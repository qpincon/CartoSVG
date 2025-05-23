import type { Feature, Polygon } from "geojson";

/**
 * Generates a GeoJSON polygon representing a rectangle with rounded corners
 * @param {number} width - Width of the rectangle
 * @param {number} height - Height of the rectangle
 * @param {number} cornerRadius - Radius of the corner rounding
 * @param {number} [center_x=0] - X coordinate of the rectangle center (default: 0)
 * @param {number} [center_y=0] - Y coordinate of the rectangle center (default: 0)
 * @param {number} [segments=8] - Number of segments to use for each rounded corner (default: 8)
 * @returns {Object} GeoJSON polygon object
 */
export function createRoundedRectangleGeoJSON(width: number, height: number, cornerRadius: number, center_x = width / 2, center_y = height / 2, segments = 16): Feature<Polygon> {
    // Validate inputs
    if (width <= 0 || height <= 0) {
        throw new Error('Width and height must be positive numbers');
    }

    if (cornerRadius < 0) {
        throw new Error('Corner radius must be non-negative');
    }

    // Limit corner radius to half the minimum dimension
    const maxRadius = Math.min(width / 2, height / 2);
    cornerRadius = Math.min(cornerRadius, maxRadius);

    // Calculate rectangle boundaries
    const halfWidth = width / 2;
    const halfHeight = height / 2;

    // Initialize coordinates array - this will store our polygon points
    const coordinates = [];

    // TOP RIGHT CORNER
    const trX = center_x + halfWidth - cornerRadius; // center X of the arc
    const trY = center_y + halfHeight - cornerRadius; // center Y of the arc

    for (let i = 0; i <= segments; i++) {
        const angle = Math.PI * 0 + (Math.PI / 2) * (i / segments); // 0 to π/2
        const x = trX + cornerRadius * Math.cos(angle);
        const y = trY + cornerRadius * Math.sin(angle);
        coordinates.push([x, y]);
    }

    // TOP LEFT CORNER
    const tlX = center_x - halfWidth + cornerRadius;
    const tlY = center_y + halfHeight - cornerRadius;

    for (let i = 0; i <= segments; i++) {
        const angle = Math.PI * 0.5 + (Math.PI / 2) * (i / segments); // π/2 to π
        const x = tlX + cornerRadius * Math.cos(angle);
        const y = tlY + cornerRadius * Math.sin(angle);
        coordinates.push([x, y]);
    }

    // BOTTOM LEFT CORNER
    const blX = center_x - halfWidth + cornerRadius;
    const blY = center_y - halfHeight + cornerRadius;

    for (let i = 0; i <= segments; i++) {
        const angle = Math.PI * 1.0 + (Math.PI / 2) * (i / segments); // π to 3π/2
        const x = blX + cornerRadius * Math.cos(angle);
        const y = blY + cornerRadius * Math.sin(angle);
        coordinates.push([x, y]);
    }

    // BOTTOM RIGHT CORNER
    const brX = center_x + halfWidth - cornerRadius;
    const brY = center_y - halfHeight + cornerRadius;

    for (let i = 0; i <= segments; i++) {
        const angle = Math.PI * 1.5 + (Math.PI / 2) * (i / segments); // 3π/2 to 2π
        const x = brX + cornerRadius * Math.cos(angle);
        const y = brY + cornerRadius * Math.sin(angle);
        coordinates.push([x, y]);
    }

    // Close the polygon by repeating the first point
    coordinates.push([...coordinates[0]]);

    // Create GeoJSON polygon
    return {
        type: "Feature",
        geometry: {
            type: "Polygon",
            coordinates: [coordinates]
        },
        properties: {
            width: width,
            height: height,
            cornerRadius: cornerRadius
        }
    };
}
