// import SVGO from 'svgo/dist/svgo.browser';
import svgoConfig from '../svgoExport.config';
import { select } from 'd3-selection'
import { duplicateContourCleanFirst } from './svg';
import { appendGlow } from './svgDefs';


// Using encodeURIComponent() as replacement function
// allows to keep result code readable
// should be in svg.js, but if we import, the toString method on function will not work properly
export function encodeSVGDataImage(data: string) {
    const symbols = /[\r\n%#()<>?[\\\]^`{|}]/g;
    if (data.indexOf(`http://www.w3.org/2000/svg`) < 0) {
        data = data.replace(/<svg/g, `<svg xmlns='http://www.w3.org/2000/svg'`);
    }
    data = data.replace(/"/g, `'`);
    data = data.replace(/>\s{1,}</g, `><`);
    data = data.replace(/\s{2,}/g, ` `);
    data = data.replace(symbols, encodeURIComponent);
    return `data:image/svg+xml,${data}`
}
export const encodeSVGDataImageStr = encodeSVGDataImage.toString();

export function imageFromSpecialGElem(gElem: SVGGElement) {
    const embeddedSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    embeddedSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    embeddedSvg.setAttribute('preserveAspectRatio', 'none');
    embeddedSvg.innerHTML = gElem.innerHTML;
    const imageElem = document.createElementNS('http://www.w3.org/2000/svg', 'image');
    embeddedSvg.querySelectorAll('path[pathLength]').forEach(el => { el.removeAttribute('pathLength') });
    [...gElem.attributes].forEach(attr => {
        if (attr.nodeName.includes('image-')) {
            const attrName = attr.nodeName.slice(6);
            imageElem.setAttribute(attrName, attr.nodeValue!);
        }
        else {
            embeddedSvg.setAttribute(attr.nodeName, attr.nodeValue!)
        }
    }
    );
    const optimized = encodeSVGDataImage(embeddedSvg.outerHTML);
    imageElem.setAttribute('href', optimized);
    return imageElem;
}
export const imageFromSpecialGElemStr = imageFromSpecialGElem.toString();

export function appendLandImageNew(this: SVGGElement, showSource: false, zonesFilter, width, height, borderWidth, contourParams, land, pathLarger, glowParams, animate) {
    // for not having glow effect on sides of view where there is land
    const offCanvasWithBorder = 20 - (borderWidth / 2);
    select(this).attr('id', 'land')
        .style('pointer-events', 'none')
        .style('will-change', 'opacity')

    const parent = select(this);
    let gElem = parent.select('g');
    if (gElem.empty()) {
        gElem = parent.append('g')
            .attr('stroke', contourParams.strokeColor)
            .attr('stroke-width', contourParams.strokeWidth)
            .attr('stroke-dasharray', contourParams.strokeDash)
            .attr('fill', 'none')
            .attr('viewBox', `${-offCanvasWithBorder / 2} ${-offCanvasWithBorder / 2} ${width + offCanvasWithBorder} ${height + offCanvasWithBorder}`)

            .attr('image-x', -offCanvasWithBorder / 2)
            .attr('image-y', -offCanvasWithBorder / 2)
            .attr('image-width', width + (offCanvasWithBorder))
            .attr('image-height', height + (offCanvasWithBorder))
            .attr('image-class', 'contour-to-dup glow-img');

        gElem.selectAll('path')
            .data(land.features ? land.features : land)
            .join('path')
            .attr('pathLength', 1)
            .attr('d', (d) => { return pathLarger(d) });
        let filterName = zonesFilter['land'];
        if (filterName) {
            if (showSource) {
                filterName = `${zonesFilter['land']}-with-source`;
                appendGlow(select('#static-svg-map'), filterName, showSource, glowParams);
            }
            gElem.attr('image-filter-name', filterName);
        }
    }
    if (showSource) {
        parent.select('g').attr('fill', contourParams.fillColor);
    }
    if (animate) return;
    const imageElem = imageFromSpecialGElem(gElem.node());
    this.append(imageElem);
}

export function appendCountryImageNew(countryData, filter, applyStyles, path, inlineStyles, animate, clear = false) {
    if (clear) select(this).html('');
    const countryName = countryData.properties.name;
    const ref = document.getElementById(countryName);

    // if country not present or no stroke width and no filter, do nothing
    if (filter === null) {
        const strokeWidth = inlineStyles[countryName]?.['stroke-width'];
        if (!strokeWidth || strokeWidth == '0px') return;
        if (!ref) return;
    }
    applyStyles(true);
    select(this).style('pointer-events', 'none')
        .style('will-change', 'opacity')
        .classed('country-img', true);

    const parent = select(this);
    let gElem = parent.select('g');
    if (gElem.empty()) {
        gElem = parent.append('g')
            .attr('image-width', '100%')
            .attr('image-height', '100%')
            .attr('image-class', 'contour-to-dup glow-img')
            .attr('image-filter-name', filter);
        gElem.append('path')
            .attr('d', path(countryData))
            .attr('pathLength', 1)
            .attr('fill', 'none');
    }
    const pathElem = gElem.select('path');
    if (ref) {
        const strokeParams = ['stroke', 'stroke-width', 'stroke-linejoin', 'stroke-dasharray'];
        const computedRef = window.getComputedStyle(ref);
        strokeParams.forEach(p => {
            pathElem.attr(p, computedRef[p])
        });
        ref.style['stroke-width'] = '0px';
    }
    if (animate) return;
    const imageElem = imageFromSpecialGElem(gElem.node());
    this.append(imageElem);
    // remove all cloned filter elements
    if (clear) {
        const svgElem = document.getElementById('static-svg-map');
        duplicateContourCleanFirst(svgElem);
    }
}


// export function appendLandDefAndUse(showSource) {
//     const svgDefs = svg.select('defs');
//     select(this)
//         .style('pointer-events', 'none')
//         .style('will-change', 'opacity');
//     svgDefs.append('svg')
//         .attr('id', 'landshape')
//         .style('pointer-events', 'none')
//         .style('will-change', 'opacity')
//         .selectAll('path')
//         .data(land.features ? land.features : land)
//         .join('path')
//         .attr('d', (d) => { return path(d) });

//     if (showSource) {
//         select(this).attr('fill', contourParams.fillColor);
//     }
//     select('#landshape').html(SVGO.optimize(select('#landshape').node().outerHTML, svgoConfig).data);
//     if (zonesFilter['land']) {
//         let filterName = zonesFilter['land'];
//         if (showSource) {
//             filterName = `${zonesFilter['land']}-with-source`;
//             appendGlow(svg, filterName, showSource, p(zonesFilter['land']));
//         }
//         select(this).append('use').attr('href', '#landshape').attr('filter', `url(#${filterName})`);
//     }
//     select(this).append('use').attr('href', '#landshape')
//         .attr('stroke', contourParams.strokeColor)
//         .attr('stroke-width', contourParams.strokeWidth)
//         .attr('stroke-dasharray', contourParams.strokeDash)
//         .attr('fill', 'none');
// }


// better, but webkit do not allow data URI of svg filters definitions :'(
// see https://bugs.webkit.org/show_bug.cgi?id=104169#c6
// using this method would be much better performance-wise, since it is the best way (to my knowledge)
// to tell the browser that the element will never change. Embedding the SVG results in worse performance
// when interacting. The "new" methods is just a workaround to mimick this method
// function appendLandImage(showSource) {
//     const landElem = d3.create('svg')
//         .attr('xmlns', "http://www.w3.org/2000/svg");
//     if (showSource) {
//         landElem.attr('fill', contourParams.fillColor);
//     }

//     landElem.append('defs').append('g').attr('id', 'landshape').selectAll('path')
//         .data(land.features ? land.features : land)
//         .join('path')
//         .attr('d', (d) => { return path(d) });

//     if (zonesFilter['land']) {
//         const filterName = zonesFilter['land'];
//         landElem.append('use').attr('href', '#landshape').attr('filter', `url(#${filterName})`);
//         appendGlow(landElem, filterName, showSource, p(filterName));
//     }
//     landElem.append('use').attr('href', '#landshape')
//         .attr('stroke', contourParams.strokeColor)
//         .attr('stroke-width', contourParams.strokeWidth)
//         .attr('stroke-dasharray', contourParams.strokeDash)
//         .attr('fill', 'none');

//     // const optimized = encodeSVGDataImage(SVGO.optimize(landElem.node().outerHTML, svgoConfig).data);
//     const landImage = d3.create('image').attr('width', '100%').attr('height', '100%')
//         .classed('glow-img', true)
//         .attr('href', `data:image/svg+xml;utf8,${landElem.node().outerHTML.replaceAll(/#/g, '%23')}`);
//     // .attr('href', `data:image/svg+xml;utf8,${SVGO.optimize(landElem.node().outerHTML, svgoConfig).data.replaceAll(/#/g, '%23')}`);
//     // .attr('href', optimized);

//     select(this).html(landImage.node().outerHTML)
//         .style('pointer-events', 'none')
//         .style('will-change', 'opacity');
//     // .attr('clip-path', 'url(#clipMapBorder)');
// }


// way better, but webkit do not allow data URI of svg filters definitions :'(
// export function appendCountryImage(countryData, filter) {
//     const countryName = countryData.properties.name;
//     const countryElem = d3.create('svg')
//         .attr('xmlns', "http://www.w3.org/2000/svg");

//     countryElem.append('defs').append('path')
//         .attr('d', path(countryData))
//         .attr('id', 'countryshape');

//     if (filter) {
//         appendGlow(countryElem, filter, false, p(filter));
//         countryElem.append('use').attr('href', '#countryshape').attr('filter', `url(#${filter})`);
//     }
//     const elemStroke = countryElem.append('use').attr('href', '#countryshape').attr('fill', 'none');
//     const ref = document.getElementById(countryName);
//     if (ref) {
//         const strokeParams = ['stroke', 'stroke-width', 'stroke-linejoin', 'stroke-dasharray'];
//         const computedRef = window.getComputedStyle(ref);
//         strokeParams.forEach(p => elemStroke.attr(p, computedRef[p]));
//     }
//     // const optimized = encodeSVGDataImage(SVGO.optimize(countryElem.node().outerHTML, svgoConfig).data);
//     const countryImage = d3.create('image').attr('width', '100%').attr('height', '100%').attr('id', countryElem)
//         .classed('glow-img', true)
//         .attr('href', `data:image/svg+xml;utf8,${countryElem.node().replaceAll(/#/g, '%23')}`);
//     // .attr('href', `data:image/svg+xml;utf8,${SVGO.optimize(countryElem.node().outerHTML, svgoConfig).data.replaceAll(/#/g, '%23')}`);
//     // .attr('href', optimized);
//     select(this).html(countryImage.node().outerHTML)
//         .style('pointer-events', 'none')
//         .style('will-change', 'opacity');
// }
