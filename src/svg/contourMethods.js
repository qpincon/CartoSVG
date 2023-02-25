// import SVGO from 'svgo/dist/svgo.browser';
import svgoConfig from '../svgoExport.config';
import * as d3 from 'd3';
import { duplicateContourCleanFirst, encodeSVGDataImage} from './svg';
import { appendGlow } from './svgDefs';

function appendLandImageNew(showSource, zonesFilter, width, height, borderWidth, contourParams, land, pathLarger, glowParams) {
    // for not having glow effect on sides of view where there is land
    const offCanvasWithBorder = 20 - (borderWidth / 2);
    d3.select(this).style('pointer-events', 'none')
        .style('will-change', 'opacity');
    const landElem = d3.create('svg')
        .attr('xmlns', "http://www.w3.org/2000/svg")
        .attr('viewBox', `${-offCanvasWithBorder/2} ${-offCanvasWithBorder/2} ${width + offCanvasWithBorder} ${height + offCanvasWithBorder}`)
        .attr('preserveAspectRatio', 'none');

        
    landElem.append('g')
        .attr('stroke', contourParams.strokeColor)
        .attr('stroke-width', contourParams.strokeWidth)
        .attr('stroke-dasharray', contourParams.strokeDash)
        .attr('fill', 'none')
        .selectAll('path')
        .data(land.features ? land.features : land)
        .join('path')
        .attr('d', (d) => {return pathLarger(d)});
        
    if (showSource) {
        landElem.select('g').attr('fill', contourParams.fillColor);
    }
    const optimized = encodeSVGDataImage(landElem.node().outerHTML);
    const img = d3.select(this).append('image')
            .attr('x', -offCanvasWithBorder/2).attr('y', -offCanvasWithBorder/2)
            .attr('width', width + (offCanvasWithBorder )).attr('height', height + (offCanvasWithBorder))
            .attr('href', optimized)
            .style('pointer-events', 'none')
            .style('will-change', 'opacity')
            .classed('contour-to-dup', true)
            .classed('glow-img', true)
            
    
    let filterName = zonesFilter['land'];
    if(filterName) {
        if (showSource) {
            filterName = `${zonesFilter['land']}-with-source`;
            appendGlow(d3.select('#static-svg-map'), filterName, showSource, glowParams);
        }
        img.attr('filter-name', filterName);
    }
}

function appendCountryImageNew(countryData, filter, applyStyles, path, inlineStyles) {
    d3.select(this).html('');
    const countryName = countryData.properties.name;
    const ref = document.getElementById(countryName);
    // if country not present or no stroke width and no filter, do nothing
    if (filter === null) {
        const strokeWidth = inlineStyles[countryName]?.['stroke-width'];
        if (!strokeWidth || strokeWidth == '0px') return;
        if (!ref) return;
    }
    applyStyles(true);
    d3.select(this).style('pointer-events', 'none')
        .style('will-change', 'opacity');

    const countryElem = d3.create('svg')
        .attr('xmlns', "http://www.w3.org/2000/svg");
    
    countryElem.append('path')
        .attr('d', path(countryData))
        .attr('fill', 'none');

    if (ref) {
        const strokeParams = ['stroke', 'stroke-width', 'stroke-linejoin', 'stroke-dasharray'];
        const computedRef = window.getComputedStyle(ref);
        strokeParams.forEach(p => {
            countryElem.attr(p, computedRef[p])
        });
        ref.style['stroke-width'] = '0px';
    }
    // const optimized = encodeSVGDataImage(SVGO.optimize(countryElem.node().outerHTML, svgoConfig).data);
    const optimized = encodeSVGDataImage(countryElem.node().outerHTML);
    d3.select(this).append('image').attr('width', '100%').attr('height', '100%')
            .attr('href', optimized)
            .style('pointer-events', 'none')
            .style('will-change', 'opacity')
            .classed('contour-to-dup', true)
            .classed('glow-img', true)
            .attr('filter-name', filter);
    // remove all cloned filter elements
    const svgElem = document.getElementById('static-svg-map');
    duplicateContourCleanFirst(svgElem);
}


function appendLandDefAndUse(showSource) {
    const svgDefs = svg.select('defs');
    d3.select(this)
        .style('pointer-events', 'none')
        .style('will-change', 'opacity');
    svgDefs.append('svg')
        .attr('id', 'landshape')
        .style('pointer-events', 'none')
        .style('will-change', 'opacity')
        .selectAll('path')
            .data(land.features ? land.features : land)
            .join('path')
                .attr('d', (d) => {return path(d)});

    if (showSource) {
        d3.select(this).attr('fill', contourParams.fillColor);
    }
    d3.select('#landshape').html(SVGO.optimize(d3.select('#landshape').node().outerHTML, svgoConfig).data);
    if(zonesFilter['land']) {
        let filterName = zonesFilter['land'];
        if (showSource) {
            filterName = `${zonesFilter['land']}-with-source`;
            appendGlow(svg, filterName, showSource, p(zonesFilter['land']));
        }
        d3.select(this).append('use').attr('href', '#landshape').attr('filter', `url(#${filterName})`);
    }
    d3.select(this).append('use').attr('href', '#landshape')
        .attr('stroke', contourParams.strokeColor)
        .attr('stroke-width', contourParams.strokeWidth)
        .attr('stroke-dasharray', contourParams.strokeDash)
        .attr('fill', 'none');
}

function appendCountryDefAndUse(countryData, filter) {
    const countryName = countryData.properties.name;
    const svgDefs = svg.select('defs');
    d3.select(this).html('');
    d3.select(this)
        .style('pointer-events', 'none')
        .style('will-change', 'opacity');
    svgDefs.append('svg')
        .style('pointer-events', 'none')
        .style('will-change', 'opacity')
        .append('path')
            .attr('d', path(countryData))
            .attr('id', 'countryshape');

    if (filter) {
        d3.select(this).append('use').attr('href', '#countryshape').attr('filter', `url(#${filter})`);
    }
    const elemStroke = d3.select(this).append('use').attr('href', '#countryshape').attr('fill', 'none');
    const ref = document.getElementById(countryName);
    if (ref) {
        const strokeParams = ['stroke', 'stroke-width', 'stroke-linejoin', 'stroke-dasharray'];
        const computedRef = window.getComputedStyle(ref);
        strokeParams.forEach(p => elemStroke.attr(p, computedRef[p]));
    }
}

// better, but webkit do not allow data URI of svg filters definitions :'(
// see https://bugs.webkit.org/show_bug.cgi?id=104169#c6
// using this method would be much better performance-wise, since it is the best way (to my knowledge)
// to tell the browser that the element will never change. Embedding the SVG results in worse performance
// when interacting. The "new" methods is just a workaround to mimick this method
function appendLandImage(showSource) {
    const landElem = d3.create('svg')
        .attr('xmlns', "http://www.w3.org/2000/svg");
    if (showSource) {
        landElem.attr('fill', contourParams.fillColor);
    }

    landElem.append('defs').append('g').attr('id', 'landshape').selectAll('path')
        .data(land.features ? land.features : land)
        .join('path')
            .attr('d', (d) => {return path(d)});
            
    if(zonesFilter['land']) {
        const filterName = zonesFilter['land'];
        landElem.append('use').attr('href', '#landshape').attr('filter', `url(#${filterName})`);
        appendGlow(landElem, filterName, showSource, p(filterName));
    }
    landElem.append('use').attr('href', '#landshape')
        .attr('stroke', contourParams.strokeColor)
        .attr('stroke-width', contourParams.strokeWidth)
        .attr('stroke-dasharray', contourParams.strokeDash)
        .attr('fill', 'none');

    // const optimized = encodeSVGDataImage(SVGO.optimize(landElem.node().outerHTML, svgoConfig).data);
    const landImage = d3.create('image').attr('width', '100%').attr('height', '100%')
        .classed('glow-img', true)
        .attr('href', `data:image/svg+xml;utf8,${landElem.node().outerHTML.replaceAll(/#/g, '%23')}`);
        // .attr('href', `data:image/svg+xml;utf8,${SVGO.optimize(landElem.node().outerHTML, svgoConfig).data.replaceAll(/#/g, '%23')}`);
        // .attr('href', optimized);
        
    d3.select(this).html(landImage.node().outerHTML)
        .style('pointer-events', 'none')
        .style('will-change', 'opacity');
        // .attr('clip-path', 'url(#clipMapBorder)');
}


// way better, but webkit do not allow data URI of svg filters definitions :'(
function appendCountryImage(countryData, filter) {
    const countryName = countryData.properties.name;
    const countryElem = d3.create('svg')
        .attr('xmlns', "http://www.w3.org/2000/svg");
        
    countryElem.append('defs').append('path')
        .attr('d', path(countryData))
        .attr('id', 'countryshape');

    if (filter) {
        appendGlow(countryElem, filter, false, p(filter));
        countryElem.append('use').attr('href', '#countryshape').attr('filter', `url(#${filter})`);
    }
    const elemStroke = countryElem.append('use').attr('href', '#countryshape').attr('fill', 'none');
    const ref = document.getElementById(countryName);
    if (ref) {
        const strokeParams = ['stroke', 'stroke-width', 'stroke-linejoin', 'stroke-dasharray'];
        const computedRef = window.getComputedStyle(ref);
        strokeParams.forEach(p => elemStroke.attr(p, computedRef[p]));
    }
    // const optimized = encodeSVGDataImage(SVGO.optimize(countryElem.node().outerHTML, svgoConfig).data);
    const countryImage = d3.create('image').attr('width', '100%').attr('height', '100%').attr('id', countryElem)
        .classed('glow-img', true)
        .attr('href', `data:image/svg+xml;utf8,${countryElem.node().replaceAll(/#/g, '%23')}`);
        // .attr('href', `data:image/svg+xml;utf8,${SVGO.optimize(countryElem.node().outerHTML, svgoConfig).data.replaceAll(/#/g, '%23')}`);
        // .attr('href', optimized);
    d3.select(this).html(countryImage.node().outerHTML)
        .style('pointer-events', 'none')
        .style('will-change', 'opacity');
}

export {appendLandImageNew, appendLandImage, appendLandDefAndUse, appendCountryDefAndUse, appendCountryImageNew, appendCountryImage};