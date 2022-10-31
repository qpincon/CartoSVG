import parsePath from 'parse-svg-path';

export function drawCustomPaths(pathDefs, svg, projection) {
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
        elem.append('path').attr('id', id).attr('d', newPath);
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