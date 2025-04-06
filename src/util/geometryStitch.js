import bbox from "@turf/bbox";
import bboxPolygon from "@turf/bbox-polygon";
import booleanDisjoint from "@turf/boolean-disjoint";
import booleanOverlap from "@turf/boolean-overlap";
import { featureCollection, geometry, polygon } from "@turf/helpers";
import intersect from "@turf/intersect";
import union from "@turf/union";
import area from "@turf/area";

function mergeMapLibreFeaturesByID(map, renderedFeatures) {
  console.log('renderedFeatures=', renderedFeatures);
  // Get visible tile coordinates
  const bounds = map.getBounds();
  const zoom = Math.floor(map.getZoom());
  const visibleTiles = getTilesInBounds(bounds, zoom);
  console.log('visibleTiles=', visibleTiles);
  // Group features by ID
  const featuresByID = {};
  renderedFeatures.forEach(feature => {
    const id = feature.properties.id;
    if (!featuresByID[id]) {
      featuresByID[id] = [];
    }
    featuresByID[id].push(feature);
  });

  // Process features
  const mergedFeatures = [];

  Object.keys(featuresByID).forEach(id => {
    const features = featuresByID[id];
    console.log('features=', features);

    if (features.length === 1) {
      // If only one feature with this ID, add it directly
      mergedFeatures.push(features[0]);
    } else {
      // Extract all polygons for processing
      const allRings = [];
      features.forEach(feature => {
        if (feature.geometry.type === 'Polygon') {
          allRings.push(...feature.geometry.coordinates);
        } else if (feature.geometry.type === 'MultiPolygon') {
          feature.geometry.coordinates.forEach(polygon => {
            allRings.push(...polygon);
          });
        }
      });

      // Create edge index for efficient lookups
      const edgeIndex = new Map();
      // Index all edges that might be on tile boundaries
      allRings.forEach((ring, ringIndex) => {
        for (let i = 0; i < ring.length - 1; i++) {
          const p1 = ring[i];
          const p2 = ring[i + 1];

          // Only process edges that might be on tile boundaries
          if (isEdgeOnTileBoundary(p1, p2, visibleTiles)) {
            // Create a unique key for this edge
            const key = getEdgeKey(p1, p2);

            // Store edge information
            if (!edgeIndex.has(key)) {
              edgeIndex.set(key, []);
            }

            edgeIndex.get(key).push({
              ringIndex,
              edgeIndex: i,
              reversed: isReversedEdge(p1, p2, key)
            });
          }
        }
      });
      console.log('edge entries', [...edgeIndex.entries()]);

      // Identify edges to remove (those that appear exactly twice and are on tile boundaries)
      const edgesToRemove = new Set();
      for (const [key, instances] of edgeIndex.entries()) {
        if (instances.length === 2) {
          instances.forEach(instance => {
            edgesToRemove.add(`${instance.ringIndex}_${instance.edgeIndex}`);
          });
        }
      }

      console.log('edgesToRemove', [...edgesToRemove]);
      // return mergedFeatures;

      // Stitch rings together
      const processedRings = new Set();
      const mergedRings = [];

      // Process each ring
      for (let ringIndex = 0; ringIndex < allRings.length; ringIndex++) {
        if (!processedRings.has(ringIndex)) {
          const mergedRing = stitchRing(ringIndex, 0, allRings, edgesToRemove, edgeIndex, processedRings);
          if (mergedRing && mergedRing.length > 3) {
            mergedRings.push(mergedRing);
          }
        }
      }

      // Determine polygon structure (which rings are holes)
      const polygons = organizeRingsIntoPolygons(mergedRings);

      // Create merged geometry
      const mergedGeometry = {
        type: polygons.length === 1 ? 'Polygon' : 'MultiPolygon',
        coordinates: polygons.length === 1 ? polygons[0] : polygons
      };

      // Create merged feature
      mergedFeatures.push({
        ...features[0],
        geometry: mergedGeometry
      });
    }
  });

  return mergedFeatures;
}

// Helper function to get all visible tiles
function getTilesInBounds(bounds, zoom) {
  const tiles = [];

  // Convert bounds to tile coordinates
  const sw = latLngToTile(bounds.getSouthWest().lat, bounds.getSouthWest().lng, zoom);
  const ne = latLngToTile(bounds.getNorthEast().lat, bounds.getNorthEast().lng, zoom);

  // Get all tiles in the visible area
  for (let x = sw.x; x <= ne.x; x++) {
    for (let y = ne.y; y <= sw.y; y++) {
      tiles.push({
        x, y, z: zoom,
        bounds: getTileBounds(x, y, zoom)
      });
    }
  }

  return tiles;
}

// Convert lat/lng to tile coordinates
function latLngToTile(lat, lng, zoom) {
  const scale = Math.pow(2, zoom);
  const x = Math.floor((lng + 180) / 360 * scale);
  const y = Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * scale);
  return { x, y };
}

// Get bounds of a tile
function getTileBounds(x, y, zoom) {
  const scale = Math.pow(2, zoom);

  // Get tile boundaries in mercator coordinates
  const west = x / scale * 360 - 180;
  const east = (x + 1) / scale * 360 - 180;
  const north = Math.atan(Math.sinh(Math.PI * (1 - 2 * y / scale))) * 180 / Math.PI;
  const south = Math.atan(Math.sinh(Math.PI * (1 - 2 * (y + 1) / scale))) * 180 / Math.PI;

  return { north, south, east, west };
}

// Check if an edge is on a tile boundary
function isEdgeOnTileBoundary(p1, p2, tiles) {
  // An edge is on a tile boundary if:
  // 1. It's vertical or horizontal (approximately)
  // 2. Its coordinate aligns with a tile edge

  const isVertical = Math.abs(p1[0] - p2[0]) < 0.0000001;
  const isHorizontal = Math.abs(p1[1] - p2[1]) < 0.0000001;

  if (!isVertical && !isHorizontal) {
    return false; // Tile boundaries are straight lines
  }

  // Check if coordinates align with any tile boundary
  for (const tile of tiles) {
    if (isVertical) {
      if (Math.abs(p1[0] - tile.bounds.west) < 0.001 ||
        Math.abs(p1[0] - tile.bounds.east) < 0.001) {
        return true;
      }
    }

    if (isHorizontal) {
      if (Math.abs(p1[1] - tile.bounds.north) < 0.001 ||
        Math.abs(p1[1] - tile.bounds.south) < 0.001) {
        return true;
      }
    }
  }

  return false;
}

// Create a unique key for an edge
function getEdgeKey(p1, p2) {
  // Sort points to ensure edge direction doesn't matter
  if (p1[0] < p2[0] || (p1[0] === p2[0] && p1[1] < p2[1])) {
    return `${p1[0]},${p1[1]}_${p2[0]},${p2[1]}`;
  } else {
    return `${p2[0]},${p2[1]}_${p1[0]},${p1[1]}`;
  }
}

// Check if an edge is reversed compared to its key
function isReversedEdge(p1, p2, key) {
  return key !== `${p1[0]},${p1[1]}_${p2[0]},${p2[1]}`;
}

// Stitch rings together
function stitchRing(startRingIndex, startEdgeIndex, allRings, edgesToRemove, edgeIndex, processedRings) {
  if (processedRings.has(startRingIndex)) {
    return null;
  }

  const mergedRing = [];
  let currentRingIndex = startRingIndex;
  let currentEdgeIndex = startEdgeIndex;
  let isComplete = false;

  while (!isComplete) {
    processedRings.add(currentRingIndex);

    // Add current point to merged ring
    const currentPoint = allRings[currentRingIndex][currentEdgeIndex];
    mergedRing.push([...currentPoint]);

    // Move to next edge
    let nextEdgeIndex = (currentEdgeIndex + 1) % (allRings[currentRingIndex].length - 1);
    let nextRingIndex = currentRingIndex;

    // Check if current edge should be removed (is on a tile boundary)
    const edgeKey = `${currentRingIndex}_${currentEdgeIndex}`;
    if (edgesToRemove.has(edgeKey)) {
      // Find matching edge
      const p1 = allRings[currentRingIndex][currentEdgeIndex];
      const p2 = allRings[currentRingIndex][(currentEdgeIndex + 1) % (allRings[currentRingIndex].length - 1)];
      const key = getEdgeKey(p1, p2);

      const matchingEdges = edgeIndex.get(key);
      if (matchingEdges && matchingEdges.length === 2) {
        // Find the edge that isn't the current one
        const otherEdge = matchingEdges.find(e =>
          e.ringIndex !== currentRingIndex || e.edgeIndex !== currentEdgeIndex
        );

        if (otherEdge) {
          // Jump to the matching ring
          nextRingIndex = otherEdge.ringIndex;

          // Adjust edge index based on direction
          if (otherEdge.reversed) {
            nextEdgeIndex = (otherEdge.edgeIndex === 0) ?
              allRings[nextRingIndex].length - 2 : otherEdge.edgeIndex - 1;
          } else {
            nextEdgeIndex = (otherEdge.edgeIndex + 1) % (allRings[nextRingIndex].length - 1);
          }
        }
      }
    }

    // Check if we've completed the ring
    if (nextRingIndex === startRingIndex && nextEdgeIndex === startEdgeIndex) {
      isComplete = true;
    } else {
      currentRingIndex = nextRingIndex;
      currentEdgeIndex = nextEdgeIndex;
    }
  }

  // Close the ring
  if (mergedRing.length > 0) {
    mergedRing.push([...mergedRing[0]]);
  }

  return mergedRing;
}

// Organize rings into polygons (outer rings and holes)
function organizeRingsIntoPolygons(rings) {
  // For simplicity, we'll assume all rings are outer rings
  // In a production system, you'd need to:
  // 1. Determine ring winding (clockwise/counterclockwise)
  // 2. Check containment relationships
  // 3. Group holes with their containing rings

  const polygons = [];
  rings.forEach(ring => {
    polygons.push([ring]);
  });

  return polygons;
}

// Example usage:
export function getRenderedFeatures(map, options) {
  // Get all rendered features
  // const renderedFeatures = map.queryRenderedFeatures(options).map(f => ({
  //     id: f.id,
  //     properties: f.properties,
  //     geometry: f.geometry,
  //     source: f.source,
  //     sourceLayer: f.sourceLayer,
  //     type: f.type,
  // }));


  // Merge features by ID
  // const mergedFeatures = mergeMapLibreFeaturesByID(map, renderedFeatures);
  const renderedFeatures = map.queryRenderedFeatures(options).map(f => {
    f.properties.id = f.id;
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
  console.log('renderedFeatures=', renderedFeatures)

  return stitch(renderedFeatures, map);

  // return mergedFeatures;
}

export function stitch(renderedFeatures, map) {
  let mapBounds;
  if (map) {
    // Get bounds by calling map.unproject() on each corner of the viewport
    const canvas = map.getCanvas();
    const w = canvas.width;
    const h = canvas.height;
    const cUL = map.unproject([0, 0]).toArray();
    const cUR = map.unproject([w, 0]).toArray();
    const cLR = map.unproject([w, h]).toArray();
    const cLL = map.unproject([0, h]).toArray();
    const coordinates = [cUL, cUR, cLR, cLL, cUL];
    mapBounds = polygon([coordinates]);
    console.log('mapBounds=', mapBounds);
  }

  const featuresByID = {};
  renderedFeatures.forEach(feature => {
    const id = feature.properties.id;
    if (!featuresByID[id]) {
      featuresByID[id] = [];
    }
    featuresByID[id].push(feature);
  });

  console.log('featuresByID', featuresByID);
  const mergedFeatures = [];
  const allClasses = new Set();
  Object.keys(featuresByID).forEach(id => {
    const features = featuresByID[id];
    const allPolygons = [];
    let i = 0;
    // Flatten into polygons
    features.forEach(feature => {
      feature.properties.computedId = getComputedId(feature);
      allClasses.add(feature.properties.computedId);
      if (feature.geometry.type === 'Polygon') {
        feature.boundingBox = bbox(feature);
        if (mapBounds && booleanDisjoint(mapBounds, bboxPolygon(feature.boundingBox))) return;
        feature.properties.index = i++;
        feature.properties.area = area(feature);
        allPolygons.push(feature);
      } else if (feature.geometry.type === 'MultiPolygon') {
        feature.geometry.coordinates.forEach(polygon => {
          const polygonFeature = {
            type: "Polygon",
            coordinates: polygon
          };
          const boundingBox = bbox(polygonFeature);
          if (mapBounds && booleanDisjoint(mapBounds, bboxPolygon(boundingBox))) return;
          feature.properties.index = i++;
          feature.properties.area = area(feature);
          allPolygons.push({
            ...feature,
            boundingBox,
            geometry: polygonFeature
          });
        });
      }
    });
    // console.log('found cuts=', cuts);
    // mergedFeatures.push(...allPolygons);
    // return;
    // Identify vertical and horizontal global cut sections

    // Identify possible cut polygon
    let segmentsToProcess = [];

    /* A vertical / horizontal segment is a cut if:
    * - it is perfectly horizontal / vertical
    * - TODO: it is close to tile boundary. 
    *     -> compute current tiles
    *     -> compute distance to buffered size from current zoom (14 or 15)
    *     -> set maxzoom of map to 15
    * - it is shared amont multiple features OR
    * - its extent is significant relative to the geometry it belongs to
    */
    const finalCutPoints = {
      'vertical': new Set(),
      'horizontal': new Set()
    };
    const pointsStats = {
      'vertical': {},
      'horizontal': {}
    };

    const pointsStatsFeatures = {
      'vertical': {},
      'horizontal': {}
    };
    const cutPoints = {
      'vertical': {},
      'horizontal': {}
    };
    allPolygons.forEach((polygon, polygonIndex) => {
      polygon.properties = { ...polygon.properties, index: polygonIndex };
      polygon.geometry.coordinates.forEach((ring, ringIndex) => {
        for (let i = 0; i < ring.length - 1; i++) {
          const p1 = ring[i];
          const p2 = ring[i + 1];

          const resHorizontal = checkSegmentHorizontal(p1, p2);
          if (resHorizontal) {
            segmentsToProcess.push([polygonIndex, ringIndex, i, 'horizontal']);
            const { latitude, extent } = resHorizontal;
            const bboxExtent = polygon.boundingBox[2] - polygon.boundingBox[0];
            if (extent / bboxExtent > 0.5) finalCutPoints['horizontal'].add(latitude);
            if (!pointsStats['horizontal'][latitude]) pointsStats['horizontal'][latitude] = 1;
            else pointsStats['horizontal'][latitude] += 1;
            const p1Str = `${p1[0].toFixed(7)}-${p1[1].toFixed(7)}`;
            const p2Str = `${p2[0].toFixed(7)}-${p2[1].toFixed(7)}`;
            /** 
             * Check if potential cut point was already found before. If the exact same point was found before
             * on another geometry, this does not tell us much
            */
            if (!cutPoints['horizontal'][latitude]?.has(p1Str) && !cutPoints['horizontal'][latitude]?.has(p2Str)) {
              if (!pointsStatsFeatures['horizontal'][latitude]) pointsStatsFeatures['horizontal'][latitude] = new Set([polygonIndex]);
              else pointsStatsFeatures['horizontal'][latitude].add(polygonIndex);
            }
            if (!cutPoints['horizontal'][latitude]) cutPoints['horizontal'][latitude] = new Set();
            cutPoints['horizontal'][latitude].add(p1Str);
            cutPoints['horizontal'][latitude].add(p2Str);
          }
          const resVertical = checkSegmentVertical(p1, p2);
          if (resVertical) {
            segmentsToProcess.push([polygonIndex, ringIndex, i, 'vertical']);
            const { longitude, extent } = resVertical;
            const bboxExtent = polygon.boundingBox[3] - polygon.boundingBox[1];
            if (extent / bboxExtent > 0.5) finalCutPoints['vertical'].add(longitude);
            if (!pointsStats['vertical'][longitude]) pointsStats['vertical'][longitude] = 1;
            else pointsStats['vertical'][longitude] += 1;
            const p1Str = `${p1[0].toFixed(7)}-${p1[1].toFixed(7)}`;
            const p2Str = `${p2[0].toFixed(7)}-${p2[1].toFixed(7)}`;
            if (!cutPoints['vertical'][longitude]?.has(p1Str) && !cutPoints['vertical'][longitude]?.has(p2Str)) {
              if (!pointsStatsFeatures['vertical'][longitude]) pointsStatsFeatures['vertical'][longitude] = new Set([polygonIndex]);
              else pointsStatsFeatures['vertical'][longitude].add(polygonIndex);
            }
            if (!cutPoints['vertical'][longitude]) cutPoints['vertical'][longitude] = new Set();
            cutPoints['vertical'][longitude].add(p1Str);
            cutPoints['vertical'][longitude].add(p2Str);
          }
          // const cutDirection = edgeMaybeFromCut(p1, p2);
          // if (!cutDirection) continue;
          // segmentsToProcess.push([polygonIndex, ringIndex, i, cutDirection]);
        }
      });
    });
    for (const [direction, polyIndexesForPoint] of Object.entries(pointsStatsFeatures)) {
      for (const [value, indexes] of Object.entries(polyIndexesForPoint)) {
        if (indexes.size > 1) finalCutPoints[direction].add(value);
        /** Sing feature on it: not a cut */
        else finalCutPoints[direction].delete(value);
        if (pointsStats[direction][value] === 1) finalCutPoints[direction].delete(value);
      }
    }
    console.log('allPolygons=', allPolygons);
    console.log('pointsStats=', pointsStats);
    console.log('pointsStatsFeatures=', pointsStatsFeatures);
    console.log('finalCutPoints=', finalCutPoints);
    console.log('segmentsToProcess before', segmentsToProcess.length);
    segmentsToProcess = segmentsToProcess.filter(segment => {
      const [polygonIndex, ringIndex, coordIndex, _] = segment;
      const p = allPolygons[polygonIndex].geometry.coordinates[ringIndex][coordIndex];
      return finalCutPoints['horizontal'].has(p[1].toFixed(7)) || finalCutPoints['vertical'].has(p[0].toFixed(7));
    });
    console.log('segmentsToProcess', segmentsToProcess);

    // Determine which polygons to stitch together by:
    // - checking if pairwise segments are closeby together
    // - if yes, checking that the geometries overlap
    const stitchGroups = [];
    for (let i = 0; i < segmentsToProcess.length; ++i) {
      // if (segmentsToProcess[i].processed) continue;
      const [polygonIndex, ringIndex, coordIndex, cutDirection] = segmentsToProcess[i];
      console.log('finding match for', segmentsToProcess[i]);
      const matching = segmentsToProcess.filter(segment => {
        // if (segment.processed) return false;
        const [curPolygonIndex, curRingIndex, curCoordIndex, curCutDirection] = segment;
        if (curPolygonIndex === polygonIndex) return false;
        if (cutDirection !== curCutDirection) return false;
        // const p1 = allPolygons[polygonIndex].geometry.coordinates[ringIndex][coordIndex];
        // const p2 = allPolygons[curPolygonIndex].geometry.coordinates[curRingIndex][curCoordIndex];
        // const closeBy = pointsAreCloseBy(p1, p2, cutDirection, map);

        // TODO: find a way to remove the booleanOverlap, which rules out false positives (see example geometry below)
        const areCut = polygonsAreCutByTile(segmentsToProcess[i], segment, allPolygons);
        if (areCut) {
          console.log('potential cut found for', curPolygonIndex, curRingIndex);
          const overlap = minimalGeometryFromSegmentsOverlap(segmentsToProcess[i], segment, allPolygons);
          // const overlap = booleanOverlap(allPolygons[polygonIndex], allPolygons[curPolygonIndex]);
          if (overlap) {
            // console.log("with overlap!");
            return true;
          }
          // else console.log("but no overlap");
        }

        // return polygonsAreCutByTile(segmentsToProcess[i], segment, allPolygons)
        //     && minimalGeometryFromSegmentsOverlap(segmentsToProcess[i], segment, allPolygons);
        // && booleanOverlap(allPolygons[polygonIndex], allPolygons[curPolygonIndex]);
        // return booleanOverlap(allPolygons[polygonIndex], allPolygons[curPolygonIndex]);
        // return intersect(featureCollection([allPolygons[polygonIndex], allPolygons[curPolygonIndex]])) != null;
        // return closeBy;
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

    const polygonIndexesCut = new Set(segmentsToProcess.map(s => s[0]));
    console.log('polygonIndexesCut=', polygonIndexesCut);

    // merge groups that have intersection
    const finalStichGroups = mergeSets(stitchGroups);
    console.log('finalStichGroups=', finalStichGroups);

    const stitchedPolygonsIndexes = new Set(finalStichGroups.flatMap(g => [...g]));
    const finalPolygons = allPolygons.filter((poly, i) => {
      const isCut = polygonIndexesCut.has(i);
      const isStiched = stitchedPolygonsIndexes.has(i);
      // return !isStiched;
      return !isCut;
      // return !stitchedPolygonsIndexes.has(i);
    });
    // union the polygons together
    for (const group of finalStichGroups) {
      const polygons = featureCollection([...group].map(polygonIndex => allPolygons[polygonIndex]));
      const stitched = union(polygons);
      // const stitched = union(polygons, { properties: featureWithoutGeom.properties });
      console.log("stitched", stitched);
      finalPolygons.push(stitched)
    }

    console.log('finalPolygons=', finalPolygons);
    mergedFeatures.push(...finalPolygons);
  });
  console.log("allClasses=", allClasses);
  return mergedFeatures;
}


function polygonsAreCutByTile(segmentInfo1, segmentInfo2, polygons) {
  const [polygonIndex1, ringIndex1, coordIndex1, cutDirection1] = segmentInfo1;
  const [polygonIndex2, ringIndex2, coordIndex2, cutDirection2] = segmentInfo2;
  const ring1 = polygons[polygonIndex1].geometry.coordinates[ringIndex1];
  const ring2 = polygons[polygonIndex2].geometry.coordinates[ringIndex2];
  // console.log('comparing', segmentInfo1, segmentInfo2, ring2);
  const p1 = ring1[coordIndex1]; const p1Next = ring1[(coordIndex1 === ring1.length - 1) ? 0 : coordIndex1 + 1];
  const p2 = ring2[coordIndex2]; const p2Next = ring2[(coordIndex2 === ring2.length - 1) ? 0 : coordIndex2 + 1];

  if (cutDirection1 === "vertical") {
    // check vertical overlap
    if (!segmentsOverlap(p1[1], p1Next[1], p2[1], p2Next[1])) return false;
    // check horizontal overlap
    const pos1 = checkRingPosition(ring1, coordIndex1, cutDirection1);
    // console.log(polygons[polygonIndex1], pos1);
    const pos2 = checkRingPosition(ring2, coordIndex2, cutDirection2);
    // console.log(polygons[polygonIndex2], pos2);
    if (pos1 !== pos2) {
      // check that the leftmost segment is at the right of rightmost segment: if it is, there is overlap
      if (pos1 === "left") return ring1[coordIndex1][0] > ring2[coordIndex2][0];
      else return ring1[coordIndex1][0] < ring2[coordIndex2][0]
    }
  } else {
    // check horizontal overlap
    if (!segmentsOverlap(p1[0], p1Next[0], p2[0], p2Next[0])) return false;
    const pos1 = checkRingPosition(ring1, coordIndex1, cutDirection1);
    // console.log(polygons[polygonIndex1], pos1);
    const pos2 = checkRingPosition(ring2, coordIndex2, cutDirection2);
    // console.log(polygons[polygonIndex2], pos2);
    if (pos1 !== pos2) {
      if (pos1 === "top") return ring1[coordIndex1][1] < ring2[coordIndex2][1];
      else return ring1[coordIndex1][1] > ring2[coordIndex2][1]
    }
  }
  return false;
}

function checkRingPosition(ring, coordIndex, cutDirection) {
  if (cutDirection === "vertical") {
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

function checkSegmentHorizontal(p1, p2) {
  const [lon1, lat1] = p1;
  const [lon2, lat2] = p2;
  if (Math.abs(lat1 - lat2) > 0.0000001) return;
  const latitude = lat1;
  const minLon = Math.min(lon1, lon2);
  const maxLon = Math.max(lon1, lon2);
  return {
    latitude: latitude.toFixed(7),
    extent: maxLon - minLon,
  }
}

function checkSegmentVertical(p1, p2) {
  const [lon1, lat1] = p1;
  const [lon2, lat2] = p2;
  if (Math.abs(lon1 - lon2) > 0.0000001) return;
  const longitude = lon1;
  const minLat = Math.min(lat1, lat2);
  const maxLat = Math.max(lat1, lat2);
  return {
    longitude: longitude.toFixed(7),
    extent: maxLat - minLat,
  }
}

function minimalGeometryFromSegmentsOverlap(segmentInfo1, segmentInfo2, allPolygons) {
  const [polygonIndex1, ringIndex1, coordIndex1, __] = segmentInfo1;
  const [polygonIndex2, ringIndex2, coordIndex2, _] = segmentInfo2;
  const ring1 = allPolygons[polygonIndex1].geometry.coordinates[ringIndex1];
  const ring2 = allPolygons[polygonIndex2].geometry.coordinates[ringIndex2];
  let triangle1ToCheck;
  if (coordIndex1 === 0) {
    triangle1ToCheck = [ring1[ring1.length - 1], ring1[coordIndex1], ring1[coordIndex1 + 1], ring1[ring1.length - 1]];
  }
  // else if (coordIndex1 === ring1.length - 1) {
  // triangle1ToCheck = [ring1[coordIndex1 - 1], ring1[coordIndex1], ring1[0], ring1[coordIndex1 - 1]];
  // } 
  else {
    triangle1ToCheck = [ring1[coordIndex1 - 1], ring1[coordIndex1], ring1[coordIndex1 + 1], ring1[coordIndex1 - 1]];
  }

  let triangle2ToCheck;

  if (coordIndex2 === 0) {
    triangle2ToCheck = [ring2[ring2.length - 1], ring2[coordIndex2], ring2[coordIndex2 + 1], ring2[ring2.length - 1]];
  }
  // else if (coordIndex2 === ring2.length - 1) {
  // triangle2ToCheck = [ring2[coordIndex2 - 1], ring2[coordIndex2], ring2[0], ring2[coordIndex2 - 1]];
  // } 
  else {
    triangle2ToCheck = [ring2[coordIndex2 - 1], ring2[coordIndex2], ring2[coordIndex2 + 1], ring2[coordIndex2 - 1]];
  }

  // console.log("comparing following triangles:");
  // console.log([polygon([triangle1ToCheck]), polygon([triangle2ToCheck])]);

  // TODO perf: check if bounding box intersects before 
  // return booleanOverlap(polygon([triangle1ToCheck]), polygon([triangle2ToCheck]));
  const intersection = intersect(featureCollection([allPolygons[polygonIndex1], allPolygons[polygonIndex2]]));
  // const intersection = intersect(featureCollection([polygon([triangle1ToCheck]), polygon([triangle2ToCheck])]));
  if (!intersection) return false;
  const intersectionArea = area(intersection);
  return ((intersectionArea / allPolygons[polygonIndex1].properties.area) > 0.1) || ((intersectionArea / allPolygons[polygonIndex2].properties.area) > 0.1);
}

const test = [
  {
    "id": 6458577239,
    "properties": {
      "render_height": 5,
      "render_min_height": 0,
      "computedId": "building",
      "index": 0,
      "area": 275.2415971962133
    },
    "geometry": {
      "type": "Polygon",
      "coordinates": [
        [
          [
            2.361835241317749,
            48.841782087426054
          ],
          [
            2.3617520928382874,
            48.84192507414414
          ],
          [
            2.3618245124816895,
            48.8419427267971
          ],
          [
            2.361907660961151,
            48.8417997401294
          ],
          [
            2.361835241317749,
            48.841782087426054
          ]
        ]
      ]
    },
    "source": "maptiler_planet",
    "sourceLayer": "building",
    "type": "Feature",
    "boundingBox": [
      2.3617520928382874,
      48.841782087426054,
      2.361907660961151,
      48.8419427267971
    ]
  },
  {
    "id": 59292446,
    "properties": {
      "render_height": 44,
      "render_min_height": 0,
      "computedId": "building",
      "index": 1,
      "area": 1716.6322852984224
    },
    "geometry": {
      "type": "Polygon",
      "coordinates": [
        [
          [
            2.3620229959487915,
            48.84126486045659
          ],
          [
            2.3621946573257446,
            48.841478459954914
          ],
          [
            2.362232208251953,
            48.841529653087775
          ],
          [
            2.362232208251953,
            48.84122249350571
          ],
          [
            2.362210750579834,
            48.84119424885185
          ],
          [
            2.36205518245697,
            48.84125250343297
          ],
          [
            2.3620229959487915,
            48.84126486045659
          ]
        ]
      ]
    },
    "source": "maptiler_planet",
    "sourceLayer": "building",
    "type": "Feature",
    "boundingBox": [
      2.3620229959487915,
      48.84119424885185,
      2.362232208251953,
      48.841529653087775
    ]
  },
  {
    "id": 915498,
    "properties": {
      "render_height": 41,
      "render_min_height": 0,
      "computedId": "building",
      "index": 2,
      "area": 4583.350076624795
    },
    "geometry": {
      "type": "Polygon",
      "coordinates": [
        [
          [
            2.3618540167808533,
            48.8413354719618
          ],
          [
            2.3617038130760193,
            48.841273686900195
          ],
          [
            2.361333668231964,
            48.84112010655974
          ],
          [
            2.361191511154175,
            48.84133194138889
          ],
          [
            2.361089587211609,
            48.84148375579866
          ],
          [
            2.361883521080017,
            48.84171677236964
          ],
          [
            2.361856698989868,
            48.84175913890243
          ],
          [
            2.3621410131454468,
            48.841842106592
          ],
          [
            2.3621544241905212,
            48.8418244539036
          ],
          [
            2.3621946573257446,
            48.841836810786134
          ],
          [
            2.362232208251953,
            48.84179091377851
          ],
          [
            2.362232208251953,
            48.841727364006175
          ],
          [
            2.362135648727417,
            48.84169911963707
          ],
          [
            2.3620766401290894,
            48.84158084616831
          ],
          [
            2.362135648727417,
            48.8414908169228
          ],
          [
            2.3621946573257446,
            48.841478459954914
          ],
          [
            2.362232208251953,
            48.841529653087775
          ],
          [
            2.362232208251953,
            48.84122249350571
          ],
          [
            2.362210750579834,
            48.84119424885185
          ],
          [
            2.36205518245697,
            48.84125250343297
          ],
          [
            2.3620229959487915,
            48.84126486045659
          ],
          [
            2.361985445022583,
            48.84128074805392
          ],
          [
            2.3618727922439575,
            48.84132664552908
          ],
          [
            2.3618540167808533,
            48.8413354719618
          ]
        ],
        [
          [
            2.362063229084015,
            48.841534948926125
          ],
          [
            2.362033724784851,
            48.84157555033485
          ],
          [
            2.3619666695594788,
            48.841556132273894
          ],
          [
            2.3619934916496277,
            48.841513765569374
          ],
          [
            2.362063229084015,
            48.841534948926125
          ]
        ],
        [
          [
            2.362036406993866,
            48.841617916987104
          ],
          [
            2.3620739579200745,
            48.84162850864456
          ],
          [
            2.362057864665985,
            48.841653222503254
          ],
          [
            2.3620203137397766,
            48.841642630851
          ],
          [
            2.362036406993866,
            48.841617916987104
          ]
        ],
        [
          [
            2.362090051174164,
            48.84144845016306
          ],
          [
            2.3620793223381042,
            48.84146433770215
          ],
          [
            2.3620525002479553,
            48.84145727657429
          ],
          [
            2.36206591129303,
            48.84144138903292
          ],
          [
            2.362090051174164,
            48.84144845016306
          ]
        ],
        [
          [
            2.361883521080017,
            48.84148728636089
          ],
          [
            2.361910343170166,
            48.84149434748451
          ],
          [
            2.3618996143341064,
            48.84151023500908
          ],
          [
            2.3618754744529724,
            48.84150317388767
          ],
          [
            2.361883521080017,
            48.84148728636089
          ]
        ],
        [
          [
            2.3619747161865234,
            48.84146433770215
          ],
          [
            2.3619988560676575,
            48.84147139882904
          ],
          [
            2.361988127231598,
            48.84148728636089
          ],
          [
            2.361963987350464,
            48.84148022523621
          ],
          [
            2.3619747161865234,
            48.84146433770215
          ]
        ]
      ]
    },
    "source": "maptiler_planet",
    "sourceLayer": "building",
    "type": "Feature",
    "boundingBox": [
      2.361089587211609,
      48.84112010655974,
      2.362232208251953,
      48.841842106592
    ]
  },
  {
    "id": 910846,
    "properties": {
      "render_height": 15,
      "render_min_height": 0,
      "computedId": "building",
      "index": 3,
      "area": 24721.484895627626
    },
    "geometry": {
      "type": "Polygon",
      "coordinates": [
        [
          [
            2.3618674278259277,
            48.8411306983225
          ],
          [
            2.362090051174164,
            48.84093651564973
          ],
          [
            2.3621731996536255,
            48.840894148421114
          ],
          [
            2.3621410131454468,
            48.84085354646004
          ],
          [
            2.3621276021003723,
            48.840834128119184
          ],
          [
            2.3621195554733276,
            48.840821770989294
          ],
          [
            2.3620927333831787,
            48.840786464887
          ],
          [
            2.3620927333831787,
            48.840784699581235
          ],
          [
            2.36181378364563,
            48.840872964793334
          ],
          [
            2.361840605735779,
            48.84090827083463
          ],
          [
            2.361988127231598,
            48.84085884236984
          ],
          [
            2.362039089202881,
            48.840927689146724
          ],
          [
            2.3620229959487915,
            48.84094181155078
          ],
          [
            2.3620283603668213,
            48.84094357685106
          ],
          [
            2.362006902694702,
            48.84096476044894
          ],
          [
            2.3620176315307617,
            48.840970056347004
          ],
          [
            2.3619452118873596,
            48.84103360708022
          ],
          [
            2.361931800842285,
            48.841028311188865
          ],
          [
            2.3618996143341064,
            48.84105832123245
          ],
          [
            2.3618298768997192,
            48.84102301529697
          ],
          [
            2.361832559108734,
            48.84102124999953
          ],
          [
            2.361781597137451,
            48.84097888284256
          ],
          [
            2.3617789149284363,
            48.84097888284256
          ],
          [
            2.3617225885391235,
            48.84090474023162
          ],
          [
            2.361585795879364,
            48.84094887275134
          ],
          [
            2.3614758253097534,
            48.84082000568475
          ],
          [
            2.361357808113098,
            48.840994770530614
          ],
          [
            2.3614731431007385,
            48.84104243356455
          ],
          [
            2.361459732055664,
            48.84105655593626
          ],
          [
            2.3614704608917236,
            48.841061851824634
          ],
          [
            2.361486554145813,
            48.841049494750905
          ],
          [
            2.361483871936798,
            48.84104772945443
          ],
          [
            2.3615241050720215,
            48.841012423511444
          ],
          [
            2.3615294694900513,
            48.84101418880917
          ],
          [
            2.3615536093711853,
            48.84099300523218
          ],
          [
            2.361631393432617,
            48.841097157732804
          ],
          [
            2.361805737018585,
            48.84118365710256
          ],
          [
            2.3618674278259277,
            48.8411306983225
          ]
        ],
        [
          [
            2.361738681793213,
            48.84101948470203
          ],
          [
            2.361762821674347,
            48.84103890297101
          ],
          [
            2.361730635166168,
            48.84107067830402
          ],
          [
            2.361709177494049,
            48.8410724435997
          ],
          [
            2.3616769909858704,
            48.84104772945443
          ],
          [
            2.3616823554039,
            48.841035372377206
          ],
          [
            2.361738681793213,
            48.84101948470203
          ]
        ],
        [
          [
            2.3618245124816895,
            48.841077739486394
          ],
          [
            2.361862063407898,
            48.841098923027545
          ],
          [
            2.3618245124816895,
            48.8411306983225
          ],
          [
            2.361784279346466,
            48.84111128008905
          ],
          [
            2.3617923259735107,
            48.84110598420594
          ],
          [
            2.3617789149284363,
            48.841098923027545
          ],
          [
            2.361805737018585,
            48.841077739486394
          ],
          [
            2.3618164658546448,
            48.84108480066777
          ],
          [
            2.3618245124816895,
            48.841077739486394
          ]
        ],
        [
          [
            2.3616689443588257,
            48.8409453421512
          ],
          [
            2.3616930842399597,
            48.84097358694541
          ],
          [
            2.3616823554039,
            48.84097711754356
          ],
          [
            2.36168771982193,
            48.84098594403787
          ],
          [
            2.3616528511047363,
            48.840998301127286
          ],
          [
            2.3616448044776917,
            48.84098947463514
          ],
          [
            2.361634075641632,
            48.84099300523218
          ],
          [
            2.361612617969513,
            48.84096476044894
          ],
          [
            2.3616689443588257,
            48.8409453421512
          ]
        ]
      ]
    },
    "source": "maptiler_planet",
    "sourceLayer": "building",
    "type": "Feature",
    "boundingBox": [
      2.361357808113098,
      48.840784699581235,
      2.3621731996536255,
      48.84118365710256
    ]
  },
  {
    "id": 910846,
    "properties": {
      "render_height": 15,
      "render_min_height": 0,
      "computedId": "building",
      "index": 4,
      "area": 24721.484895627626
    },
    "geometry": {
      "type": "Polygon",
      "coordinates": [
        [
          [
            2.36131489276886,
            48.841054790640015
          ],
          [
            2.361285388469696,
            48.84110068832223
          ],
          [
            2.361333668231964,
            48.84112010655974
          ],
          [
            2.3617038130760193,
            48.841273686900195
          ],
          [
            2.3617467284202576,
            48.84123485053675
          ],
          [
            2.36131489276886,
            48.841054790640015
          ]
        ]
      ]
    },
    "source": "maptiler_planet",
    "sourceLayer": "building",
    "type": "Feature",
    "boundingBox": [
      2.361285388469696,
      48.841054790640015,
      2.3617467284202576,
      48.841273686900195
    ]
  },
  {
    "id": 910846,
    "properties": {
      "render_height": 15,
      "render_min_height": 0,
      "computedId": "building",
      "index": 5,
      "area": 24721.484895627626
    },
    "geometry": {
      "type": "Polygon",
      "coordinates": [
        [
          [
            2.3607221245765686,
            48.84180327066932
          ],
          [
            2.3606684803962708,
            48.841888003552725
          ],
          [
            2.3607274889945984,
            48.84190389095244
          ],
          [
            2.36081063747406,
            48.841767965258924
          ],
          [
            2.3609930276870728,
            48.84181209701802
          ],
          [
            2.3610037565231323,
            48.84179267904881
          ],
          [
            2.3610520362854004,
            48.84180327066932
          ],
          [
            2.361041307449341,
            48.8418244539036
          ],
          [
            2.361140549182892,
            48.84184740239732
          ],
          [
            2.361191511154175,
            48.841769730530046
          ],
          [
            2.3607999086380005,
            48.841674405801
          ],
          [
            2.360791862010956,
            48.841688527994535
          ],
          [
            2.3607221245765686,
            48.84180327066932
          ]
        ],
        [
          [
            2.3607999086380005,
            48.84175384308779
          ],
          [
            2.3607784509658813,
            48.84175737363094
          ],
          [
            2.3608025908470154,
            48.841725598733575
          ],
          [
            2.360807955265045,
            48.841737955640525
          ],
          [
            2.3607999086380005,
            48.84175384308779
          ]
        ]
      ]
    },
    "source": "maptiler_planet",
    "sourceLayer": "building",
    "type": "Feature",
    "boundingBox": [
      2.3606684803962708,
      48.841674405801,
      2.361191511154175,
      48.84190389095244
    ]
  },
  {
    "id": 571025,
    "properties": {
      "render_height": 19,
      "render_min_height": 0,
      "computedId": "building",
      "index": 6,
      "area": 8287.513950834005
    },
    "geometry": {
      "type": "Polygon",
      "coordinates": [
        [
          [
            2.3620176315307617,
            48.84119601414321
          ],
          [
            2.36205518245697,
            48.84125250343297
          ],
          [
            2.362210750579834,
            48.84119424885185
          ],
          [
            2.362232208251953,
            48.841187187685904
          ],
          [
            2.362232208251953,
            48.841035372377206
          ],
          [
            2.362135648727417,
            48.84106538241659
          ],
          [
            2.3619773983955383,
            48.841104218911426
          ],
          [
            2.3620042204856873,
            48.841139524789696
          ],
          [
            2.3621544241905212,
            48.841091861848156
          ],
          [
            2.3621946573257446,
            48.84114129008296
          ],
          [
            2.3620176315307617,
            48.84119601414321
          ]
        ]
      ]
    },
    "source": "maptiler_planet",
    "sourceLayer": "building",
    "type": "Feature",
    "boundingBox": [
      2.3619773983955383,
      48.841035372377206,
      2.362232208251953,
      48.84125250343297
    ]
  },
  {
    "id": 571025,
    "properties": {
      "render_height": 19,
      "render_min_height": 0,
      "computedId": "building",
      "index": 7,
      "area": 8287.513950834005
    },
    "geometry": {
      "type": "Polygon",
      "coordinates": [
        [
          [
            2.3618727922439575,
            48.84132664552908
          ],
          [
            2.361985445022583,
            48.84128074805392
          ],
          [
            2.3618701100349426,
            48.8411306983225
          ],
          [
            2.3618674278259277,
            48.8411306983225
          ],
          [
            2.361805737018585,
            48.84118365710256
          ],
          [
            2.361781597137451,
            48.84120484059892
          ],
          [
            2.3618727922439575,
            48.84132664552908
          ]
        ]
      ]
    },
    "source": "maptiler_planet",
    "sourceLayer": "building",
    "type": "Feature",
    "boundingBox": [
      2.361781597137451,
      48.8411306983225,
      2.361985445022583,
      48.84132664552908
    ]
  },
  {
    "id": 571025,
    "properties": {
      "render_height": 19,
      "render_min_height": 0,
      "computedId": "building",
      "index": 8,
      "area": 8287.513950834005
    },
    "geometry": {
      "type": "Polygon",
      "coordinates": [
        [
          [
            2.362232208251953,
            48.841035372377206
          ],
          [
            2.362232208251953,
            48.84097535224453
          ],
          [
            2.3622161149978638,
            48.84095240335125
          ],
          [
            2.3621946573257446,
            48.84092592384596
          ],
          [
            2.3621731996536255,
            48.840894148421114
          ],
          [
            2.362090051174164,
            48.84093651564973
          ],
          [
            2.3618674278259277,
            48.8411306983225
          ],
          [
            2.3618701100349426,
            48.8411306983225
          ],
          [
            2.3619773983955383,
            48.841104218911426
          ],
          [
            2.362135648727417,
            48.84106538241659
          ],
          [
            2.362232208251953,
            48.841035372377206
          ]
        ],
        [
          [
            2.3620203137397766,
            48.841003597021796
          ],
          [
            2.3620739579200745,
            48.840982413440344
          ],
          [
            2.3621195554733276,
            48.841044198861255
          ],
          [
            2.3620685935020447,
            48.841060086528586
          ],
          [
            2.3620203137397766,
            48.841003597021796
          ]
        ]
      ]
    },
    "source": "maptiler_planet",
    "sourceLayer": "building",
    "type": "Feature",
    "boundingBox": [
      2.3618674278259277,
      48.840894148421114,
      2.362232208251953,
      48.8411306983225
    ]
  },
  {
    "id": 570217,
    "properties": {
      "render_height": 30,
      "render_min_height": 0,
      "computedId": "building",
      "index": 9,
      "area": 29527.836243239504
    },
    "geometry": {
      "type": "Polygon",
      "coordinates": [
        [
          [
            2.3620015382766724,
            48.84207335623546
          ],
          [
            2.3619532585144043,
            48.84213160979405
          ],
          [
            2.3619344830513,
            48.842152792889465
          ],
          [
            2.3620042204856873,
            48.842152792889465
          ],
          [
            2.3620444536209106,
            48.84215102763187
          ],
          [
            2.36206591129303,
            48.84214926237419
          ],
          [
            2.362087368965149,
            48.842145731858665
          ],
          [
            2.3621168732643127,
            48.84214043608492
          ],
          [
            2.3621410131454468,
            48.842133375052356
          ],
          [
            2.3621463775634766,
            48.84213160979405
          ],
          [
            2.3621866106987,
            48.84212101824298
          ],
          [
            2.362138330936432,
            48.842055703628546
          ],
          [
            2.362111508846283,
            48.84206452993277
          ],
          [
            2.3620927333831787,
            48.84206806045401
          ],
          [
            2.362087368965149,
            48.842055703628546
          ],
          [
            2.362063229084015,
            48.842060999411274
          ],
          [
            2.3620685935020447,
            48.84207335623546
          ],
          [
            2.3620498180389404,
            48.842076886756075
          ],
          [
            2.3620176315307617,
            48.84207865201628
          ],
          [
            2.3620015382766724,
            48.84207335623546
          ]
        ]
      ]
    },
    "source": "maptiler_planet",
    "sourceLayer": "building",
    "type": "Feature",
    "boundingBox": [
      2.3619344830513,
      48.842055703628546,
      2.3621866106987,
      48.842152792889465
    ]
  },
  {
    "id": 570217,
    "properties": {
      "render_height": 30,
      "render_min_height": 0,
      "computedId": "building",
      "index": 10,
      "area": 29527.836243239504
    },
    "geometry": {
      "type": "Polygon",
      "coordinates": [
        [
          [
            2.362138330936432,
            48.842055703628546
          ],
          [
            2.3621866106987,
            48.84212101824298
          ],
          [
            2.362232208251953,
            48.84210513091219
          ],
          [
            2.362232208251953,
            48.84201510260908
          ],
          [
            2.3622268438339233,
            48.84201686787148
          ],
          [
            2.3622187972068787,
            48.84200804155884
          ],
          [
            2.362232208251953,
            48.842004511033366
          ],
          [
            2.362232208251953,
            48.8419886236656
          ],
          [
            2.3621731996536255,
            48.84190742148499
          ],
          [
            2.3621919751167297,
            48.8419003604196
          ],
          [
            2.3621731996536255,
            48.84187741195015
          ],
          [
            2.3621544241905212,
            48.84188270775172
          ],
          [
            2.3621544241905212,
            48.84188447301878
          ],
          [
            2.3620793223381042,
            48.841978032084285
          ],
          [
            2.3621007800102234,
            48.84198685840224
          ],
          [
            2.3621410131454468,
            48.84203628575378
          ],
          [
            2.3621517419815063,
            48.84204334680001
          ],
          [
            2.3621544241905212,
            48.84205040784525
          ],
          [
            2.362138330936432,
            48.842055703628546
          ]
        ]
      ]
    },
    "source": "maptiler_planet",
    "sourceLayer": "building",
    "type": "Feature",
    "boundingBox": [
      2.3620793223381042,
      48.84187741195015,
      2.362232208251953,
      48.84212101824298
    ]
  },
  {
    "id": 570217,
    "properties": {
      "render_height": 30,
      "render_min_height": 0,
      "computedId": "building",
      "index": 11,
      "area": 29527.836243239504
    },
    "geometry": {
      "type": "Polygon",
      "coordinates": [
        [
          [
            2.362232208251953,
            48.84185622873824
          ],
          [
            2.362232208251953,
            48.84179091377851
          ],
          [
            2.3621946573257446,
            48.841836810786134
          ],
          [
            2.3622268438339233,
            48.84184916766563
          ],
          [
            2.362232208251953,
            48.84185622873824
          ]
        ]
      ]
    },
    "source": "maptiler_planet",
    "sourceLayer": "building",
    "type": "Feature",
    "boundingBox": [
      2.3621946573257446,
      48.84179091377851,
      2.362232208251953,
      48.84185622873824
    ]
  },
  {
    "id": 569853,
    "properties": {
      "render_height": 4,
      "render_min_height": 0,
      "computedId": "building",
      "index": 12,
      "area": 11206.320238357115
    },
    "geometry": {
      "type": "Polygon",
      "coordinates": [
        [
          [
            2.361387312412262,
            48.84089767902486
          ],
          [
            2.361290752887726,
            48.840871199490635
          ],
          [
            2.361207604408264,
            48.840998301127286
          ],
          [
            2.36118346452713,
            48.841037137674135
          ],
          [
            2.3612773418426514,
            48.84106538241659
          ],
          [
            2.361387312412262,
            48.84089767902486
          ]
        ]
      ]
    },
    "source": "maptiler_planet",
    "sourceLayer": "building",
    "type": "Feature",
    "boundingBox": [
      2.36118346452713,
      48.840871199490635,
      2.361387312412262,
      48.84106538241659
    ]
  },
  {
    "id": 569853,
    "properties": {
      "render_height": 4,
      "render_min_height": 0,
      "computedId": "building",
      "index": 13,
      "area": 11206.320238357115
    },
    "geometry": {
      "type": "Polygon",
      "coordinates": [
        [
          [
            2.3612532019615173,
            48.84193743100187
          ],
          [
            2.3612049221992493,
            48.84201157208409
          ],
          [
            2.3612505197525024,
            48.84202392892047
          ],
          [
            2.3612987995147705,
            48.84194978785652
          ],
          [
            2.3612532019615173,
            48.84193743100187
          ]
        ]
      ]
    },
    "source": "maptiler_planet",
    "sourceLayer": "building",
    "type": "Feature",
    "boundingBox": [
      2.3612049221992493,
      48.84193743100187,
      2.3612987995147705,
      48.84202392892047
    ]
  },
  {
    "id": 556713,
    "properties": {
      "render_height": 5,
      "render_min_height": 0,
      "computedId": "building",
      "index": 14,
      "area": 106729.85597974929
    },
    "geometry": {
      "type": "Polygon",
      "coordinates": [
        [
          [
            2.361017167568207,
            48.84204687732276
          ],
          [
            2.3609527945518494,
            48.84214926237419
          ],
          [
            2.3610949516296387,
            48.84218633277223
          ],
          [
            2.3611217737197876,
            48.842143966600815
          ],
          [
            2.3610949516296387,
            48.842136905568736
          ],
          [
            2.361113727092743,
            48.84210336565289
          ],
          [
            2.3611432313919067,
            48.84211042668966
          ],
          [
            2.3612049221992493,
            48.84201157208409
          ],
          [
            2.3612532019615173,
            48.84193743100187
          ],
          [
            2.3613175749778748,
            48.84183151497973
          ],
          [
            2.3613014817237854,
            48.84181915809586
          ],
          [
            2.361285388469696,
            48.84180856647873
          ],
          [
            2.3612692952156067,
            48.8417997401294
          ],
          [
            2.3612451553344727,
            48.841789148508155
          ],
          [
            2.3612263798713684,
            48.841782087426054
          ],
          [
            2.361191511154175,
            48.841769730530046
          ],
          [
            2.361140549182892,
            48.84184740239732
          ],
          [
            2.3611271381378174,
            48.84187211614801
          ],
          [
            2.3611781001091003,
            48.84188623828581
          ],
          [
            2.3611807823181152,
            48.84188447301878
          ],
          [
            2.361191511154175,
            48.841888003552725
          ],
          [
            2.3611968755722046,
            48.84187917721738
          ],
          [
            2.3612263798713684,
            48.84188623828581
          ],
          [
            2.3612236976623535,
            48.8419003604196
          ],
          [
            2.3611968755722046,
            48.841909186751195
          ],
          [
            2.3611003160476685,
            48.84206982571456
          ],
          [
            2.361017167568207,
            48.84204687732276
          ]
        ]
      ]
    },
    "source": "maptiler_planet",
    "sourceLayer": "building",
    "type": "Feature",
    "boundingBox": [
      2.3609527945518494,
      48.841769730530046,
      2.3613175749778748,
      48.84218633277223
    ]
  },
  {
    "id": 556713,
    "properties": {
      "render_height": 5,
      "render_min_height": 0,
      "computedId": "building",
      "index": 15,
      "area": 106729.85597974929
    },
    "geometry": {
      "type": "Polygon",
      "coordinates": [
        [
          [
            2.361931800842285,
            48.841640865575414
          ],
          [
            2.361883521080017,
            48.84171677236964
          ],
          [
            2.361856698989868,
            48.84175913890243
          ],
          [
            2.3621410131454468,
            48.841842106592
          ],
          [
            2.3621544241905212,
            48.8418244539036
          ],
          [
            2.3621946573257446,
            48.841836810786134
          ],
          [
            2.362232208251953,
            48.84179091377851
          ],
          [
            2.362232208251953,
            48.841727364006175
          ],
          [
            2.362135648727417,
            48.84169911963707
          ],
          [
            2.361931800842285,
            48.841640865575414
          ]
        ]
      ]
    },
    "source": "maptiler_planet",
    "sourceLayer": "building",
    "type": "Feature",
    "boundingBox": [
      2.361856698989868,
      48.841640865575414,
      2.362232208251953,
      48.841842106592
    ]
  },
  {
    "id": 556713,
    "properties": {
      "render_height": 5,
      "render_min_height": 0,
      "computedId": "building",
      "index": 16,
      "area": 106729.85597974929
    },
    "geometry": {
      "type": "Polygon",
      "coordinates": [
        [
          [
            2.3619773983955383,
            48.841570254500766
          ],
          [
            2.361191511154175,
            48.84133194138889
          ],
          [
            2.361089587211609,
            48.84148375579866
          ],
          [
            2.361883521080017,
            48.84171677236964
          ],
          [
            2.361931800842285,
            48.841640865575414
          ],
          [
            2.3619773983955383,
            48.841570254500766
          ]
        ]
      ]
    },
    "source": "maptiler_planet",
    "sourceLayer": "building",
    "type": "Feature",
    "boundingBox": [
      2.361089587211609,
      48.84133194138889,
      2.3619773983955383,
      48.84171677236964
    ]
  },
  {
    "id": 556713,
    "properties": {
      "render_height": 5,
      "render_min_height": 0,
      "computedId": "building",
      "index": 17,
      "area": 106729.85597974929
    },
    "geometry": {
      "type": "Polygon",
      "coordinates": [
        [
          [
            2.362033724784851,
            48.842032755230264
          ],
          [
            2.362014949321747,
            48.842055703628546
          ],
          [
            2.362031042575836,
            48.84206276467202
          ],
          [
            2.3620525002479553,
            48.84203981627701
          ],
          [
            2.362033724784851,
            48.842032755230264
          ]
        ]
      ]
    },
    "source": "maptiler_planet",
    "sourceLayer": "building",
    "type": "Feature",
    "boundingBox": [
      2.362014949321747,
      48.842032755230264,
      2.3620525002479553,
      48.84206276467202
    ]
  },
  {
    "id": 308311,
    "properties": {
      "render_height": 26,
      "render_min_height": 0,
      "computedId": "building",
      "index": 18,
      "area": 56732.620950080214
    },
    "geometry": {
      "type": "Polygon",
      "coordinates": [
        [
          [
            2.3620015382766724,
            48.84207335623546
          ],
          [
            2.3620042204856873,
            48.84206806045401
          ],
          [
            2.36193984746933,
            48.84205040784525
          ],
          [
            2.3619693517684937,
            48.84200627629613
          ],
          [
            2.361609935760498,
            48.84190389095244
          ],
          [
            2.3615804314613342,
            48.84194802259174
          ],
          [
            2.3615992069244385,
            48.84195331838586
          ],
          [
            2.361615300178528,
            48.84195861417942
          ],
          [
            2.3616018891334534,
            48.841981562611664
          ],
          [
            2.361690402030945,
            48.84200804155884
          ],
          [
            2.3616716265678406,
            48.842034520492064
          ],
          [
            2.361741364002228,
            48.84205393836751
          ],
          [
            2.3618191480636597,
            48.842076886756075
          ],
          [
            2.3618003726005554,
            48.84210336565289
          ],
          [
            2.3619022965431213,
            48.84213160979405
          ],
          [
            2.361910343170166,
            48.84211925298425
          ],
          [
            2.3619532585144043,
            48.84213160979405
          ],
          [
            2.3620015382766724,
            48.84207335623546
          ]
        ]
      ]
    },
    "source": "maptiler_planet",
    "sourceLayer": "building",
    "type": "Feature",
    "boundingBox": [
      2.3615804314613342,
      48.84190389095244,
      2.3620042204856873,
      48.84213160979405
    ]
  },
  {
    "id": 1262727603,
    "properties": {
      "render_height": 44,
      "render_min_height": 0,
      "computedId": "building",
      "index": 19,
      "area": 608.9495414200089
    },
    "geometry": {
      "type": "Polygon",
      "coordinates": [
        [
          [
            2.3620229959487915,
            48.84126486045659
          ],
          [
            2.3621946573257446,
            48.841478459954914
          ],
          [
            2.3622697591781616,
            48.84157731561271
          ],
          [
            2.362454831600189,
            48.84151906140943
          ],
          [
            2.362379729747772,
            48.84141844035318
          ],
          [
            2.362355589866638,
            48.841386665240805
          ],
          [
            2.362210750579834,
            48.84119424885185
          ],
          [
            2.36205518245697,
            48.84125250343297
          ],
          [
            2.3620229959487915,
            48.84126486045659
          ]
        ]
      ]
    },
    "source": "maptiler_planet",
    "sourceLayer": "building",
    "type": "Feature",
    "boundingBox": [
      2.3620229959487915,
      48.84119424885185,
      2.362454831600189,
      48.84157731561271
    ]
  },
  {
    "id": 1189683,
    "properties": {
      "render_height": 5,
      "render_min_height": 0,
      "computedId": "building",
      "index": 20,
      "area": 119563.35807447779
    },
    "geometry": {
      "type": "Polygon",
      "coordinates": [
        [
          [
            2.362033724784851,
            48.842032755230264
          ],
          [
            2.362014949321747,
            48.842055703628546
          ],
          [
            2.362031042575836,
            48.84206276467202
          ],
          [
            2.3620525002479553,
            48.84203981627701
          ],
          [
            2.362033724784851,
            48.842032755230264
          ]
        ]
      ]
    },
    "source": "maptiler_planet",
    "sourceLayer": "building",
    "type": "Feature",
    "boundingBox": [
      2.362014949321747,
      48.842032755230264,
      2.3620525002479553,
      48.84206276467202
    ]
  },
  {
    "id": 1189683,
    "properties": {
      "render_height": 5,
      "render_min_height": 0,
      "computedId": "building",
      "index": 21,
      "area": 119563.35807447779
    },
    "geometry": {
      "type": "Polygon",
      "coordinates": [
        [
          [
            2.361888885498047,
            48.84170794600411
          ],
          [
            2.361888885498047,
            48.841767965258924
          ],
          [
            2.3621410131454468,
            48.841842106592
          ],
          [
            2.3621544241905212,
            48.8418244539036
          ],
          [
            2.3621946573257446,
            48.841836810786134
          ],
          [
            2.3622697591781616,
            48.84174325145682
          ],
          [
            2.3622751235961914,
            48.8417397209127
          ],
          [
            2.362135648727417,
            48.84169911963707
          ],
          [
            2.361931800842285,
            48.841640865575414
          ],
          [
            2.361888885498047,
            48.84170794600411
          ]
        ]
      ]
    },
    "source": "maptiler_planet",
    "sourceLayer": "building",
    "type": "Feature",
    "boundingBox": [
      2.361888885498047,
      48.841640865575414,
      2.3622751235961914,
      48.841842106592
    ]
  },
  {
    "id": 1189683,
    "properties": {
      "render_height": 5,
      "render_min_height": 0,
      "computedId": "building",
      "index": 22,
      "area": 119563.35807447779
    },
    "geometry": {
      "type": "Polygon",
      "coordinates": [
        [
          [
            2.361888885498047,
            48.84154377532212
          ],
          [
            2.361888885498047,
            48.84170794600411
          ],
          [
            2.361931800842285,
            48.841640865575414
          ],
          [
            2.3619773983955383,
            48.841570254500766
          ],
          [
            2.361888885498047,
            48.84154377532212
          ]
        ]
      ]
    },
    "source": "maptiler_planet",
    "sourceLayer": "building",
    "type": "Feature",
    "boundingBox": [
      2.361888885498047,
      48.84154377532212,
      2.3619773983955383,
      48.84170794600411
    ]
  },
  {
    "id": 1189683,
    "properties": {
      "render_height": 5,
      "render_min_height": 0,
      "computedId": "building",
      "index": 23,
      "area": 119563.35807447779
    },
    "geometry": {
      "type": "Polygon",
      "coordinates": [
        [
          [
            2.3628732562065125,
            48.84208571305655
          ],
          [
            2.3628678917884827,
            48.84208041727646
          ],
          [
            2.362862527370453,
            48.84207335623546
          ],
          [
            2.3627659678459167,
            48.84205040784525
          ],
          [
            2.3624038696289062,
            48.84216868020516
          ],
          [
            2.3623287677764893,
            48.84219339379732
          ],
          [
            2.3622778058052063,
            48.842211046355686
          ],
          [
            2.362234890460968,
            48.842225168397874
          ],
          [
            2.3621973395347595,
            48.84223575992695
          ],
          [
            2.3621678352355957,
            48.842241055690636
          ],
          [
            2.3621410131454468,
            48.84224635145375
          ],
          [
            2.362036406993866,
            48.842433468058005
          ],
          [
            2.3619478940963745,
            48.84257645291646
          ],
          [
            2.3622992634773254,
            48.84266824544994
          ],
          [
            2.362379729747772,
            48.84268942831838
          ],
          [
            2.3623985052108765,
            48.842692958795624
          ],
          [
            2.3625540733337402,
            48.84253055658664
          ],
          [
            2.3629242181777954,
            48.84215102763187
          ],
          [
            2.362910807132721,
            48.842133375052356
          ],
          [
            2.3628732562065125,
            48.84208571305655
          ]
        ]
      ]
    },
    "source": "maptiler_planet",
    "sourceLayer": "building",
    "type": "Feature",
    "boundingBox": [
      2.3619478940963745,
      48.84205040784525,
      2.3629242181777954,
      48.842692958795624
    ]
  },
  {
    "id": 915499,
    "properties": {
      "render_height": 15,
      "render_min_height": 0,
      "computedId": "building",
      "index": 24,
      "area": 2574.030563164137
    },
    "geometry": {
      "type": "Polygon",
      "coordinates": [
        [
          [
            2.361888885498047,
            48.84111128008905
          ],
          [
            2.362090051174164,
            48.84093651564973
          ],
          [
            2.3621731996536255,
            48.840894148421114
          ],
          [
            2.3621410131454468,
            48.84085354646004
          ],
          [
            2.3621276021003723,
            48.840834128119184
          ],
          [
            2.3621195554733276,
            48.840821770989294
          ],
          [
            2.3620927333831787,
            48.840786464887
          ],
          [
            2.3620927333831787,
            48.840784699581235
          ],
          [
            2.361888885498047,
            48.840850015853135
          ],
          [
            2.361888885498047,
            48.840892383119126
          ],
          [
            2.361988127231598,
            48.84085884236984
          ],
          [
            2.362039089202881,
            48.840927689146724
          ],
          [
            2.3620229959487915,
            48.84094181155078
          ],
          [
            2.3620283603668213,
            48.84094357685106
          ],
          [
            2.362006902694702,
            48.84096476044894
          ],
          [
            2.3620176315307617,
            48.840970056347004
          ],
          [
            2.3619452118873596,
            48.84103360708022
          ],
          [
            2.361931800842285,
            48.841028311188865
          ],
          [
            2.3618996143341064,
            48.84105832123245
          ],
          [
            2.361888885498047,
            48.84105302534374
          ],
          [
            2.361888885498047,
            48.84111128008905
          ]
        ]
      ]
    },
    "source": "maptiler_planet",
    "sourceLayer": "building",
    "type": "Feature",
    "boundingBox": [
      2.361888885498047,
      48.840784699581235,
      2.3621731996536255,
      48.84111128008905
    ]
  },
  {
    "id": 915498,
    "properties": {
      "render_height": 41,
      "render_min_height": 0,
      "computedId": "building",
      "index": 25,
      "area": 4802.432004031067
    },
    "geometry": {
      "type": "Polygon",
      "coordinates": [
        [
          [
            2.361888885498047,
            48.84150846972878
          ],
          [
            2.361888885498047,
            48.841767965258924
          ],
          [
            2.3621410131454468,
            48.841842106592
          ],
          [
            2.3621544241905212,
            48.8418244539036
          ],
          [
            2.3621946573257446,
            48.841836810786134
          ],
          [
            2.3622697591781616,
            48.84174325145682
          ],
          [
            2.3622751235961914,
            48.8417397209127
          ],
          [
            2.362135648727417,
            48.84169911963707
          ],
          [
            2.3620766401290894,
            48.84158084616831
          ],
          [
            2.362135648727417,
            48.8414908169228
          ],
          [
            2.3621946573257446,
            48.841478459954914
          ],
          [
            2.3622697591781616,
            48.84157731561271
          ],
          [
            2.362334132194519,
            48.841665579428025
          ],
          [
            2.3623663187026978,
            48.841626743368465
          ],
          [
            2.362454831600189,
            48.84151906140943
          ],
          [
            2.362379729747772,
            48.84141844035318
          ],
          [
            2.362355589866638,
            48.841386665240805
          ],
          [
            2.362210750579834,
            48.84119424885185
          ],
          [
            2.36205518245697,
            48.84125250343297
          ],
          [
            2.3620229959487915,
            48.84126486045659
          ],
          [
            2.361985445022583,
            48.84128074805392
          ],
          [
            2.361888885498047,
            48.84131958438181
          ],
          [
            2.361888885498047,
            48.841489051641844
          ],
          [
            2.361910343170166,
            48.84149434748451
          ],
          [
            2.3618996143341064,
            48.84151023500908
          ],
          [
            2.361888885498047,
            48.84150846972878
          ]
        ],
        [
          [
            2.362090051174164,
            48.84144845016306
          ],
          [
            2.3620793223381042,
            48.84146433770215
          ],
          [
            2.3620525002479553,
            48.84145727657429
          ],
          [
            2.36206591129303,
            48.84144138903292
          ],
          [
            2.362090051174164,
            48.84144845016306
          ]
        ],
        [
          [
            2.362036406993866,
            48.841617916987104
          ],
          [
            2.3620739579200745,
            48.84162850864456
          ],
          [
            2.362057864665985,
            48.841653222503254
          ],
          [
            2.3620203137397766,
            48.841642630851
          ],
          [
            2.362036406993866,
            48.841617916987104
          ]
        ],
        [
          [
            2.362063229084015,
            48.841534948926125
          ],
          [
            2.362033724784851,
            48.84157555033485
          ],
          [
            2.3619666695594788,
            48.841556132273894
          ],
          [
            2.3619934916496277,
            48.841513765569374
          ],
          [
            2.362063229084015,
            48.841534948926125
          ]
        ],
        [
          [
            2.3619747161865234,
            48.84146433770215
          ],
          [
            2.3619988560676575,
            48.84147139882904
          ],
          [
            2.361988127231598,
            48.84148728636089
          ],
          [
            2.361963987350464,
            48.84148022523621
          ],
          [
            2.3619747161865234,
            48.84146433770215
          ]
        ]
      ]
    },
    "source": "maptiler_planet",
    "sourceLayer": "building",
    "type": "Feature",
    "boundingBox": [
      2.361888885498047,
      48.84119424885185,
      2.362454831600189,
      48.841842106592
    ]
  },
  {
    "id": 915384,
    "properties": {
      "render_height": 19,
      "render_min_height": 0,
      "computedId": "building",
      "index": 26,
      "area": 38973.108748306404
    },
    "geometry": {
      "type": "Polygon",
      "coordinates": [
        [
          [
            2.361888885498047,
            48.84131958438181
          ],
          [
            2.361985445022583,
            48.84128074805392
          ],
          [
            2.361888885498047,
            48.841155412426815
          ],
          [
            2.361888885498047,
            48.84131958438181
          ]
        ]
      ]
    },
    "source": "maptiler_planet",
    "sourceLayer": "building",
    "type": "Feature",
    "boundingBox": [
      2.361888885498047,
      48.841155412426815,
      2.361985445022583,
      48.84131958438181
    ]
  },
  {
    "id": 915384,
    "properties": {
      "render_height": 19,
      "render_min_height": 0,
      "computedId": "building",
      "index": 27,
      "area": 38973.108748306404
    },
    "geometry": {
      "type": "Polygon",
      "coordinates": [
        [
          [
            2.3620176315307617,
            48.84119601414321
          ],
          [
            2.36205518245697,
            48.84125250343297
          ],
          [
            2.362210750579834,
            48.84119424885185
          ],
          [
            2.362355589866638,
            48.841139524789696
          ],
          [
            2.3623126745224,
            48.84108303537252
          ],
          [
            2.3622697591781616,
            48.84102301529697
          ],
          [
            2.362135648727417,
            48.84106538241659
          ],
          [
            2.3619773983955383,
            48.841104218911426
          ],
          [
            2.3620042204856873,
            48.841139524789696
          ],
          [
            2.3621544241905212,
            48.841091861848156
          ],
          [
            2.3621946573257446,
            48.84114129008296
          ],
          [
            2.3620176315307617,
            48.84119601414321
          ]
        ]
      ]
    },
    "source": "maptiler_planet",
    "sourceLayer": "building",
    "type": "Feature",
    "boundingBox": [
      2.3619773983955383,
      48.84102301529697,
      2.362355589866638,
      48.84125250343297
    ]
  },
  {
    "id": 915384,
    "properties": {
      "render_height": 19,
      "render_min_height": 0,
      "computedId": "building",
      "index": 28,
      "area": 38973.108748306404
    },
    "geometry": {
      "type": "Polygon",
      "coordinates": [
        [
          [
            2.362135648727417,
            48.84106538241659
          ],
          [
            2.3622697591781616,
            48.84102301529697
          ],
          [
            2.3622161149978638,
            48.84095240335125
          ],
          [
            2.3621946573257446,
            48.84092592384596
          ],
          [
            2.3621731996536255,
            48.840894148421114
          ],
          [
            2.362090051174164,
            48.84093651564973
          ],
          [
            2.361888885498047,
            48.84111128008905
          ],
          [
            2.361888885498047,
            48.841125402441406
          ],
          [
            2.3619773983955383,
            48.841104218911426
          ],
          [
            2.362135648727417,
            48.84106538241659
          ]
        ],
        [
          [
            2.3620203137397766,
            48.841003597021796
          ],
          [
            2.3620739579200745,
            48.840982413440344
          ],
          [
            2.3621195554733276,
            48.841044198861255
          ],
          [
            2.3620685935020447,
            48.841060086528586
          ],
          [
            2.3620203137397766,
            48.841003597021796
          ]
        ]
      ]
    },
    "source": "maptiler_planet",
    "sourceLayer": "building",
    "type": "Feature",
    "boundingBox": [
      2.361888885498047,
      48.840894148421114,
      2.3622697591781616,
      48.841125402441406
    ]
  },
  {
    "id": 915383,
    "properties": {
      "render_height": 30,
      "render_min_height": 0,
      "computedId": "building",
      "index": 29,
      "area": 4822.6759792942885
    },
    "geometry": {
      "type": "Polygon",
      "coordinates": [
        [
          [
            2.3620015382766724,
            48.84207335623546
          ],
          [
            2.3619532585144043,
            48.84213160979405
          ],
          [
            2.3619344830513,
            48.842152792889465
          ],
          [
            2.3620042204856873,
            48.842152792889465
          ],
          [
            2.3620444536209106,
            48.84215102763187
          ],
          [
            2.36206591129303,
            48.84214926237419
          ],
          [
            2.362087368965149,
            48.842145731858665
          ],
          [
            2.3621168732643127,
            48.84214043608492
          ],
          [
            2.3621410131454468,
            48.842133375052356
          ],
          [
            2.3621463775634766,
            48.84213160979405
          ],
          [
            2.3621866106987,
            48.84212101824298
          ],
          [
            2.362138330936432,
            48.842055703628546
          ],
          [
            2.362111508846283,
            48.84206452993277
          ],
          [
            2.3620927333831787,
            48.84206806045401
          ],
          [
            2.362087368965149,
            48.842055703628546
          ],
          [
            2.362063229084015,
            48.842060999411274
          ],
          [
            2.3620685935020447,
            48.84207335623546
          ],
          [
            2.3620498180389404,
            48.842076886756075
          ],
          [
            2.3620176315307617,
            48.84207865201628
          ],
          [
            2.3620015382766724,
            48.84207335623546
          ]
        ]
      ]
    },
    "source": "maptiler_planet",
    "sourceLayer": "building",
    "type": "Feature",
    "boundingBox": [
      2.3619344830513,
      48.842055703628546,
      2.3621866106987,
      48.842152792889465
    ]
  },
  {
    "id": 915383,
    "properties": {
      "render_height": 30,
      "render_min_height": 0,
      "computedId": "building",
      "index": 30,
      "area": 4822.6759792942885
    },
    "geometry": {
      "type": "Polygon",
      "coordinates": [
        [
          [
            2.362138330936432,
            48.842055703628546
          ],
          [
            2.3621866106987,
            48.84212101824298
          ],
          [
            2.362339496612549,
            48.84206982571456
          ],
          [
            2.3622912168502808,
            48.842004511033366
          ],
          [
            2.362261712551117,
            48.84201510260908
          ],
          [
            2.3622536659240723,
            48.84200804155884
          ],
          [
            2.3622268438339233,
            48.84201686787148
          ],
          [
            2.3622187972068787,
            48.84200804155884
          ],
          [
            2.3622429370880127,
            48.842000980507635
          ],
          [
            2.3621731996536255,
            48.84190742148499
          ],
          [
            2.3621919751167297,
            48.8419003604196
          ],
          [
            2.3621731996536255,
            48.84187741195015
          ],
          [
            2.3621544241905212,
            48.84188270775172
          ],
          [
            2.3621544241905212,
            48.84188447301878
          ],
          [
            2.3620793223381042,
            48.841978032084285
          ],
          [
            2.3621007800102234,
            48.84198685840224
          ],
          [
            2.3621410131454468,
            48.84203628575378
          ],
          [
            2.3621517419815063,
            48.84204334680001
          ],
          [
            2.3621544241905212,
            48.84205040784525
          ],
          [
            2.362138330936432,
            48.842055703628546
          ]
        ]
      ]
    },
    "source": "maptiler_planet",
    "sourceLayer": "building",
    "type": "Feature",
    "boundingBox": [
      2.3620793223381042,
      48.84187741195015,
      2.362339496612549,
      48.84212101824298
    ]
  },
  {
    "id": 915383,
    "properties": {
      "render_height": 30,
      "render_min_height": 0,
      "computedId": "building",
      "index": 31,
      "area": 4822.6759792942885
    },
    "geometry": {
      "type": "Polygon",
      "coordinates": [
        [
          [
            2.3622938990592957,
            48.84193919626699
          ],
          [
            2.3623931407928467,
            48.841905656218756
          ],
          [
            2.3623287677764893,
            48.84181915809586
          ],
          [
            2.3622697591781616,
            48.84174325145682
          ],
          [
            2.3621946573257446,
            48.841836810786134
          ],
          [
            2.3622268438339233,
            48.84184916766563
          ],
          [
            2.3622536659240723,
            48.84188270775172
          ],
          [
            2.362234890460968,
            48.841888003552725
          ],
          [
            2.3622483015060425,
            48.84190389095244
          ],
          [
            2.362264394760132,
            48.841898595153054
          ],
          [
            2.3622938990592957,
            48.84193919626699
          ]
        ]
      ]
    },
    "source": "maptiler_planet",
    "sourceLayer": "building",
    "type": "Feature",
    "boundingBox": [
      2.3621946573257446,
      48.84174325145682,
      2.3623931407928467,
      48.84193919626699
    ]
  },
  {
    "id": 915383,
    "properties": {
      "render_height": 30,
      "render_min_height": 0,
      "computedId": "building",
      "index": 32,
      "area": 4822.6759792942885
    },
    "geometry": {
      "type": "Polygon",
      "coordinates": [
        [
          [
            2.362334132194519,
            48.84199215419221
          ],
          [
            2.3622912168502808,
            48.842004511033366
          ],
          [
            2.362339496612549,
            48.84206982571456
          ],
          [
            2.362436056137085,
            48.84203805101541
          ],
          [
            2.362457513809204,
            48.84199568471857
          ],
          [
            2.3624494671821594,
            48.84198332787523
          ],
          [
            2.362406551837921,
            48.84192683940972
          ],
          [
            2.3623931407928467,
            48.841905656218756
          ],
          [
            2.3622938990592957,
            48.84193919626699
          ],
          [
            2.3622751235961914,
            48.841944492062055
          ],
          [
            2.362285852432251,
            48.841960379443805
          ],
          [
            2.36230731010437,
            48.84195331838586
          ],
          [
            2.362334132194519,
            48.84199215419221
          ]
        ]
      ]
    },
    "source": "maptiler_planet",
    "sourceLayer": "building",
    "type": "Feature",
    "boundingBox": [
      2.3622751235961914,
      48.841905656218756,
      2.362457513809204,
      48.84206982571456
    ]
  },
  {
    "id": 915383,
    "properties": {
      "render_height": 30,
      "render_min_height": 0,
      "computedId": "building",
      "index": 33,
      "area": 4822.6759792942885
    },
    "geometry": {
      "type": "Polygon",
      "coordinates": [
        [
          [
            2.3623985052108765,
            48.84167087525202
          ],
          [
            2.3624414205551147,
            48.841727364006175
          ],
          [
            2.3627230525016785,
            48.84163556974826
          ],
          [
            2.362613081932068,
            48.84148728636089
          ],
          [
            2.3625487089157104,
            48.841402552799536
          ],
          [
            2.362454831600189,
            48.84151906140943
          ],
          [
            2.3623663187026978,
            48.841626743368465
          ],
          [
            2.3623985052108765,
            48.84167087525202
          ]
        ],
        [
          [
            2.3625460267066956,
            48.84167087525202
          ],
          [
            2.3625218868255615,
            48.841663814153236
          ],
          [
            2.3624521493911743,
            48.84157378505688
          ],
          [
            2.362529933452606,
            48.841547305880084
          ],
          [
            2.362537980079651,
            48.84155789755246
          ],
          [
            2.3625218868255615,
            48.84156495866617
          ],
          [
            2.36255943775177,
            48.84161615171061
          ],
          [
            2.3625782132148743,
            48.84161085588087
          ],
          [
            2.3625996708869934,
            48.841640865575414
          ],
          [
            2.362588942050934,
            48.841656753053485
          ],
          [
            2.3625460267066956,
            48.84167087525202
          ]
        ]
      ]
    },
    "source": "maptiler_planet",
    "sourceLayer": "building",
    "type": "Feature",
    "boundingBox": [
      2.3623663187026978,
      48.841402552799536,
      2.3627230525016785,
      48.841727364006175
    ]
  },
  {
    "id": 915383,
    "properties": {
      "render_height": 30,
      "render_min_height": 0,
      "computedId": "building",
      "index": 34,
      "area": 4822.6759792942885
    },
    "geometry": {
      "type": "Polygon",
      "coordinates": [
        [
          [
            2.362779378890991,
            48.84192507414414
          ],
          [
            2.3628652095794678,
            48.84189682988651
          ],
          [
            2.362886667251587,
            48.841852698202075
          ],
          [
            2.3627766966819763,
            48.84170618073085
          ],
          [
            2.3627230525016785,
            48.84163556974826
          ],
          [
            2.3624414205551147,
            48.841727364006175
          ],
          [
            2.3625004291534424,
            48.841806801208975
          ],
          [
            2.362562119960785,
            48.841888003552725
          ],
          [
            2.3626264929771423,
            48.84197450155668
          ],
          [
            2.362709641456604,
            48.84194802259174
          ],
          [
            2.362779378890991,
            48.84192507414414
          ]
        ],
        [
          [
            2.3626452684402466,
            48.84170265018409
          ],
          [
            2.3627525568008423,
            48.841842106592
          ],
          [
            2.3626774549484253,
            48.84186682034533
          ],
          [
            2.3625701665878296,
            48.841727364006175
          ],
          [
            2.3626452684402466,
            48.84170265018409
          ]
        ]
      ]
    },
    "source": "maptiler_planet",
    "sourceLayer": "building",
    "type": "Feature",
    "boundingBox": [
      2.3624414205551147,
      48.84163556974826,
      2.362886667251587,
      48.84197450155668
    ]
  }
]

stitch(test);