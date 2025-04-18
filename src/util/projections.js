import { geoMercator, geoEqualEarth, geoAlbersUsa, geoNaturalEarth1, geoTransform } from 'd3-geo';
import { geoSatellite, geoBaker } from 'd3-geo-projection';
import { scaleLinear, geoClipCircle, geoClipRectangle } from 'd3';
import { LngLat, Point } from 'maplibre-gl';

const degrees = 180 / Math.PI;
const earthRadius = 6371;
const offCanvasPx = 20;

function getGeographicalBounds(projection, width, height) {
    // Get the corners of your viewport in pixel coordinates
    const corners = [
        [0, 0],           // top-left
        [width, 0],       // top-right
        [width, height],  // bottom-right
        [0, height]       // bottom-left
    ];

    // Convert pixel coordinates to geographical coordinates
    const geoCorners = corners.map(corner => {
        try {
            return projection.invert(corner);
        } catch (e) {
            // Some points might not be invertible depending on the projection and rotation
            return null;
        }
    }).filter(corner => corner !== null);

    if (geoCorners.length === 0) {
        return null; // No invertible corners
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

function geoSatelliteCustom({ fov, width, height, longitude, latitude, rotation, altitude, tilt, borderWidth, larger = false } = {}) {
    const snyderP = 1.0 + altitude / earthRadius;
    const dY = altitude * Math.sin(tilt / degrees);
    const dZ = altitude * Math.cos(tilt / degrees);
    const fovExtent = Math.tan(0.5 * fov / degrees);
    const visibleYextent = 2 * dZ * fovExtent;
    // const altRange = [(1 / fovExtent) * 500, (1 / fovExtent) * 4000];
    // altitudeScale = scaleLinear().domain([1, 0]).range(altRange);
    const yShift = dY * 600 / visibleYextent;
    const scale = earthRadius * 600 / visibleYextent;
    const realTilt = tilt / degrees;
    const alpha = Math.acos(snyderP * Math.cos(realTilt) * 0.999);
    const clipDistance = geoClipCircle(Math.acos(1 / snyderP) - 1e-6);
    const preclip = alpha ? geoPipeline(
        clipDistance,
        geoRotatePhi(Math.PI + realTilt),
        geoClipCircle(Math.PI - alpha - 1e-4), // Extra safety factor needed for large tilt values
        geoRotatePhi(-Math.PI - realTilt)
    ) : clipDistance;

    function geoRotatePhi(deltaPhi) {
        const cosDeltaPhi = Math.cos(deltaPhi);
        const sinDeltaPhi = Math.sin(deltaPhi);
        return sink => ({
            point(lambda, phi) {
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

    function geoPipeline(...transforms) {
        return sink => {
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
        .tilt(tilt)
        .distance(snyderP)
        .preclip(preclip)
        .postclip(geoClipRectangle(-offCanvasWithBorder, -offCanvasWithBorder, width + offCanvasWithBorder, height + offCanvasWithBorder))
        .precision(0.1);
    if (larger) {
        proj = proj.postclip(geoClipRectangle(-offCanvasWithBorder, -offCanvasWithBorder, width + offCanvasWithBorder, height + offCanvasWithBorder))
    }
    else {
        proj = proj.postclip(geoClipRectangle(0, 0, width, height))
    }
    return proj;
}

const standardProjection = {
    'mercator': geoMercatorProj,
    'equalEarth': geoEqualEarthProj,
    'geoNaturalEarth': geoNaturalEarthProj,
    'geoBaker': geoBakerProj,
}

function standardProj(projFunc, { width, height, translateX, translateY, altitude, latitude, longitude, rotation, borderWidth, larger = false } = {}) {
    const offCanvasWithBorder = offCanvasPx - (borderWidth / 2);
    let proj = projFunc()
        .scale(altitude)
        .translate([(width / 2), (height / 2) + translateY])
        .rotate([-longitude, 0, 0])
        .precision(0.1);
    if (larger) {
        proj = proj.postclip(geoClipRectangle(-offCanvasWithBorder, -offCanvasWithBorder, width + offCanvasWithBorder, height + offCanvasWithBorder))
    }
    return proj;
}
function geoAlbersUsaProj({ width, height, translateX, translateY, altitude, latitude, longitude, rotation, borderWidth, larger = false } = {}) {
    let proj = geoAlbersUsa()
        .scale(altitude)
        .translate([(width / 2) + translateX, (height / 2) + translateY])
        .precision(0.1);
    return proj;
}

function geoMercatorProj(params) {
    return standardProj(geoMercator, params);
}

function geoEqualEarthProj(params) {
    return standardProj(geoEqualEarth, params);
}
function geoNaturalEarthProj(params) {
    return standardProj(geoNaturalEarth1, params);
}
function geoBakerProj(params) {
    return standardProj(geoBaker, params);
}


function updateAltitudeRange(fov = null) {
    if (!fov) return;
    const fovExtent = Math.tan(0.5 * fov / degrees);
    const altRange = [Math.round((1 / fovExtent) * 500), Math.round((1 / fovExtent) * 4000)];
    const altScale = scaleLinear().domain([1, 0]).range(altRange);
    return altScale;
}

function getProjection(params) {
    if (params.projectionName === 'satellite') {
        return geoSatelliteCustom(params);
    }
    else if (params.projectionName in standardProjection) {
        return standardProjection[params.projectionName](params);
    }
    else if (params.projectionName === 'geoAlbersUsa') {
        return geoAlbersUsaProj(params);
    }
}


function createD3ProjectionFromMapLibre(map) {

    const projection = function(coordinates) {
        const lngLat = new LngLat(coordinates[0], coordinates[1]);
        const point = map.project(lngLat);
        return [point.x, point.y];
    };
    
    // Add the stream method expected by D3
    projection.stream = function(stream) {
        return geoTransform({
            point: function(x, y) {
                const lngLat = new LngLat(x, y);
                const point = map.project(lngLat);
                stream.point(point.x, point.y);
            }
        }).stream(stream);
    };
    
    // Add invert method
    projection.invert = function(pixels) {
        const point = new Point(pixels[0], pixels[1]);
        const lngLat = map.unproject(point);
        return [lngLat.lng, lngLat.lat];
    };


    // const projection = geoTransform({
    //     point: function (x, y) {
    //         const lngLat = new LngLat(x, y);
    //         const point = map.project(lngLat);
    //         this.stream.point(point.x, point.y);
    //     }
    // });

    // projection.invert = function (pixels) {
    //     const point = new Point(pixels[0], pixels[1]);
    //     const lngLat = map.unproject(point);
    //     return [lngLat.lng, lngLat.lat];
    // };
    return projection
}

export { updateAltitudeRange, getProjection, getGeographicalBounds, createD3ProjectionFromMapLibre };