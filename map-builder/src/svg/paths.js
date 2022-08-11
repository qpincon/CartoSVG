import parsePath from 'parse-svg-path';
import MotionPathHelper from "../util/MotionPathHelper.js";

export function drawCustomPaths(pathDefs, svg, projection) {
    if (!pathDefs) return;
    let elem = svg.select('#paths');
    if (elem.empty()) elem = svg.append('g').attr('id', 'paths');
    pathDefs.forEach((pathDef, index) => {
        const id = `path-${index}`;
        const newPath = pathDef.reduce((d, curGroup) => {
            const [instruction, ...data] = curGroup;
            let newData = '';
            for (let i = 0; i < data.length; i += 2) {
                newData += projection([data[i], data[i + 1]]) + ' ';
            }
            d +=  `${instruction}${newData}`;
            return d
        }, '');
        const path = elem.append('path').attr('id', id).attr('d', newPath);
        path.on('click', (e) => {
            MotionPathHelper.editPath(e.target, {
                onRelease: function() {
                    const parsed = parseAndUnprojectPath(this.path, projection);
                    pathDefs[index] = parsed;
                }
            });
        })
    });
}

function parseMatrixAttr(matrixStr) {
    const numOnly = matrixStr.match(/[-0-9]+/g);
    if (numOnly.length == 6) return numOnly.map(n => parseInt(n));
    return null;
}

function extractTranslateFromElem(elem) {
    const transform = elem.getAttribute('transform');
    if (transform) {
        const parsedMatrix = parseMatrixAttr(transform);
        if (parsedMatrix) return [parsedMatrix[4], parsedMatrix[5]];
    }
    return [null, null];
}

export function parseAndUnprojectPath(pathElemOrStr, projection) {
    let pathStr = pathElemOrStr, xTranslate = 0, yTranslate = 0;
    if (typeof pathElemOrStr !== 'string'){
        pathStr = pathElemOrStr.getAttribute('d');
        [xTranslate, yTranslate] = extractTranslateFromElem(pathElemOrStr);
    } 
    const parsed = parsePath(pathStr);
    const toCoords = parsed.map(group => {
        const transformed = [group[0]];
        for (let i = 1; i < group.length; i += 2) {
            transformed.push(...projection.invert([group[i] + xTranslate, group[i + 1] + yTranslate]));
        }
        return transformed;
    });
    return toCoords;
}