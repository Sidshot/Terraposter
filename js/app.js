/**
 * Terraposter - Main Application
 * Orchestrates the entire map poster generation flow
 */

import { themes, getThemeNames, getTheme } from './themes.js';
import { searchCity, reverseGeocode, fetchMapData, getCurrentLocation } from './data-fetcher.js';
import { renderPreview, renderPoster, downloadPoster, exportToPNG, POSTER_SIZES } from './map-renderer.js';

// Application State
const state = {
    currentLocation: null,
    locationInfo: null,
    mapData: null,
    selectedTheme: 'noir',
    selectedSize: 'portrait',
    radius: 10000,
    isLoading: false,
    isReady: false,
    lastBlob: null,
    // Custom text options (saved on "Apply")
    customText: {
        title: '',
        subtitle: '',
        name: ''
    }
};

// DOM Elements
const elements = {
    posterCanvas: document.getElementById('posterCanvas'),
    posterFrame: document.getElementById('posterFrame'),
    loadingOverlay: document.getElementById('loadingOverlay'),
    loaderText: document.getElementById('loaderText'),
    useLocationBtn: document.getElementById('useLocationBtn'),
    citySearch: document.getElementById('citySearch'),
    searchBtn: document.getElementById('searchBtn'),
    locationInfo: document.getElementById('locationInfo'),
    themeGrid: document.getElementById('themeGrid'),
    sizeOptions: document.getElementById('sizeOptions'),
    radiusSlider: document.getElementById('radiusSlider'),
    radiusValue: document.getElementById('radiusValue'),
    downloadBtn: document.getElementById('downloadBtn'),
    // Custom text inputs
    customTitle: document.getElementById('customTitle'),
    customSubtitle: document.getElementById('customSubtitle'),
    customName: document.getElementById('customName'),
    applyTextBtn: document.getElementById('applyTextBtn'),
    // Share buttons
    shareTwitter: document.getElementById('shareTwitter'),
    shareInstagram: document.getElementById('shareInstagram'),
    shareReddit: document.getElementById('shareReddit'),
    shareWhatsApp: document.getElementById('shareWhatsApp'),
    shareTelegram: document.getElementById('shareTelegram'),
    shareCopy: document.getElementById('shareCopy'),
    toast: document.getElementById('toast')
};

/**
 * Initialize the application
 */
async function init() {
    console.log('Terraposter initialized');

    // Populate theme grid
    populateThemes();

    // Set up event listeners
    setupEventListeners();

    // Initial state
    showLoading('Search for a city to get started');
}

/**
 * Populate the theme selection grid
 */
function populateThemes() {
    const themeNames = getThemeNames();

    elements.themeGrid.innerHTML = themeNames.map(name => {
        const theme = getTheme(name);
        const isActive = name === state.selectedTheme;

        return `
            <button class="theme-btn ${isActive ? 'active' : ''}" data-theme="${name}" title="${theme.name}">
                <div class="theme-preview">
                    <div class="theme-bg" style="background: ${theme.bg}; flex: 1;"></div>
                    <div class="theme-roads" style="background: ${theme.roads.motorway};"></div>
                    <div class="theme-roads" style="background: ${theme.roads.secondary};"></div>
                </div>
                <span class="theme-name">${name.replace(/_/g, ' ')}</span>
            </button>
        `;
    }).join('');
}

/**
 * Set up all event listeners
 */
function setupEventListeners() {
    // Use location button
    elements.useLocationBtn.addEventListener('click', handleUseLocation);

    // Search functionality
    elements.searchBtn.addEventListener('click', handleSearch);
    elements.citySearch.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleSearch();
    });

    // Apply text changes button
    elements.applyTextBtn.addEventListener('click', handleApplyText);

    // Theme selection
    elements.themeGrid.addEventListener('click', (e) => {
        const btn = e.target.closest('.theme-btn');
        if (btn) {
            const theme = btn.dataset.theme;
            selectTheme(theme);
        }
    });

    // Size selection
    elements.sizeOptions.addEventListener('click', (e) => {
        const btn = e.target.closest('.size-btn');
        if (btn) {
            const size = btn.dataset.size;
            selectSize(size);
        }
    });

    // Radius slider
    elements.radiusSlider.addEventListener('input', handleRadiusChange);
    elements.radiusSlider.addEventListener('change', handleRadiusChangeComplete);

    // Download button
    elements.downloadBtn.addEventListener('click', handleDownload);

    // Share buttons
    elements.shareTwitter.addEventListener('click', () => shareToTwitter());
    elements.shareInstagram.addEventListener('click', () => shareToInstagram());
    elements.shareReddit.addEventListener('click', () => shareToReddit());
    elements.shareWhatsApp.addEventListener('click', () => shareToWhatsApp());
    elements.shareTelegram.addEventListener('click', () => shareToTelegram());
    elements.shareCopy.addEventListener('click', () => copyImageToClipboard());
}

/**
 * Handle "Apply Changes" button click - saves custom text and re-renders
 */
function handleApplyText() {
    state.customText = {
        title: elements.customTitle.value.trim(),
        subtitle: elements.customSubtitle.value.trim(),
        name: elements.customName.value.trim()
    };

    state.lastBlob = null; // Clear cached blob since text changed

    if (state.isReady) {
        showToast('Changes applied!');
        renderMap();
    } else {
        showToast('Enter a location first, then apply changes');
    }
}

/**
 * Handle "Use My Location" button click
 */
async function handleUseLocation() {
    if (state.isLoading) return;

    showLoading('Detecting your location...');

    try {
        const coords = await getCurrentLocation();
        state.currentLocation = coords;

        showLoading('Getting city information...');
        const info = await reverseGeocode(coords.lat, coords.lon);

        state.locationInfo = {
            ...info,
            lat: coords.lat,
            lon: coords.lon
        };

        updateLocationDisplay();
        await loadMapData();

    } catch (error) {
        console.error('Location error:', error);
        showLoading(`Error: ${error.message}`);
        elements.locationInfo.textContent = `Error: ${error.message}`;
    }
}

/**
 * Handle search button click
 */
async function handleSearch() {
    const query = elements.citySearch.value.trim();
    if (!query || state.isLoading) return;

    showLoading(`Searching for "${query}"...`);

    try {
        const result = await searchCity(query);

        state.currentLocation = { lat: result.lat, lon: result.lon };
        state.locationInfo = {
            city: result.city,
            country: result.country,
            lat: result.lat,
            lon: result.lon
        };

        updateLocationDisplay();
        await loadMapData();

    } catch (error) {
        console.error('Search error:', error);
        showLoading(`Error: ${error.message}`);
        elements.locationInfo.textContent = `City not found. Try another search.`;
    }
}

/**
 * Load map data from Overpass API
 */
async function loadMapData() {
    if (!state.currentLocation) return;

    showLoading('Fetching map data...');

    try {
        const mapData = await fetchMapData(
            state.currentLocation.lat,
            state.currentLocation.lon,
            state.radius,
            (msg) => showLoading(msg)
        );

        state.mapData = mapData;
        state.isReady = true;

        // Enable buttons
        enableButtons(true);

        // Render preview
        await renderMap();

    } catch (error) {
        console.error('Map data error:', error);
        showLoading(`Error loading map: ${error.message}`);
    }
}

/**
 * Render the map preview
 */
async function renderMap() {
    if (!state.mapData || !state.locationInfo) return;

    showLoading('Rendering map...');

    try {
        // Get display width from poster frame
        const frameWidth = elements.posterFrame.clientWidth;

        await renderPreview(
            elements.posterCanvas,
            state.mapData,
            state.locationInfo,
            state.selectedTheme,
            state.selectedSize,
            state.customText,
            frameWidth,
            (msg) => showLoading(msg)
        );

        hideLoading();

    } catch (error) {
        console.error('Render error:', error);
        showLoading(`Render error: ${error.message}`);
    }
}

/**
 * Select a theme
 */
function selectTheme(themeName) {
    state.selectedTheme = themeName;
    state.lastBlob = null; // Clear cached blob

    // Update UI
    document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.theme === themeName);
    });

    // Re-render if ready
    if (state.isReady) {
        renderMap();
    }
}

/**
 * Select a size
 */
function selectSize(sizeName) {
    state.selectedSize = sizeName;
    state.lastBlob = null; // Clear cached blob

    // Update UI
    document.querySelectorAll('.size-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.size === sizeName);
    });

    // Update poster frame aspect ratio
    const size = POSTER_SIZES[sizeName];
    elements.posterFrame.style.aspectRatio = `${size.width}/${size.height}`;

    // Re-render if ready
    if (state.isReady) {
        renderMap();
    }
}

/**
 * Handle radius slider change (live update display)
 */
function handleRadiusChange(e) {
    const value = parseInt(e.target.value);
    state.radius = value;
    elements.radiusValue.textContent = `${Math.round(value / 1000)} km`;
}

/**
 * Handle radius slider change complete (reload data)
 */
async function handleRadiusChangeComplete(e) {
    if (state.currentLocation) {
        state.lastBlob = null; // Clear cached blob
        await loadMapData();
    }
}

/**
 * Handle download button click
 */
async function handleDownload() {
    if (!state.mapData || !state.locationInfo) return;

    showLoading('Generating HD poster...');
    elements.downloadBtn.disabled = true;

    try {
        // Create a temporary canvas for full-resolution rendering
        const exportCanvas = document.createElement('canvas');

        await renderPoster(
            exportCanvas,
            state.mapData,
            state.locationInfo,
            state.selectedTheme,
            state.selectedSize,
            state.customText,
            (msg) => showLoading(msg)
        );

        showLoading('Preparing download...');

        // Store blob for sharing
        state.lastBlob = await exportToPNG(exportCanvas);

        // Generate filename
        const name = state.customText.title || state.locationInfo.city;
        await downloadPoster(exportCanvas, name, state.selectedTheme);

        hideLoading();
        showToast('HD poster downloaded!');

    } catch (error) {
        console.error('Download error:', error);
        showLoading(`Download error: ${error.message}`);
    } finally {
        elements.downloadBtn.disabled = false;
    }
}

/**
 * Enable/disable action buttons
 */
function enableButtons(enabled) {
    elements.downloadBtn.disabled = !enabled;
    elements.shareTwitter.disabled = !enabled;
    elements.shareInstagram.disabled = !enabled;
    elements.shareReddit.disabled = !enabled;
    elements.shareWhatsApp.disabled = !enabled;
    elements.shareTelegram.disabled = !enabled;
    elements.shareCopy.disabled = !enabled;
}

/**
 * Share to Twitter/X
 */
function shareToTwitter() {
    const name = state.customText.title || `${state.locationInfo.city}, ${state.locationInfo.country}`;
    const text = encodeURIComponent(`Check out my ${name} map poster! Created with Terraposter`);
    const url = encodeURIComponent('https://sidshot.github.io/Terraposter');
    window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, '_blank', 'width=600,height=400');
}

/**
 * Share to Instagram (copy image + show instructions)
 */
async function shareToInstagram() {
    await copyImageToClipboard();
    showToast('Image copied! Open Instagram and paste in a new post.');
}

/**
 * Share to Reddit
 */
function shareToReddit() {
    const name = state.customText.title || `${state.locationInfo.city}, ${state.locationInfo.country}`;
    const title = encodeURIComponent(`${name} map poster - Created with Terraposter`);
    const url = encodeURIComponent('https://sidshot.github.io/Terraposter');
    window.open(`https://www.reddit.com/submit?title=${title}&url=${url}`, '_blank');
}

/**
 * Share to WhatsApp
 */
function shareToWhatsApp() {
    const name = state.customText.title || `${state.locationInfo.city}, ${state.locationInfo.country}`;
    const text = encodeURIComponent(`Check out my ${name} map poster!\n\nCreate yours free: https://sidshot.github.io/Terraposter`);
    window.open(`https://wa.me/?text=${text}`, '_blank');
}

/**
 * Share to Telegram
 */
function shareToTelegram() {
    const name = state.customText.title || `${state.locationInfo.city}, ${state.locationInfo.country}`;
    const text = encodeURIComponent(`Check out my ${name} map poster!`);
    const url = encodeURIComponent('https://sidshot.github.io/Terraposter');
    window.open(`https://t.me/share/url?url=${url}&text=${text}`, '_blank');
}

/**
 * Copy image to clipboard
 */
async function copyImageToClipboard() {
    try {
        // Generate full-size image if needed
        if (!state.lastBlob) {
            showLoading('Preparing HD image...');

            const exportCanvas = document.createElement('canvas');
            await renderPoster(
                exportCanvas,
                state.mapData,
                state.locationInfo,
                state.selectedTheme,
                state.selectedSize,
                state.customText,
                () => { }
            );

            state.lastBlob = await exportToPNG(exportCanvas);
            hideLoading();
        }

        // Try to use Clipboard API
        if (navigator.clipboard && navigator.clipboard.write) {
            await navigator.clipboard.write([
                new ClipboardItem({
                    'image/png': state.lastBlob
                })
            ]);
            showToast('HD image copied to clipboard!');
        } else {
            showToast('Clipboard not supported. Downloading instead...');
            handleDownload();
        }
    } catch (error) {
        console.error('Copy error:', error);
        showToast('Could not copy. Try downloading instead.');
    }
}

/**
 * Update location display in UI
 */
function updateLocationDisplay() {
    if (state.locationInfo) {
        const { city, country } = state.locationInfo;
        elements.locationInfo.textContent = `${city}, ${country}`;
        elements.citySearch.value = `${city}, ${country}`;
    }
}

/**
 * Show loading overlay with message
 */
function showLoading(message) {
    elements.loaderText.textContent = message;
    elements.loadingOverlay.classList.remove('hidden');
}

/**
 * Hide loading overlay
 */
function hideLoading() {
    elements.loadingOverlay.classList.add('hidden');
}

/**
 * Show toast notification
 */
function showToast(message) {
    elements.toast.textContent = message;
    elements.toast.classList.add('show');

    setTimeout(() => {
        elements.toast.classList.remove('show');
    }, 3000);
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', init);
