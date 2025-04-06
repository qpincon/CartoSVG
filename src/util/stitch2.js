import bbox from "@turf/bbox";
import bboxPolygon from "@turf/bbox-polygon";
import booleanDisjoint from "@turf/boolean-disjoint";
import { featureCollection, polygon } from "@turf/helpers";
import intersect from "@turf/intersect";
import union from "@turf/union";
import booleanOverlap from "@turf/boolean-overlap";
import center from "@turf/center";
// import { testBounds, testRendered, testTiles} from "./testData";
/**
 * This files contains an attempt at stiching tiles together.
 * The problem is that, when we use queryRenderedFeatures, the resulting geometries may be split among tiles
 * The most problematic layer is the building layer. IDs of the polygons between tiles don't match, and we can have 
 * convoluted situations with the tiles buffer. We can have:
 * - a polygon that is cut and continues on another tile
 * - the beginning of a new polygon beyond the tile extent taht is fully contained by the polygon on the other tile
 * 
 * 
 * A process for stitching tiles together is:
 * 1. Identify when the possible cuts are
 * 
 * Cuts are perfectly vertical or horizontal, and are at a specific distance of a tile boundary, so it should not be to hard to find
 * 
 * Then, for each layer (source layer + class + subclass):
 * 2. Filter polygons in viewport
 * To not have to process too much data that is not needed
 * 
 * 
 * 3. Identify polygons that are cut
 * We can use the info from step 1 to reliably identify polygons that are cut. One caveat is that we could have a polygon 
 * perfectly horizontal / vertical, that is on the position of where a cut could be. That's bad luck.
 * 
 * 4. For each cut polygon, find its counterpart in the other tile
 * This way we will find groups of polygons to ultimately union together
 * 
 * 5. Get all polygons not cut, and add the unioned polygons to the list
 * 
 * 6. Profit!
 */

const MAX_ZOOM = 15;
const FLOAT_DECIMALS = 7;
// Get bounds of a tile
function getTileBounds(x, y, zoom) {
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
    ]], { tileExtent: true })
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
function bboxContains(containing, contained) {
    return containing[0] <= contained[0] && containing[1] <= contained[1] && containing[2] >= contained[2] && containing[3] >= contained[3];
}

function bboxIntersects([axmin, aymin, axmax, aymax], [bxmin, bymin, bxmax, bymax]) {
    const yOverlaps = bymin <= aymax && bymax >= aymin;
    const xOverlaps = bxmin <= axmax && bxmax >= axmin;
    return xOverlaps && yOverlaps;
}

function computeFeatureUuid(feature) {
    if (feature.properties.center) return;
    const c = center(feature);
    const coords = c.geometry.coordinates;
    const coordsStr = coords.map(val => val.toFixed(FLOAT_DECIMALS)).join('-');
    feature.properties.center = coords;
    feature.properties.uuid = coordsStr;

}
export function getRenderedFeatures(map, options) {

    const visibleTiles = new Set();
    // const mergedFeatures = mergeMapLibreFeaturesByID(map, renderedFeatures);
    const renderedFeatures = map.queryRenderedFeatures(options).map(f => {
        f.properties.id = f.id;
        f.properties.x = f._vectorTileFeature._x;
        f.properties.y = f._vectorTileFeature._y;
        visibleTiles.add(`${f._vectorTileFeature._x}-${f._vectorTileFeature._y}`);
        return {
            // _vectorTileFeature: f._vectorTileFeature,
            id: f.id,
            properties: f.properties,
            geometry: f.geometry,
            source: f.source,
            sourceLayer: f.sourceLayer,
            type: f.type,
        }
    });
    const zoom = map.getZoom();
    const tiles = [...visibleTiles].map(xyStr => {
        const [x, y] = xyStr.split('-').map(x => parseInt(x));
        return getTileBounds(x, y, zoom);
    });
    // tiles.forEach(t => {
    //     renderedFeatures.splice(0, 0, t.polyBuffer);
    // });
    // console.log('renderedFeatures=', renderedFeatures);
    // return renderedFeatures

    // Get bounds by calling map.unproject() on each corner of the viewport
    const canvas = map.getCanvas();
    const w = canvas.width;
    const h = canvas.height;
    const cUL = map.unproject([0, 0]).toArray();
    const cUR = map.unproject([w, 0]).toArray();
    const cLR = map.unproject([w, h]).toArray();
    const cLL = map.unproject([0, h]).toArray();
    // [minX, minY, maxX, maxY]
    const coordinates = [cUL, cUR, cLR, cLL, cUL];
    const mapBounds = polygon([coordinates]);

    console.log('renderedFeatures=', renderedFeatures);
    return stitch(renderedFeatures, tiles, mapBounds);
}

export function stitch(renderedFeatures, tiles, mapBounds) {
    console.log('mapBounds=', mapBounds);
    console.log('tiles=', tiles);
    const cuts = { 'h': [], 'v': [] };
    // const cuts = { 'h': new Set(), 'v': new Set() };
    /** Polygons fully contained in this area are useless, as it means it is already complete in the adjacent tile */
    const deadZones = [];
    tiles.forEach(tile => {
        cuts['v'].push(tile.tileBufferBounds.east);
        cuts['v'].push(tile.tileBufferBounds.west);
        cuts['h'].push(tile.tileBufferBounds.north);
        cuts['h'].push(tile.tileBufferBounds.south);

        const tileAtEast = tiles.find(t => t.y === tile.y && t.x === tile.x + 1);
        if (tileAtEast) {
            const intersection = intersect(featureCollection([tile.polyBuffer, tileAtEast.polyBuffer]));
            intersection.bbox = bbox(intersection);
            // const apply small buffering on longitude to ensure it's bigger than fully contained geometries within
            // [minX, minY, maxX, maxY] 
            const extentLng = intersection.bbox[2] - intersection.bbox[0];
            const buffAmount = extentLng * 0.01;
            intersection.bbox[0] -= buffAmount;
            intersection.bbox[2] += buffAmount;
            deadZones.push(intersection);
        }
        const tileAtSouth = tiles.find(t => t.x === tile.x && t.y === tile.y + 1);
        if (tileAtSouth) {
            const intersection = intersect(featureCollection([tile.polyBuffer, tileAtSouth.polyBuffer]));
            intersection.bbox = bbox(intersection);
            // const apply small buffering on latitude to ensure it's bigger than fully contained geometries within
            // [minX, minY, maxX, maxY] 
            const extentLat = intersection.bbox[3] - intersection.bbox[1];
            const buffAmount = extentLat * 0.01;
            intersection.bbox[1] -= buffAmount;
            intersection.bbox[3] += buffAmount;
            deadZones.push(intersection);
        }
    });

    console.log('cuts=', cuts);
    console.log('deadZones=', deadZones);

    const allPolygons = [];
    const allClasses = new Set();
    let i = 0;
    /** Explode and filter polygon features */
    renderedFeatures.forEach(feature => {
        feature.properties.computedId = getComputedId(feature);
        allClasses.add(feature.properties.computedId);
        if (feature.geometry.type === 'Polygon') {
            feature.boundingBox = bbox(feature);
            if (booleanDisjoint(mapBounds, bboxPolygon(feature.boundingBox))) return;
            computeFeatureUuid(feature);
            feature.properties.index = i++;
            // feature.properties.area = area(feature);
            allPolygons.push(feature);
        } else if (feature.geometry.type === 'MultiPolygon') {
            feature.geometry.coordinates.forEach(polygon => {
                const polygonGeom = {
                    type: "Polygon",
                    coordinates: polygon
                };
                const boundingBox = bbox(polygonGeom);
                if (booleanDisjoint(mapBounds, bboxPolygon(boundingBox))) return;
                feature.properties.index = i++;
                // feature.properties.area = area(feature);
                const polygonFeature = {
                    id: feature.id,
                    properties: { ...feature.properties },
                    boundingBox,
                    geometry: polygonGeom,
                    type: "Feature",
                };
                computeFeatureUuid(polygonFeature);
                allPolygons.push(polygonFeature);
            });
        }
    });


    const featuresByClass = {};
    allPolygons.forEach(feature => {
        const id = feature.properties.computedId;
        if (!featuresByClass[id]) {
            featuresByClass[id] = [];
        }
        featuresByClass[id].push(feature);
    });

    console.log('featuresByClass', featuresByClass);

    // return allPolygons;
    const mergedFeatures = [];
    Object.values(featuresByClass).forEach(layerPolygons => {

        console.log("layerPolygons=", layerPolygons);

        // Identify cut polygon
        let segmentsToProcess = [];
        layerPolygons.forEach((polygon, polygonIndex) => {
            polygon.properties = { ...polygon.properties, index: polygonIndex };
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
        console.log('segmentsToProcess', segmentsToProcess);

        const polygonIndexesCut = new Set(segmentsToProcess.map(s => s[0]));
        console.log('polygonIndexesCut=', polygonIndexesCut);

        // Filter cut polygons entirely in dead zones
        const polygonCutIndexExclude = new Set([...polygonIndexesCut].map(polygonIndex => {
            const polygon = layerPolygons[polygonIndex];
            if (deadZones.some(deadZone => bboxContains(deadZone.bbox, polygon.boundingBox))) return polygonIndex;
        }).filter(i => i !== undefined));

        console.log('polygonCutIndexExclude', polygonCutIndexExclude);

        /** Polygons that are not cut and fully contained in a dead zone are duplicated among tiles: we must remove one */
        const polygonUuidDuplicated = {};
        layerPolygons.forEach((p, pIndex)=> {
            if (polygonIndexesCut.has(pIndex)) return;
            if (deadZones.some(deadZone => bboxContains(deadZone.bbox, p.boundingBox))) {
                polygonUuidDuplicated[p.properties.uuid] = pIndex;
            }
        });
        console.log("polygonUuidDuplicated", polygonUuidDuplicated);

        // Determine which polygons to stitch together by:
        // - checking if pairwise segments are closeby together
        // - if yes, checking that the geometries overlap
        const stitchGroups = [];
        for (let i = 0; i < segmentsToProcess.length; ++i) {
            // if (segmentsToProcess[i].processed) continue;
            const [polygonIndex, ringIndex, coordIndex, cutDirection] = segmentsToProcess[i];
            if (polygonCutIndexExclude.has(polygonIndex)) continue;
            console.log('finding match for', segmentsToProcess[i]);
            const matching = segmentsToProcess.filter(segment => {
                // if (segment.processed) return false;
                const [curPolygonIndex, curRingIndex, curCoordIndex, curCutDirection] = segment;
                if (polygonCutIndexExclude.has(curPolygonIndex)) return;
                if (curPolygonIndex === polygonIndex) return false;
                if (cutDirection !== curCutDirection) return false;

                const areCut = polygonsAreCutByTile(segmentsToProcess[i], segment, layerPolygons);
                if (areCut) {
                    console.log('potential cut found for', curPolygonIndex, curRingIndex);
                    return bboxIntersects(allPolygons[polygonIndex].boundingBox, allPolygons[curPolygonIndex].boundingBox) &&
                        booleanOverlap(allPolygons[polygonIndex], allPolygons[curPolygonIndex]);
                }
            });
            console.log('matching=', matching);
            console.log('current stitchGroups=', stitchGroups.map(g => [...g]));
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
        console.log('stitchGroups=', stitchGroups);


        // merge groups that have intersection
        const finalStichGroups = mergeSets(stitchGroups);
        console.log('finalStichGroups=', finalStichGroups);
        const stitchedPolygonsIndexes = new Set(finalStichGroups.flatMap(g => [...g]));
        const unmatchedCutPolygon = polygonIndexesCut.difference(stitchedPolygonsIndexes).difference(polygonCutIndexExclude);
        console.log('unmatchedCutPolygon', unmatchedCutPolygon);

        const finalPolygons = layerPolygons.filter((poly, i) => {
            const isCut = polygonIndexesCut.has(i);
            const uuid = poly.properties.uuid;
            const isDuplicated = (uuid in polygonUuidDuplicated) && polygonUuidDuplicated[uuid] !== i;
            if (isDuplicated) return false;
            /** 
             * If a polygon is cut, it is normally in stiched groups. However we can have false positives of cuts
             * if a legit segment is exactly on one of the cut.
             */
            return !isCut || unmatchedCutPolygon.has(i);
        });
        // union the polygons together
        for (const group of finalStichGroups) {
            const groupArr = [...group];
            const polygons = featureCollection(groupArr.map(polygonIndex => layerPolygons[polygonIndex]));
            const stitched = union(polygons, { properties: layerPolygons[groupArr[0]].properties });
            // const stitched = union(polygons, { properties: featureWithoutGeom.properties });
            console.log("stitched", stitched);
            finalPolygons.push(stitched)
        }

        console.log('finalPolygons=', finalPolygons);
        mergedFeatures.push(...finalPolygons);

        for (const deadZone of deadZones) {
            mergedFeatures.push(bboxPolygon(deadZone.bbox, { properties: { deadZone: true } }));
        }
    });
    console.log("allClasses=", allClasses);
    return mergedFeatures;
}


function polygonsAreCutByTile(segmentInfo1, segmentInfo2, polygons) {
    const [polygonIndex1, ringIndex1, coordIndex1, cutDirection1] = segmentInfo1;
    const [polygonIndex2, ringIndex2, coordIndex2, cutDirection2] = segmentInfo2;
    const polygon1 = polygons[polygonIndex1];
    const polygon2 = polygons[polygonIndex2];
    const ring1 = polygon1.geometry.coordinates[ringIndex1];
    const ring2 = polygon2.geometry.coordinates[ringIndex2];
    // console.log('comparing', segmentInfo1, segmentInfo2, ring2);
    // const p1 = ring1[coordIndex1]; const p1Next = ring1[(coordIndex1 === ring1.length - 1) ? 0 : coordIndex1 + 1];
    // const p2 = ring2[coordIndex2]; const p2Next = ring2[(coordIndex2 === ring2.length - 1) ? 0 : coordIndex2 + 1];

    if (cutDirection1 === "v") {
        // check vertical overlap
        // if (!segmentsOverlap(p1[1], p1Next[1], p2[1], p2Next[1])) return false;
        // check horizontal overlap
        const pos1 = checkRingPosition(ring1, coordIndex1, cutDirection1);
        console.log(polygons[polygonIndex1], pos1);
        const pos2 = checkRingPosition(ring2, coordIndex2, cutDirection2);
        console.log(polygons[polygonIndex2], pos2);
        if (pos1 !== pos2) {
            if (pos1 === "left") {
                // check that the leftmost segment is at the right of rightmost segment: if it is, there is overlap
                return polygon2.properties.x === polygon1.properties.x + 1 && ring1[coordIndex1][0] > ring2[coordIndex2][0];
            }
            else {
                return polygon1.properties.x === polygon2.properties.x + 1 && ring1[coordIndex1][0] < ring2[coordIndex2][0]
            }
        }
    } else {
        // check horizontal overlap
        // if (!segmentsOverlap(p1[0], p1Next[0], p2[0], p2Next[0])) return false;
        const pos1 = checkRingPosition(ring1, coordIndex1, cutDirection1);
        // console.log(polygons[polygonIndex1], pos1);
        const pos2 = checkRingPosition(ring2, coordIndex2, cutDirection2);
        // console.log(polygons[polygonIndex2], pos2);
        if (pos1 !== pos2) {
            if (pos1 === "top") {
                return polygon2.properties.y === polygon1.properties.y && ring1[coordIndex1][1] < ring2[coordIndex2][1];
            }
            else {
                return polygon1.properties.y === polygon2.properties.y + 1 && ring1[coordIndex1][1] > ring2[coordIndex2][1];
            }
        }
    }
    return false;
}

function checkRingPosition(ring, coordIndex, cutDirection) {
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

function getComputedId(feature) {
    let computedId = feature.sourceLayer;
    if (feature.properties.class) computedId += '-' + feature.properties.class;
    if (feature.properties.subclass) computedId += '-' + feature.properties.subclass;
    return computedId;
}

function mergeSets(setList) {
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

function segmentsOverlap(start1, end1, start2, end2) {
    if (start1 > end1) [start1, end1] = [end1, start1];
    if (start2 > end2) [start2, end2] = [end2, start2];
    return start1 <= end2 && start2 <= end1;
}

function checkSegmentHorizontalCut(p1, p2, cuts) {
    if (Math.abs(p1[1] - p2[1]) > 0.0000001) return false;
    return cuts['h'].some(p => Math.abs(p - p1[1]) < 0.0000001);
}

function checkSegmentVerticalCut(p1, p2, cuts) {
    if (Math.abs(p1[0] - p2[0]) > 0.0000001) return false;
    return cuts['v'].some(p => Math.abs(p - p1[0]) < 0.0000001);
}



// stitch(testRendered, testTiles, testBounds)