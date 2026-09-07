import bbox from "@turf/bbox";
import { log } from './log';
import bboxPolygon from "@turf/bbox-polygon";
import booleanDisjoint from "@turf/boolean-disjoint";
import { featureCollection, polygon, lineString } from "@turf/helpers";
import intersect from "@turf/intersect";
import union from "@turf/union";
import center from "@turf/center";
import { groupBy } from 'lodash-es';
import { tiles as getTiles } from '@mapbox/tile-cover';
import bboxClip from "@turf/bbox-clip";
import type { Map as MaplibreMap } from 'maplibre-gl';
import { mergeLineStrings } from "./linestitch";
import { yieldToMain } from "./polyfills";
import type { BBox, Feature, Geometry, LineString, MultiLineString, MultiPolygon, Polygon, Position } from "geojson";
import { lineIntersect } from "@turf/line-intersect";
import { booleanWithin } from "@turf/boolean-within";
import booleanIntersects from "@turf/boolean-intersects";
import { buffer } from "@turf/buffer";
import { distance } from "@turf/distance";
import RBush from "rbush";

/**
 * This file contains an attempt at stitching tiles together.
 * The problem is that, when we use queryRenderedFeatures, the resulting geometries may be split among tiles.
 * The most problematic layer is the building layer. IDs of the polygons between tiles don't match, and we can have 
 * convoluted situations with the tiles buffer. We can have:
 * - a polygon that is cut and continues on another tile
 * - the beginning of a new polygon beyond the tile extent that is fully contained by the polygon on the other tile
 * 
 * A process for stitching tiles together is:
 * 1. Identify where the possible cuts are.
 * 
 * Cuts are perfectly vertical or horizontal, and are at a specific distance from a tile boundary, so it should not be too hard to find.
 * 
 * Then, for each layer (source layer + class + subclass):
 * 2. Filter polygons in the viewport.
 * To not have to process too much data that is not needed.
 * 
 * 3. Identify polygons that are cut.
 * We can use the info from step 1 to reliably identify polygons that are cut. One caveat is that we could have a polygon 
 * perfectly horizontal/vertical, that is on the position of where a cut could be. That's bad luck.
 * 
 * 4. For each cut polygon, find its counterpart in the other tile.
 * This way we will find groups of polygons to ultimately union together.
 * 
 * 5. Get all polygons not cut, and add the unioned polygons to the list.
 * 
 * 6. Profit!
 */

const MAX_ZOOM = 15;
const FLOAT_DECIMALS = 7;

type TileBounds = {
  north: number;
  south: number;
  east: number;
  west: number;
};

type Tile = {
  tileBounds: TileBounds;
  polyBuffer: Feature<Polygon>;
  tileBufferBounds: TileBounds;
  x: number;
  y: number;
};

type Tiles = Tile[] & { zoom?: number };

export type RenderedFeature<T extends Geometry | null = Polygon | LineString | MultiPolygon | MultiLineString> = Feature<T> & {
  properties: {
    id?: string | number;
    x?: number;
    y?: number;
    sourceLayer?: string;
    center?: [number, number];
    uuid?: string;
    computedId?: string;
    index?: number;
    mapLayerId?: string;
    paint?: Record<string, any>;
    brunnel?: string;
    height?: number;
    base_height?: number;
    min_height?: number;
    kind_detail?: 'yes' | 'no' | 'corridor';
    kind?: string;  // "building_part" for parts, undefined or other for non-parts
    removedByCutout?: boolean;
  };
  layer?: {
    id: string;
    paint: Record<string, any>;
  };
  boundingBox?: BBox;
  bboxPoly?: Feature<Polygon>;
}

export type RenderedFeaturePoly = RenderedFeature<Polygon>;
type RenderedFeaturePolyOrMutli = RenderedFeature<Polygon | MultiPolygon>;

type Cuts = {
  h: number[];
  v: number[];
  zoom?: number;
  tolerance?: number;
};

type DeadZone = Feature<Polygon> & {
  bbox: BBox;
  extentLng?: number;
  extentLat?: number;
};

type DeadZones = DeadZone[] & { extentLng?: number; extentLat?: number; }

function getTolerance(zoom: number): number {
  if (zoom < 3) return 0.1;
  if (zoom < 6) return 0.01;
  if (zoom < 10) return 0.001;
  if (zoom < 13) return 0.0001;
  return 0.000001;
}

// Get bounds of a tile
export function getTileBounds(x: number, y: number, zoom: number): Tile {
  zoom = Math.min(Math.floor(zoom), MAX_ZOOM);
  const scale = Math.pow(2, zoom);

  // Get tile boundaries in mercator coordinates
  const west = x / scale * 360 - 180;
  const east = (x + 1) / scale * 360 - 180;
  const north = Math.atan(Math.sinh(Math.PI * (1 - 2 * y / scale))) * 180 / Math.PI;
  const south = Math.atan(Math.sinh(Math.PI * (1 - 2 * (y + 1) / scale))) * 180 / Math.PI;

  const bufferRatio = 64 / 4096;
  const bufferLngExtent = (east - west) * bufferRatio;
  const bufferLatExtent = (north - south) * bufferRatio;

  const polyBuffer = polygon([[
    [west - bufferLngExtent, south - bufferLatExtent],
    [west - bufferLngExtent, north + bufferLatExtent],
    [east + bufferLngExtent, north + bufferLatExtent],
    [east + bufferLngExtent, south - bufferLatExtent],
    [west - bufferLngExtent, south - bufferLatExtent],
  ]], { tileExtent: true });

  return {
    tileBounds: { north, south, east, west },
    polyBuffer,
    tileBufferBounds: {
      north: north + bufferLatExtent,
      south: south - bufferLatExtent,
      west: west - bufferLngExtent,
      east: east + bufferLngExtent,
    },
    x, y
  };
}


// bbox is [minX, minY, maxX, maxY]
export function bboxContains(containing: BBox, contained: BBox): boolean {
  return containing[0] <= contained[0] && containing[1] <= contained[1] && containing[2] >= contained[2] && containing[3] >= contained[3];
}

export function bboxIntersects(
  [axmin, aymin, axmax, aymax]: BBox,
  [bxmin, bymin, bxmax, bymax]: BBox
): boolean {
  const yOverlaps = bymin <= aymax && bymax >= aymin;
  const xOverlaps = bxmin <= axmax && bxmax >= axmin;
  return xOverlaps && yOverlaps;
}

function computeFeatureUuid(feature: RenderedFeature): void {
  if (feature.properties.center) return;
  const c = center(feature);
  const coords = c.geometry.coordinates as [number, number];
  const coordsStr = coords.map(val => val.toFixed(FLOAT_DECIMALS)).join('-');
  feature.properties.center = coords;
  feature.properties.uuid = coordsStr;
}

// Get bounds by calling map.unproject() on each corner of the viewport
export function getMapRealBounds(map: MaplibreMap): Feature<Polygon> {
  const canvas = map.getCanvas();
  // map.unproject() takes CSS-pixel screen coordinates, not the canvas's device-pixel
  // drawing-buffer size (canvas.width/height = clientWidth * devicePixelRatio). Browser
  // zoom changes devicePixelRatio (zoom <100% shrinks it, >100% grows it), so using
  // canvas.width/height here shrank or grew the computed viewport bounds along with zoom,
  // silently dropping (or over-including) features near the far edge of the map.
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  const cUL = map.unproject([0, 0]).toArray();
  const cUR = map.unproject([w, 0]).toArray();
  const cLR = map.unproject([w, h]).toArray();
  const cLL = map.unproject([0, h]).toArray();
  // [minX, minY, maxX, maxY]
  const coordinates = [cUL, cUR, cLR, cLL, cUL];
  const poly = polygon([coordinates]);
  poly.bbox = bbox(poly);
  return poly;
}

function getViewportBottomEdge(mapBounds: Feature<Polygon>): Feature<LineString> {
  const coords = mapBounds.geometry.coordinates[0];
  // coords order: [cUL, cUR, cLR, cLL, cUL]
  // Bottom edge: cLL (index 3) to cLR (index 2)
  return lineString([coords[3], coords[2]]);
}

let processCounter = 0;
let maplibreMap: MaplibreMap;
export async function getRenderedFeatures(map: MaplibreMap, options: any, threeDimensionsBuilings: boolean): Promise<RenderedFeature[] | null> {
  maplibreMap = map;
  processCounter += 1;
  const currentProcessId = processCounter;

  const renderedFeatures: RenderedFeature[] = map.queryRenderedFeatures(options).map((f: any) => {
    f.properties.id = f.id;
    f.properties.x = f._x;
    f.properties.y = f._y;
    f.properties.sourceLayer = f.sourceLayer;
    return {
      id: f.id,
      layer: f.layer,
      properties: f.properties,
      geometry: f.geometry,
      source: f.source,
      type: f.type,
    };
  });

  const mapBounds = getMapRealBounds(map);
  const zoom = Math.min(Math.floor(map.getZoom()), MAX_ZOOM);

  const tiles: Tiles = getTiles(mapBounds.geometry, { min_zoom: zoom, max_zoom: zoom }).map(([x, y, zoom]) => {
    return getTileBounds(x, y, zoom);
  });

  tiles.zoom = map.getZoom();

  const finalGeometries = await stitch(renderedFeatures, tiles, mapBounds, currentProcessId, threeDimensionsBuilings);
  return finalGeometries;
}

export function cancelStitch(): void {
  processCounter += 1;
}

/**
 * Stitches LineString features across tile boundaries without a MapLibre map instance.
 * Unlike `stitch()`, this never reads from a live map (no `getCanvas`/`unproject`), so it
 * can be used with tiles fetched directly from a PMTiles archive. `stitchLines` ignores
 * its `cuts`/`deadZones` arguments, so empty stand-ins are safe here.
 *
 * `tileCoords` must list every tile the `lines` were decoded from (as `[x, y, z]`); each
 * line's `properties.x`/`properties.y` must match one of them for stitching to find it.
 */
export async function stitchTileLines(
  lines: RenderedFeature[],
  tileCoords: [number, number, number][],
): Promise<RenderedFeature[] | null> {
  const tiles: Tiles = tileCoords.map(([x, y, zoom]) => getTileBounds(x, y, zoom));
  tiles.zoom = tileCoords[0]?.[2] ?? 0;
  return stitchLines(lines, { h: [], v: [] }, [], tiles, processCounter);
}

// Additional functions remain unchanged but now include proper type annotations.
export async function stitch(renderedFeatures: RenderedFeature[], tiles: Tiles, mapBounds: Feature<Polygon>, currentProcessId: number, threeDimensionsBuildings: boolean = false): Promise<RenderedFeature[] | null> {
  // console.log('mapBounds=', mapBounds);
  // console.log('tiles=', tiles);
  const cuts: Cuts = { 'h': [], 'v': [] };

  cuts.zoom = tiles.zoom;
  /** Polygons fully contained in this area are useless, as it means it is already complete in the adjacent tile */
  const deadZones: DeadZones = [];
  tiles.forEach(tile => {
    cuts['v'].push(tile.tileBufferBounds.east);
    cuts['v'].push(tile.tileBufferBounds.west);
    cuts['h'].push(tile.tileBufferBounds.north);
    cuts['h'].push(tile.tileBufferBounds.south);

    const tileAtEast = tiles.find(t => t.y === tile.y && t.x === tile.x + 1);
    if (tileAtEast) {
      const intersection = intersect(featureCollection([tile.polyBuffer, tileAtEast.polyBuffer]))!;
      intersection.bbox = bbox(intersection);
      // const apply small buffering on longitude to ensure it's bigger than fully contained geometries within
      // [minX, minY, maxX, maxY] 
      const extentLng = intersection.bbox[2] - intersection.bbox[0];
      const buffAmount = extentLng * 0.01;
      deadZones.extentLng = extentLng;
      intersection.bbox[0] -= buffAmount;
      intersection.bbox[2] += buffAmount;
      // @ts-expect-error
      deadZones.push(intersection);
    }
    const tileAtSouth = tiles.find(t => t.x === tile.x && t.y === tile.y + 1);
    if (tileAtSouth) {
      const intersection = intersect(featureCollection([tile.polyBuffer, tileAtSouth.polyBuffer]))!;
      intersection.bbox = bbox(intersection);
      // const apply small buffering on latitude to ensure it's bigger than fully contained geometries within
      // [minX, minY, maxX, maxY] 
      const extentLat = intersection.bbox[3] - intersection.bbox[1];
      deadZones.extentLat = extentLat;
      const buffAmount = extentLat * 0.01;
      intersection.bbox[1] -= buffAmount;
      intersection.bbox[3] += buffAmount;
      // @ts-expect-error
      deadZones.push(intersection);
    }
  });

  // console.log('cuts=', cuts);
  // console.log('deadZones=', deadZones);

  const allPolygons = explodeGeometry(renderedFeatures, "Polygon").filter(feature => {
    feature.boundingBox = bbox(feature);
    feature.bboxPoly = bboxPolygon(feature.boundingBox);
    if (booleanDisjoint(mapBounds, feature.bboxPoly)) return false;
    return true;
  }) as RenderedFeaturePoly[];

  await yieldToMain();
  if (currentProcessId !== processCounter) return null;

  const allLines = explodeGeometry(renderedFeatures, "LineString").filter(feature => {
    if (feature.properties.brunnel === "tunnel") return false;
    feature.boundingBox = bbox(feature);
    feature.bboxPoly = bboxPolygon(feature.boundingBox);
    if (booleanDisjoint(mapBounds, feature.bboxPoly)) return false;
    return true;
  });

  await yieldToMain();
  if (currentProcessId !== processCounter) return null;

  let i = 0;
  [...allPolygons, ...allLines].forEach(feature => {
    feature.properties.computedId = getComputedId(feature);
    feature.properties.index = i++;
    computeFeatureUuid(feature);
  });

  await yieldToMain();
  if (currentProcessId !== processCounter) return null;


  // console.log("allLines=", allLines);
  // console.log("allPolygons=", allPolygons);
  const stichedLines = await stitchLines(allLines, cuts, deadZones, tiles, currentProcessId);
  if (stichedLines === null) return null;
  const stichedPolygons = await stitchPolygons(allPolygons, cuts, deadZones, tiles, currentProcessId);
  if (stichedPolygons === null) return null;

  let finalPolygons = explodeGeometry(stichedPolygons, "Polygon") as RenderedFeature<Polygon>[];

  const canvas = maplibreMap.getCanvas();
  // Same CSS-pixel vs. device-pixel distinction as getMapRealBounds() above.
  const p1 = maplibreMap.unproject([canvas.clientWidth - 1, canvas.clientHeight - 1]);
  const p2 = maplibreMap.unproject([canvas.clientWidth - 2, canvas.clientHeight - 2]);

  /** Get 1px distance in km */
  const dist = distance([p1.lng, p1.lat], [p2.lng, p2.lat]);
  // console.log('distance for 1px is', dist, 'km')
  const mapBoundsExtended = buffer(mapBounds, dist) as Feature<Polygon>;
  mapBoundsExtended!.bbox = bbox(mapBoundsExtended!);

  const bottomEdge = threeDimensionsBuildings ? getViewportBottomEdge(mapBounds) : null;

  let nbClipped = 0;
  finalPolygons = finalPolygons.map(polygon => {
    if (!polygon.boundingBox) polygon.boundingBox = bbox(polygon);
    if (bboxContains(mapBoundsExtended!.bbox!, polygon.boundingBox!) || booleanWithin(polygon, mapBoundsExtended!)) return polygon;

    // For 3D buildings: skip clipping if polygon intersects bottom edge
    if (bottomEdge && polygon.properties.mapLayerId === "buildings" &&
      booleanIntersects(polygon, bottomEdge)) {
      return polygon;
    }

    nbClipped += 1;
    const clipped = intersect(featureCollection<Polygon>([mapBoundsExtended!, polygon as Feature<Polygon>]), { properties: polygon.properties }) as RenderedFeature<Polygon>;
    if (clipped) clipped.id = polygon.id;
    return clipped;
  }).filter(p => p);
  log(nbClipped, 'geometries clipped');
  // @ts-expect-error
  return [
    ...explodeGeometry(finalPolygons, "Polygon") as RenderedFeature<Polygon>[],
    ...stichedLines
  ];
}

export function explodeGeometry(geometries: RenderedFeature[], type = 'LineString'): RenderedFeature[] {
  const multiType = `Multi${type}`;
  const exploded: RenderedFeature[] = [];

  geometries.forEach(feature => {
    if (feature.layer) {
      feature.properties.mapLayerId = feature.layer.id;
      feature.properties.paint = feature.layer.paint;
    }
    if (feature.geometry.type === type) {
      exploded.push(feature);
    } else if (feature.geometry.type === multiType) {
      feature.geometry.coordinates.forEach(geom => {
        const newGeom = {
          type: type,
          coordinates: geom
        };
        const newFeature: RenderedFeature = {
          id: feature.id,
          properties: { ...feature.properties },
          // @ts-expect-error
          geometry: newGeom,
          type: "Feature",
        };
        exploded.push(newFeature);
      });
    }
  });
  return exploded;
}

async function stitchLines(allLines: RenderedFeature[], cuts: Cuts, deadZones: DeadZones, tiles: Tiles, currentProcessId: number) {
  const featuresByClass = groupBy(allLines, f => f.properties.computedId);
  // console.log('featuresByClass', featuresByClass);
  const finalFeatures = [];

  for (const lines of Object.values(featuresByClass)) {

    // console.log(computedId);
    // if (computedId !== "transportation-primary") return;
    // console.log("lines", JSON.parse(JSON.stringify(lines)));

    const linesToStitch = [];
    for (let lineIndex = 0; lineIndex < lines.length; ++lineIndex) {
      const line = lines[lineIndex];
      const tile = tiles.find(t => t.x === line.properties.x && t.y === line.properties.y);
      if (!tile) continue;
      const tileBounds = tile.tileBounds;
      const bboxTile: BBox = [tileBounds.west, tileBounds.south, tileBounds.east, tileBounds.north];
      /** The line is fully contained in the tile, no need to clip it */
      if (bboxContains(bboxTile, line.boundingBox!)) {
        linesToStitch.push(line);
        continue;
      }
      const clipped = bboxClip(line, bboxTile);

      if (clipped.geometry.type === 'LineString') {
        linesToStitch.push(clipped);
      } else if (clipped.geometry.type === 'MultiLineString') {
        clipped.geometry.coordinates.forEach(linestring => {
          const lineFeature = {
            id: clipped.id,
            properties: clipped.properties,
            geometry: {
              type: "LineString",
              coordinates: linestring
            },
            type: "Feature",
          };
          linesToStitch.push(lineFeature);
        });
      }

    }

    // console.log("linesToStitch", linesToStitch);
    // @ts-expect-error
    const mergedLines = mergeLineStrings(linesToStitch);
    finalFeatures.push(...mergedLines);

    await yieldToMain();
    if (currentProcessId !== processCounter) return null;
  }
  return finalFeatures;
}

type IndexedSegment = { minX: number; minY: number; maxX: number; maxY: number; p: Position; q: Position };
type SegmentData = { segments: IndexedSegment[]; tree?: RBush<IndexedSegment> };

/** Per-polygon-feature cache of its boundary segments (and lazily, an rbush index over them) */
const segmentDataCache = new WeakMap<Feature, SegmentData>();

function getSegmentData(feature: RenderedFeaturePoly): SegmentData {
  let data = segmentDataCache.get(feature);
  if (!data) {
    const segments: IndexedSegment[] = [];
    for (const ring of feature.geometry.coordinates) {
      for (let i = 0; i < ring.length - 1; i++) {
        const p = ring[i];
        const q = ring[i + 1];
        segments.push({
          minX: Math.min(p[0], q[0]),
          minY: Math.min(p[1], q[1]),
          maxX: Math.max(p[0], q[0]),
          maxY: Math.max(p[1], q[1]),
          p, q,
        });
      }
    }
    data = { segments };
    segmentDataCache.set(feature, data);
  }
  return data;
}

function bboxRoughlyEqual(a: BBox, b: BBox, eps = 5e-7): boolean {
  return Math.abs(a[0] - b[0]) < eps && Math.abs(a[1] - b[1]) < eps &&
    Math.abs(a[2] - b[2]) < eps && Math.abs(a[3] - b[3]) < eps;
}

/** Coordinate-for-coordinate compare at 6-decimal precision, mirroring geojson-equality-ts (used
 * internally by @turf/boolean-overlap) closely enough for our purposes: same ring/vertex counts
 * and same rounded coordinates in the same order. */
function polygonsRoughlyEqual(a: RenderedFeaturePoly, b: RenderedFeaturePoly): boolean {
  const ringsA = a.geometry.coordinates;
  const ringsB = b.geometry.coordinates;
  if (ringsA.length !== ringsB.length) return false;
  const round = (n: number) => Math.round(n * 1e6);
  for (let r = 0; r < ringsA.length; r++) {
    const ringA = ringsA[r];
    const ringB = ringsB[r];
    if (ringA.length !== ringB.length) return false;
    for (let i = 0; i < ringA.length; i++) {
      if (round(ringA[i][0]) !== round(ringB[i][0]) || round(ringA[i][1]) !== round(ringB[i][1])) return false;
    }
  }
  return true;
}

/**
 * Drop-in, result-identical replacement for `@turf/boolean-overlap` specialized to two `Polygon`
 * features. Turf's version runs a full sweepline `lineIntersect` (FeatureCollection allocation +
 * sort) for every pair of segments across both polygons with no early exit, which is O(n*m) and
 * extremely slow for the large tile-clipped polygons seen at low zoom (water especially).
 *
 * Here we flatten each polygon's boundary to segments once (cached per feature), index the larger
 * side in an rbush, and bail out on the first confirmed intersection - `lineIntersect` is still
 * used as the final pairwise predicate so the semantics match turf exactly.
 */
function polygonsOverlap(a: RenderedFeaturePoly, b: RenderedFeaturePoly): boolean {
  // @turf/boolean-overlap treats coordinate-identical features as non-overlapping.
  if (a.boundingBox && b.boundingBox && bboxRoughlyEqual(a.boundingBox, b.boundingBox) && polygonsRoughlyEqual(a, b)) {
    return false;
  }

  const dataA = getSegmentData(a);
  const dataB = getSegmentData(b);
  const [smaller, larger] = dataA.segments.length <= dataB.segments.length ? [dataA, dataB] : [dataB, dataA];
  if (!larger.tree) {
    larger.tree = new RBush<IndexedSegment>();
    larger.tree.load(larger.segments);
  }

  for (const seg of smaller.segments) {
    for (const candidate of larger.tree.search(seg)) {
      const line1 = { type: "LineString" as const, coordinates: [seg.p, seg.q] };
      const line2 = { type: "LineString" as const, coordinates: [candidate.p, candidate.q] };
      if (lineIntersect(line1, line2).features.length) return true;
    }
  }
  return false;
}

/** For some reason water is cut differently: we bypass a lot of checks to merge more aggressively */
let currentIsWater = false;

type SegmentToProcess = [number, number, number, 'h' | 'v'];
async function stitchPolygons(allPolygons: RenderedFeaturePoly[], cuts: Cuts, deadZones: DeadZones, tiles: Tiles, currentProcessId: number) {

  const featuresByClass = groupBy(allPolygons, (f) => f.properties.computedId);

  // console.log('featuresByClass', featuresByClass);
  cuts.tolerance = getTolerance(cuts.zoom!);
  // console.log("tolerance", cuts.tolerance, cuts.zoom);

  const mergedFeatures: RenderedFeature[] = [];
  for (const [computedId, layerPolygons] of Object.entries(featuresByClass)) {
    currentIsWater = computedId === "water";
    // console.log("computedId=", computedId);
    // console.log("layerPolygons=", layerPolygons);

    // Identify cut polygon
    let segmentsToProcess: SegmentToProcess[] = [];
    layerPolygons.forEach((polygon, polygonIndex) => {
      polygon.properties.index = polygonIndex;
      polygon.geometry.coordinates.forEach((ring, ringIndex) => {
        for (let i = 0; i < ring.length - 1; i++) {
          const p1 = ring[i];
          const p2 = ring[i + 1];

          const isHorizontalCut = checkSegmentHorizontalCut(p1, p2, cuts);
          if (isHorizontalCut) {
            segmentsToProcess.push([polygonIndex, ringIndex, i, 'h']);
          }
          const isVerticalCut = checkSegmentVerticalCut(p1, p2, cuts);
          if (isVerticalCut) {
            segmentsToProcess.push([polygonIndex, ringIndex, i, 'v']);
          }
        }
      });
    });
    // console.log('segmentsToProcess', segmentsToProcess);
    const polygonIndexesCut = new Set(segmentsToProcess.map(s => s[0]));
    // console.log('polygonIndexesCut=', polygonIndexesCut);

    // Filter cut polygons entirely in dead zones
    const polygonCutIndexExclude = new Set([...polygonIndexesCut].map(polygonIndex => {
      if (currentIsWater) return;
      const polygon = layerPolygons[polygonIndex];
      if (deadZones.some(deadZone => bboxContains(deadZone.bbox, polygon.boundingBox!))) return polygonIndex;
    }).filter(i => i !== undefined));

    // console.log('polygonCutIndexExclude', polygonCutIndexExclude);

    /** Polygons that are not cut and fully contained in a dead zone are duplicated among tiles: we must remove one */
    const polygonUuidDuplicated: { [uuid: string]: number } = {};
    layerPolygons.forEach((p, pIndex) => {
      if (polygonIndexesCut.has(pIndex)) return;
      if (deadZones.some(deadZone => bboxContains(deadZone.bbox, p.boundingBox!))) {
        polygonUuidDuplicated[p.properties.uuid!] = pIndex;
      }
    });
    // console.log("polygonUuidDuplicated", polygonUuidDuplicated);

    // Determine which polygons to stitch together by:
    // - checking if pairwise segments are closeby together
    // - if yes, checking that the geometries overlap
    const stitchGroups: Set<number>[] = [];
    const overlapCache = new Map<number, boolean>();
    const overlapKey = (a: number, b: number) => {
      const lo = a < b ? a : b;
      const hi = a < b ? b : a;
      return lo * (1 << 20) + hi;
    };
    // Union-find over confirmed overlaps: once two polygons are known to be linked, any further
    // segment pair between them (or between anything already merged into their component) is
    // redundant to re-test - the transitive grouping is unaffected, only the redundant
    // bboxIntersects/polygonsAreCutByTile/polygonsOverlap work is skipped.
    const unionFindParent = layerPolygons.map((_, idx) => idx);
    const find = (x: number): number => {
      while (unionFindParent[x] !== x) {
        unionFindParent[x] = unionFindParent[unionFindParent[x]];
        x = unionFindParent[x];
      }
      return x;
    };
    const linkIndices = (a: number, b: number) => {
      const rootA = find(a);
      const rootB = find(b);
      if (rootA !== rootB) unionFindParent[rootA] = rootB;
    };
    for (let i = 0; i < segmentsToProcess.length; ++i) {
      const [polygonIndex, ringIndex, coordIndex, cutDirection] = segmentsToProcess[i];
      if (polygonCutIndexExclude.has(polygonIndex)) continue;
      // console.log('finding match for', segmentsToProcess[i]);
      const matching = segmentsToProcess.filter(segment => {
        const [curPolygonIndex, curRingIndex, curCoordIndex, curCutDirection] = segment;
        if (polygonCutIndexExclude.has(curPolygonIndex)) return false;
        if (curPolygonIndex === polygonIndex) return false;
        if (cutDirection !== curCutDirection) return false;

        // Tile-stitch candidates only ever come from different, adjacent (incl. diagonal) tiles.
        const dx = Math.abs(layerPolygons[polygonIndex].properties.x! - layerPolygons[curPolygonIndex].properties.x!);
        const dy = Math.abs(layerPolygons[polygonIndex].properties.y! - layerPolygons[curPolygonIndex].properties.y!);
        if (dx === 0 && dy === 0) return false;
        if (dx > 1 || dy > 1) return false;

        // Already known to be in the same stitch component: no need to re-derive the edge.
        if (find(polygonIndex) === find(curPolygonIndex)) return false;

        const key = overlapKey(polygonIndex, curPolygonIndex);
        let overlap = overlapCache.get(key);
        if (overlap === false) return false;

        if (overlap === undefined) {
          if (!bboxIntersects(layerPolygons[polygonIndex].boundingBox!, layerPolygons[curPolygonIndex].boundingBox!)) return false;
          if (!polygonsAreCutByTile(segmentsToProcess[i], segment, layerPolygons, deadZones)) return false;

          overlap = polygonsOverlap(layerPolygons[polygonIndex], layerPolygons[curPolygonIndex]);
          overlapCache.set(key, overlap);
        }
        if (overlap) linkIndices(polygonIndex, curPolygonIndex);
        return overlap;
      });
      if (matching.length) {
        for (const m of matching) {
          const group = stitchGroups.find(group => group.has(polygonIndex) || group.has(m[0]));
          if (!group) {
            stitchGroups.push(new Set([polygonIndex, m[0]]));
          } else {
            group.add(polygonIndex);
            group.add(m[0]);
          }
        }
      }
    }
    // console.log('stitchGroups=', stitchGroups);

    // merge groups that have intersection
    const finalStichGroups = mergeSets(stitchGroups);
    // console.log('finalStichGroups=', finalStichGroups);
    const stitchedPolygonsIndexes = new Set(finalStichGroups.flatMap(g => [...g]));
    const unmatchedCutPolygon = polygonIndexesCut.difference(stitchedPolygonsIndexes).difference(polygonCutIndexExclude);
    // console.log('unmatchedCutPolygon', unmatchedCutPolygon);

    const finalPolygons = layerPolygons.filter((poly, i) => {
      const isCut = polygonIndexesCut.has(i);
      const uuid = poly.properties.uuid!;
      const isDuplicated = (uuid in polygonUuidDuplicated) && polygonUuidDuplicated[uuid] !== i;
      if (isDuplicated) return false;
      /** 
       * If a polygon is cut, it is normally in stiched groups. However we can have false positives of cuts
       * if a legit segment is exactly on one of the cut.
       */
      return !isCut || unmatchedCutPolygon.has(i);
    }) as RenderedFeaturePolyOrMutli[];
    // union the polygons together
    for (const group of finalStichGroups) {
      const groupArr = [...group];
      const polygons = featureCollection(groupArr.map(polygonIndex => layerPolygons[polygonIndex]));
      const mergedProperties = {};
      for (const polygonIndex of groupArr) {
        Object.assign(mergedProperties, layerPolygons[polygonIndex].properties);
      }
      let stitched: RenderedFeaturePolyOrMutli | null = null;
      try {
        stitched = union(polygons, { properties: mergedProperties }) as RenderedFeaturePolyOrMutli | null;
      } catch (err) {
        console.warn('stitchPolygons: union threw, keeping originals', err);
      }
      await yieldToMain();
      if (currentProcessId !== processCounter) return null;
      if (stitched && stitched.geometry) {
        stitched.id = layerPolygons[groupArr[0]].id;
        computeFeatureUuid(stitched);
        finalPolygons.push(stitched);
      } else {
        for (const polygonIndex of groupArr) finalPolygons.push(layerPolygons[polygonIndex]);
      }
    }

    // console.log('finalPolygons=', finalPolygons);
    mergedFeatures.push(...finalPolygons);
    await yieldToMain();
    if (currentProcessId !== processCounter) return null;
    // for (const deadZone of deadZones) {
    //   mergedFeatures.push(bboxPolygon(deadZone.bbox, { properties: { deadZone: true } }));
    // }
  }
  return mergedFeatures;
}


function polygonsAreCutByTile(segmentInfo1: SegmentToProcess, segmentInfo2: SegmentToProcess, polygons: RenderedFeaturePoly[], deadZones: DeadZones) {
  const [polygonIndex1, ringIndex1, coordIndex1, cutDirection1] = segmentInfo1;
  const [polygonIndex2, ringIndex2, coordIndex2, cutDirection2] = segmentInfo2;
  const polygon1 = polygons[polygonIndex1];
  const polygon2 = polygons[polygonIndex2];
  const ring1 = polygon1.geometry.coordinates[ringIndex1];
  const ring2 = polygon2.geometry.coordinates[ringIndex2];
  // console.log('comparing', segmentInfo1, segmentInfo2, ring2);

  if (cutDirection1 === "v") {
    const pos1 = checkRingPosition(ring1, coordIndex1, cutDirection1);
    // console.log(polygons[polygonIndex1], pos1);
    const pos2 = checkRingPosition(ring2, coordIndex2, cutDirection2);
    // console.log(polygons[polygonIndex2], pos2);
    if (pos1 !== pos2) {
      if (currentIsWater) return true;
      const distance = Math.abs(ring1[coordIndex1][0] - ring2[coordIndex2][0]);
      const distanceIsDeadZoneExtent = Math.abs(distance - deadZones.extentLng!) < 0.00001;
      // console.log("distanceLng", distance, distanceIsDeadZoneExtent);
      if (pos1 === "left") {
        // check that the leftmost segment is at the right of rightmost segment: if it is, there is overlap
        return distanceIsDeadZoneExtent && polygon2.properties.x === polygon1.properties.x! + 1 && ring1[coordIndex1][0] > ring2[coordIndex2][0];
      }
      else {
        return distanceIsDeadZoneExtent && polygon1.properties.x === polygon2.properties.x! + 1 && ring1[coordIndex1][0] < ring2[coordIndex2][0]
      }
    }
  } else {
    const pos1 = checkRingPosition(ring1, coordIndex1, cutDirection1);
    // console.log(polygons[polygonIndex1], pos1);
    const pos2 = checkRingPosition(ring2, coordIndex2, cutDirection2);
    // console.log(polygons[polygonIndex2], pos2);
    if (pos1 !== pos2) {
      if (currentIsWater) return true;
      const distance = Math.abs(ring1[coordIndex1][1] - ring2[coordIndex2][1]);
      const distanceIsDeadZoneExtent = Math.abs(distance - deadZones.extentLat!) < 0.00001;
      // console.log("distanceLat", distance, distanceIsDeadZoneExtent);
      if (pos1 === "top") {
        return distanceIsDeadZoneExtent && polygon2.properties.y === polygon1.properties.y! + 1 && ring1[coordIndex1][1] < ring2[coordIndex2][1];
      }
      else {
        return distanceIsDeadZoneExtent && polygon1.properties.y === polygon2.properties.y! + 1 && ring1[coordIndex1][1] > ring2[coordIndex2][1];
      }
    }
  }
  return false;
}

function checkRingPosition(ring: Position[], coordIndex: number, cutDirection: 'h' | 'v') {
  if (cutDirection === "v") {
    let segmentToCheck;
    // coordIndex1 is the first point of vertical segment, so coordIndex1 - 1 is the point just before it,
    // and coordIndex1 + 1 is the end of the segment, so coordIndex1 + 2 is the next point after the segment
    if (coordIndex > 0) segmentToCheck = [ring[coordIndex - 1], ring[coordIndex]];
    else segmentToCheck = [ring[coordIndex + 2], ring[coordIndex + 1]];
    // console.log('segmentToCheck', segmentToCheck);
    if (segmentToCheck[0][0] < segmentToCheck[1][0]) return "left";
    else return 'right';
  } else {
    let segmentToCheck;
    if (coordIndex > 0) segmentToCheck = [ring[coordIndex - 1], ring[coordIndex]];
    else segmentToCheck = [ring[coordIndex + 2], ring[coordIndex + 1]];
    // console.log('segmentToCheck', segmentToCheck);
    if (segmentToCheck[0][1] < segmentToCheck[1][1]) return 'bottom';
    else return 'top';
  }

}

function getComputedId(feature: RenderedFeature) {
  let computedId = feature.properties.sourceLayer;
  if (feature.properties.class) computedId += '-' + feature.properties.class;
  if (feature.properties.subclass) computedId += '-' + feature.properties.subclass;
  return computedId;
}



function mergeSets(setList: Set<number>[]) {
  // Clone the input sets to avoid modifying originals
  const sets = setList.map(set => new Set(set));
  let merged = true;

  while (merged) {
    merged = false;

    // Compare each pair of sets
    for (let i = 0; i < sets.length; i++) {
      if (sets[i] === null) continue; // Skip already merged sets

      for (let j = i + 1; j < sets.length; j++) {
        if (sets[j] === null) continue; // Skip already merged sets

        // Check if sets have any overlap
        let hasOverlap = false;
        for (const value of sets[i]) {
          if (sets[j].has(value)) {
            hasOverlap = true;
            break;
          }
        }

        // If overlap found, merge sets[j] into sets[i] and mark sets[j] for removal
        if (hasOverlap) {
          for (const value of sets[j]) {
            sets[i].add(value);
          }
          // @ts-expect-error
          sets[j] = null; // Mark for removal
          merged = true;
        }
      }
    }

    // Remove null entries (merged sets)
    if (merged) {
      for (let i = sets.length - 1; i >= 0; i--) {
        if (sets[i] === null) {
          sets.splice(i, 1);
        }
      }
    }
  }

  return sets;
}

// function pointsAreCloseBy(p1, p2) {
//   return Math.abs(p1[1] - p2[1]) < 0.00001 && Math.abs(p1[0] - p2[0]) < 0.00001;
// }

// function segmentsOverlap(start1, end1, start2, end2) {
//   if (start1 > end1) [start1, end1] = [end1, start1];
//   if (start2 > end2) [start2, end2] = [end2, start2];
//   return start1 <= end2 && start2 <= end1;
// }

function checkSegmentHorizontalCut(p1: Position, p2: Position, cuts: Cuts) {
  if (Math.abs(p1[1] - p2[1]) > 0.0000001) return false;
  if (currentIsWater) return true;
  return cuts['h'].some(p => Math.abs(p - p1[1]) < cuts.tolerance!);
}

function checkSegmentVerticalCut(p1: Position, p2: Position, cuts: Cuts) {
  if (Math.abs(p1[0] - p2[0]) > 0.0000001) return false;
  if (currentIsWater) return true;
  return cuts['v'].some(p => Math.abs(p - p1[0]) < cuts.tolerance!);
}