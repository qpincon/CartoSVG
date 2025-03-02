const domParser = new DOMParser();

// remove buggy paths, covering the whole svg element
function removeCoveringAll(groupElement) {
    if (!groupElement) return;
    const parent = groupElement.closest('svg');
    const containerRect = parent.getBoundingClientRect();
    for (let child of groupElement.children) {
        if (child.tagName != 'path') continue;
        const d = child.getAttribute('d');
        // ignore empty path, and big ones (that actually draw something)
        if (!d || d.length > 100) continue;
        const rect = child.getBoundingClientRect();
        const includes = rect.x <= containerRect.x && rect.right >= containerRect.right
            && rect.y <= containerRect.y && rect.bottom >= containerRect.bottom;
        if (includes) {
            console.log('removing', child);
            child.remove();
        }
    }
}


function distance(p1, p2) {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    return Math.sqrt(dx * dx + dy * dy);
}

function closestDistance(point, pathElem) {
    const pathLength = pathElem.getTotalLength();
    const delta = 10;
    const nbSample = Math.ceil(pathLength / delta);
    let minDist = Number.MAX_SAFE_INTEGER;
    let minDistPoint;
    let advancement;
    for (let i = 0; i < nbSample; i++) {
        const pathPoint = pathElem.getPointAtLength(i * delta);
        const dist = distance(pathPoint, point);
        if (dist < minDist) {
            minDist = dist;
            minDistPoint = pathPoint;
            advancement = (i * delta) / pathLength;
        }
    }
    return { distance: minDist, point: minDistPoint, advancement: advancement };
}


function setTransformScale(el, scaleStr) {
    const existingTransform = el.getAttribute('transform');
    if (!existingTransform) {
        el.setAttribute("transform", scaleStr);
    }
    else if (existingTransform.length && !existingTransform.includes('scale')) {
        el.setAttribute("transform", `${existingTransform} ${scaleStr}`);
    }
    else {
        const newAttr = existingTransform.replace(/scale\(.*?\)/, scaleStr);
        el.setAttribute("transform", newAttr);
    }
}

function getTranslateFromTransform(el) {
    const existingTransform = el.getAttribute('transform');
    if (!existingTransform) return null;
    const matched = existingTransform.match(/([\-0-9\.]+),? ([\-0-9\.]+)/);
    if (matched.length === 3) return [parseInt(matched[1]), parseInt(matched[2])];
    return null;
}

function setTransformTranslate(el, translateStr) {
    const existingTransform = el.getAttribute('transform');
    if (!existingTransform) {
        el.setAttribute("transform", translateStr);
    }
    else if (existingTransform.length && !existingTransform.includes('translate')) {
        el.setAttribute("transform", `${translateStr} ${existingTransform}`);
    }
    else {
        const newAttr = existingTransform.replace(/translate\(.*?\)/, translateStr);
        el.setAttribute("transform", newAttr);
    }
}

function createSvgFromPart(partStr) {
    const svgStr = `<svg xmlns="http://www.w3.org/2000/svg">${partStr}</svg>`;
    return domParser.parseFromString(svgStr, 'text/html').body.childNodes[0].firstChild;
}

// // Using encodeURIComponent() as replacement function
// // allows to keep result code readable
// function encodeSVGDataImage(data) {
//     const symbols = /[\r\n%#()<>?[\\\]^`{|}]/g;
//     if (data.indexOf(`http://www.w3.org/2000/svg`) < 0) {
//       data = data.replace(/<svg/g, `<svg xmlns='http://www.w3.org/2000/svg'`);
//     }
//     data = data.replace(/"/g, `'`);
//     data = data.replace(/>\s{1,}</g, `><`);
//     data = data.replace(/\s{2,}/g, ` `);
//     data = data.replace(symbols, encodeURIComponent);
//     return `data:image/svg+xml,${data}`
// }
// const encodeSVGDataImageStr = encodeSVGDataImage.toString();

function duplicateContourCleanFirst(svgElem) {
    Array.from(svgElem.querySelectorAll('.contour-to-dup[filter]')).forEach(el => el.remove());
    duplicateContours(svgElem);
}

/** Duplicate contour <image> tags, that only contain stroke, to have a new one wiht a fill and a filter applied */
function duplicateContours(svgElem) {
    Array.from(svgElem.querySelectorAll('.contour-to-dup')).forEach(el => {
        if (!el.hasAttribute('filter-name')) return;
        const clone = el.cloneNode();
        clone.setAttribute('href', el.getAttribute('href').replace(`fill='none'`, ''))
        clone.setAttribute('filter', `url(#${el.getAttribute('filter-name')})`);
        // set opacity to 0 once to initiate transition
        clone.style['opacity'] = 0;
        setTimeout(() => {
            clone.style['opacity'] = 1;
        }, 0);
        el.parentNode.insertBefore(clone, el);
    });
}

export {
    createSvgFromPart, setTransformScale, setTransformTranslate, getTranslateFromTransform, 
    closestDistance, duplicateContours, duplicateContourCleanFirst, 
    //encodeSVGDataImageStr, encodeSVGDataImage
};