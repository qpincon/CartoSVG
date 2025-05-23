import { geoMercator, geoEqualEarth, geoAlbersUsa, geoNaturalEarth1, geoTransform } from 'd3-geo';
import { geoSatellite, geoBaker } from 'd3-geo-projection';
import { scaleLinear, geoClipCircle, geoClipRectangle } from 'd3';
import { LngLat, Point, Map } from 'maplibre-gl';

const degrees = 180 / Math.PI;
const earthRadius = 6371;
const offCanvasPx = 20;

type ProjectionParams = {
    width: number;
    height: number;
    translateX?: number;
    translateY?: number;
    altitude: number;
    latitude?: number;
    longitude?: number;
    rotation?: number;
    borderWidth: number;
    larger?: boolean;
    fov?: number;
    tilt?: number;
    projectionName?: string;
};

type ProjectionFunction = (params: ProjectionParams) => any;

export function getGeographicalBounds(projection: any, width: number, height: number): [[number, number], [number, number]] | null {
    const corners = [
        [0, 0],           // top-left
        [width, 0],       // top-right
        [width, height],  // bottom-right
        [0, height]       // bottom-left
    ];

    const geoCorners = corners.map(corner => {
        try {
            return projection.invert(corner);
        } catch (e) {
            return null;
        }
    }).filter(corner => corner !== null);

    if (geoCorners.length === 0) {
        return null;
    }

    let minLng = Infinity;
    let maxLng = -Infinity;
    let minLat = Infinity;
    let maxLat = -Infinity;

    for (const corner of geoCorners) {
        minLng = Math.min(minLng, corner[0]);
        maxLng = Math.max(maxLng, corner[0]);
        minLat = Math.min(minLat, corner[1]);
        maxLat = Math.max(maxLat, corner[1]);
    }

    return [
        [minLng, minLat],
        [maxLng, maxLat],
    ];
}

export function geoSatelliteCustom(params: ProjectionParams): any {
    const {
        fov = 60,
        width,
        height,
        longitude = 0,
        latitude = 0,
        rotation = 0,
        altitude,
        tilt = 0,
        borderWidth,
        larger = false
    } = params;

    const snyderP = 1.0 + altitude / earthRadius;
    const dY = altitude * Math.sin(tilt / degrees);
    const dZ = altitude * Math.cos(tilt / degrees);
    const fovExtent = Math.tan(0.5 * fov / degrees);
    const visibleYextent = 2 * dZ * fovExtent;
    const yShift = dY * 600 / visibleYextent;
    const scale = earthRadius * 600 / visibleYextent;
    const realTilt = tilt / degrees;
    const alpha = Math.acos(snyderP * Math.cos(realTilt) * 0.999);
    const clipDistance = geoClipCircle(Math.acos(1 / snyderP) - 1e-6);

    const preclip = alpha ? geoPipeline(
        clipDistance,
        geoRotatePhi(Math.PI + realTilt),
        geoClipCircle(Math.PI - alpha - 1e-4),
        geoRotatePhi(-Math.PI - realTilt)
    ) : clipDistance;

    function geoRotatePhi(deltaPhi: number) {
        const cosDeltaPhi = Math.cos(deltaPhi);
        const sinDeltaPhi = Math.sin(deltaPhi);
        return (sink: any) => ({
            point(lambda: number, phi: number) {
                const cosPhi = Math.cos(phi);
                const x = Math.cos(lambda) * cosPhi;
                const y = Math.sin(lambda) * cosPhi;
                const z = Math.sin(phi);
                const k = z * cosDeltaPhi + x * sinDeltaPhi;
                sink.point(Math.atan2(y, x * cosDeltaPhi - z * sinDeltaPhi), Math.asin(k));
            },
            lineStart() { sink.lineStart(); },
            lineEnd() { sink.lineEnd(); },
            polygonStart() { sink.polygonStart(); },
            polygonEnd() { sink.polygonEnd(); },
            sphere() { sink.sphere(); }
        });
    }

    function geoPipeline(...transforms: any[]) {
        return (sink: any) => {
            for (let i = transforms.length - 1; i >= 0; --i) {
                sink = transforms[i](sink);
            }
            return sink;
        };
    }

    const offCanvasWithBorder = offCanvasPx - (borderWidth / 2);
    let proj = geoSatellite()
        .scale(scale)
        .translate([((width / 2)), (yShift + height / 2)])
        .rotate([-longitude, -latitude, rotation])
        // @ts-expect-error
        .tilt(tilt)
        .distance(snyderP)
        .preclip(preclip)
        .postclip(geoClipRectangle(-offCanvasWithBorder, -offCanvasWithBorder, width + offCanvasWithBorder, height + offCanvasWithBorder))
        .precision(0.1);

    if (larger) {
        proj = proj.postclip(geoClipRectangle(-offCanvasWithBorder, -offCanvasWithBorder, width + offCanvasWithBorder, height + offCanvasWithBorder));
    } else {
        proj = proj.postclip(geoClipRectangle(0, 0, width, height));
    }

    return proj;
}

export const standardProjection: Record<string, ProjectionFunction> = {
    'mercator': geoMercatorProj,
    'equalEarth': geoEqualEarthProj,
    'geoNaturalEarth': geoNaturalEarthProj,
    'geoBaker': geoBakerProj,
};

export function standardProj(projFunc: () => any, params: ProjectionParams): any {
    const {
        width,
        height,
        translateX = 0,
        translateY = 0,
        altitude,
        longitude = 0,
        borderWidth,
        larger = false
    } = params;

    const offCanvasWithBorder = offCanvasPx - (borderWidth / 2);
    let proj = projFunc()
        .scale(altitude)
        .translate([(width / 2) + translateX, (height / 2) + translateY])
        .rotate([-longitude, 0, 0])
        .precision(0.1);

    if (larger) {
        proj = proj.postclip(geoClipRectangle(-offCanvasWithBorder, -offCanvasWithBorder, width + offCanvasWithBorder, height + offCanvasWithBorder));
    }

    return proj;
}

export function geoAlbersUsaProj(params: ProjectionParams): any {
    const { width, height, translateX = 0, translateY = 0, altitude } = params;

    return geoAlbersUsa()
        .scale(altitude)
        .translate([(width / 2) + translateX, (height / 2) + translateY])
        .precision(0.1);
}

export function geoMercatorProj(params: ProjectionParams): any {
    return standardProj(geoMercator, params);
}

export function geoEqualEarthProj(params: ProjectionParams): any {
    return standardProj(geoEqualEarth, params);
}

export function geoNaturalEarthProj(params: ProjectionParams): any {
    return standardProj(geoNaturalEarth1, params);
}

export function geoBakerProj(params: ProjectionParams): any {
    return standardProj(geoBaker, params);
}

export function updateAltitudeRange(fov: number | null = null): ((value: number) => number) | undefined {
    if (!fov) return;
    const fovExtent = Math.tan(0.5 * fov / degrees);
    const altRange = [Math.round((1 / fovExtent) * 500), Math.round((1 / fovExtent) * 4000)];
    return scaleLinear().domain([1, 0]).range(altRange);
}

export function getProjection(params: ProjectionParams): any {
    if (params.projectionName === 'satellite') {
        return geoSatelliteCustom(params);
    } else if (params.projectionName && params.projectionName in standardProjection) {
        return standardProjection[params.projectionName](params);
    } else if (params.projectionName === 'geoAlbersUsa') {
        return geoAlbersUsaProj(params);
    }
}

export function createD3ProjectionFromMapLibre(map: Map): any {
    const projection = function (coordinates: [number, number]): [number, number] {
        const lngLat = new LngLat(coordinates[0], coordinates[1]);
        const point = map.project(lngLat);
        return [point.x, point.y];
    };

    projection.stream = function (stream: any): any {
        return geoTransform({
            point: function (x: number, y: number) {
                const lngLat = new LngLat(x, y);
                const point = map.project(lngLat);
                stream.point(point.x, point.y);
            }
        }).stream(stream);
    };

    projection.invert = function (pixels: [number, number]): [number, number] {
        const point = new Point(pixels[0], pixels[1]);
        const lngLat = map.unproject(point);
        return [lngLat.lng, lngLat.lat];
    };

    return projection;
}
