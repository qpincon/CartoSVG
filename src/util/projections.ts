import { geoMercator, geoEqualEarth, geoAlbersUsa, geoNaturalEarth1, geoTransform } from 'd3-geo';
import { geoSatellite, geoBaker, geoEckert4 } from 'd3-geo-projection';
import { geoClipCircle, geoClipRectangle } from 'd3';
import { LngLat, Point } from 'maplibre-gl';
import type { Map } from 'maplibre-gl';
import { clamp } from 'lodash-es';
import type { ProjectionParams } from 'src/types';
import type { Feature, MultiPolygon, Polygon, Position } from 'geojson';

const degrees = 180 / Math.PI;
const earthRadius = 6371;
const offCanvasPx = 20;

type ProjectionFunction = (params: ProjectionParams) => any;

// 13x13 grid — cheap (a few hundred invert/reproject calls) for a once-per-draw bounds
// calculation, and dense enough to correctly bound circular/clipped projections (satellite)
// where the visible disc doesn't touch the viewport rectangle's own corners.
const BOUNDS_GRID_STEPS = 12;

// Below this, the sampled longitudes have no meaningful "uncovered side" left (see
// `longitudeBoundsFromSamples`) — treated as full 360° coverage rather than a real arc.
const FULL_COVERAGE_GAP_THRESHOLD_DEG = 10;

/**
 * A satellite/perspective view's visible cap can straddle the antimeridian even when its
 * center longitude is nowhere near ±180 — near the edge of a wide cap, longitude lines
 * converge (more so at high latitude) and a real, continuous swept region can numerically
 * wrap past -180/180. A plain min/max over sampled longitudes can't tell "the view covers
 * -170..171 (a ~341° span, the long way round)" apart from "the view covers 171..-170 the
 * SHORT way round, through the seam (a real ~18° span)" — those are the same two numbers.
 *
 * This finds the largest angular gap between consecutive sampled longitudes (arranged on
 * the circle); the covered arc is everything else. If every gap is small, samples surround
 * the whole circle with no clear empty side (e.g. a pole is in view, so literally every
 * longitude appears somewhere in the sampled area) and the caller should treat it as full
 * coverage. Otherwise the two bounds are returned in arc order — if the arc crosses the
 * seam, the "min" (right after the gap) ends up numerically greater than the "max" (right
 * before the gap); callers use exactly that (minLng > maxLng) as the wrap signal, rather
 * than needing a separate sentinel.
 */
function longitudeBoundsFromSamples(lngs: number[]): [number, number] {
    const normalized = lngs.map(l => (((l % 360) + 540) % 360) - 180).sort((a, b) => a - b);

    let maxGap = -Infinity;
    let gapIndex = normalized.length - 1; // default: the "wraparound" pair (last -> first+360)
    for (let i = 0; i < normalized.length; i++) {
        const curr = normalized[i];
        const next = i + 1 < normalized.length ? normalized[i + 1] : normalized[0] + 360;
        const gap = next - curr;
        if (gap > maxGap) {
            maxGap = gap;
            gapIndex = i;
        }
    }

    if (maxGap < FULL_COVERAGE_GAP_THRESHOLD_DEG) return [-180, 180];
    if (gapIndex === normalized.length - 1) return [normalized[0], normalized[normalized.length - 1]];
    return [normalized[gapIndex + 1], normalized[gapIndex]];
}

export function getGeographicalBounds(projection: any, width: number, height: number): [[number, number], [number, number]] | null {
    const points: [number, number][] = [];
    for (let i = 0; i <= BOUNDS_GRID_STEPS; i++) {
        for (let j = 0; j <= BOUNDS_GRID_STEPS; j++) {
            points.push([(width * i) / BOUNDS_GRID_STEPS, (height * j) / BOUNDS_GRID_STEPS]);
        }
    }

    const geoPoints = points.map(point => {
        try {
            const inverted = projection.invert(point);
            if (!inverted) return null;
            // Perspective/clipped projections (satellite) can return a mathematically valid
            // but meaningless inverse for a pixel outside their visible disc — reflecting to
            // the back of the globe instead of failing outright. Round-trip through the
            // forward projection and discard anything that doesn't land back near its own
            // pixel, so those points can't corrupt the bounding box.
            const reprojected = projection(inverted);
            if (!reprojected || Math.hypot(reprojected[0] - point[0], reprojected[1] - point[1]) > 1) return null;
            return inverted as [number, number];
        } catch (e) {
            return null;
        }
    }).filter((p): p is [number, number] => p !== null);

    if (geoPoints.length === 0) {
        return null;
    }

    let minLat = Infinity;
    let maxLat = -Infinity;
    for (const [, lat] of geoPoints) {
        minLat = Math.min(minLat, lat);
        maxLat = Math.max(maxLat, lat);
    }

    const [minLng, maxLng] = longitudeBoundsFromSamples(geoPoints.map(([lng]) => lng));

    return [
        [minLng, minLat],
        [maxLng, maxLat],
    ];
}

function ringIsCCW(ring: Position[]): boolean {
    let sum = 0;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        sum += (ring[j][0] - ring[i][0]) * (ring[i][1] + ring[j][1]);
    }
    return sum > 0;
}

/**
 * d3-geo treats lon/lat polygons as spherical and requires the opposite ring winding from
 * GeoJSON/RFC 7946: exterior rings clockwise, holes counter-clockwise. A CCW exterior isn't
 * rendered as "the same shape" — it's interpreted as everything except that shape, which
 * combined with a projection's spherical preclip (geoClipAntimeridian/geoClipCircle) can
 * fill the entire visible area instead of the intended small polygon.
 *
 * Raw vector-tile decode already comes out with correct (d3-compatible) winding, but
 * anything that has passed through a turf union/intersect/etc. (which normalize to RFC
 * 7946) needs this before geoPath. Cheap enough to apply unconditionally as a safety net.
 * Mutates the feature's geometry in place.
 */
export function rewindForD3(feature: Feature<Polygon | MultiPolygon>): void {
    const polys = feature.geometry.type === 'Polygon' ? [feature.geometry.coordinates] : feature.geometry.coordinates;
    for (const rings of polys) {
        rings.forEach((ring, ringIndex) => {
            const isHole = ringIndex > 0;
            if (ringIsCCW(ring) !== isHole) ring.reverse();
        });
    }
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

    // Guard against a stale/zero persisted altitude (e.g. from a degenerate fieldOfView),
    // which would otherwise produce an infinite scale and an inverted clip circle.
    const alt = Math.max(1, altitude || 1);
    const snyderP = 1.0 + alt / earthRadius;
    const dY = alt * Math.sin(tilt / degrees);
    const dZ = alt * Math.cos(tilt / degrees);
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
    'geoEckert4': geoEckert4Proj,
};

function standardProj(projFunc: () => any, params: ProjectionParams): any {
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
    } else {
        proj = proj.postclip(geoClipRectangle(0, 0, width, height));
    }

    return proj;
}

function geoAlbersUsaProj(params: ProjectionParams): any {
    const { width, height, translateX = 0, translateY = 0, altitude } = params;

    return geoAlbersUsa()
        .scale(altitude)
        .translate([(width / 2) + translateX, (height / 2) + translateY])
        .precision(0.1);
}

function geoMercatorProj(params: ProjectionParams): any {
    return standardProj(geoMercator, params);
}

function geoEqualEarthProj(params: ProjectionParams): any {
    return standardProj(geoEqualEarth, params);
}

function geoNaturalEarthProj(params: ProjectionParams): any {
    return standardProj(geoNaturalEarth1, params);
}

function geoBakerProj(params: ProjectionParams): any {
    return standardProj(geoBaker, params);
}

function geoEckert4Proj(params: ProjectionParams): any {
    return standardProj(geoEckert4, params);
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

export function createD3ProjectionFromMapLibre(map: Map, offset: number = 0): any {
    const projection = function (coordinates: [number, number]): [number, number] {
        const lngLat = new LngLat(coordinates[0], clamp(coordinates[1], -90, 90));
        const point = map.project(lngLat);
        return [point.x + offset, point.y + offset];
    };

    projection.stream = function (stream: any): any {
        return geoTransform({
            point: function (x: number, y: number) {
                const lngLat = new LngLat(x, clamp(y, -90, 90));
                const point = map.project(lngLat);
                stream.point(point.x + offset, point.y + offset);
            }
        }).stream(stream);
    };

    projection.invert = function (pixels: [number, number]): [number, number] {
        const point = new Point(pixels[0] - offset, pixels[1] - offset);
        const lngLat = map.unproject(point);
        return [lngLat.lng, lngLat.lat];
    };

    return projection;
}
