
import fitCurve from 'fit-curve';

let rawLineData, isMouseDown, fittedCurveData, fittedCurve, svgElem, endCb;
export function freeHandDrawPath(svg, projection, onEnd) {
    endCb = onEnd
    svgElem = svg.node();
    svgElem.addEventListener('mousedown', onMouseDown)
    svgElem.addEventListener('mouseup', onMouseUp);
    svgElem.addEventListener('mousemove', onMouseMove)
}

function onMouseDown() {
    rawLineData = [];
    fittedCurve = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    document.getElementById('paths').append(fittedCurve);
    isMouseDown = true;
}

function onMouseUp() {
    isMouseDown = false;
    detachListeners();
    endCb(fittedCurve);
}

function onMouseMove(event) {
    if (!isMouseDown) return;
    const containerArea = svgElem.getBoundingClientRect(),
        x = event.clientX - containerArea.left,
        y = event.clientY - containerArea.top;
    rawLineData.push([x, y]);
    updateLine();
}

function detachListeners() {
    svgElem.removeEventListener('mousedown', onMouseDown)
    svgElem.removeEventListener('mouseup', onMouseUp);
    svgElem.removeEventListener('mousemove', onMouseMove)
}

function fittedCurveDataToPathString(fittedLineData) {
    let str = "";
    fittedLineData.map(function (bezier, i) {
        if (i == 0) {
            str += "M " + bezier[0][0] + " " + bezier[0][1];
        }
        str += "C " + bezier[1][0] + " " + bezier[1][1] + ", " +
            bezier[2][0] + " " + bezier[2][1] + ", " +
            bezier[3][0] + " " + bezier[3][1] + " ";
    });
    return str;
}

function updateLine() {
    if (rawLineData.length > 1) {
        fittedCurveData = fitCurve(rawLineData, 400);
        fittedCurve.setAttribute("d", fittedCurveDataToPathString(fittedCurveData));
    }
}