import fitCurve from 'fit-curve';

let rawLineData: [number, number][] = [];
let isMouseDown: boolean = false;
let fittedCurveData: [number, number][][] | undefined;
let fittedCurve: SVGPathElement | null = null;
let svgElem: SVGSVGElement | null = null;
let endCb: ((path: SVGPathElement) => void) | undefined;

export function freeHandDrawPath(svg: SVGSVGElement, onEnd: (path: SVGPathElement) => void): void {
    endCb = onEnd;
    svgElem = svg;
    svgElem.addEventListener('mousedown', onMouseDown);
    svgElem.addEventListener('mouseup', onMouseUp);
    svgElem.addEventListener('mousemove', onMouseMove);
}

function onMouseDown(): void {
    rawLineData = [];
    fittedCurve = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    const pathsContainer = document.getElementById('paths');
    if (pathsContainer && fittedCurve) {
        pathsContainer.append(fittedCurve);
    }
    isMouseDown = true;
}

function onMouseUp(): void {
    isMouseDown = false;
    detachListeners();
    if (endCb && fittedCurve) {
        endCb(fittedCurve);
    }
}

function onMouseMove(event: MouseEvent): void {
    if (!isMouseDown || !svgElem) return;
    const containerArea = svgElem.getBoundingClientRect();
    const x = event.clientX - containerArea.left;
    const y = event.clientY - containerArea.top;
    rawLineData.push([x, y]);
    updateLine();
}

function detachListeners(): void {
    if (svgElem) {
        svgElem.removeEventListener('mousedown', onMouseDown);
        svgElem.removeEventListener('mouseup', onMouseUp);
        svgElem.removeEventListener('mousemove', onMouseMove);
    }
}

function fittedCurveDataToPathString(fittedLineData: [number, number][][]): string {
    let str = "";
    fittedLineData.forEach((bezier, i) => {
        if (i === 0) {
            str += `M ${bezier[0][0]} ${bezier[0][1]}`;
        }
        str += `C ${bezier[1][0]} ${bezier[1][1]}, ${bezier[2][0]} ${bezier[2][1]}, ${bezier[3][0]} ${bezier[3][1]} `;
    });
    return str;
}

function updateLine(): void {
    if (rawLineData.length > 1 && fittedCurve) {
        fittedCurveData = fitCurve(rawLineData, 400);
        fittedCurve.setAttribute("d", fittedCurveDataToPathString(fittedCurveData));
    }
}