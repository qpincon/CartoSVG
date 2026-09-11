import svgoConfig from '../svgoExport.config';
import { log, logTime, logTimeEnd } from '../util/log';
import { select, type Selection } from "d3-selection";
import { bboxContains, bboxIntersects, getRenderedFeatures, type RenderedFeature, type RenderedFeaturePoly } from "../util/geometryStitch";
import { cloneDeep, kebabCase, random, size } from "lodash-es";
import { color, hsl } from "d3-color";
import { DOM_PARSER, findStyleSheet, fontsToCssMultiSubset, fontsToCssEmbedMultiSubset, getUsedInlineFonts, updateStyleSheetOrGenerateCss } from "../util/dom";
import { patternGenerator } from "../svg/patternGenerator";
import { appendClip } from "../svg/svgDefs";
import { discriminateCssForExport, download, randomString, xhtmlifyHtml } from "../util/common";
import { addAttribution, addFrameShadow, addTexture, additionnalCssExport, changeIdAndReferences, exportFontChoices, FRAME_SHADOW_MARGIN, inlineFontVsPath, rgb2hex, type ExportOptions } from "../svg/export";
import intersectionObserverScript from 'src/svg/exportScripts/intersectionObserver.js?raw';
import elementAnnotationsScript from 'src/svg/exportScripts/elementAnnotations.js?raw';
import { createRoundedRectangleGeoJSON } from '../util/geometry';
import bboxPolygon from '@turf/bbox-polygon';
import booleanDisjoint from '@turf/boolean-disjoint';
import difference from '@turf/difference';
import { featureCollection } from '@turf/helpers';
import type { Feature, Geometry, Polygon } from 'geojson';
import type { MicroParams } from '../params';
import { MICRO_LAYERS, type Color, type ElementAnnotations, type MicroLayerId, type MicroPalette, type PatternDefinition, type ProvidedFont, type StateMicro, type SvgSelection } from '../types';
import type { Config } from 'svgo/browser';
import type { Map as MapLibreMap } from 'maplibre-gl';
import { postClipSimple } from 'src/svg/svg';
import bbox from '@turf/bbox';
import { renderBuildingsToSvgImproved } from './3d';
import area from '@turf/area';
import center from '@turf/center';
import { transitionCssMicro } from 'src/svg/transition';
import { removeNotRenderedElements } from './remove-not-rendered-canvas';
import { appState, microState } from 'src/state.svelte';
import { yieldToMain } from '../util/polyfills';
import { distance } from '@turf/distance';
import { polygonizeWaterLines } from './waterPolygonize';


// Interfaces for building grouping
export interface GroupedFeature extends RenderedFeaturePoly {
    parts: RenderedFeaturePoly[];
}

export interface GroupBuildingResult {
    normalFeatures: RenderedFeaturePoly[];
    groupedFeatures: GroupedFeature[];
}

// Helper function for centroid distance calculation
function centroidDistance(c1: [number, number], c2: [number, number]): number {
    return Math.sqrt(Math.pow(c1[0] - c2[0], 2) + Math.pow(c1[1] - c2[1], 2));
}

type D3PathFunction = (geometry: Geometry) => string | null;


export function orderFeaturesByLayer(features: RenderedFeature[]): void {
    features.sort((a, b) => {
        const rankA = a.properties['sort_rank'] ?? 0;
        const rankB = b.properties['sort_rank'] ?? 0;
        if (rankA === rankB) {
            // @ts-expect-error
            const idxA = MICRO_LAYERS.indexOf(a.properties.mapLayerId!);
            // @ts-expect-error
            const idxB = MICRO_LAYERS.indexOf(b.properties.mapLayerId!);
            const layerIdA = idxA === -1 ? MICRO_LAYERS.length : idxA;
            const layerIdB = idxB === -1 ? MICRO_LAYERS.length : idxB;
            return layerIdA - layerIdB;
        }
        return rankA - rankB;
    });
}
// Layers whose polygons act as cutout sources: they sit visually on top of
// water/grass/forest and should punch holes in those layers rather than simply
// overlapping them.  This avoids a z-order artifact where the "under" layer
// bleeds through the fill of the "over" layer when both use semi-transparent or
// patterned styles.
const BACKGROUND_LAYERS = ['landuse_pedestrian', 'landuse_pier'];
// Layers that receive the cutouts.
const CUTOUT_TARGET_LAYERS = ['water', 'grass', 'forest'];
// Some logical MICRO_LAYERS are backed by more than one MapLibre style layer
// (e.g. "water" is a fill layer plus separate "water_stream"/"water_river" line
// layers, since a style layer can't mix the fill and line types, and MapLibre
// disallows combining stream's and river's differing zoom-based line-width
// curves into a single "water_line" layer via match()).
// Extra style-layer ids to query for a given logical layer are listed here;
// their features get their mapLayerId remapped back to the logical id below.
const EXTRA_STYLE_LAYERS: Partial<Record<MicroLayerId, string[]>> = {
    water: ['water_stream', 'water_river'],
};
const STYLE_LAYER_TO_LOGICAL: Record<string, MicroLayerId> = Object.fromEntries(
    Object.entries(EXTRA_STYLE_LAYERS).flatMap(([logical, styleLayers]) =>
        styleLayers!.map(styleLayer => [styleLayer, logical as MicroLayerId])
    )
);

let cutoutProcessId = 0;
let pendingCutout: Promise<void> | null = null;

export function cancelPendingCutout(): void { cutoutProcessId += 1; }
export function awaitPendingCutout(): Promise<void> { return pendingCutout ?? Promise.resolve(); }

/**
 * Schedules the cutout sweep to run asynchronously after the initial paint.
 * For each feature in `mainFeatures` whose layer is in CUTOUT_TARGET_LAYERS,
 * subtracts all geometrically-overlapping `cutoutFeatures` (BACKGROUND_LAYERS)
 * from it. Yields to the main thread every 8 polygons so the browser stays
 * responsive, and checks a cancellation token so a new draw can interrupt a
 * stale run. On completion patches the `d` attribute of the affected <path>
 * elements and removes any that vanished entirely.
 */
async function applyCutoutsDeferred(
    svg: SvgSelection,
    d3PathFunction: D3PathFunction,
    mainFeatures: RenderedFeaturePoly[],
    cutoutFeatures: RenderedFeaturePoly[],
): Promise<void> {
    if (cutoutFeatures.length === 0) return;
    const myId = ++cutoutProcessId;
    logTime('Cutout layers');
    try {
        const cutoutBboxes = cutoutFeatures.map(c => bbox(c));
        let nbDifferenceCall = 0;
        let yieldCounter = 0;

        for (let i = mainFeatures.length - 1; i >= 0; i--) {
            const f = mainFeatures[i];
            if (!CUTOUT_TARGET_LAYERS.includes(f.properties.mapLayerId!)) continue;
            // Skip line geometries (e.g. water's streams/rivers): turf's difference()
            // below is Polygon-only, and cutouts only make sense against filled areas.
            if (f.geometry.type !== 'Polygon') continue;
            const featureBbox = bbox(f);

            const relevant: Feature<Polygon>[] = [];
            for (let j = 0; j < cutoutFeatures.length; j++) {
                if (bboxIntersects(featureBbox, cutoutBboxes[j])) {
                    relevant.push(cutoutFeatures[j] as Feature<Polygon>);
                }
            }
            if (relevant.length === 0) continue;

            // One polyclip sweep per polygon: @turf/difference forwards
            // variadic clips to polyclip.difference(subject, c1, c2, ...).
            const diff = difference(featureCollection([
                f as Feature<Polygon>,
                ...relevant,
            ]));
            nbDifferenceCall += 1;
            if (diff == null) {
                f.properties.removedByCutout = true;
            } else {
                (f as Feature).geometry = diff.geometry;
            }

            if (++yieldCounter % 8 === 0) {
                await yieldToMain();
                if (myId !== cutoutProcessId) return;
            }
        }
        log(nbDifferenceCall, 'difference calls');

        // Patch the DOM: update d attribute or remove vanished paths.
        const microGroup = svg.node()?.querySelector('#micro');
        if (!microGroup) return;
        microGroup.querySelectorAll<SVGPathElement>('path.water, path.grass, path.forest')
            .forEach(el => {
                const d = (el as any).__data__ as RenderedFeaturePoly | undefined;
                if (!d) return;
                if (d.properties.removedByCutout) {
                    el.remove();
                } else {
                    const path = d3PathFunction(d.geometry);
                    if (path) el.setAttribute('d', path);
                    el.removeAttribute('mask');
                }
            });
        svg.node()?.querySelector('#cutoutMask')?.remove();
    } finally {
        logTimeEnd('Cutout layers');
        if (myId === cutoutProcessId) pendingCutout = null;
    }
}

export async function drawPrettyMap(
    maplibreMap: MapLibreMap,
    svg: SvgSelection,
    d3PathFunction: D3PathFunction,
    layerDefinitions: MicroPalette,
    generalParams: MicroParams,
): Promise<void> {
    log('layerDefinitions=', layerDefinitions);
    select("#map-container").style("width", null).style('height', null);
    const mapLibreContainer = select('#maplibre-map');
    const activeLogicalLayers = MICRO_LAYERS.filter(layer => {
        return layerDefinitions[kebabCase(layer) as MicroLayerId]?.active !== false;
    });
    const layersToQuery = activeLogicalLayers.flatMap(layer => [layer, ...(EXTRA_STYLE_LAYERS[layer] ?? [])]);
    updateSvgPatterns(svg.node() as SVGElement, layerDefinitions);
    const width = generalParams.General.width;
    const height = generalParams.General.height;

    svg.attr("width", `${width}`).attr("height", `${height}`);
    const use3d = layerDefinitions.buildings['3dBuildings'];
    logTime('getRenderedFeatures')
    let geometries = (await getRenderedFeatures(maplibreMap, { layers: layersToQuery }, use3d!))
    ?.filter(geom => {
            if (geom.properties['kind_detail'] === 'corridor') return false;
            const layer = geom.properties['layer'];
            /** Remove below ground buildings */
            if (geom.properties.mapLayerId === "buildings" && layer != null && layer < 0) return false;
            return true;
        });
        // Process got interrupted, a new call to this function is coming soon
    logTimeEnd('getRenderedFeatures')
        if (geometries == null) return;

    geometries.forEach(geom => {
        const logicalLayer = STYLE_LAYER_TO_LOGICAL[geom.properties.mapLayerId!];
        if (logicalLayer) geom.properties.mapLayerId = logicalLayer;
    });

    // 1px distance at the current view, in km — used to turn water_stream/water_river's
    // pixel line-width into a buffer radius (see polygonizeWaterLines). Same technique as
    // the 1px mapBounds buffer in geometryStitch.ts's stitch().
    const p1 = maplibreMap.unproject([0, 0]);
    const p2 = maplibreMap.unproject([1, 0]);
    const kmPerPixel = distance([p1.lng, p1.lat], [p2.lng, p2.lat]);
    logTime('polygonizeWaterLines');
    geometries = polygonizeWaterLines(geometries, kmPerPixel);
    logTimeEnd('polygonizeWaterLines');

    const presentLayers = new Set<MicroLayerId>(
        geometries.map(g => kebabCase(g.properties.mapLayerId) as MicroLayerId),
    );
    appState.microEmptyLayers = activeLogicalLayers.filter(
        l => !presentLayers.has(kebabCase(l) as MicroLayerId),
    );

    const geometries2d = geometries.filter(geom =>
        geom.properties.mapLayerId !== "buildings" || !layerDefinitions.buildings['3dBuildings']
    ) as RenderedFeaturePoly[];
    orderFeaturesByLayer(geometries2d);

    // Query background layer features separately so they are never mixed with MICRO_LAYERS
    // inside getRenderedFeatures/stitchPolygons. Both can share the same computedId (same
    // sourceLayer + class on the underlying OSM feature), which would cause one to overwrite
    // the other's mapLayerId during the stitch union. Raw unstitched geometries are fine here
    // because tile-boundary fragments still punch holes correctly.
    const cutoutFeatures = maplibreMap.queryRenderedFeatures({ layers: BACKGROUND_LAYERS })
        .filter(f => f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon')
        .map(f => ({ type: 'Feature' as const, id: f.id, properties: { ...f.properties, mapLayerId: f.layer.id }, geometry: f.geometry })) as RenderedFeaturePoly[];
    const mainFeatures = geometries2d;

    if (cutoutFeatures.length > 0) {
        let defs = svg.select('defs');
        if (defs.empty()) defs = svg.append('defs') as any;
        const mask = defs.append('mask')
            .attr('id', 'cutoutMask')
            .attr('maskUnits', 'userSpaceOnUse');
        mask.append('rect').attr('x', 0).attr('y', 0).attr('width', width).attr('height', height).attr('fill', 'white');
        cutoutFeatures.forEach(f => {
            const d = d3PathFunction(f.geometry);
            if (d) mask.append('path').attr('d', d).attr('fill', 'black');
        });
    }

    const borderWidth = generalParams.Border.borderWidth;
    const borderPadding = generalParams.Border.borderPadding;
    const borderRadius = generalParams.Border.borderRadius;
    const borderColor = generalParams.Border.borderColor;
    resizeMaplibreMap(generalParams, maplibreMap);
    const translateAmount = borderPadding + (borderWidth / 2);

    const outerFrameWidth = width - borderPadding;
    const outerFrameHeight = height - borderPadding;
    const outerFrameRx = (borderRadius / 100) * Math.min(outerFrameWidth, outerFrameHeight);
    // Background layer
    svg.append('rect')
        .attr('id', 'micro-background')
        .attr('x', 0)
        .attr('y', 0)
        .attr('width', width)
        .attr('height', height)
        .attr('rx', outerFrameRx);

    svg.append('g')
        .attr('id', 'micro')
        .attr("clip-path", "url(#clipMapBorder)")
        .selectAll('path')
        .data(mainFeatures)
        .enter()
        .append("path")
        .attr("d", (d) => d3PathFunction(d.geometry))
        .attr("class", d => {
            const layerIdKebab = kebabCase(d.properties.mapLayerId) as MicroLayerId;
            const classes: string[] = [layerIdKebab];
            if (layerIdKebab.includes('path') || layerIdKebab.includes('road')) classes.push('line');
            else classes.push(d.geometry.type.includes("Line") ? 'line' : 'poly');
            const state = layerDefinitions[layerIdKebab];
            if (!state) classes.push('background');
            if (state?.fills) {
                classes.push(`${layerIdKebab}-${random(0, state.fills.length - 1)}`);
            }
            d.properties.class = classes.join(' ');
            return classes.join(' ');
        })
        // Inline style, not an attribute: attribute-level stroke-width is a
        // presentation attribute and gets overridden by any CSS class rule
        // (e.g. the per-layer "#micro .water { stroke-width }" rule), which
        // would otherwise clobber this per-feature MapLibre-computed width.
        .style("stroke-width", d => d.properties.paint!['line-width'] ?? null)
        .attr("id", d => d.properties.uuid!)
        .attr("mask", d =>
            cutoutFeatures.length > 0 && CUTOUT_TARGET_LAYERS.includes(d.properties.mapLayerId!)
                ? 'url(#cutoutMask)'
                : null
        );

    const buildings = geometries.filter(geom => geom.properties.mapLayerId === "buildings") as RenderedFeaturePoly[];
    if (layerDefinitions.buildings['3dBuildings']) {

        const { normalFeatures, groupedFeatures } = groupBuildingFeatures(buildings);
        log('normalFeatures=', normalFeatures);
        log('groupedFeatures=', groupedFeatures);
        renderBuildingsToSvgImproved(
            [...normalFeatures, ...groupedFeatures],
            maplibreMap,
            svg,
            translateAmount,
            layerDefinitions['buildings'],
            false
        );
    }
    
    drawMicroFrame(svg, width, height, borderWidth, borderRadius, borderPadding, borderColor, false, outerFrameRx);
    mapLibreContainer.style('opacity', 0);
    setTimeout(() => {
        postClip(generalParams);
        const svgNode = svg.node() as SVGSVGElement;
        const buildingsGroup = svgNode.querySelector('#buildings');
        const buildingPaths = buildingsGroup
            ? [...buildingsGroup.querySelectorAll<SVGPathElement>('path')]
            : [...svgNode.querySelectorAll<SVGPathElement>('.buildings')];
        const microGroup = svgNode.querySelector('#micro');
        const linePaths = microGroup
            ? [...microGroup.querySelectorAll<SVGPathElement>('path.line')]
            : [];
        if (buildingPaths.length > 0 || linePaths.length > 0) removeNotRenderedElements(linePaths, buildingPaths);
    }, 200);
    pendingCutout = applyCutoutsDeferred(svg, d3PathFunction, mainFeatures, cutoutFeatures);
}

export function resizeMaplibreMap(generalParams: MicroParams, mapLibreMap: MapLibreMap): void {
    const mapLibreContainer = select(mapLibreMap.getContainer());
    const width = generalParams.General.width;
    const height = generalParams.General.height;
    const borderWidth = generalParams.Border.borderWidth;
    const borderPadding = generalParams.Border.borderPadding;

    const finalWidth = Math.ceil(width - ((borderPadding + (borderWidth / 2)) * 2));
    const finalHeight = Math.ceil(height - ((borderPadding + (borderWidth / 2)) * 2));
    const finalPadding = borderPadding + (borderWidth / 2);

    const currentStyle = mapLibreContainer.node()?.style;
    // Compare paddingTop (longhand) instead of padding (shorthand) — browsers decompose
    // shorthand padding into longhand properties, so style.padding returns "" even after
    // being set, causing resize() to fire every time and creating an infinite loop.
    const styleChanged = currentStyle?.width !== `${finalWidth}px`
        || currentStyle?.height !== `${finalHeight}px`
        || currentStyle?.paddingTop !== `${finalPadding}px`;
    mapLibreContainer
        .style('width', `${finalWidth}px`)
        .style('height', `${finalHeight}px`)
        .style('padding', `${finalPadding}px`);
    if (styleChanged) {
        mapLibreMap.resize();
    } else {
        // Even if inline styles haven't changed (e.g. after switching macro→micro),
        // the canvas may be stale. Compare the canvas CSS size against the expected size.
        const canvas = mapLibreMap.getCanvas();
        const canvasRect = canvas.getBoundingClientRect();
        if (Math.round(canvasRect.width) !== finalWidth || Math.round(canvasRect.height) !== finalHeight) {
            mapLibreMap.resize();
        }
    }
}

function postClip(generalParams: MicroParams): void {
    const roundedRect = roundedRectFromParams(generalParams);

    const height = generalParams.General.height;
    // select('#micro').append("path").attr('d', polyToPath(roundedRect.geometry.coordinates[0], height));
    postClipSimple();
    const toRemove: Element[] = [];
    document.querySelectorAll('#micro path').forEach(el => {
        const bbox = (el as SVGGraphicsElement).getBBox();
        const bboxRect: [number, number, number, number] = [
            bbox.x,
            height - bbox.y,
            bbox.x + bbox.width,
            height - bbox.y - bbox.height
        ];
        const bboxPoly = bboxPolygon(bboxRect);
        if (booleanDisjoint(roundedRect, bboxPoly)) {
            toRemove.push(el);
        }
    });
    log('toRemove', toRemove);
    toRemove.forEach(el => el.remove());
}

function roundedRectFromParams(microParams: MicroParams): Feature<Polygon> {
    const width = microParams.General.width;
    const height = microParams.General.height;
    const borderPadding = microParams.Border.borderPadding;
    const borderRadius = microParams.Border.borderRadius;
    const outerFrameWidth = width - borderPadding;
    const outerFrameHeight = height - borderPadding;
    const outerFrameRx = (borderRadius / 100) * Math.min(outerFrameWidth, outerFrameHeight);
    const innerFrameWidth = outerFrameWidth - borderPadding;
    const innerFrameHeight = outerFrameHeight - borderPadding;
    const innerFrameRadius = Math.max(0, outerFrameRx - borderPadding);

    return createRoundedRectangleGeoJSON(
        innerFrameWidth,
        innerFrameHeight,
        innerFrameRadius,
        (innerFrameWidth / 2) + borderPadding,
        (innerFrameHeight / 2) + borderPadding
    );
}

function polyToPath(coords: number[][], height: number): string {
    let d = '';
    for (let i = 0; i < coords.length; i++) {
        const p = coords[i];
        if (i === 0) d += `M${p[0]},${height - p[1]}`;
        else d += `L${p[0]},${height - p[1]}`;
    }
    return d;
}

export function drawMicroFrame(
    svg: SvgSelection,
    width: number,
    height: number,
    borderWidth: number,
    borderRadius: number,
    borderPadding: number,
    borderColor: string,
    animated: boolean,
    outerFrameRx: number
): Selection<SVGRectElement, any, SVGSVGElement, any> {
    // Calculate positions and dimensions
    // For the outer frame (border padding)
    const outerFrameHalfWidth = borderPadding / 2;
    const outerFrameX = outerFrameHalfWidth;
    const outerFrameY = outerFrameHalfWidth;
    const outerFrameWidth = width - borderPadding;
    const outerFrameHeight = height - borderPadding;

    // For the inner frame (border width)
    const innerFrameX = outerFrameX + outerFrameHalfWidth;
    const innerFrameY = outerFrameY + outerFrameHalfWidth;
    const innerFrameWidth = outerFrameWidth - borderPadding;
    const innerFrameHeight = outerFrameHeight - borderPadding;
    const innerFrameRx = Math.max(0, outerFrameRx - borderPadding);

    // Draw the inner frame (border width)
    const frame = svg.append('rect')
        .attr('x', innerFrameX)
        .attr('y', innerFrameY)
        .attr('id', 'frame')
        .attr('width', innerFrameWidth)
        .attr('height', innerFrameHeight)
        .attr('rx', innerFrameRx)
        .attr('fill', 'none')
        .attr('stroke', borderColor)
        .attr('stroke-width', borderWidth);

    if (animated) frame.attr('pathLength', 1)
    appendClip(svg, innerFrameWidth, innerFrameHeight, innerFrameRx, innerFrameX, innerFrameY);

    if (animated) {
        frame.on("animationend", (e) => {
            setTimeout(() => {
                svg.classed('animate', false);
                svg.selectAll('path[pathLength]').attr('pathLength', null);
                setTimeout(() => {
                    svg.classed('animate-transition', false);
                }, 1500);
            }, 200);
        });
    }
    return frame;
}

/** Recolors the map border directly in the DOM, without going through a full draw() cycle. */
export function updateMicroBorderColor(color: Color): void {
    microState.microParams.Border.borderColor = color;
    select("#frame").attr("stroke", color);
}

/**
 * Groups building features by separating parts (kind === "building_part") from non-parts,
 * then assigning each part to its containing non-part building.
 */
export function groupBuildingFeatures(features: RenderedFeaturePoly[]): GroupBuildingResult {

    logTime('grouping buildings');
    // Step 1: Separate features into parts and non-parts
    const parts: RenderedFeaturePoly[] = [];
    const nonParts: GroupedFeature[] = [];

    for (const feature of features) {
        if (feature.properties.kind_detail === "yes" || (feature.properties.kind_detail !== "no" && feature.properties.kind === "building_part")) {
            parts.push(feature);
        } else {
            // Initialize parts array on each non-part
            nonParts.push({
                ...feature,
                parts: []
            });
        }
    }

    // If no parts, return all as normal features
    if (parts.length === 0) {
        return {
            normalFeatures: nonParts,
            groupedFeatures: []
        };
    }

    // Step 2: Pre-compute geometry data for all features
    interface FeatureData {
        feature: RenderedFeaturePoly | GroupedFeature;
        bbox: [number, number, number, number];
        area: number;
        center: [number, number];
    }

    const partData: FeatureData[] = parts.map(f => ({
        feature: f,
        bbox: bbox(f) as [number, number, number, number],
        area: area(f),
        center: center(f).geometry.coordinates as [number, number]
    }));

    const nonPartData: FeatureData[] = nonParts.map(f => ({
        feature: f,
        bbox: bbox(f) as [number, number, number, number],
        area: area(f),
        center: center(f).geometry.coordinates as [number, number]
    }));

    // Step 3: Pre-filter candidates - for each part, find non-parts whose bbox fully contains it
    const partCandidates: Map<number, number[]> = new Map();
    for (let pIdx = 0; pIdx < partData.length; pIdx++) {
        const partBbox = partData[pIdx].bbox;
        const candidates: number[] = [];
        for (let npIdx = 0; npIdx < nonPartData.length; npIdx++) {
            if (bboxContains(nonPartData[npIdx].bbox, partBbox)) {
                candidates.push(npIdx);
            }
        }
        partCandidates.set(pIdx, candidates);
    }

    // Track orphan parts
    const orphanParts: { partIdx: number; data: FeatureData }[] = [];

    // Step 4: For each part, find which non-part it belongs to (using pre-filtered candidates)
    for (let pIdx = 0; pIdx < partData.length; pIdx++) {
        const pData = partData[pIdx];
        const part = pData.feature as RenderedFeaturePoly;
        const partBbox = pData.bbox;

        let bestMatch: GroupedFeature | null = null;
        let bestOverlap = 0;

        // Only iterate through pre-filtered candidates
        const candidates = partCandidates.get(pIdx) || [];
        if (candidates.length === 1) {
            bestMatch = nonPartData[candidates[0]].feature as GroupedFeature;
        }
        else {
            for (const npIdx of candidates) {
                const npData = nonPartData[npIdx];
                const nonPart = npData.feature as GroupedFeature;
                const nonPartBbox = npData.bbox;

                // Calculate bbox overlap percentage (cheap operation)
                const [pMinX, pMinY, pMaxX, pMaxY] = partBbox;
                const [npMinX, npMinY, npMaxX, npMaxY] = nonPartBbox;

                const intersectMinX = Math.max(pMinX, npMinX);
                const intersectMinY = Math.max(pMinY, npMinY);
                const intersectMaxX = Math.min(pMaxX, npMaxX);
                const intersectMaxY = Math.min(pMaxY, npMaxY);

                const bboxIntersectArea = (intersectMaxX - intersectMinX) * (intersectMaxY - intersectMinY);
                const partBboxArea = (pMaxX - pMinX) * (pMaxY - pMinY);
                const bboxOverlapPercentage = bboxIntersectArea / partBboxArea;

                // Skip if bbox overlap is less than 70% - actual geometry overlap unlikely to be > 80%
                if (bboxOverlapPercentage < 0.7) continue;

                // Calculate geometry intersection
                // const intersection = intersect(featureCollection([part, nonPart]));
                // if (!intersection) continue;

                // // Calculate overlap percentage
                // const overlapArea = area(intersection);
                // const overlapPercentage = overlapArea / partArea;

                // If >80% overlap, consider it a match
                if (bboxOverlapPercentage > 0.8 && bboxOverlapPercentage > bestOverlap) {
                    bestMatch = nonPart;
                    bestOverlap = bboxOverlapPercentage;
                }
            }
        }
        if (bestMatch) {
            bestMatch.parts.push(part);
        } else {
            // Mark as orphan
            orphanParts.push({ partIdx: pIdx, data: pData });
        }
    }
    // Step 5: Assign orphan parts to the closest non-part by centroid distance
    for (const orphan of orphanParts) {
        const orphanCenter = orphan.data.center;
        let closestNonPart: GroupedFeature | null = null;
        let closestDistance = Infinity;

        for (const npData of nonPartData) {
            const dist = centroidDistance(orphanCenter, npData.center);
            if (dist < closestDistance) {
                closestDistance = dist;
                closestNonPart = npData.feature as GroupedFeature;
            }
        }

        if (closestNonPart) {
            closestNonPart.parts.push(orphan.data.feature as RenderedFeaturePoly);
        }
    }

    // Step 6: Return normal features (empty parts) and grouped features (non-empty parts)
    const normalFeatures: RenderedFeaturePoly[] = [];
    const groupedFeatures: GroupedFeature[] = [];

    for (const nonPart of nonParts) {
        if (nonPart.parts.length === 0) {
            normalFeatures.push(nonPart);
        } else {
            groupedFeatures.push(nonPart);
        }
    }
    logTimeEnd('grouping buildings');
    logTime('determining heights');
    computeBaseHeights(groupedFeatures);
    logTimeEnd('determining heights');
    return { normalFeatures, groupedFeatures };
}

/**
 * Computes base heights for parts within grouped features.
 * For each part, finds the tallest container (another part that fully contains it
 * but has a lower height), and sets the part's base_height to that container's height.
 */
export function computeBaseHeights(groupedFeatures: GroupedFeature[]): void {
    for (const groupedFeature of groupedFeatures) {
        const parts = groupedFeature.parts;

        const partBboxes = parts.map(p => bbox(p));

        for (let i = 0; i < parts.length; i++) {
            const currentPart = parts[i];

            // Skip if the part already has min_height property defined
            if (currentPart.properties.min_height !== undefined) continue;

            const currentHeight = currentPart.properties.height ?? 0;
            const currentBbox = partBboxes[i];
            // const currentArea = area(currentPart);

            let tallestContainerHeight = -1;

            // Look through ALL other parts in the same group
            for (let j = 0; j < parts.length; j++) {
                if (i === j) continue;

                const otherPart = parts[j];
                const otherHeight = otherPart.properties.height ?? 0;

                // Container's height must be LOWER than current part's height
                if (otherHeight >= currentHeight) continue;

                // Skip if this container is not taller than our current best
                if (otherHeight <= tallestContainerHeight) continue;

                const otherBbox = partBboxes[j];

                // Bbox containment check before expensive intersection
                // Check if current bbox is potentially contained in other bbox
                if (!bboxIntersects(currentBbox, otherBbox)) continue;

                // Quick check: other bbox should be able to contain current bbox
                const [cMinX, cMinY, cMaxX, cMaxY] = currentBbox;
                const [oMinX, oMinY, oMaxX, oMaxY] = otherBbox;

                // For containment, other should be larger or equal in all dimensions
                // We use a tolerance here since we're checking >95% containment
                const intersectMinX = Math.max(cMinX, oMinX);
                const intersectMinY = Math.max(cMinY, oMinY);
                const intersectMaxX = Math.min(cMaxX, oMaxX);
                const intersectMaxY = Math.min(cMaxY, oMaxY);

                if (intersectMaxX <= intersectMinX || intersectMaxY <= intersectMinY) continue;

                const bboxIntersectArea = (intersectMaxX - intersectMinX) * (intersectMaxY - intersectMinY);
                const currentBboxArea = (cMaxX - cMinX) * (cMaxY - cMinY);
                const bboxContainmentPercentage = bboxIntersectArea / currentBboxArea;

                // Skip if bbox containment is less than 90% (actual containment unlikely to be >95%)
                if (bboxContainmentPercentage < 0.9) continue;

                // Check full containment using intersect (>95% overlap)
                // const intersection = intersect(featureCollection([currentPart, otherPart]));
                // if (!intersection) continue;

                // const overlapArea = area(intersection);
                // const containmentPercentage = overlapArea / currentArea;

                // Container must fully contain the current part (>95% overlap)
                // if (bboxContainmentPercentage > 0.95) {
                tallestContainerHeight = otherHeight;
                // }
            }

            // Set base_height to the container's height (if found)
            if (tallestContainerHeight > -1) {
                currentPart.properties.base_height = tallestContainerHeight;
            }
        }

        // Compute shouldRender for the root element
        const rootHeight = groupedFeature.properties.height;
        if (rootHeight == null || parts.length < 5) {
            groupedFeature.properties.shouldRender = true;
        } else {
            const meanPartHeight = parts.reduce((sum, p) => sum + (p.properties.height ?? rootHeight), 0) / parts.length;
            const heightSuggestsPodium = rootHeight < 30 || rootHeight < meanPartHeight;

            // The root is only redundant with its parts (and safe to skip) when the parts'
            // combined footprint actually covers most of the root's footprint (podium/tower
            // case). For a large complex/courtyard root containing several small, scattered
            // structures, the parts cover only a fraction of it, so the root is a distinct
            // volume in its own right and must still render even if it's the tallest element.
            const rootArea = area(groupedFeature);
            const partsArea = parts.reduce((sum, p) => sum + area(p), 0);
            const partsCoverMostOfRoot = rootArea > 0 && (partsArea / rootArea) > 0.7;

            groupedFeature.properties.shouldRender = heightSuggestsPodium || !partsCoverMostOfRoot;
        }
    }
}

export function initLayersState(providedPalette: Partial<MicroPalette>): MicroPalette {
    const palette = cloneDeep(providedPalette) as Partial<MicroPalette>;
    // if (!palette['forest']) palette['forest'] = { ...palette['wood'], active: false };
    // if (!palette['roads_other']) palette['roads_other'] = { ...palette['roads_minor'], active: false };
    if (!palette['railways']) palette['railways'] = { ...palette['roads'], active: false };
    if (!palette['paths']) palette['paths'] = { ...palette['roads'], active: false };

    Object.entries(palette).forEach(([layer, state]) => {
        if (layer === "borderParams") return;
        if (state.menuOpened == null) state.menuOpened = false;
        let pattern = state.pattern;
        if (!pattern && state.fill) {
            state.pattern = pattern = { hatch: '.', active: false };
        } else if (pattern) {
            pattern.active = true;
        }
        if (!pattern) return;
        if (pattern.menuOpened == null) pattern.menuOpened = pattern.active;
        if (!pattern.id) pattern.id = `pattern-${layer}`;
        if (!pattern.color) pattern.color = darken(state.fill!);
        if (!pattern.strokeWidth) pattern.strokeWidth = 3;
        if (!pattern.scale) pattern.scale = 1.3;
    });

    // if (!palette['building1']) {
    //     const strokeRef = palette['building0'].stroke;
    //     const fillRef = hsl(color(palette['building0'].fill));
    //     console.log(fillRef);
    //     const lighter1 = fillRef.brighter(0.2).formatHex();
    //     const lighter2 = fillRef.brighter(0.4).formatHex();
    //     palette['building1'] = { stroke: strokeRef, fill: lighter1 };
    //     palette['building2'] = { stroke: strokeRef, fill: lighter2 };
    // }
    return palette as MicroPalette;
}

function lighten(c: string, quantity: number = 0.2): Color {
    return hsl(color(c)!)!.brighter(quantity).formatHex() as Color;
}

function darken(c: string, quantity: number = 0.4): Color {
    return hsl(color(c)!)!.darker(quantity).formatHex() as Color;
}

export function generateCssFromState(state: MicroPalette): string | null {
    log('generateCssFromState');
    const [sheet, _] = findStyleSheet("#micro .line");
    let css = `
    #micro .line { 
        fill: none; 
        stroke-linecap: round;
        stroke-linejoin: round;
    }
    #micro .poly {
        stroke-linejoin: round;
    }
    #micro .water.line {
        fill: none;
    }
    #paths path {
        stroke: ${state['roads']?.stroke ?? '#6D4C41'};
        fill: none;
        stroke-width: 2px;
    }
    #freehand-drawings .freehand {
        paint-order: stroke;
        fill: ${state['roads']?.stroke ?? '#6D4C41'};
    }

    #freehand-drawings g path {
        fill: inherit;
    }
    .shape {
        fill: black;
    }
    .text {
        paint-order: stroke;
        stroke-width: 0px;
    }
    `;

    for (const [layer, layerDef] of Object.entries(state)) {
        if (layer === "borderParams") continue;
        let ruleContent: Record<string, string | number> = {};
        let ruleHoverContent: Record<string, string | number> = {};

        if (layerDef.stroke) {
            ruleContent['stroke'] = layerDef.stroke;
            if (!layer.includes('road') && !layer.includes('path') && !layer.includes('rail')) {
                ruleContent['stroke-width'] = layerDef['stroke-width'] ?? '1px';
            }
            if (layer.includes('path') && !layerDef['stroke-dasharray']) {
                ruleContent['stroke-dasharray'] = 5;
            }
            const dashArray = layerDef['stroke-dasharray'];
            if (dashArray) ruleContent['stroke-dasharray'] = dashArray;
            const lighter = lighten(layerDef.stroke);
            ruleHoverContent['stroke'] = lighter;
        }

        if (layerDef.pattern?.active) {
            ruleContent['fill'] = `url(#${layerDef.pattern.id})`;
            ruleHoverContent['fill'] = `url(#${layerDef.pattern.id}-light)`;
        }
        else if (layerDef.fill) {
            ruleContent['fill'] = layerDef.fill;
            const lighter = lighten(layerDef.fill);
            ruleHoverContent['fill'] = lighter;
        }

        if (size(ruleContent) > 0) {
            if (layer === "background") {
                css += updateStyleSheetOrGenerateCss(sheet, '#micro-background', ruleContent);
                css += updateStyleSheetOrGenerateCss(sheet, '#micro .background', ruleContent);
            } else {
                css += updateStyleSheetOrGenerateCss(sheet, `#micro .${layer}`, ruleContent);
                // css += updateStyleSheetOrGenerateCss(sheet, `#micro .${layer}:hover`, ruleHoverContent);
            }
        }

        if (layerDef.fills) {
            layerDef.fills.forEach((fill, i) => {
                css += updateStyleSheetOrGenerateCss(sheet, `#micro .${layer}-${i}`, { 'fill': fill });
                css += updateStyleSheetOrGenerateCss(sheet, `#micro .${layer}-${i}:hover`, { 'fill': lighten(fill) });
            });
            if (layerDef['3dBuildings']) {
                // 'miter' instead of 'round' avoids the expensive round-join arc tessellation
                css += updateStyleSheetOrGenerateCss(sheet, `#buildings`, { 'stroke': layerDef.stroke!, 'stroke-linejoin': 'miter' });
                layerDef.fills.forEach((fill, i) => {
                    css += updateStyleSheetOrGenerateCss(sheet, `#buildings .${layer}-${i}`, {
                        '--building-color': fill,
                        'fill': 'var(--building-color)'
                    });
                    css += updateStyleSheetOrGenerateCss(sheet, `#buildings .${layer}-${i} .roof`, {
                        'fill': 'color-mix(in srgb, var(--building-color), white 20%)'
                    });
                    css += updateStyleSheetOrGenerateCss(sheet, `#buildings .${layer}-${i}:hover .roof`, {
                        'fill': 'color-mix(in srgb, var(--building-color), white 40%)'
                    });
                    css += updateStyleSheetOrGenerateCss(sheet, `#buildings .${layer}-${i}:hover .wall`, {
                        'fill': 'color-mix(in srgb, var(--building-color), white 20%)'
                    });
                });
            }
        }
    }

    if (sheet) return null;
    return css;
}

function updateSvgPatterns(svgNode: SVGElement | null, layerState: MicroPalette): void {
    if (!svgNode) return;
    const patterns: PatternDefinition[] = Object.values(layerState).map((def) => {
        return {
            ...def.pattern,
            backgroundColor: def.fill
        }
    }).filter((pattern) =>
        pattern?.active === true && pattern.backgroundColor != null
    );

    /** Add lighter variations to patterns for hovering */
    for (const pattern of [...patterns]) {
        if (pattern.id?.includes('background')) continue;
        patterns.push({
            ...pattern,
            backgroundColor: lighten(pattern.backgroundColor!),
            id: `${pattern.id}-light`
        });
    }
    patternGenerator.addOrUpdatePatternsForSVG(svgNode.querySelector('defs') as unknown as SVGDefsElement, patterns);
}


export async function exportMicro(
    svg: SvgSelection,
    stateMicro: StateMicro,
    providedFonts: ProvidedFont[],
    commonCss: string,
    options: ExportOptions = {},
    downloadExport: boolean = true,
    elementAnnotations?: ElementAnnotations,
): Promise<string | void> {
    await awaitPendingCutout();
    const {
        exportFonts = exportFontChoices.convertToPath,
        animate = false,
        useViewBox = false,
        frameShadow = false,
        minifyJs = false,
        customAttributions,
        skipAttribution = false,
        hideBrand = false,
        texture,
        textureMode = 'overlay',
    } = options;
    const width = stateMicro.microParams.General.width;
    const height = stateMicro.microParams.General.height;
    const borderPadding = stateMicro.microParams.Border.borderPadding;
    const borderRadius = stateMicro.microParams.Border.borderRadius;
    const svgNode = svg.node()! as SVGSVGElement;

    const usedFonts = getUsedInlineFonts(svgNode);
    const usedProvidedFonts = providedFonts.filter(font => usedFonts.has(font.name));
    const { optimize } = await import('svgo/browser');

    const defs = svgNode.querySelector('defs')!.cloneNode(true);
    const annotationIds = new Set(Object.keys(elementAnnotations ?? {}));

    // Temporarily mutate the SVG to produce a clean outerHTML for SVGO,
    // then restore everything so the live editor is unaffected.
    const savedStyle = svgNode.getAttribute('style');
    svgNode.removeAttribute('style');

    const selectionOverlay = svgNode.querySelector('#selection-overlay');
    const overlayParent = selectionOverlay?.parentNode ?? null;
    const overlayNextSibling = selectionOverlay?.nextSibling ?? null;
    selectionOverlay?.remove();

    // Remove ALL foreignObjects before SVGO (element-annotation tooltip, open popover).
    // Each may contain HTML5 content with void elements (<br>, <img>) that break SVGO's XML parser.
    const fos = Array.from(svgNode.querySelectorAll('foreignObject'));
    fos.forEach(fo => document.body.append(fo));

    const strippedIds: Array<{ el: Element; id: string }> = [];
    svgNode.querySelectorAll('#micro path').forEach(el => {
        const id = el.getAttribute('id');
        if (id && !annotationIds.has(id)) {
            strippedIds.push({ el, id });
            el.removeAttribute('id');
        }
    });

    // Optimize whole SVG
    const finalSvg = optimize(svgNode.outerHTML, svgoConfig as Config).data;

    // Restore live SVG to its original state
    if (savedStyle !== null) svgNode.setAttribute('style', savedStyle);
    if (selectionOverlay && overlayParent) overlayParent.insertBefore(selectionOverlay, overlayNextSibling);
    fos.forEach(fo => svgNode.append(fo));
    strippedIds.forEach(({ el, id }) => el.setAttribute('id', id));
    const optimizedSVG = DOM_PARSER.parseFromString(finalSvg, 'image/svg+xml');
    let pathIsBetter = false;

    if (exportFonts == exportFontChoices.smallest || exportFonts == exportFontChoices.convertToPath) {
        pathIsBetter = await inlineFontVsPath(optimizedSVG.firstChild as SVGElement, usedProvidedFonts, exportFonts);
    }
    else if (exportFonts == exportFontChoices.noExport) {
        pathIsBetter = true;
    }

    const hasAnnotations = elementAnnotations && Object.keys(elementAnnotations).length > 0;

    // Styling
    const mapId = randomString(5);
    const styleElem = document.createElementNS("http://www.w3.org/2000/svg", 'style');
    const renderedCss = commonCss.replaceAll(/rgb\(.*?\)/g, rgb2hex) + additionnalCssExport;
    const animateCss = animate ? transitionCssMicro : '';
    const finalCss = discriminateCssForExport(renderedCss + animateCss, mapId);

    const svgElement = optimizedSVG.firstChild as SVGElement;
    svgElement.setAttribute('id', mapId);
    svgElement.querySelector('defs')!.remove();
    svgElement.append(defs);
    svgElement.querySelectorAll('#micro > path, #buildings > g').forEach(el => {
        const id = el.getAttribute('id');
        if (id && !annotationIds.has(id)) el.removeAttribute('id');
    });
    changeIdAndReferences(svgElement, mapId);

    // Build animation and annotation code after changeIdAndReferences so IDs are resolved correctly
    const animationCode = animate
        ? intersectionObserverScript.replaceAll('__ON_ANIMATION_END__', '')
        : '';

    let annotationCode = '';
    if (hasAnnotations) {
        const resolvedAnnotations: Record<string, { tooltip?: string; popover?: string }> = {};
        for (const [id, ann] of Object.entries(elementAnnotations!)) {
            // #paths elements get their IDs prefixed by changeIdAndReferences; try both
            const resolvedId = optimizedSVG.getElementById(id) ? id : `${mapId}-${id}`;
            if (optimizedSVG.getElementById(resolvedId)) {
                resolvedAnnotations[resolvedId] = {
                    tooltip: ann.tooltip ? xhtmlifyHtml(ann.tooltip) : undefined,
                    popover: ann.popover ? xhtmlifyHtml(ann.popover) : undefined,
                };
            }
        }
        if (Object.keys(resolvedAnnotations).length > 0) {
            annotationCode = elementAnnotationsScript.replaceAll(
                '__ELEMENT_ANNOTATIONS__',
                JSON.stringify(resolvedAnnotations)
            );
        }
    }

    let fontCss = '';
    if (!pathIsBetter) {
        const svgTextContent = (optimizedSVG.firstChild as SVGElement)?.textContent || '';
        if (exportFonts === exportFontChoices.embedFontFace || exportFonts === exportFontChoices.smallest) {
            fontCss = await fontsToCssMultiSubset(usedProvidedFonts, svgTextContent);
        } else {
            fontCss = await fontsToCssEmbedMultiSubset(usedProvidedFonts, svgTextContent);
        }
    }
    styleElem.innerHTML = finalCss + fontCss;
    svgElement.append(styleElem);
    svgElement.classList.remove('animate-transition');
    svgElement.classList.add('mapello');

    let shadowPadded = false;

    if (frameShadow) {
        const outerFrameRx = Math.max(0, (borderRadius / 100) * Math.min(width - borderPadding, height - borderPadding));
        addFrameShadow(svgElement, mapId, {
            x: 0,
            y: 0,
            width,
            height,
            rx: outerFrameRx,
        });
        const m = FRAME_SHADOW_MARGIN;
        const paddedW = width + 2 * m;
        const paddedH = height + 2 * m;
        svgElement.setAttribute('width', String(paddedW));
        svgElement.setAttribute('height', String(paddedH));
        svgElement.setAttribute('viewBox', `${-m} ${-m} ${paddedW} ${paddedH}`);
        shadowPadded = true;
    }

    if (animate || hasAnnotations) {
        let js = `(function() {
        const mapElement = document.currentScript.parentNode;
        ${animationCode}
        ${annotationCode}
    })()`;

        if (minifyJs !== false) {
            const terser = await import('terser');
            const minified = await terser.minify(js, {
                toplevel: true,
                mangle: { eval: true }
            });
            js = minified.code || js;
        }

        const scriptElem = document.createElementNS("http://www.w3.org/2000/svg", 'script');
        const scriptContent = document.createTextNode(js);
        scriptElem.appendChild(scriptContent);
        svgElement.append(scriptElem);
    }

    if (texture) {
        // Create a clip path that matches the micro map's outer frame (with border radius)
        // so the texture never bleeds outside the frame edges.
        const outerFrameRxTex = Math.max(0, (borderRadius / 100) * Math.min(width - borderPadding, height - borderPadding));
        const texClipId = `${mapId}-tex-clip`;
        let texDefs = svgElement.querySelector('defs');
        if (!texDefs) {
            texDefs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
            svgElement.prepend(texDefs);
        }
        const texClip = document.createElementNS('http://www.w3.org/2000/svg', 'clipPath');
        texClip.setAttribute('id', texClipId);
        const texClipRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        texClipRect.setAttribute('x', '0');
        texClipRect.setAttribute('y', '0');
        texClipRect.setAttribute('width', String(width));
        texClipRect.setAttribute('height', String(height));
        if (outerFrameRxTex > 0) texClipRect.setAttribute('rx', String(outerFrameRxTex));
        texClip.appendChild(texClipRect);
        texDefs.appendChild(texClip);

        // For background mode: insert after #micro-background so the texture is visible
        // on the background colour but stays below all map features.
        const bgEl = svgElement.querySelector('#micro-background') as Element | null;
        addTexture(svgElement, mapId, texture, textureMode, width, height, texClipId, bgEl);
    }

    if (!skipAttribution) addAttribution(svgElement, width, height, 'micro', customAttributions, hideBrand);

    if (useViewBox) {
        if (!shadowPadded) {
            svgElement.setAttribute('viewBox', `0 0 ${width} ${height}`);
        }
        svgElement.removeAttribute('width');
        svgElement.removeAttribute('height');
    }

    if (!downloadExport) return svgElement.outerHTML;
    download(svgElement.outerHTML, 'text/plain', 'mapello-export.svg');
}