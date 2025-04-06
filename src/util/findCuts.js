/**
 * Detects horizontal and vertical cuts in GeoJSON Polygon geometries
 * A cut is identified as a lat/lon where multiple polygons are perfectly aligned
 * horizontally or vertically across that coordinate
 * More precisely, a vertical / horizontal segment is a cut if:
 * - it is perfectly hotirzontal / vertical
 * - it is shared amont multiple features OR
 * - its extent is significant relative to the geometry it belongs to
 */
function detectPolygonCuts(polygons) {
    // Store all horizontal and vertical segments
    const horizontalSegments = new Map(); // key: latitude, value: array of [minLon, maxLon]
    const verticalSegments = new Map();   // key: longitude, value: array of [minLat, maxLat]

    // Process only Polygon features
    for (const feature of polygons) {
        extractPolygonSegments(feature, horizontalSegments, verticalSegments);
    }

    console.log('horizontalSegments', horizontalSegments);
    console.log('verticalSegments', verticalSegments);
    // Find potential cuts
    const horizontalCuts = findCuts(horizontalSegments);
    const verticalCuts = findCuts(verticalSegments);

    return {
        horizontalCuts, // Array of latitudes that represent horizontal cuts
        verticalCuts    // Array of longitudes that represent vertical cuts
    };
}

/**
 * Extract horizontal and vertical segments from a polygon
 */
function extractPolygonSegments(feature, horizontalSegments, verticalSegments) {
    // Process each ring of the polygon (outer ring and holes)
    for (const ring of feature.geometry.coordinates) {
        // Need at least 2 points to form a segment
        if (ring.length < 2) continue;

        // Process each segment in the ring
        for (let i = 0; i < ring.length - 1; i++) {
            const [lon1, lat1] = ring[i];
            const [lon2, lat2] = ring[i + 1];
            // Check if segment is horizontal (same latitude)
            checkSegmentHorizontal(horizontalSegments, lon1, lat1, lon2, lat2);
            // Check if segment is vertical (same longitude)
            checkSegmentVertical(verticalSegments, lon1, lat1, lon2, lat2);
        }

        // Don't forget to check the segment between last and first points (closing the ring)
        const [lon1, lat1] = ring[ring.length - 1];
        const [lon2, lat2] = ring[0];
        // Check if segment is horizontal (same latitude)
        checkSegmentHorizontal(horizontalSegments, lon1, lat1, lon2, lat2);
        // Check if segment is vertical (same longitude)
        checkSegmentVertical(verticalSegments, lon1, lat1, lon2, lat2);
    }
}

function checkSegmentHorizontal(horizontalSegments, lon1, lat1, lon2, lat2) {
    if (Math.abs(lat1 - lat2) < Number.EPSILON) {
        const latitude = lat1;
        const minLon = Math.min(lon1, lon2);
        const maxLon = Math.max(lon1, lon2);

        if (!horizontalSegments.has(latitude)) {
            horizontalSegments.set(latitude, []);
        }
        horizontalSegments.get(latitude).push([minLon, maxLon]);
    }
}
function checkSegmentVertical(verticalSegments, lon1, lat1, lon2, lat2) {
    if (Math.abs(lon1 - lon2) < Number.EPSILON) {
        const longitude = lon1;
        const minLat = Math.min(lat1, lat2);
        const maxLat = Math.max(lat1, lat2);

        if (!verticalSegments.has(longitude)) {
            verticalSegments.set(longitude, []);
        }
        verticalSegments.get(longitude).push([minLat, maxLat]);
    }
}

/**
 * Find cuts by analyzing segments along a specific coordinate
 */
function findCuts(segmentsMap) {
    const cuts = [];

    for (const [coordinate, segments] of segmentsMap.entries()) {
        // Skip if there are fewer than 2 segments (need multiple segments for a cut)
        if (segments.length < 2) continue;

        // Sort segments by their start position
        segments.sort((a, b) => a[0] - b[0]);

        // Look for sequences of segments that form a continuous line
        // This is a simplification - we're looking for at least two segments along the same coordinate
        cuts.push(parseFloat(coordinate));
    }

    return cuts;
}

// Usage example
export function findPolygonCuts(geoJSON) {
    const potentialCuts = detectPolygonCuts(geoJSON);
    console.log('potentialCuts', potentialCuts);
    
}
