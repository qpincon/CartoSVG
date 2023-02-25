import parsePath from 'parse-svg-path';
import * as markers from './markerDefs';
import { RGBAToHexA } from '../util/common';

export function drawCustomPaths(pathDefs, svg, projection, inlineStyles = {}) {
    if (!pathDefs) return;
    let elem = svg.select('#paths');
    if (elem.empty()) elem = svg.append('g').attr('id', 'paths');
    else elem.html('');
    const images = {}; // imageName => content
    let imagesElem = svg.select('#path-images');
    if (imagesElem.empty()) imagesElem = svg.append('g').attr('id', 'path-images');
    else imagesElem.html('');
    pathDefs.forEach((pathDef, index) => {
        if (pathDef.image) {
            if (!(pathDef.image.name in images)) {
                images[pathDef.image.name] = pathDef.image.content;
            }
        }
        const id = `path-${index}`;
        const pathElem = elem.append('path').attr('id', id);
        if (pathDef.marker) {
            let color = inlineStyles[id]?.stroke;
            if (!color) {
                color = RGBAToHexA(getComputedStyle(svg.select(`#path-${index}`).node())['stroke']);
            }
            const markerId = appendMarkerDef(svg, pathDef.marker, color);
            pathElem.attr('marker-end', `url(#${markerId})`);
        }
        pathDef.index = index;
        const newPath = pathDef.d.reduce((d, curGroup) => {
            const [instruction, ...data] = curGroup;
            let newData = '';
            for (let i = 0; i < data.length; i += 2) {
                newData += projection([data[i], data[i + 1]]) + ' ';
            }
            d +=  `${instruction}${newData}`;
            return d
        }, '');
        pathElem.attr('d', newPath);
        appendImageAnimated(imagesElem, pathDef);
    });
    // remove node if no image
    if (!imagesElem.node().children) imagesElem.html('');
    else {
        let defs = svg.select('defs');
        if (defs.empty()) defs = svg.append('defs');
        defs.selectAll('.image-def').remove();
        Object.entries(images).forEach(([name, content]) => {
            defs.append('image')
                .attr('class', 'image-def')
                .attr('id', `img-${name}`)
                .attr('href', content)
                .style('width', 'var(--width)')
                .style('height', 'var(--height)')
        })
    }
}

function appendMarkerDef(svg, markerName, color) {
    const id = `${markerName}${color ? '-' + color.substring(1) : ''}`;
    const existingDef = svg.select(`defs #${id}`);
    const markerDef = markers[markerName];
    if (!existingDef.empty()) return id;
    if (svg.select('defs').empty()) svg.append('defs');
    svg.select('defs').append('marker')
        .attr('id', id)
        .attr('markerWidth', 5)
        .attr('markerHeight', 5)
        .attr('viewBox', `0 0 ${markerDef.width} ${markerDef.height}`)
        .attr('orient', 'auto-start-reverse')
        .attr('refX', markerDef.center[0])
        .attr('refY', markerDef.center[1])
        .attr('fill', color || 'black')
        .attr('markerUnits', 'strokeWidth')
        .append("path").attr('d', markerDef.d);
    return id;
}

function appendImageAnimated(selection, pathDef) {
    if (!pathDef.image) return;
    selection.append('use')
        .style('--height', `${pathDef.height}px`)
        .style('--width', `${pathDef.width}px`)
        .attr('x', (-pathDef.width / 2))
        .attr('y', (-pathDef.height / 2))
        .attr('href', `#img-${pathDef.image.name}`)
        .append('animateMotion')
            .attr('dur', `${pathDef.duration}s`)
            .attr('repeatCount', 'indefinite')
            .attr('rotate', 'auto')
            .attr('keyPoints', '0.001;0.1;0.9;0.999;0.9;0.1;0.001')
            .attr('keyTimes', '0;0.1;0.4;0.5;0.6;0.9;1')
            .attr('calcMode', 'linear')
            .append('mpath')
                .attr('xlink:href', `#path-${pathDef.index}`)
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