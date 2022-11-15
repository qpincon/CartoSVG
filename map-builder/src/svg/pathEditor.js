import parsePath from 'parse-svg-path';
import { closestDistance } from './svg'
import { pointer } from 'd3';
const moveTypes = Object.freeze({
    SYMETRIC_KEEP_LENGTH: 0,
    TRANSLATE: 1,
    SYMETRIC_PERFECT: 2,
});
// will assume that the given path only contains C commands (begining with a M command)
export default class PathEditor {
    constructor(pathElem, svgContainer, onFinish) {
        this.init(pathElem, svgContainer, onFinish);
    }

    init(pathElem, svgContainer, onFinish) {
        this.pathElem = pathElem;
        this.svgContainer = svgContainer;
        this.onFinish = onFinish;
        this.editorContainer = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        this.pathOverlayElem = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        this.pathOverlayElem.setAttribute('d', this.pathElem.getAttribute('d'));
        this.pathOverlayElem.setAttribute('stroke', " #528af4");
        this.pathOverlayElem.setAttribute('stroke-width', "3");
        this.pathOverlayElem.setAttribute('fill', "none");
        this.pathElem.parentNode.append(this.editorContainer);
        this.editorContainer.append(this.pathOverlayElem);
        const parsedPath = parsePath(pathElem.getAttribute('d'));
        // flatten parsed path into a single array, wrapping coords into array on 2 elements
        this.pathData = parsedPath.flatMap(x => x).filter(x => typeof (x) !== 'string')
            .reduce((allCoords, curPoint, i) => {
                if (i && i % 2 !== 0) allCoords[allCoords.length - 1].push(curPoint);
                else allCoords.push([curPoint]);
                return allCoords;
            }, []);
        if ((this.pathData.length - 1) % 3 !== 0) {
            console.error('Wrong number of elements after path parsing');
            return;
        }
        this.pointElems = [];
        this.addOrAbortFunc = (e) => this.addOrAbort(e);
        this.svgContainer.addEventListener('mousedown', this.addOrAbortFunc);
        this.createPoints();
        this.setupPathOverlay();
    }

    cleanup() {
        this.editorContainer.remove();
        this.svgContainer.removeEventListener('mousedown', this.addOrAbortFunc);
    }

    reset() {
        this.cleanup();
        this.init(this.pathElem, this.svgContainer, this.onFinish);
    }

    setupPathOverlay() {
        this.pathOverlayElem.addEventListener('mousedown', e => {
            e.stopPropagation();
            if (e.ctrlKey) return this.addPoint(e);
            this.currentDragging = this.pathOverlayElem;
            this.pathOverlayElem.x = e.clientX;
            this.pathOverlayElem.y = e.clientY;
        });
        this.svgContainer.addEventListener('mousemove', e => {
            if (this.currentDragging === this.pathOverlayElem) {
                e.stopPropagation();
                const deltaX = e.clientX - this.pathOverlayElem.x;
                const deltaY = e.clientY - this.pathOverlayElem.y;
                for (let i = 0; i < this.pathData.length; ++i) {
                    this.pathData[i][0] = this.pathOverlayElem.x + deltaX;
                    this.pathData[i][1] = this.pathOverlayElem.y + deltaY;
                    this.movePoint(this.pointElems[i].coordIndex, deltaX, deltaY);
                    if (this.pointElems[i].lines) this.pointElems[i].lines.forEach(line => this.updateLine(line));
                }
                this.pathOverlayElem.x = e.clientX;
                this.pathOverlayElem.y = e.clientY;
                this.pathDataToD();
            }
        });
        this.pathOverlayElem.addEventListener('mouseup', e => {
            if (this.currentDragging === this.pathOverlayElem) {
                this.currentDragging = null;
            }
        });
    }

    addOrAbort(e) {
        if (e.ctrlKey) return this.addPoint(e);
        this.cleanup();
        this.onFinish(this.pathElem);
    }

    addPoint(e) {
        const [x, y] = pointer(e);
        const point = { x, y };
        const dist = closestDistance(point, this.pathElem);
        const middlePoints = this.pointElems.filter((p, i) => p.isOnCurve && i != 0 && i != this.pointElems.length - 1);
        let clickedSegment = 0;
        let found = false;
        let advancement = dist.advancement;
        for (let index = 0; index < middlePoints.length; ++index) {
            const point = middlePoints[index];
            if (point.advancement && dist.advancement < point.advancement) {
                clickedSegment = index;
                found = true;
                break;
            }
        }
        if (middlePoints.length && !found) {
            clickedSegment = middlePoints.length;
        }
        const prevAdv = clickedSegment && middlePoints.length ? middlePoints[clickedSegment - 1].advancement : 0;
        const nextAdv = clickedSegment < middlePoints.length ? middlePoints[clickedSegment].advancement : 1;
        advancement = (dist.advancement - prevAdv) / (nextAdv - prevAdv);
        const points = this.getBezierPoints(advancement, clickedSegment * 3);
        this.pathData.splice(clickedSegment * 3 + 1, 3, points[0][1], points[0][2], points[0][3], points[1][1], points[1][2], points[1][3]);
        this.pathDataToD();
        this.reset();
    }

    pathDataToD() {
        let d = `M ${this.pathData[0][0]} ${this.pathData[0][1]} `;
        this.pathData.forEach((coord, index) => {
            if (!index) return;
            if ((index % 3) === 1) d += 'C';
            d += `${coord[0]} ${coord[1]} `;
        });
        this.pathElem.setAttribute('d', d);
        this.pathOverlayElem.setAttribute('d', d);
    }

    createPoints() {
        // create point elements
        this.pathData.forEach((coord, index) => {
            const point = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            point.coordIndex = index;
            point.setAttribute('cx', coord[0]);
            point.setAttribute('cy', coord[1]);
            point.setAttribute('stroke', '#528af4');
            point.setAttribute('fill', '#acc5f4');
            point.setAttribute('stroke-width', '3');
            this.editorContainer.append(point);
            this.pointElems.push(point);
        });
        this.pathData.forEach((coord, index) => {
            const isFirstCoord = index === 0;
            const isFirstCurveCommand = index < 4;
            const isLastCurveCommand = index > this.pathData.length - 4;
            const isLastCoord = index === this.pathData.length - 1;
            const isOnCurve = (index % 3) === 0;
            const point = this.pointElems[index];
            point.isOnCurve = isOnCurve;
            if (isOnCurve) point.setAttribute('r', '10');
            else point.setAttribute('r', '7');
            point.moveType = moveTypes.TRANSLATE;
            // Attach first coord to first control point
            if (isFirstCoord) {
                point.linkedNext = index + 1;
                point.lines = [this.createLine(index, index + 1)];
            }
            // Attach last coord to last control point
            else if (isLastCoord) {
                point.linkedPrev = index - 1;
                point.lines = [this.createLine(index, index - 1)];
            }
            // First control point moved (and not first C command)
            else if (!isFirstCurveCommand && (index % 3) === 1) {
                point.linkedPrev = index - 2; // second control point of previous C
                point.symRef = index - 1;
                point.moveType = moveTypes.SYMETRIC_KEEP_LENGTH;
            }
            // Second control point moved (and not last C command)
            else if (!isLastCurveCommand && (index % 3) === 2) {
                point.linkedNext = index + 2; // first control point of next C
                point.symRef = index + 1;
                point.moveType = moveTypes.SYMETRIC_KEEP_LENGTH;
            }
            // Point (not last) moved
            else if (!isLastCurveCommand && (index % 3) === 0) {
                point.linkedPrev = index - 1; // last control point of previous C
                point.linkedNext = index + 1; // first control point of next C
                point.lines = [
                    this.createLine(index, index - 1),
                    this.createLine(index, index + 1),
                ];
            }
            point.addEventListener('mousedown', (e) => this.onPointClick(e, point));
            point.addEventListener('mouseup', (e) => this.onPointRelease(e, point));
            this.svgContainer.addEventListener('mousemove', (e) => this.onMouseMove(e));
            this.computePointParts();
        });
    }

    createLine(p1Index, p2Index) {
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('stroke', '#528af4');
        line.setAttribute('stroke-width', '2');
        line.p1Index = p1Index;
        line.p2Index = p2Index;
        this.editorContainer.insertBefore(line, this.editorContainer.firstChild);
        this.updateLine(line);
        return line;
    }

    updateLine(lineElem) {
        const p1 = this.pathData[lineElem.p1Index];
        const p2 = this.pathData[lineElem.p2Index];
        const [x1, y1] = [p1[0], p1[1]];
        const [x2, y2] = [p2[0], p2[1]]
        lineElem.setAttribute('x1', x1);
        lineElem.setAttribute('y1', y1);
        lineElem.setAttribute('x2', x2);
        lineElem.setAttribute('y2', y2);
    }

    onPointClick(e, point) {
        e.stopPropagation();
        if (point.isOnCurve && e.ctrlKey) {
            return this.deletePoint(point);
        }
        this.currentDragging = point;
        point.x = e.clientX;
        point.y = e.clientY;
    }

    deletePoint(point) {
        if (this.pointElems.length < 5) {
            this.pathElem.remove();
            this.cleanup();
            this.onFinish(null);
            return;
        }
        if (point.coordIndex === 0) {
            this.pathData.splice(point.coordIndex, 3);
        }
        else if (point.coordIndex === this.pathData.length - 1) {
            this.pathData.splice(point.coordIndex - 2, 3);
        }
        else this.pathData.splice(point.coordIndex - 1, 3);
        this.pathDataToD();
        this.reset();
    }

    onMouseMove(e) {
        if (!this.currentDragging || this.currentDragging === this.pathOverlayElem) return;
        const point = this.currentDragging;
        const deltaX = e.clientX - point.x;
        const deltaY = e.clientY - point.y;
        this.movePoint(point.coordIndex, deltaX, deltaY);
        point.x = e.clientX;
        point.y = e.clientY;
        this.pathData[point.coordIndex][0] += deltaX;
        this.pathData[point.coordIndex][1] += deltaY;
        if (point.linkedPrev) {
            this.moveLinked(point, point.linkedPrev, deltaX, deltaY);
        }
        if (point.linkedNext) {
            this.moveLinked(point, point.linkedNext, deltaX, deltaY);
        }
        let redrawLines = point.lines;
        if (!redrawLines && point.symRef) redrawLines = this.pointElems[point.symRef].lines;
        if (point.coordIndex === 1) redrawLines = this.pointElems[0].lines;
        else if (point.coordIndex === this.pointElems.length - 2) redrawLines = this.pointElems[this.pointElems.length - 1].lines;
        redrawLines.forEach(line => this.updateLine(line));
        this.pathDataToD();
    }

    onPointRelease(e, point) {
        this.currentDragging = null;
    }

    moveLinked(point, linkedIndex, deltaX, deltaY) {
        if (point.moveType === moveTypes.TRANSLATE) {
            this.movePoint(linkedIndex, deltaX, deltaY);
        }
        else if (point.moveType === moveTypes.SYMETRIC_PERFECT) {
            this.movePointSym(linkedIndex, deltaX, deltaY);
        }
        else if (point.moveType === moveTypes.SYMETRIC_KEEP_LENGTH) {
            this.movePointAngle(point, linkedIndex);
        }
    }

    movePoint(index, deltaX, deltaY) {
        const point = this.pointElems[index];
        const [curX, curY] = this.getPosCircle(point);
        this.setPosCircle(this.pointElems[index], curX + deltaX, curY + deltaY)
        this.pathData[index][0] = curX + deltaX;
        this.pathData[index][1] = curY + deltaY;
    }

    movePointSym(index, deltaX, deltaY) {
        const point = this.pointElems[index];
        const curX = parseFloat(point.getAttribute('cx'));
        const curY = parseFloat(point.getAttribute('cy'));
        point.setAttribute('cx', curX - deltaX);
        point.setAttribute('cy', curY - deltaY);
        this.pathData[index][0] -= deltaX;
        this.pathData[index][1] -= deltaY;
    }

    // assumes currently dragged point has already been moved
    movePointAngle(point, movedIndex) {
        const [refX, refY] = this.getPosAtIndex(point.symRef);
        const [curX, curY] = this.getPosAtIndex(point.coordIndex);
        const relativeX = curX - refX;
        const relativeY = curY - refY;
        const newAngle = this.calcAngle(relativeX, relativeY);
        const [curMovedX, curMovedY] = this.getPosAtIndex(movedIndex);
        const length = this.getLength(curMovedX - refX, curMovedY - refY);
        const newPosX = -(Math.cos(newAngle) * length) + refX;
        const newPosY = (Math.sin(newAngle) * length) + refY;
        this.setPosCircle(this.pointElems[movedIndex], newPosX, newPosY);
        this.pathData[movedIndex][0] = newPosX;
        this.pathData[movedIndex][1] = newPosY;
    }

    getPosCircle(pointElem) {
        const curX = parseFloat(pointElem.getAttribute('cx'));
        const curY = parseFloat(pointElem.getAttribute('cy'));
        return [curX, curY];
    }

    getPosAtIndex(index) {
        const p = this.pathData[index];
        return [p[0], p[1]];
    }

    setPosCircle(pointElem, x, y) {
        pointElem.setAttribute('cx', x);
        pointElem.setAttribute('cy', y);
    }

    calcAngle(x, y) {
        return Math.atan2(-y, x);
    }

    getLength(x, y) {
        return Math.sqrt((x * x) + (y * y))
    }

    lerp(A, B, t) {
        return [
            (B[0] - A[0]) * t + A[0], // the x coordinate
            (B[1] - A[1]) * t + A[1]  // the y coordinate
        ];
    }

    // see https://codepen.io/enxaneta/post/how-to-add-a-point-to-an-svg-path
    getBezierPoints(t, pointOffset) {
        const helperPoints = [];
        // helper points 0,1,2
        for (let i = pointOffset + 1; i < pointOffset + 4; i++) {
            //points.length must be 4 !!!
            const p = this.lerp(this.pathData[i - 1], this.pathData[i], t);
            helperPoints.push(p);
        }
        // helper points 3,4
        helperPoints.push(this.lerp(helperPoints[0], helperPoints[1], t));
        helperPoints.push(this.lerp(helperPoints[1], helperPoints[2], t));

        // helper point 5 is where the first Bézier ends and where the second Bézier begins
        helperPoints.push(this.lerp(helperPoints[3], helperPoints[4], t));

        // points for the 2 "child" curves
        const firstBezier = [
            this.pathData[pointOffset],
            helperPoints[0],
            helperPoints[3],
            helperPoints[5]
        ];
        const secondBezier = [
            helperPoints[5],
            helperPoints[4],
            helperPoints[2],
            this.pathData[pointOffset + 3]
        ];

        // returns 2 array of points for the new bezier curves
        return [firstBezier, secondBezier];
    }

    computePointParts() {
        const pathLength = this.pathElem.getTotalLength();
        const delta = 20;
        const nbSample = Math.ceil(pathLength / delta);
        const middlePoints = this.pointElems.filter((p, i) => p.isOnCurve && i != 0 && i != this.pointElems.length - 1);
        middlePoints.forEach(p => p.dist = Number.MAX_SAFE_INTEGER);
        for (let i = 0; i < nbSample; i++) {
            const pathPoint = this.pathElem.getPointAtLength(i * delta);
            middlePoints.forEach(pointElem => {
                const [x, y] = this.getPosCircle(pointElem);
                const dist = this.distance(pathPoint, {x, y});
                if (dist < pointElem.dist) {
                    pointElem.dist = dist;
                    pointElem.advancement = (i * delta) / pathLength;
                }
            });
        }
    }

    distance(p1, p2) {
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        return Math.sqrt(dx * dx + dy * dy);
    }
    

}