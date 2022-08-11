function fixOrder(geojson) {
    if (geojson.features) {
        const fixed = {...geojson};
        fixed.features = fixed.features.map(f =>
            rewind(f, { reverse: true })
        );
        return fixed;
    }
    return rewind(geojson);
}

function splitMultiPolygons(geojson) {
    const newGeojson = {type: 'FeatureCollection', features: []};
    geojson.features.forEach(feat => {
        if (feat.geometry.type == 'MultiPolygon') {
            feat.geometry.coordinates.map(coords => {
                newGeojson.features.push(
                {
                    type: 'Feature', 
                    properties: feat.properties, 
                    geometry: {
                        type: 'Polygon', coordinates: coords
                    }
                });
            });
        }
        else newGeojson.features.push(feat);
    });
    return newGeojson;
}

export { fixOrder, splitMultiPolygons };