import type { FeatureCollection } from "geojson";


export function splitMultiPolygons(geojson: FeatureCollection, id_prefix = null) {
    const newGeojson: FeatureCollection = { type: 'FeatureCollection', features: [] };
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
