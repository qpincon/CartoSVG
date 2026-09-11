import bbox from "@turf/bbox";
import { buffer } from "@turf/buffer";
import { booleanWithin } from "@turf/boolean-within";
import { featureCollection } from "@turf/helpers";
import simplify from "@turf/simplify";
import union from "@turf/union";
import type { BBox, Feature, LineString, MultiPolygon, Polygon } from "geojson";
import { bboxContains, bboxIntersects, computeFeatureUuid, explodeGeometry, type RenderedFeature } from "../util/geometryStitch";

// Fallback half-width (px) for a water line whose paint didn't resolve a numeric
// line-width — shouldn't normally happen for the water_stream/water_river style layers.
const DEFAULT_LINE_WIDTH_PX = 1;
// Bevel resolution for buffer()'s round joins/caps. Cost scales with this, and at the pixel
// widths these lines get (a few px), a smoother join is imperceptible — round it down from
// turf's default of 8.
const BUFFER_STEPS = 4;
// Douglas-Peucker tolerance, expressed in pixels of allowed deviation (converted to degrees
// per call via kmPerPixel — see bufferLineToPolygon). buffer() and the union step both scale
// with vertex count, and shedding ~1px of wiggle is invisible once the line is widened into a
// filled polygon anyway.
const SIMPLIFY_TOLERANCE_PX = 1;
const KM_PER_DEGREE_LAT = 111.32;

/**
 * Converts "water" LineString features (streams/rivers, queried from MapLibre's separate
 * line-type style layers — see EXTRA_STYLE_LAYERS in drawing.ts) into buffered Polygon
 * features, unions them with the existing water polygons, so the whole "water" layer renders
 * as one seamless fill instead of a stroked line overlaid on separate polygons.
 *
 * A line fully covered by an existing water polygon is dropped instead of buffered:
 * MapLibre's water source-layer also carries label-anchor centerlines that duplicate an
 * already-filled lake/river polygon, and buffering those would only spend time drawing
 * something invisible underneath the fill.
 *
 * Buffering happens pre-projection, in the same lon/lat space as the rest of the geometry
 * pipeline, using one `kmPerPixel` approximation for the whole view rather than a
 * per-feature/projection-exact radius — trading pixel-perfect width for reusing the existing
 * polygon render/cutout pipeline unchanged.
 */
export function polygonizeWaterLines(geometries: RenderedFeature[], kmPerPixel: number): RenderedFeature[] {
    const waterPolygons: RenderedFeature[] = [];
    const waterLines: RenderedFeature[] = [];
    const rest: RenderedFeature[] = [];

    for (const geom of geometries) {
        if (geom.properties.mapLayerId !== 'water') rest.push(geom);
        else if (geom.geometry.type === 'LineString') waterLines.push(geom);
        else waterPolygons.push(geom);
    }

    if (waterLines.length === 0) return geometries;

    const polygonBboxes = waterPolygons.map(p => bbox(p));

    // Lines that couldn't be buffered (see bufferLineToPolygon) fall back to their original
    // LineString and stay out of the union below — turf/union is Polygon/MultiPolygon-only.
    const convertedPolygons: RenderedFeature[] = [];
    const unconvertedLines: RenderedFeature[] = [];
    for (const line of waterLines) {
        const lineBbox = bbox(line);
        const isFullyCovered = waterPolygons.some((poly, i) =>
            // Necessary bbox condition first (cheap): rules out most polygons before the
            // exact (and much costlier) geometric containment check below.
            bboxContains(polygonBboxes[i], lineBbox) &&
            booleanWithin(line as Feature<LineString>, poly as Feature<Polygon>)
        );
        if (isFullyCovered) continue;

        const result = bufferLineToPolygon(line, kmPerPixel);
        if (result[0]?.geometry.type === 'LineString') unconvertedLines.push(...result);
        else convertedPolygons.push(...result);
    }

    const mergedWater = unionWaterPolygons([...waterPolygons, ...convertedPolygons]);

    return [...rest, ...unconvertedLines, ...mergedWater];
}

function bufferLineToPolygon(line: RenderedFeature, kmPerPixel: number): RenderedFeature[] {
    const widthPx = line.properties.paint?.['line-width'] ?? DEFAULT_LINE_WIDTH_PX;
    const radiusKm = (widthPx / 2) * kmPerPixel;
    const toleranceDeg = (SIMPLIFY_TOLERANCE_PX * kmPerPixel) / KM_PER_DEGREE_LAT;

    let buffered: Feature<Polygon | MultiPolygon> | undefined;
    try {
        const simplified = simplify(line as Feature<LineString>, { tolerance: toleranceDeg, highQuality: false });
        buffered = buffer(simplified, radiusKm, { units: 'kilometers', steps: BUFFER_STEPS });
    } catch {
        buffered = undefined;
    }
    // Degenerate line (e.g. zero-length after clipping): keep the original feature instead of
    // silently dropping it — it renders as a stroked line, same as before this conversion.
    if (!buffered) return [line];

    // `paint['line-width']` no longer means anything on a polygon (it would otherwise leak
    // into the inline stroke-width style applied to every rendered feature — see drawing.ts —
    // making this buffered shape draw its own per-segment border instead of using the normal
    // per-layer "water" stroke-width if one is ever configured). `paint` itself must stay a
    // (possibly empty) object, not be removed: every rendered feature is assumed to carry one.
    buffered.properties = { ...line.properties, paint: {} };

    return explodeGeometry([buffered as RenderedFeature], 'Polygon');
}

/**
 * Merges every water polygon (original lake/sea shapes plus the freshly-buffered
 * streams/rivers) into as few polygons as possible, so overlapping/touching pieces don't
 * show seams if "water" ever gets a border stroke, and so the exported SVG doesn't carry
 * redundant overlapping fills.
 *
 * Polygons are first grouped by bbox-overlap (plain union-find, same idea as the tile-stitch
 * grouping in geometryStitch.ts's stitchPolygons): most water polygons in a city-scale view
 * don't spatially interact at all (a lake on one side, a river on the other), so turf/union
 * — whose cost isn't cheap-linear in input count — only ever runs per cluster instead of once
 * across everything, and an isolated polygon skips it entirely.
 */
function unionWaterPolygons(polygons: RenderedFeature[]): RenderedFeature[] {
    if (polygons.length <= 1) return polygons;

    const bboxes = polygons.map(p => bbox(p));
    const clusters = clusterByBboxOverlap(polygons, bboxes);

    return clusters.flatMap(cluster => cluster.length === 1 ? cluster : unionCluster(cluster));
}

function clusterByBboxOverlap(polygons: RenderedFeature[], bboxes: BBox[]): RenderedFeature[][] {
    const parent = polygons.map((_, i) => i);
    const find = (i: number): number => {
        while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; }
        return i;
    };

    for (let i = 0; i < polygons.length; i++) {
        for (let j = i + 1; j < polygons.length; j++) {
            if (!bboxIntersects(bboxes[i], bboxes[j])) continue;
            const ri = find(i), rj = find(j);
            if (ri !== rj) parent[ri] = rj;
        }
    }

    const clusters = new Map<number, RenderedFeature[]>();
    polygons.forEach((polygon, i) => {
        const root = find(i);
        if (!clusters.has(root)) clusters.set(root, []);
        clusters.get(root)!.push(polygon);
    });
    return [...clusters.values()];
}

function unionCluster(cluster: RenderedFeature[]): RenderedFeature[] {
    const mergedProperties = {};
    for (const p of cluster) Object.assign(mergedProperties, p.properties);

    let merged: Feature<Polygon | MultiPolygon> | null = null;
    try {
        merged = union(featureCollection(cluster as Feature<Polygon | MultiPolygon>[]), { properties: mergedProperties });
    } catch (err) {
        console.warn('polygonizeWaterLines: union of a water polygon cluster threw, keeping them separate', err);
    }
    if (!merged?.geometry) return cluster;

    const mergedFeature = merged as RenderedFeature;
    computeFeatureUuid(mergedFeature);
    return explodeGeometry([mergedFeature], 'Polygon');
}
