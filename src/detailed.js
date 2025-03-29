import { Map } from 'maplibre-gl';

export const interestingBasicV2Layers = [
    "Residential",
    "Forest",
    "Sand",
    "Grass",
    "Wood",
    "Water",
    "River",
    "Bridge",
    "Road network",
    "Building",
]


function altitudeToZoom(altitude) {
    const A = 40487.57;
    const B = 0.00007096758;
    const C = 91610.74;
    const D = -40467.74;
    return D+(A-D)/(1+Math.pow(altitude/C, B));
}

// Because features come from tiled vector data,
// feature geometries may be split
// or duplicated across tile boundaries.
// As a result, features may appear
// multiple times in query results.
export function getUniqueFeatures(features) {
    const uniqueIds = new Set();
    const uniqueFeatures = [];
    for (const feature of features) {
        const id = feature.id;
        if (!uniqueIds.has(id)) {
            uniqueIds.add(id);
            uniqueFeatures.push(feature);
        }
    }
    return uniqueFeatures;
}

export class MaplibreGeometryUtil {
    constructor(divId) {
        this.maplibreMap = new Map({
            container: divId, 
            style: 'https://api.maptiler.com/maps/basic-v2/style.json?key=FDR0xJ9eyXD87yIqUjOi',
            center: [ 2.3369480024747986, 48.86042010964684],
            zoom: 15,
            attributionControl: false
        });
        // await maplibreMap.once('load');
        this.maplibreMap.on('click', event => {
            console.log(event);
            console.log(this.maplibreMap.getStyle());
            // let features = maplibreMap.querySourceFeatures('maptiler_planet', {
                // sourceLayer: 'building'
            // });
            // console.log('querySourceFeatures', features);
            // console.log(maplibreMap.queryRenderedFeatures(event.point));
            // console.log(maplibreMap.queryRenderedFeatures(event.point, { layers: interestingBasicV2Layers }));
            console.log(this.getGeometries());
            // console.log('rendered features', test);
            // if (test.length) {
            //     console.log(test[0].geometry);
            // }
        });
    }

    getGeometries() {
        const rendered = this.maplibreMap.queryRenderedFeatures(event.point, { layers: interestingBasicV2Layers });
        return rendered;
        // const geometries = rendered.map(r => {
        //     const className = `${r.sourceLayer}-${r.properties.class}`;
        //     console.log(r, className);
        //     return r.geometry;
        // });
        // return geometries;
    }

    isZoomedEnough() {
        return this.maplibreMap.getZoom() > 13;
    }

    setBounds(lngLatBounds) {
        this.maplibreMap.fitBounds(lngLatBounds, {animate: false});
    }

    setPosition(lng, lat, pitch, altitude) {
        const zoom = altitudeToZoom(altitude);
        console.log('altitude', altitude, 'zoom', zoom);
        this.maplibreMap.jumpTo({center:[lng, lat], pitch, zoom});
    }

}