/**
 * MapToPoster - Data Fetcher
 * Handles all API calls to Nominatim and Overpass
 */

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org';
const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

/**
 * Search for a city and get its coordinates
 * @param {string} query - City name to search
 * @returns {Promise<{lat: number, lon: number, displayName: string, city: string, country: string}>}
 */
export async function searchCity(query) {
    const response = await fetch(
        `${NOMINATIM_URL}/search?q=${encodeURIComponent(query)}&format=json&limit=1&addressdetails=1`,
        {
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'MapToPoster/1.0'
            }
        }
    );

    if (!response.ok) {
        throw new Error('Failed to search city');
    }

    const data = await response.json();

    if (data.length === 0) {
        throw new Error('City not found');
    }

    const result = data[0];
    const address = result.address || {};

    return {
        lat: parseFloat(result.lat),
        lon: parseFloat(result.lon),
        displayName: result.display_name,
        city: address.city || address.town || address.village || address.municipality || result.name,
        country: address.country || ''
    };
}

/**
 * Reverse geocode coordinates to get city/country info
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @returns {Promise<{city: string, country: string, displayName: string}>}
 */
export async function reverseGeocode(lat, lon) {
    const response = await fetch(
        `${NOMINATIM_URL}/reverse?lat=${lat}&lon=${lon}&format=json&addressdetails=1`,
        {
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'MapToPoster/1.0'
            }
        }
    );

    if (!response.ok) {
        throw new Error('Failed to reverse geocode');
    }

    const data = await response.json();
    const address = data.address || {};

    return {
        city: address.city || address.town || address.village || address.municipality || address.county || 'Unknown',
        country: address.country || '',
        displayName: data.display_name || ''
    };
}

/**
 * Build Overpass QL query for map data
 * @param {number} lat - Center latitude
 * @param {number} lon - Center longitude
 * @param {number} radius - Radius in meters
 * @returns {string} Overpass QL query
 */
function buildOverpassQuery(lat, lon, radius) {
    // Convert radius to bounding box
    const latDelta = radius / 111320; // Approximate meters per degree latitude
    const lonDelta = radius / (111320 * Math.cos(lat * Math.PI / 180));

    const south = lat - latDelta;
    const north = lat + latDelta;
    const west = lon - lonDelta;
    const east = lon + lonDelta;

    const bbox = `${south},${west},${north},${east}`;

    return `
        [out:json][timeout:60];
        (
            // Roads
            way["highway"~"motorway|motorway_link|trunk|trunk_link|primary|primary_link|secondary|secondary_link|tertiary|tertiary_link|residential|living_street|unclassified"](${bbox});
            
            // Water
            way["natural"="water"](${bbox});
            way["waterway"~"river|riverbank|stream|canal"](${bbox});
            relation["natural"="water"](${bbox});
            
            // Parks
            way["leisure"="park"](${bbox});
            way["landuse"~"grass|forest|meadow"](${bbox});
            relation["leisure"="park"](${bbox});
        );
        out body;
        >;
        out skel qt;
    `.trim();
}

/**
 * Fetch map data from Overpass API
 * @param {number} lat - Center latitude
 * @param {number} lon - Center longitude
 * @param {number} radius - Radius in meters
 * @param {function} onProgress - Progress callback
 * @returns {Promise<{roads: Array, water: Array, parks: Array, bounds: Object}>}
 */
export async function fetchMapData(lat, lon, radius, onProgress = () => { }) {
    onProgress('Fetching map data...');

    const query = buildOverpassQuery(lat, lon, radius);

    const response = await fetch(OVERPASS_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: `data=${encodeURIComponent(query)}`
    });

    if (!response.ok) {
        throw new Error('Failed to fetch map data');
    }

    onProgress('Processing map data...');

    const data = await response.json();

    // Build node lookup table
    const nodes = {};
    for (const element of data.elements) {
        if (element.type === 'node') {
            nodes[element.id] = { lat: element.lat, lon: element.lon };
        }
    }

    // Process ways into categories
    const roads = [];
    const water = [];
    const parks = [];

    for (const element of data.elements) {
        if (element.type === 'way' && element.nodes && element.tags) {
            // Convert node IDs to coordinates
            const coordinates = element.nodes
                .filter(nodeId => nodes[nodeId])
                .map(nodeId => nodes[nodeId]);

            if (coordinates.length < 2) continue;

            const feature = {
                id: element.id,
                coordinates,
                tags: element.tags
            };

            // Categorize
            if (element.tags.highway) {
                feature.type = element.tags.highway;
                roads.push(feature);
            } else if (element.tags.natural === 'water' || element.tags.waterway) {
                water.push(feature);
            } else if (element.tags.leisure === 'park' || element.tags.landuse) {
                parks.push(feature);
            }
        }
    }

    // Calculate bounds
    const latDelta = radius / 111320;
    const lonDelta = radius / (111320 * Math.cos(lat * Math.PI / 180));

    const bounds = {
        south: lat - latDelta,
        north: lat + latDelta,
        west: lon - lonDelta,
        east: lon + lonDelta,
        center: { lat, lon },
        radius
    };

    onProgress('Map data ready!');

    return { roads, water, parks, bounds, nodes };
}

/**
 * Get user's current location
 * @returns {Promise<{lat: number, lon: number}>}
 */
export function getCurrentLocation() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error('Geolocation not supported'));
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                resolve({
                    lat: position.coords.latitude,
                    lon: position.coords.longitude
                });
            },
            (error) => {
                let message = 'Failed to get location';
                switch (error.code) {
                    case error.PERMISSION_DENIED:
                        message = 'Location permission denied';
                        break;
                    case error.POSITION_UNAVAILABLE:
                        message = 'Location unavailable';
                        break;
                    case error.TIMEOUT:
                        message = 'Location request timed out';
                        break;
                }
                reject(new Error(message));
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            }
        );
    });
}
