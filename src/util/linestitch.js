const PRECISION = 7;


function toFixed(num) {
    num = num.toString(); //If it's not already a String
    return num.slice(0, (num.indexOf(".")) + PRECISION); //With 3 exposing the hundredths place
}
/**
 * Merges GeoJSON LineString Features that share their first or last points
 * with optimized O(n) performance using an endpoint index
 * @param {Array<Object>} features - Array of GeoJSON Features with LineString geometry
 * @returns {Array<Object>} - Array of merged GeoJSON Features
 */
export function mergeLineStrings(features) {
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
    const pointToKey = (point) => {
        return `${point[0].toFixed(PRECISION)},${point[1].toFixed(PRECISION)}`;
    };

    // Create an index of endpoints to LineString features
    // This will let us quickly find which features share endpoints
    const endpointIndex = new Map();

    // Initialize with all features
    const result = [...validFeatures];

    // Build the initial endpoint index
    for (let i = 0; i < result.length; i++) {
        const feature = result[i];
        const coords = feature.geometry.coordinates;
        const firstPoint = coords[0];
        const lastPoint = coords[coords.length - 1];

        const firstKey = pointToKey(firstPoint);
        const lastKey = pointToKey(lastPoint);

        // Add endpoints to index
        if (!endpointIndex.has(firstKey)) {
            endpointIndex.set(firstKey, []);
        }
        endpointIndex.get(firstKey).push({ index: i, isFirst: true });

        if (!endpointIndex.has(lastKey)) {
            endpointIndex.set(lastKey, []);
        }
        endpointIndex.get(lastKey).push({ index: i, isFirst: false });
    }

    // Helper function to merge two LineString Features
    const mergeTwoFeatures = (feature1, feature2, connect1IsFirst, connect2IsFirst) => {
        // console.log("merging", feature1, feature2, connect1IsFirst, connect2IsFirst);
        const coords1 = feature1.geometry.coordinates;
        const coords2 = feature2.geometry.coordinates;
        let mergedCoords = [];

        // Handle different connection scenarios
        if (connect1IsFirst && connect2IsFirst) {
            // First point of feature1 connects to first point of feature2
            const reversedCoords1 = [...coords1].reverse();
            mergedCoords = [...reversedCoords1, ...coords2.slice(1)];
        } else if (connect1IsFirst && !connect2IsFirst) {
            // First point of feature1 connects to last point of feature2
            mergedCoords = [...coords2, ...coords1.slice(1)];
        } else if (!connect1IsFirst && connect2IsFirst) {
            // Last point of feature1 connects to first point of feature2
            mergedCoords = [...coords1, ...coords2.slice(1)];
        } else {
            // Last point of feature1 connects to last point of feature2
            const reversedCoords2 = [...coords2].reverse();
            mergedCoords = [...coords1, ...reversedCoords2.slice(1)];
        }

        // Create a new merged feature with combined properties
        const mergedFeature = {
            type: "Feature",
            geometry: {
                type: "LineString",
                coordinates: mergedCoords
            },
            properties: {
                ...feature1.properties,
                ...feature2.properties,
                merged: true
            }
        };

        return mergedFeature;
    };

    // Function to update the index after merging
    const updateIndexAfterMerge = (newFeature, replacedIndices) => {
        // Remove the replaced features from our endpoint index
        replacedIndices.forEach(idx => {
            const feature = result[idx];
            const coords = feature.geometry.coordinates;
            const firstPoint = coords[0];
            const lastPoint = coords[coords.length - 1];

            const firstKey = pointToKey(firstPoint);
            const lastKey = pointToKey(lastPoint);

            // Filter out the references to the replaced features
            if (endpointIndex.has(firstKey)) {
                endpointIndex.set(
                    firstKey,
                    endpointIndex.get(firstKey).filter(entry => !replacedIndices.includes(entry.index))
                );
                if (endpointIndex.get(firstKey).length === 0) {
                    endpointIndex.delete(firstKey);
                }
            }

            if (endpointIndex.has(lastKey)) {
                endpointIndex.set(
                    lastKey,
                    endpointIndex.get(lastKey).filter(entry => !replacedIndices.includes(entry.index))
                );
                if (endpointIndex.get(lastKey).length === 0) {
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
        endpointIndex.get(newFirstKey).push({ index: newIndex, isFirst: true });

        if (!endpointIndex.has(newLastKey)) {
            endpointIndex.set(newLastKey, []);
        }
        endpointIndex.get(newLastKey).push({ index: newIndex, isFirst: false });
        // console.log('updated index=', JSON.parse(JSON.stringify(Object.fromEntries(endpointIndex))));
    };

    // Process all features and merge where possible
    let mergeFound = true;
    // console.log('initial index=', JSON.parse(JSON.stringify(Object.fromEntries(endpointIndex))));
    while (mergeFound) {
        mergeFound = false;

        // Iterate through the result array
        for (let i = 0; i < result.length; i++) {
            const feature = result[i];
            if (!feature) continue; // Skip if this feature was already merged
            // console.log('current feature', feature);
            // console.log('result', JSON.parse(JSON.stringify(result)));
            const coords = feature.geometry.coordinates;
            const firstPoint = coords[0];
            const lastPoint = coords[coords.length - 1];

            // Check for connections at the first point
            const firstPointKey = pointToKey(firstPoint);
            const connectionsAtFirst = endpointIndex.get(firstPointKey) || [];
            // console.log("connectionsAtFirst", connectionsAtFirst);

            // Find a valid connection at the first point
            for (const connection of connectionsAtFirst) {
                // Skip self-connection
                if (connection.index === i) continue;

                const otherFeature = result[connection.index];
                if (!otherFeature) continue; // Skip if this feature was already merged

                // Found a valid connection
                mergeFound = true;

                // Merge the features
                const mergedFeature = mergeTwoFeatures(
                    feature,
                    otherFeature,
                    true, // First point of feature1
                    connection.isFirst // First or last point of feature2
                );

                // console.log('mergedFeature', mergedFeature);
                // console.log('i', i);
                // console.log('connection.index', connection.index);
                
                // Add the merged feature
                result.push(mergedFeature);
                // Update our index
                updateIndexAfterMerge(mergedFeature, [i, connection.index]);
                // Mark the merged features as null (to be filtered out later)
                result[i] = null;
                result[connection.index] = null;

                break;
            }

            // If we already found a merge, continue to the next iteration
            if (mergeFound) break;

            // Check for connections at the last point
            const lastPointKey = pointToKey(lastPoint);
            const connectionsAtLast = endpointIndex.get(lastPointKey) || [];
            // console.log("connectionsAtLast", connectionsAtLast);

            // Find a valid connection at the last point
            for (const connection of connectionsAtLast) {
                // Skip self-connection
                if (connection.index === i) continue;

                const otherFeature = result[connection.index];
                if (!otherFeature) continue; // Skip if this feature was already merged

                // Found a valid connection
                mergeFound = true;

                // Merge the features
                const mergedFeature = mergeTwoFeatures(
                    feature,
                    otherFeature,
                    false, // Last point of feature1
                    connection.isFirst // First or last point of feature2
                );


                // console.log('mergedFeature', mergedFeature);
                // console.log('i', i);
                // console.log('connection.index', connection.index);
                // Add the merged feature
                result.push(mergedFeature);

                // Update our index
                updateIndexAfterMerge(mergedFeature, [i, connection.index]);
                // Mark the merged features as null (to be filtered out later)
                result[i] = null;
                result[connection.index] = null;


                break;
            }

            // If we found a merge, break out of the loop and start again
            if (mergeFound) break;
        }
    }

    const final = result.filter(feature => feature !== null);
    // console.log('final=', final);
    // Filter out any null entries (merged features)
    return result.filter(feature => feature !== null);
}