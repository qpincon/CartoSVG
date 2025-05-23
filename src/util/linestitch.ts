import type { Feature, LineString, GeoJsonProperties, Position } from "geojson";

const PRECISION = 7;

/**
 * Merges GeoJSON LineString Features that share their first or last points
 * with optimized O(n) performance using an endpoint index
 */
export function mergeLineStrings(features: Array<Feature<LineString>>): Array<Feature<LineString>> {
    if (!features || features.length === 0) {
        return [];
    }

    // Validate and extract LineStrings
    const validFeatures = features.filter(feature =>
        feature &&
        feature.geometry &&
        feature.geometry.type === 'LineString' &&
        Array.isArray(feature.geometry.coordinates) &&
        feature.geometry.coordinates.length > 0
    );

    if (validFeatures.length === 0) {
        return [];
    }

    // Helper function to create a string key from a point
    const pointToKey = (point: Position): string => {
        return `${point[0].toFixed(PRECISION)},${point[1].toFixed(PRECISION)}`;
    };

    // Create an index of endpoints to LineString features
    const endpointIndex = new Map<string, Array<{ index: number; isFirst: boolean }>>();

    // Initialize with all features
    const result: Array<Feature<LineString> | null> = [...validFeatures];

    // Build the initial endpoint index
    for (let i = 0; i < result.length; i++) {
        const feature = result[i]!;
        const coords = feature.geometry.coordinates;
        const firstPoint = coords[0];
        const lastPoint = coords[coords.length - 1];

        const firstKey = pointToKey(firstPoint);
        const lastKey = pointToKey(lastPoint);

        // Add endpoints to index
        if (!endpointIndex.has(firstKey)) {
            endpointIndex.set(firstKey, []);
        }
        endpointIndex.get(firstKey)!.push({ index: i, isFirst: true });

        if (!endpointIndex.has(lastKey)) {
            endpointIndex.set(lastKey, []);
        }
        endpointIndex.get(lastKey)!.push({ index: i, isFirst: false });
    }

    // Helper function to merge two LineString Features
    const mergeTwoFeatures = (
        feature1: Feature<LineString>,
        feature2: Feature<LineString>,
        connect1IsFirst: boolean,
        connect2IsFirst: boolean
    ): Feature<LineString> => {
        const coords1 = feature1.geometry.coordinates;
        const coords2 = feature2.geometry.coordinates;
        let mergedCoords: Position[] = [];

        // Handle different connection scenarios
        if (connect1IsFirst && connect2IsFirst) {
            const reversedCoords1 = [...coords1].reverse();
            mergedCoords = [...reversedCoords1, ...coords2.slice(1)];
        } else if (connect1IsFirst && !connect2IsFirst) {
            mergedCoords = [...coords2, ...coords1.slice(1)];
        } else if (!connect1IsFirst && connect2IsFirst) {
            mergedCoords = [...coords1, ...coords2.slice(1)];
        } else {
            const reversedCoords2 = [...coords2].reverse();
            mergedCoords = [...coords1, ...reversedCoords2.slice(1)];
        }

        // Create a new merged feature with combined properties
        const mergedFeature: Feature<LineString> = {
            type: "Feature",
            geometry: {
                type: "LineString",
                coordinates: mergedCoords
            },
            properties: {
                ...feature1.properties,
                ...feature2.properties,
                merged: true
            } as GeoJsonProperties
        };

        return mergedFeature;
    };

    // Function to update the index after merging
    const updateIndexAfterMerge = (newFeature: Feature<LineString>, replacedIndices: number[]): void => {
        // Remove the replaced features from our endpoint index
        replacedIndices.forEach(idx => {
            const feature = result[idx]!;
            const coords = feature.geometry.coordinates;
            const firstPoint = coords[0];
            const lastPoint = coords[coords.length - 1];

            const firstKey = pointToKey(firstPoint);
            const lastKey = pointToKey(lastPoint);

            // Filter out the references to the replaced features
            if (endpointIndex.has(firstKey)) {
                endpointIndex.set(
                    firstKey,
                    endpointIndex.get(firstKey)!.filter(entry => !replacedIndices.includes(entry.index))
                );
                if (endpointIndex.get(firstKey)!.length === 0) {
                    endpointIndex.delete(firstKey);
                }
            }

            if (endpointIndex.has(lastKey)) {
                endpointIndex.set(
                    lastKey,
                    endpointIndex.get(lastKey)!.filter(entry => !replacedIndices.includes(entry.index))
                );
                if (endpointIndex.get(lastKey)!.length === 0) {
                    endpointIndex.delete(lastKey);
                }
            }
        });

        // Add the new feature to our index
        const newIndex = result.length - 1;
        const newCoords = newFeature.geometry.coordinates;
        const newFirstPoint = newCoords[0];
        const newLastPoint = newCoords[newCoords.length - 1];

        const newFirstKey = pointToKey(newFirstPoint);
        const newLastKey = pointToKey(newLastPoint);

        if (!endpointIndex.has(newFirstKey)) {
            endpointIndex.set(newFirstKey, []);
        }
        endpointIndex.get(newFirstKey)!.push({ index: newIndex, isFirst: true });

        if (!endpointIndex.has(newLastKey)) {
            endpointIndex.set(newLastKey, []);
        }
        endpointIndex.get(newLastKey)!.push({ index: newIndex, isFirst: false });
    };

    // Process all features and merge where possible
    let mergeFound = true;
    while (mergeFound) {
        mergeFound = false;

        for (let i = 0; i < result.length; i++) {
            const feature = result[i];
            if (!feature) continue;

            const coords = feature.geometry.coordinates;
            const firstPoint = coords[0];
            const lastPoint = coords[coords.length - 1];

            // Check for connections at the first point
            const firstPointKey = pointToKey(firstPoint);
            const connectionsAtFirst = endpointIndex.get(firstPointKey) || [];

            for (const connection of connectionsAtFirst) {
                if (connection.index === i) continue;

                const otherFeature = result[connection.index];
                if (!otherFeature) continue;

                mergeFound = true;

                const mergedFeature = mergeTwoFeatures(
                    feature,
                    otherFeature,
                    true,
                    connection.isFirst
                );

                result.push(mergedFeature);
                updateIndexAfterMerge(mergedFeature, [i, connection.index]);
                result[i] = null;
                result[connection.index] = null;

                break;
            }

            if (mergeFound) break;

            // Check for connections at the last point
            const lastPointKey = pointToKey(lastPoint);
            const connectionsAtLast = endpointIndex.get(lastPointKey) || [];

            for (const connection of connectionsAtLast) {
                if (connection.index === i) continue;

                const otherFeature = result[connection.index];
                if (!otherFeature) continue;

                mergeFound = true;

                const mergedFeature = mergeTwoFeatures(
                    feature,
                    otherFeature,
                    false,
                    connection.isFirst
                );

                result.push(mergedFeature);
                updateIndexAfterMerge(mergedFeature, [i, connection.index]);
                result[i] = null;
                result[connection.index] = null;

                break;
            }

            if (mergeFound) break;
        }
    }

    return result.filter(feature => feature !== null) as Array<Feature<LineString>>;
}