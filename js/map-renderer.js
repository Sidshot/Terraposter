/**
 * Terraposter - Map Renderer
 * Canvas-based rendering engine for map posters
 */

import { getTheme } from './themes.js';

// Poster size presets (width x height in pixels for HD export - 4K resolution)
export const POSTER_SIZES = {
    portrait: { width: 4000, height: 5333, label: 'Portrait (3:4)' },
    square: { width: 4000, height: 4000, label: 'Square (1:1)' },
    landscape: { width: 5333, height: 4000, label: 'Landscape (4:3)' }
};

// Road type to width mapping (relative scale)
const ROAD_WIDTHS = {
    motorway: 4.0,
    motorway_link: 3.0,
    trunk: 3.5,
    trunk_link: 2.5,
    primary: 3.0,
    primary_link: 2.0,
    secondary: 2.5,
    secondary_link: 1.8,
    tertiary: 2.0,
    tertiary_link: 1.5,
    residential: 1.2,
    living_street: 1.0,
    unclassified: 1.0,
    default: 1.0
};

/**
 * Get road color based on type and theme
 */
function getRoadColor(type, theme) {
    const roads = theme.roads;

    if (type.includes('motorway')) return roads.motorway;
    if (type.includes('trunk') || type.includes('primary')) return roads.primary;
    if (type.includes('secondary')) return roads.secondary;
    if (type.includes('tertiary')) return roads.tertiary;
    if (type.includes('residential') || type === 'living_street') return roads.residential;
    return roads.default;
}

/**
 * Get road width based on type
 */
function getRoadWidth(type, baseWidth) {
    const width = ROAD_WIDTHS[type] || ROAD_WIDTHS.default;
    return width * baseWidth;
}

/**
 * Convert lat/lon to canvas coordinates
 */
function latLonToCanvas(lat, lon, bounds, canvasWidth, canvasHeight, padding) {
    const effectiveWidth = canvasWidth - (padding * 2);
    const effectiveHeight = canvasHeight - (padding * 2);

    const x = padding + ((lon - bounds.west) / (bounds.east - bounds.west)) * effectiveWidth;
    const y = padding + ((bounds.north - lat) / (bounds.north - bounds.south)) * effectiveHeight;

    return { x, y };
}

/**
 * Draw a gradient fade overlay
 */
function drawGradientFade(ctx, width, height, color, location) {
    const gradient = ctx.createLinearGradient(0, 0, 0, height);

    if (location === 'top') {
        gradient.addColorStop(0, color);
        gradient.addColorStop(0.25, hexToRgba(color, 0));
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height * 0.25);
    } else {
        gradient.addColorStop(0.75, hexToRgba(color, 0));
        gradient.addColorStop(1, color);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, height * 0.75, width, height * 0.25);
    }
}

/**
 * Convert hex color to rgba
 */
function hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Format coordinates for display
 */
function formatCoordinates(lat, lon) {
    const latDir = lat >= 0 ? 'N' : 'S';
    const lonDir = lon >= 0 ? 'E' : 'W';
    return `${Math.abs(lat).toFixed(4)}° ${latDir} / ${Math.abs(lon).toFixed(4)}° ${lonDir}`;
}

/**
 * Space out letters in a string
 */
function spaceLetters(str, spacing = 2) {
    return str.split('').join(' '.repeat(spacing));
}

/**
 * Main render function
 * @param {HTMLCanvasElement} canvas - Canvas element to render to
 * @param {Object} mapData - Map data from Overpass
 * @param {Object} locationInfo - City, country, lat, lon
 * @param {string} themeName - Theme name
 * @param {string} sizeName - Size preset name
 * @param {Object} customText - Custom text options {title, subtitle, name}
 * @param {function} onProgress - Progress callback
 */
export async function renderPoster(canvas, mapData, locationInfo, themeName, sizeName, customText = {}, onProgress = () => { }) {
    const theme = getTheme(themeName);
    const size = POSTER_SIZES[sizeName] || POSTER_SIZES.portrait;

    // Set canvas size
    canvas.width = size.width;
    canvas.height = size.height;

    const ctx = canvas.getContext('2d');
    const { width, height } = canvas;

    // Calculate padding and base road width
    const padding = width * 0.05;
    const baseRoadWidth = width / 800;

    const { roads, water, parks, bounds } = mapData;
    const { city, country, lat, lon } = locationInfo;

    onProgress('Rendering background...');

    // 1. Draw background
    ctx.fillStyle = theme.bg;
    ctx.fillRect(0, 0, width, height);

    await sleep(10);
    onProgress('Rendering water...');

    // 2. Draw water bodies
    ctx.fillStyle = theme.water;
    ctx.strokeStyle = theme.water;
    ctx.lineWidth = 1;

    for (const feature of water) {
        if (feature.coordinates.length < 3) continue;

        ctx.beginPath();
        const start = latLonToCanvas(feature.coordinates[0].lat, feature.coordinates[0].lon, bounds, width, height, padding);
        ctx.moveTo(start.x, start.y);

        for (let i = 1; i < feature.coordinates.length; i++) {
            const point = latLonToCanvas(feature.coordinates[i].lat, feature.coordinates[i].lon, bounds, width, height, padding);
            ctx.lineTo(point.x, point.y);
        }

        ctx.closePath();
        ctx.fill();
    }

    await sleep(10);
    onProgress('Rendering parks...');

    // 3. Draw parks
    ctx.fillStyle = theme.parks;

    for (const feature of parks) {
        if (feature.coordinates.length < 3) continue;

        ctx.beginPath();
        const start = latLonToCanvas(feature.coordinates[0].lat, feature.coordinates[0].lon, bounds, width, height, padding);
        ctx.moveTo(start.x, start.y);

        for (let i = 1; i < feature.coordinates.length; i++) {
            const point = latLonToCanvas(feature.coordinates[i].lat, feature.coordinates[i].lon, bounds, width, height, padding);
            ctx.lineTo(point.x, point.y);
        }

        ctx.closePath();
        ctx.fill();
    }

    await sleep(10);
    onProgress('Rendering roads...');

    // 4. Draw roads (sorted by importance - less important first)
    const roadOrder = ['unclassified', 'living_street', 'residential', 'tertiary_link', 'tertiary',
        'secondary_link', 'secondary', 'primary_link', 'primary', 'trunk_link',
        'trunk', 'motorway_link', 'motorway'];

    const sortedRoads = [...roads].sort((a, b) => {
        const aIndex = roadOrder.indexOf(a.type);
        const bIndex = roadOrder.indexOf(b.type);
        return aIndex - bIndex;
    });

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (const road of sortedRoads) {
        if (road.coordinates.length < 2) continue;

        ctx.strokeStyle = getRoadColor(road.type, theme);
        ctx.lineWidth = getRoadWidth(road.type, baseRoadWidth);

        ctx.beginPath();
        const start = latLonToCanvas(road.coordinates[0].lat, road.coordinates[0].lon, bounds, width, height, padding);
        ctx.moveTo(start.x, start.y);

        for (let i = 1; i < road.coordinates.length; i++) {
            const point = latLonToCanvas(road.coordinates[i].lat, road.coordinates[i].lon, bounds, width, height, padding);
            ctx.lineTo(point.x, point.y);
        }

        ctx.stroke();
    }

    await sleep(10);
    onProgress('Adding gradient fades...');

    // 5. Draw gradient fades
    drawGradientFade(ctx, width, height, theme.gradientColor, 'top');
    drawGradientFade(ctx, width, height, theme.gradientColor, 'bottom');

    await sleep(10);
    onProgress('Adding typography...');

    // 6. Draw typography
    ctx.textAlign = 'center';
    ctx.fillStyle = theme.text;

    // Determine what text to display
    const displayTitle = customText.title || city;
    const displaySubtitle = customText.subtitle || country;
    const displayName = customText.name || '';
    const showCoords = !customText.title; // Only show coords if no custom title

    // Calculate font sizes relative to canvas size
    const titleFontSize = Math.min(width * 0.06, calculateFontSize(displayTitle, width * 0.8));
    const subtitleFontSize = width * 0.022;
    const nameFontSize = width * 0.016;
    const coordsFontSize = width * 0.014;

    // Main title (spaced letters)
    ctx.font = `700 ${titleFontSize}px 'Roboto', sans-serif`;
    const spacedTitle = spaceLetters(displayTitle.toUpperCase());
    ctx.fillText(spacedTitle, width / 2, height * 0.86);

    // Decorative line
    ctx.strokeStyle = theme.text;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(width * 0.4, height * 0.875);
    ctx.lineTo(width * 0.6, height * 0.875);
    ctx.stroke();

    // Subtitle (country or custom)
    ctx.font = `300 ${subtitleFontSize}px 'Roboto', sans-serif`;
    ctx.fillText(displaySubtitle.toUpperCase(), width / 2, height * 0.90);

    // Coordinates (only if no custom title)
    if (showCoords) {
        ctx.globalAlpha = 0.7;
        ctx.font = `400 ${coordsFontSize}px 'Roboto', sans-serif`;
        ctx.fillText(formatCoordinates(lat, lon), width / 2, height * 0.93);
        ctx.globalAlpha = 1;
    }

    // Custom name (if provided)
    if (displayName) {
        ctx.globalAlpha = 0.6;
        ctx.font = `400 ${nameFontSize}px 'Roboto', sans-serif`;
        const nameY = showCoords ? height * 0.955 : height * 0.93;
        ctx.fillText(displayName, width / 2, nameY);
        ctx.globalAlpha = 1;
    }

    // Attribution
    ctx.globalAlpha = 0.5;
    ctx.textAlign = 'right';
    ctx.font = `300 ${width * 0.008}px 'Roboto', sans-serif`;
    ctx.fillText('© OpenStreetMap contributors', width * 0.98, height * 0.98);
    ctx.globalAlpha = 1;

    onProgress('Done!');

    return canvas;
}

/**
 * Calculate optimal font size for title
 */
function calculateFontSize(text, maxWidth) {
    const spacedText = spaceLetters(text.toUpperCase());
    const charCount = spacedText.length;
    const approxSize = maxWidth / (charCount * 0.6);
    return Math.max(approxSize, 24);
}

/**
 * Export canvas as PNG blob
 */
export function exportToPNG(canvas) {
    return new Promise((resolve) => {
        canvas.toBlob(resolve, 'image/png', 1.0);
    });
}

/**
 * Trigger download of poster
 */
export async function downloadPoster(canvas, name, theme) {
    const blob = await exportToPNG(canvas);
    const url = URL.createObjectURL(blob);

    const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 15);
    const filename = `${name.toLowerCase().replace(/\s+/g, '_')}_${theme}_${timestamp}.png`;

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    URL.revokeObjectURL(url);
}

/**
 * Render preview (smaller size for display canvas)
 */
export async function renderPreview(canvas, mapData, locationInfo, themeName, sizeName, customText, displayWidth, onProgress) {
    const size = POSTER_SIZES[sizeName] || POSTER_SIZES.portrait;
    const aspectRatio = size.width / size.height;

    // Set preview canvas size
    canvas.width = displayWidth;
    canvas.height = displayWidth / aspectRatio;

    // Render at smaller size for preview
    const tempCanvas = document.createElement('canvas');
    const previewSize = {
        width: 800,
        height: 800 / aspectRatio
    };
    tempCanvas.width = previewSize.width;
    tempCanvas.height = previewSize.height;

    // Temporarily modify POSTER_SIZES for preview rendering
    const originalSize = POSTER_SIZES[sizeName];
    POSTER_SIZES[sizeName] = previewSize;

    await renderPoster(tempCanvas, mapData, locationInfo, themeName, sizeName, customText, onProgress);

    // Restore original size
    POSTER_SIZES[sizeName] = originalSize;

    // Draw scaled preview
    const ctx = canvas.getContext('2d');
    ctx.drawImage(tempCanvas, 0, 0, canvas.width, canvas.height);

    return canvas;
}

/**
 * Utility sleep function
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
