function _stitchLines(allLines, cuts, deadZones, tiles) {
  const featuresByClass = groupBy(allLines, f => f.properties.computedId);
  console.log('featuresByClass', featuresByClass);
  const finalFeatures = [];

  function findTileWithCut(point, direction) {
    for (let tile of tiles) {
      // if (direction === 'v') {
      let adjacentInterestingLng;
      const eastCut = Math.abs(tile.tileBufferBounds.east - point[0]) < 0.0000001;
      if (eastCut) console.log(tile, point);
      // Return this tile + west segment of tile at east 
      if (eastCut) {
        const eastTile = tiles.find(t => t.x === tile.x + 1 && t.y === tile.y)
        if (eastTile) adjacentInterestingLng = eastTile.tileBufferBounds.west;
      }
      const westCut = Math.abs(tile.tileBufferBounds.west - point[0]) < 0.0000001;
      // Return this tile + east segment of tile at west
      if (westCut) console.log(tile, tile.tileBufferBounds.west - point[0], westCut);
      if (westCut) {
        const westTile = tiles.find(t => t.x === tile.x - 1 && t.y === tile.y);
        if (westTile) adjacentInterestingLng = westTile.tileBufferBounds.east;
      }
      if (adjacentInterestingLng) {
        return { segment: [[adjacentInterestingLng, -90], [adjacentInterestingLng, 90]] }
      }

      // } else {
      let adjacentInterestingLat;
      const northCut = Math.abs(tile.tileBufferBounds.north - point[1]) < 0.0000001;
      if (northCut) console.log(tile, point);
      // Return this tile + south segment of tile at north
      if (northCut) {
        const northTile = tiles.find(t => t.x === tile.x && t.y === tile.y - 1);
        if (northTile) adjacentInterestingLat = northTile.tileBufferBounds.south;
      }
      const southCut = Math.abs(tile.tileBufferBounds.south - point[1]) < 0.0000001;
      if (southCut) console.log(tile, point);
      // Return this tile + north segment of tile at south
      if (southCut) {
        const southTile = tiles.find(t => t.x === tile.x && t.y === tile.y + 1);
        if (southTile) adjacentInterestingLat = southTile.tileBufferBounds.north;
      }
      if (adjacentInterestingLat) {
        return { segment: [[-180, adjacentInterestingLat], [180, adjacentInterestingLat]] }
      }
      // }
    }
  }


  Object.values(featuresByClass).forEach(lines => {
    /** Lines that are fully contained in a dead zone are duplicated among tiles: we must remove one */
    const lineUuidDuplicated = {};
    const lineIndexesProcessed = new Set();
    console.log("lines", lines);
    const mergedLines = [];
    lines.forEach((line, lineIndex) => {
      const lineCoords = line.geometry.coordinates;
      // const firstSegment = [lineCoords[0], lineCoords[1]];
      // const lastSegment = [lineCoords[lineCoords.length - 2], lineCoords[lineCoords.length - 1]];
      // const p1 = lineCoords[0];
      const p = lineCoords[lineCoords.length - 1];
      console.log('searching', line, p);
      // checkLineCut(p1, line, lineIndex, 0, cutLines);
      // checkLineCut(p2, line, lineIndex, lineCoords.length - 1, cutLines);
      const cut = findTileWithCut(p);
      if (cut) {
        // console.log(verticalCut.segment, lineString(verticalCut.segment));
        const intersection = lineIntersect(lineString(cut.segment), line);
        console.log("intersection", intersection);
        if (!intersection.features.length) return;
        const startOfMatchingLine = intersection.features[0].geometry.coordinates;
        const matchingLineIndex = lines.findIndex((l, lIndex) => {
          return lIndex !== lineIndex && pointsAreCloseBy(l.geometry.coordinates[0], startOfMatchingLine);
        });
        if (matchingLineIndex !== -1) {
          const matchingLine = lines[matchingLineIndex];
          console.log("End of ", line, "needs merging with", matchingLine);
          console.log("startOfMatchingLine=", startOfMatchingLine);
          // Get rid of the end of the line from the start of matching line, and append the matching line points
          const nearest = nearestPointOnLine(line, startOfMatchingLine);
          console.log("nearest=", nearest);
          // matchingLine.processed = true;
          lineIndexesProcessed.add(matchingLineIndex)
          lineIndexesProcessed.add(lineIndex)
          const index = nearest.properties.index;
          const segment = lineCoords.slice(0, index + 1);
          const finalSegment = segment.concat(matchingLine.geometry.coordinates);
          console.log("finalSegment", lineString(finalSegment, matchingLine.properties));
          mergedLines.push(lineString(finalSegment, matchingLine.properties));
        }
      }
    });
    const unmergedLines = [];
    lines.forEach((line, lineIndex) => {
      // if (lineIndexesCutNotMerged.has(lineIndex)) return;
      if (lineIndexesProcessed.has(lineIndex)) return;
      if (deadZones.some(deadZone => bboxContains(deadZone.bbox, line.boundingBox))) {
        // if (!(line.properties.uuid in lineUuidDuplicated)) {
        //     unmergedLines.push(line);
        // }
        // lineUuidDuplicated[line.properties.uuid] = lineIndex;
        return;
      }
      unmergedLines.push(line);
    });
    console.log("mergedLines=", mergedLines);
    console.log('unmergedLines', unmergedLines);
    console.log('combined lines', [...mergedLines, ...unmergedLines]);
    finalFeatures.push(...mergedLines, ...unmergedLines);
  });
  return finalFeatures;
}