import bbox from "@turf/bbox";
import bboxPolygon from "@turf/bbox-polygon";
import booleanDisjoint from "@turf/boolean-disjoint";
import { featureCollection, polygon } from "@turf/helpers";
import intersect from "@turf/intersect";
import union from "@turf/union";
import booleanOverlap from "@turf/boolean-overlap";
import center from "@turf/center";
import { groupBy } from 'lodash-es';
import { tiles as getTiles } from '@mapbox/tile-cover';
import bboxClip from "@turf/bbox-clip";
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

  // const visibleTiles = new Set();
  const renderedFeatures = map.queryRenderedFeatures(options).map(f => {
    f.properties.id = f.id;
    f.properties.x = f._vectorTileFeature._x;
    f.properties.y = f._vectorTileFeature._y;
    // visibleTiles.add(`${f._vectorTileFeature._x}-${f._vectorTileFeature._y}`);
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
  // const zoom = map.getZoom();
  // const tiles = [...visibleTiles].map(xyStr => {
  //     const [x, y] = xyStr.split('-').map(x => parseInt(x));
  //     return getTileBounds(x, y, zoom);
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
  console.log('mapbounds', mapBounds);
  const zoom = Math.min(Math.floor(map.getZoom()), MAX_ZOOM);

  const tiles = getTiles(mapBounds.geometry, { min_zoom: zoom, max_zoom: zoom }).map(([x, y, z]) => {
    return getTileBounds(x, y, zoom);
  });

  console.log('renderedFeatures=', renderedFeatures);

  const finalGeometries = stitch(renderedFeatures, tiles, mapBounds);

  tiles.forEach(t => {
    finalGeometries.splice(0, 0, t.polyBuffer);
  });
  return finalGeometries;
}

export function stitch(renderedFeatures, tiles, mapBounds) {
  console.log('mapBounds=', mapBounds);
  console.log('tiles=', tiles);
  console
  const cuts = { 'h': [], 'v': [] };

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
  const allLines = [];
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
      feature.bboxPoly = bboxPolygon(feature.boundingBox);
      feature.properties.index = i++;
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
        const polygonFeature = {
          id: feature.id,
          properties: { ...feature.properties },
          boundingBox,
          bboxPoly: bboxPolygon(boundingBox),
          geometry: polygonGeom,
          type: "Feature",
        };
        computeFeatureUuid(polygonFeature);
        allPolygons.push(polygonFeature);
      });
    } else if (feature.geometry.type === 'LineString') {
      feature.boundingBox = bbox(feature);
      if (booleanDisjoint(mapBounds, bboxPolygon(feature.boundingBox))) return;
      computeFeatureUuid(feature);
      feature.properties.index = i++;
      allLines.push(feature);
    } else if (feature.geometry.type === 'MultiLineString') {
      feature.geometry.coordinates.forEach(linestring => {
        const linestringGeom = {
          type: "LineString",
          coordinates: linestring
        };
        const boundingBox = bbox(linestringGeom);
        if (booleanDisjoint(mapBounds, bboxPolygon(boundingBox))) return;
        feature.properties.index = i++;
        const lineFeature = {
          id: feature.id,
          properties: { ...feature.properties },
          boundingBox,
          geometry: linestringGeom,
          type: "Feature",
        };
        computeFeatureUuid(lineFeature);
        allLines.push(lineFeature);
      });
    }
  });

  console.log("allLines=", allLines);
  console.log("allPolygons=", allPolygons);
  const allLinesWithCutLines = [...allLines];
  tiles.forEach(t => {
    allLinesWithCutLines.splice(0, 0, t.polyBuffer);
  });

  console.log("allLinesWithCutLines=", featureCollection(allLinesWithCutLines));
  console.log("allClasses=", allClasses);
  return [...stitchPolygons(allPolygons, cuts, deadZones, tiles), ...stitchLines(allLines, cuts, deadZones, tiles)];
}
function stitchLines(allLines, cuts, deadZones, tiles) {
  const featuresByClass = groupBy(allLines, f => f.properties.computedId);
  // console.log('featuresByClass', featuresByClass);
  const finalFeatures = [];

  Object.values(featuresByClass).forEach(lines => {
    // console.log("lines", JSON.parse(JSON.stringify(lines)));

    for (let lineIndex = 0; lineIndex < lines.length; ++lineIndex) {
      const line = lines[lineIndex];
      const tile = tiles.find(t => t.x === line.properties.x && t.y === line.properties.y);
      const tileBounds = tile.tileBounds;
      const bboxTile = [tileBounds.west, tileBounds.south, tileBounds.east, tileBounds.north];
      /** The line is fully contained in the tile, no need to clip it */
      if (bboxContains(bboxTile, line.boundingBox)) continue;
      lines[lineIndex] = bboxClip(line, bboxTile);
    }

    // console.log("lines after clipping", lines);
    finalFeatures.push(...mergeLineStrings(lines));
  });
  return finalFeatures;
}

function stitchPolygons(allPolygons, cuts, deadZones, tiles) {

  const featuresByClass = groupBy(allPolygons, (f) => f.properties.computedId);

  // console.log('featuresByClass', featuresByClass);

  const mergedFeatures = [];
  Object.values(featuresByClass).forEach(layerPolygons => {

    console.log("layerPolygons=", layerPolygons);

    // Identify cut polygon
    let segmentsToProcess = [];
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
    console.log('segmentsToProcess', segmentsToProcess);

    const polygonIndexesCut = new Set(segmentsToProcess.map(s => s[0]));
    console.log('polygonIndexesCut=', polygonIndexesCut);

    // Filter cut polygons entirely in dead zones
    const polygonCutIndexExclude = new Set([...polygonIndexesCut].map(polygonIndex => {
      const polygon = layerPolygons[polygonIndex];
      if (deadZones.some(deadZone => bboxContains(deadZone.bbox, polygon.boundingBox))) return polygonIndex;
    }).filter(i => i !== undefined));

    // console.log('polygonCutIndexExclude', polygonCutIndexExclude);

    /** Polygons that are not cut and fully contained in a dead zone are duplicated among tiles: we must remove one */
    const polygonUuidDuplicated = {};
    layerPolygons.forEach((p, pIndex) => {
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
      const [polygonIndex, ringIndex, coordIndex, cutDirection] = segmentsToProcess[i];
      if (polygonCutIndexExclude.has(polygonIndex)) continue;
      console.log('finding match for', segmentsToProcess[i]);
      const matching = segmentsToProcess.filter(segment => {
        const [curPolygonIndex, curRingIndex, curCoordIndex, curCutDirection] = segment;
        if (polygonCutIndexExclude.has(curPolygonIndex)) return;
        if (curPolygonIndex === polygonIndex) return false;
        if (cutDirection !== curCutDirection) return false;

        const areCut = polygonsAreCutByTile(segmentsToProcess[i], segment, layerPolygons);
        if (areCut) {
          return bboxIntersects(layerPolygons[polygonIndex].boundingBox, layerPolygons[curPolygonIndex].boundingBox) &&
            booleanOverlap(layerPolygons[polygonIndex], layerPolygons[curPolygonIndex]);
        }
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
    console.log('stitchGroups=', stitchGroups);

    // merge groups that have intersection
    const finalStichGroups = mergeSets(stitchGroups);
    // console.log('finalStichGroups=', finalStichGroups);
    const stitchedPolygonsIndexes = new Set(finalStichGroups.flatMap(g => [...g]));
    const unmatchedCutPolygon = polygonIndexesCut.difference(stitchedPolygonsIndexes).difference(polygonCutIndexExclude);
    // console.log('unmatchedCutPolygon', unmatchedCutPolygon);

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
      computeFeatureUuid(stitched);
      finalPolygons.push(stitched)
    }

    console.log('finalPolygons=', finalPolygons);
    mergedFeatures.push(...finalPolygons);

    for (const deadZone of deadZones) {
      mergedFeatures.push(bboxPolygon(deadZone.bbox, { properties: { deadZone: true } }));
    }
  });
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

  if (cutDirection1 === "v") {
    // check horizontal overlap
    const pos1 = checkRingPosition(ring1, coordIndex1, cutDirection1);
    // console.log(polygons[polygonIndex1], pos1);
    const pos2 = checkRingPosition(ring2, coordIndex2, cutDirection2);
    // console.log(polygons[polygonIndex2], pos2);
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
    const pos1 = checkRingPosition(ring1, coordIndex1, cutDirection1);
    // console.log(polygons[polygonIndex1], pos1);
    const pos2 = checkRingPosition(ring2, coordIndex2, cutDirection2);
    // console.log(polygons[polygonIndex2], pos2);
    if (pos1 !== pos2) {
      if (pos1 === "top") {
        return polygon2.properties.y === polygon1.properties.y + 1 && ring1[coordIndex1][1] < ring2[coordIndex2][1];
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

/**
 * Merges GeoJSON LineString Features that share their first or last points
 * @param {Array<Object>} features - Array of GeoJSON Features with LineString geometry
 * @returns {Array<Object>} - Array of merged GeoJSON Features
 */
function mergeLineStrings(features) {
  if (!features || features.length === 0) {
    return [];
  }

  // Validate and extract LineStrings
  const validFeatures = features.filter(feature => 
    feature && 
    feature.geometry && 
    feature.geometry.type === 'LineString' && 
    Array.isArray(feature.geometry.coordinates) &&
    feature.geometry.coordinates.length > 0
  );

  if (validFeatures.length === 0) {
    return [];
  }

  // Helper function to get the first and last points of a LineString
  const getEndPoints = (feature) => {
    const coords = feature.geometry.coordinates;
    return {
      first: coords[0],
      last: coords[coords.length - 1]
    };
  };

  // Helper function to merge two LineString Features
  const mergeTwoFeatures = (feature1, feature2, connectFirst1, connectFirst2) => {
    console.log("merging", feature1, feature2, connectFirst1, connectFirst2);
    const coords1 = feature1.geometry.coordinates;
    const coords2 = feature2.geometry.coordinates;
    let mergedCoords = [];
    
    // Handle different connection scenarios
    if (connectFirst1 && connectFirst2) {
      // First point of feature1 connects to first point of feature2
      const reversedCoords1 = [...coords1].reverse();
      mergedCoords = [...reversedCoords1, ...coords2.slice(1)];
    } else if (connectFirst1 && !connectFirst2) {
      // First point of feature1 connects to last point of feature2
      mergedCoords = [...coords2, ...coords1.slice(1)];
    } else if (!connectFirst1 && connectFirst2) {
      // Last point of feature1 connects to first point of feature2
      mergedCoords = [...coords1, ...coords2.slice(1)];
    } else {
      // Last point of feature1 connects to last point of feature2
      const reversedCoords2 = [...coords2].reverse();
      mergedCoords = [...coords1, ...reversedCoords2.slice(1)];
    }
    
    // Create a new merged feature with combined properties
    const mergedFeature = {
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: mergedCoords
      },
      properties: feature1.properties
    };
    
    return mergedFeature;
  };

  let lines = [...validFeatures]; // Create a copy to work with
  let merged = true;
  
  // Continue merging until no more merges are possible
  while (merged) {
    merged = false;
    
    for (let i = 0; i < lines.length; i++) {
      if (merged) break; // If a merge occurred, restart the process
      
      const feature1 = lines[i];
      const endpoints1 = getEndPoints(feature1);
      
      for (let j = i + 1; j < lines.length; j++) {
        const feature2 = lines[j];
        const endpoints2 = getEndPoints(feature2);
        
        // Check for connections between endpoints
        let connection = null;
        
        if (pointsAreCloseBy(endpoints1.first, endpoints2.first)) {
          connection = { i, j, connectFirst1: true, connectFirst2: true };
        } else if (pointsAreCloseBy(endpoints1.first, endpoints2.last)) {
          connection = { i, j, connectFirst1: true, connectFirst2: false };
        } else if (pointsAreCloseBy(endpoints1.last, endpoints2.first)) {
          connection = { i, j, connectFirst1: false, connectFirst2: true };
        } else if (pointsAreCloseBy(endpoints1.last, endpoints2.last)) {
          connection = { i, j, connectFirst1: false, connectFirst2: false };
        }
        
        if (connection) {
          // Merge the features
          const mergedFeature = mergeTwoFeatures(
            feature1, 
            feature2, 
            connection.connectFirst1, 
            connection.connectFirst2
          );
          
          // Remove the original features and add the merged one
          lines.splice(j, 1); // Remove feature2 first (higher index)
          lines.splice(i, 1); // Remove feature1
          lines.push(mergedFeature); // Add merged feature
          
          merged = true;
          break;
        }
      }
    }
  }
  
  return lines;
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

function pointsAreCloseBy(p1, p2) {
  return Math.abs(p1[1] - p2[1]) < 0.00001 && Math.abs(p1[0] - p2[0]) < 0.00001;
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


const testRendered = [
  {
    "id": 41804121,
    "properties": {
      "class": "grass",
      "subclass": "meadow",
      "id": 41804121,
      "x": 16615,
      "y": 11461,
      "computedId": "landcover-grass-meadow",
      "center": [
        2.546357810497284,
        47.472917595641974
      ],
      "uuid": "2.5463578-47.4729176",
      "index": 0
    },
    "geometry": {
      "type": "Polygon",
      "coordinates": [
        [
          [
            2.547385096549988,
            47.47254683536755
          ],
          [
            2.5451722741127014,
            47.47254683536755
          ],
          [
            2.5456926226615906,
            47.473288355916395
          ],
          [
            2.5475433468818665,
            47.47286592617718
          ],
          [
            2.547385096549988,
            47.47254683536755
          ]
        ]
      ]
    },
    "source": "maptiler_planet",
    "sourceLayer": "landcover",
    "type": "Feature",
    "boundingBox": [
      2.5451722741127014,
      47.47254683536755,
      2.5475433468818665,
      47.473288355916395
    ]
  },
  {
    "id": 385230348,
    "properties": {
      "class": "grass",
      "subclass": "grass",
      "id": 385230348,
      "x": 16615,
      "y": 11462,
      "computedId": "landcover-grass-grass",
      "center": [
        2.546282708644867,
        47.47168111043963
      ],
      "uuid": "2.5462827-47.4716811",
      "index": 1
    },
    "geometry": {
      "type": "Polygon",
      "coordinates": [
        [
          [
            2.5461968779563904,
            47.47173278242363
          ],
          [
            2.5461727380752563,
            47.47175091291601
          ],
          [
            2.546210289001465,
            47.471745473768976
          ],
          [
            2.546255886554718,
            47.471738221572
          ],
          [
            2.5462961196899414,
            47.47173459547315
          ],
          [
            2.5463470816612244,
            47.47173096937405
          ],
          [
            2.5463926792144775,
            47.47173278242363
          ],
          [
            2.5463256239891052,
            47.47168020396032
          ],
          [
            2.546277344226837,
            47.47164394292048
          ],
          [
            2.5462505221366882,
            47.47161130796326
          ],
          [
            2.5462505221366882,
            47.47163306460368
          ],
          [
            2.5462505221366882,
            47.47165300818281
          ],
          [
            2.5462424755096436,
            47.471674764805954
          ],
          [
            2.546231746673584,
            47.47169833447083
          ],
          [
            2.5462183356285095,
            47.47171646497512
          ],
          [
            2.5461968779563904,
            47.47173278242363
          ]
        ]
      ]
    },
    "source": "maptiler_planet",
    "sourceLayer": "landcover",
    "type": "Feature",
    "boundingBox": [
      2.5461727380752563,
      47.47161130796326,
      2.5463926792144775,
      47.47175091291601
    ]
  },
  {
    "id": 41804121,
    "properties": {
      "class": "grass",
      "subclass": "meadow",
      "id": 41804121,
      "x": 16615,
      "y": 11462,
      "computedId": "landcover-grass-meadow",
      "index": 3
    },
    "geometry": {
      "type": "MultiPolygon",
      "coordinates": [
        [
          [
            [
              2.5444936752319336,
              47.46883544937785
            ],
            [
              2.5436004996299744,
              47.469635042227
            ],
            [
              2.543882131576538,
              47.46970031457556
            ],
            [
              2.5443997979164124,
              47.47025150006456
            ],
            [
              2.544981837272644,
              47.470039366859965
            ],
            [
              2.5458428263664246,
              47.47064856760781
            ],
            [
              2.545005977153778,
              47.4709477261041
            ],
            [
              2.5445660948753357,
              47.470641315259485
            ],
            [
              2.5447887182235718,
              47.47199567395111
            ],
            [
              2.54533588886261,
              47.47277890160308
            ],
            [
              2.547500431537628,
              47.47277890160308
            ],
            [
              2.5470900535583496,
              47.47195216096151
            ],
            [
              2.547428011894226,
              47.47199023482938
            ],
            [
              2.5475353002548218,
              47.47092415610254
            ],
            [
              2.5484901666641235,
              47.470730156457506
            ],
            [
              2.548999786376953,
              47.47080993209917
            ],
            [
              2.548999786376953,
              47.469379391414435
            ],
            [
              2.548653781414032,
              47.46958790103591
            ],
            [
              2.547755241394043,
              47.46981998033746
            ],
            [
              2.5467440485954285,
              47.46970575393428
            ],
            [
              2.5465750694274902,
              47.469212583121674
            ],
            [
              2.546685039997101,
              47.46860336572894
            ],
            [
              2.5467950105667114,
              47.468222601272515
            ],
            [
              2.5472429394721985,
              47.4678001308142
            ],
            [
              2.5466206669807434,
              47.466889903952705
            ],
            [
              2.5452205538749695,
              47.46742480013367
            ],
            [
              2.5443193316459656,
              47.466855452825655
            ],
            [
              2.544485628604889,
              47.4661301606987
            ],
            [
              2.5448745489120483,
              47.46540848509943
            ],
            [
              2.5427421927452087,
              47.46602136601646
            ],
            [
              2.5421226024627686,
              47.46512017474103
            ],
            [
              2.539786398410797,
              47.46512017474103
            ],
            [
              2.5409477949142456,
              47.46636588173769
            ],
            [
              2.5414520502090454,
              47.466442037539736
            ],
            [
              2.542581260204315,
              47.467468316871674
            ],
            [
              2.543310821056366,
              47.46773304291827
            ],
            [
              2.5445473194122314,
              47.46780557036959
            ],
            [
              2.5444936752319336,
              47.46883544937785
            ]
          ]
        ],
        [
          [
            [
              2.548256814479828,
              47.46840935751723
            ],
            [
              2.548999786376953,
              47.4691309919161
            ],
            [
              2.548999786376953,
              47.467932493168576
            ],
            [
              2.548256814479828,
              47.46840935751723
            ]
          ]
        ]
      ]
    },
    "source": "maptiler_planet",
    "sourceLayer": "landcover",
    "type": "Feature"
  },
  {
    "id": 41804121,
    "properties": {
      "class": "grass",
      "subclass": "meadow",
      "id": 41804121,
      "x": 16616,
      "y": 11462,
      "computedId": "landcover-grass-meadow",
      "center": [
        2.5543212890625,
        47.468949538172055
      ],
      "uuid": "2.5543213-47.4689495",
      "index": 4
    },
    "geometry": {
      "type": "Polygon",
      "coordinates": [
        [
          [
            2.548656463623047,
            47.46958608791229
          ],
          [
            2.548656463623047,
            47.47075735271258
          ],
          [
            2.549726665019989,
            47.470920529947534
          ],
          [
            2.5514674186706543,
            47.47106920209828
          ],
          [
            2.551523745059967,
            47.47118342553813
          ],
          [
            2.55107581615448,
            47.47164212986786
          ],
          [
            2.551751732826233,
            47.47202105651175
          ],
          [
            2.5520119071006775,
            47.47277890160308
          ],
          [
            2.5534656643867493,
            47.47277890160308
          ],
          [
            2.5528165698051453,
            47.471600429639665
          ],
          [
            2.555117905139923,
            47.471023875267605
          ],
          [
            2.556247115135193,
            47.47231839416611
          ],
          [
            2.557590901851654,
            47.47177992169085
          ],
          [
            2.558363378047943,
            47.47027144416796
          ],
          [
            2.5589239597320557,
            47.4702206773444
          ],
          [
            2.5597071647644043,
            47.471100024320776
          ],
          [
            2.5591492652893066,
            47.47158773825933
          ],
          [
            2.559911012649536,
            47.47221323835868
          ],
          [
            2.559811770915985,
            47.47226037719494
          ],
          [
            2.559986114501953,
            47.472289385688526
          ],
          [
            2.559986114501953,
            47.46512017474103
          ],
          [
            2.557413876056671,
            47.46512017474103
          ],
          [
            2.557397782802582,
            47.46538491261376
          ],
          [
            2.5574541091918945,
            47.465994167310726
          ],
          [
            2.5570088624954224,
            47.46656715040359
          ],
          [
            2.556391954421997,
            47.46698600434567
          ],
          [
            2.5561103224754333,
            47.466376761144744
          ],
          [
            2.5551554560661316,
            47.46672127453661
          ],
          [
            2.5549891591072083,
            47.4673305137444
          ],
          [
            2.5551608204841614,
            47.46801589941245
          ],
          [
            2.552918493747711,
            47.46855259729409
          ],
          [
            2.55144864320755,
            47.46672671420367
          ],
          [
            2.5508853793144226,
            47.466119281240594
          ],
          [
            2.5504937767982483,
            47.46657802976898
          ],
          [
            2.5499922037124634,
            47.467225347956884
          ],
          [
            2.549152672290802,
            47.467836394506094
          ],
          [
            2.548656463623047,
            47.468151887569746
          ],
          [
            2.548656463623047,
            47.46879737322445
          ],
          [
            2.549158036708832,
            47.46928329539739
          ],
          [
            2.548656463623047,
            47.46958608791229
          ]
        ]
      ]
    },
    "source": "maptiler_planet",
    "sourceLayer": "landcover",
    "type": "Feature",
    "boundingBox": [
      2.548656463623047,
      47.46512017474103,
      2.559986114501953,
      47.47277890160308
    ]
  }
];
const testTiles = [
  {
    "tileBounds": {
      "north": 47.48008846346321,
      "south": 47.47266286861342,
      "east": 2.548828125,
      "west": 2.537841796875
    },
    "polyBuffer": {
      "type": "Feature",
      "properties": {
        "tileExtent": true
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [
              2.537670135498047,
              47.47254684369389
            ],
            [
              2.537670135498047,
              47.48020448838274
            ],
            [
              2.548999786376953,
              47.48020448838274
            ],
            [
              2.548999786376953,
              47.47254684369389
            ],
            [
              2.537670135498047,
              47.47254684369389
            ]
          ]
        ]
      }
    },
    "tileBufferBounds": {
      "north": 47.48020448838274,
      "south": 47.47254684369389,
      "west": 2.537670135498047,
      "east": 2.548999786376953
    },
    "x": 16615,
    "y": 11461
  },
  {
    "tileBounds": {
      "north": 47.48008846346321,
      "south": 47.47266286861342,
      "east": 2.559814453125,
      "west": 2.548828125
    },
    "polyBuffer": {
      "type": "Feature",
      "properties": {
        "tileExtent": true
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [
              2.548656463623047,
              47.47254684369389
            ],
            [
              2.548656463623047,
              47.48020448838274
            ],
            [
              2.559986114501953,
              47.48020448838274
            ],
            [
              2.559986114501953,
              47.47254684369389
            ],
            [
              2.548656463623047,
              47.47254684369389
            ]
          ]
        ]
      }
    },
    "tileBufferBounds": {
      "north": 47.48020448838274,
      "south": 47.47254684369389,
      "west": 2.548656463623047,
      "east": 2.559986114501953
    },
    "x": 16616,
    "y": 11461
  },
  {
    "tileBounds": {
      "north": 47.47266286861342,
      "south": 47.46523622438362,
      "east": 2.559814453125,
      "west": 2.548828125
    },
    "polyBuffer": {
      "type": "Feature",
      "properties": {
        "tileExtent": true
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [
              2.548656463623047,
              47.465120183067526
            ],
            [
              2.548656463623047,
              47.47277890992951
            ],
            [
              2.559986114501953,
              47.47277890992951
            ],
            [
              2.559986114501953,
              47.465120183067526
            ],
            [
              2.548656463623047,
              47.465120183067526
            ]
          ]
        ]
      }
    },
    "tileBufferBounds": {
      "north": 47.47277890992951,
      "south": 47.465120183067526,
      "west": 2.548656463623047,
      "east": 2.559986114501953
    },
    "x": 16616,
    "y": 11462
  },
  {
    "tileBounds": {
      "north": 47.47266286861342,
      "south": 47.46523622438362,
      "east": 2.548828125,
      "west": 2.537841796875
    },
    "polyBuffer": {
      "type": "Feature",
      "properties": {
        "tileExtent": true
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [
              2.537670135498047,
              47.465120183067526
            ],
            [
              2.537670135498047,
              47.47277890992951
            ],
            [
              2.548999786376953,
              47.47277890992951
            ],
            [
              2.548999786376953,
              47.465120183067526
            ],
            [
              2.537670135498047,
              47.465120183067526
            ]
          ]
        ]
      }
    },
    "tileBufferBounds": {
      "north": 47.47277890992951,
      "south": 47.465120183067526,
      "west": 2.537670135498047,
      "east": 2.548999786376953
    },
    "x": 16615,
    "y": 11462
  }
];
const testBounds = {
  "type": "Feature",
  "properties": {},
  "geometry": {
    "type": "Polygon",
    "coordinates": [
      [
        [
          2.5440872586023886,
          47.47414349614263
        ],
        [
          2.5514315271361454,
          47.47414349614263
        ],
        [
          2.5514315271361454,
          47.46859989290638
        ],
        [
          2.5440872586023886,
          47.46859989290638
        ],
        [
          2.5440872586023886,
          47.47414349614263
        ]
      ]
    ]
  }
};
stitch(testRendered, testTiles, testBounds)