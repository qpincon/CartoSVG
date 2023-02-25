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

function splitMultiPolygons(geojson, id_prefix=null) {
    const newGeojson = {type: 'FeatureCollection', features: []};
    geojson.features.forEach(feat => {
        if (feat.geometry.type == 'MultiPolygon') {
            feat.geometry.coordinates.map((coords, i) => {
                const props = feat.properties || {};
                if (id_prefix) props['id'] = `${id_prefix}_${i}`;
                newGeojson.features.push(
                {
                    type: 'Feature', 
                    properties: props,
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