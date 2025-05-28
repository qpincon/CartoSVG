import type { Feature, FeatureCollection, MultiPolygon, Polygon } from "geojson";


export function splitMultiPolygons(geojson: FeatureCollection<MultiPolygon | Polygon>, id_prefix = null): FeatureCollection<Polygon> {
    const newGeojson: FeatureCollection<Polygon> = { type: 'FeatureCollection', features: [] };
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
                    } as Feature<Polygon>);
            });
        }
        else newGeojson.features.push(feat as Feature<Polygon>);
    });
    return newGeojson;
}
