import SVGO from 'svgo/dist/svgo.browser';
import svgoConfig from '../svgoExport.config';
import svgoConfigText from '../svgoExportText.config';

import TextToSVG from 'text-to-svg';
import { htmlToElement } from '../util/common';
import { indexBy, pick, download } from '../util/common';
import { reportStyle, reportStyleElem, fontsToCss, getUsedInlineFonts } from '../util/dom';
import { encodeSVGDataImage} from './svg';

const domParser = new DOMParser();

const rgb2hex = (rgb) => `#${rgb.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/).slice(1).map(n => parseInt(n, 10).toString(16).padStart(2, '0')).join('')}`

const exportFontChoices = Object.freeze({
    noExport: 0,
    convertToPath: 1,
    embedFont: 2,
    smallest: 3,
});

const domBaselineToBaseline = {
    hanging: "top",
    auto: "middle",
    middle: "middle",
    "text-top": "bottom"
};
const anchorToAnchor = {
    left: 'left',
    middle: 'center',
    right: 'right'
};
function getTextElems(svgElem) {
    const texts = Array.from(svgElem.querySelectorAll('text')).concat(Array.from(svgElem.querySelectorAll('tspan')));
    // ignore text elements containing tspans
    return texts.filter(t => !(t.tagName == 'text' && t.firstChild.tagName == 'tspan'))
}


function getInlineStyle(el, defaultStyles, propName) {
    const isTspan = el.tagName == 'tspan';
    return el.style[propName] || (isTspan ? el.parentNode.style[propName] : null) || defaultStyles.getPropertyValue(propName);
}

function replaceTextsWithPaths(svgElem, transformedTexts) {
    const defaultStyles = getComputedStyle(document.body);
    const texts = getTextElems(svgElem);
    texts.forEach(textElem => {
        const fontFamily = getInlineStyle(textElem, defaultStyles, 'font-family');
        const text = textElem.textContent.trim();
        const transformed = transformedTexts[fontFamily]?.[text];
        if (!transformed) return;
        const pathElem = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        pathElem.setAttribute('d', transformed);
        reportStyleElem(textElem, pathElem);
        if (textElem.tagName == 'tspan') {
            textElem.parentNode.parentNode.append(pathElem);
            reportStyleElem(textElem.parentNode, pathElem);
            textElem.remove();
        }
        else textElem.replaceWith(pathElem);
    });
}

function getTextPosition(textElem, defaultStyles) {
    const getShift = (elem, attr) => {
        const fontSize = parseFloat(getInlineStyle(elem, defaultStyles, 'font-size'));
        const delta = elem.getAttribute(attr);
        if (delta && delta.includes('em')) return parseFloat(delta) * fontSize;
        return 0;
    };
    const getPos = (elem, direction) => {
        let attributes = {delta: 'dx', pos: 'x'};
        let pos = parseFloat(elem.getAttribute(attributes.pos)) || 0;
        if (direction == 'y') attributes = {delta: 'dy', pos: 'y'};
        pos += getShift(elem, attributes.delta);
        let prevSibling = elem.previousSibling;
        // if "y" is ommited, "dy" is cumulative
        while(prevSibling !== null && !prevSibling.hasAttribute(attributes.pos)) {
            pos += getShift(prevSibling, attributes.delta);
            prevSibling = prevSibling.previousSibling;
        }
        return pos;
    };
    
    let x = getPos(textElem, 'x');
    let y = getPos(textElem, 'y');
    return {x, y};
}

async function inlineFontVsPath(svgElem, providedFonts, exportFontsOption) {
    let nbFontChars = 0;
    let nbPathChars = 0;
    const transformedTexts = {};
    const defaultStyles = getComputedStyle(document.body);
    await Promise.all(providedFonts.map(({ name, content }) => {
        transformedTexts[name] = {};
        nbFontChars += content.length;
        // const texts = Array.from(svgElem.querySelectorAll('text')).concat(Array.from(svgElem.querySelectorAll('tspan')));
        const texts = getTextElems(svgElem);
        return new Promise(resolve => {
            TextToSVG.load(content, function (err, textToSVG) {
                texts.forEach(textElem => {
                    if (textElem.tagName == 'text' && textElem.firstChild.tagName == 'tspan') return;
                    const fontFamily = getInlineStyle(textElem, defaultStyles, 'font-family');
                    if (fontFamily === name) {
                        const text = textElem.textContent.trim();
                        const anchor = anchorToAnchor[textElem.getAttribute('text-anchor')] || 'left';
                        const baseline = domBaselineToBaseline[textElem.getAttribute('dominant-baseline')] || 'baseline';
                        const fontSize = parseFloat(getInlineStyle(textElem, defaultStyles, 'font-size'));
                        const {x, y} = getTextPosition(textElem, defaultStyles);
                        const options = {
                            x: x,
                            y: y,
                            fontSize: fontSize,
                            anchor: `${anchor} ${baseline}`
                        };
                        let path = textToSVG.getD(text, options);
                        const tmpSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                        const tmpPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                        tmpPath.setAttribute('d', path);
                        tmpSvg.append(tmpPath);
                        const optimized = domParser.parseFromString(SVGO.optimize(tmpSvg.outerHTML, svgoConfigText).data, 'image/svg+xml');
                        path = optimized.querySelector('path').getAttribute('d');
                        transformedTexts[name][text] = path;
                        nbPathChars += path.length;
                    }
                });
                resolve();
            });
        });
    }));
    const pathIsBetter = nbPathChars + 10000 < nbFontChars;
    if (exportFontsOption === exportFontChoices.convertToPath || pathIsBetter) {
        replaceTextsWithPaths(svgElem, transformedTexts);
        return true;
    }
    return false;
}

async function exportSvg(svg, width, height, tooltipDefs, chosenCountries, zonesData, providedFonts, downloadExport = true, commonCss,
    { exportFonts = exportFontChoices.convertToPath, hideOnResize = false, minifyJs = false }) {
    const fo = svg.select('foreignObject').node();
    // remove foreign object from dom when exporting
    if (fo) document.body.append(fo);
    const svgNode = svg.node();
    let contours = Array.from(svg.node().querySelectorAll('.contour-to-dup[filter]'));
    contours = contours.map(el => {
        const parent = el.parentNode;
        document.body.append(el);
        return [el, parent];
    });
    const usedFonts = getUsedInlineFonts(svgNode);
    const usedProvidedFonts = providedFonts.filter(font => usedFonts.has(font.name));

    // first, optimize data-uri images
    const glowImages = svgNode.querySelectorAll('.glow-img'); 
    glowImages.forEach(glowImg => {
        let glowImgStr = decodeURIComponent(glowImg.getAttribute('href'));
        glowImgStr = glowImgStr.substring(glowImgStr.indexOf('<svg'));
        glowImgStr = encodeSVGDataImage(SVGO.optimize(glowImgStr, svgoConfig).data);
        glowImg.setAttribute('href', glowImgStr);
    });
    const finalSvg = SVGO.optimize(svgNode.outerHTML, svgoConfig).data;
    if (fo) svg.node().append(fo);
    contours.forEach(([el, parent]) => {
        parent.insertBefore(el, parent.firstChild);
    });
    const optimizedSVG = domParser.parseFromString(finalSvg, 'image/svg+xml');
    let pathIsBetter = false;
    if (exportFonts == exportFontChoices.smallest || exportFonts == exportFontChoices.convertToPath) {
        pathIsBetter = await inlineFontVsPath(optimizedSVG.firstChild, providedFonts);
    }
    else if (exportFonts == exportFontChoices.noExport) {
        pathIsBetter = true;
    }
    const finalDataByGroup = { data: {}, tooltips: {} };
    let tooltipEnabled = false;
    [...chosenCountries, 'countries'].forEach(groupId => {
        const group = optimizedSVG.getElementById(groupId);
        if (!group || !tooltipDefs[groupId].enabled) return;
        tooltipEnabled = true;
        const ttTemplate = getFinalTooltipTemplate(groupId, tooltipDefs);
        let usedVars = [...ttTemplate.matchAll(/\{(\w+)\}/g)].map(group => {
            return group[1];
        });
        usedVars = [...new Set(usedVars)];
        usedVars = usedVars.filter(v => v != 'name');
        let functionStr = ttTemplate.replaceAll(/\{(\w+)\}/gi, '${data.$1}');
        functionStr = functionStr.replace('data.name', 'shapeId');
        finalDataByGroup.tooltips[groupId] = functionStr;
        const zonesDataDup = JSON.parse(JSON.stringify(zonesData[groupId].data));
        zonesData[groupId].numericCols.forEach(colDef => {
            const col = colDef.column;
            zonesDataDup.forEach(row => {
                row[col] = zonesData[groupId].formatters[col](row[col]);
            });
        });
        const indexed = indexBy(zonesDataDup, 'name');
        const finalData = {};
        for (const child of group.children) {
            const id = child.getAttribute('id');
            if (!id) continue;
            finalData[id] = pick(indexed[id], usedVars);
        }
        finalDataByGroup.data[groupId] = finalData;
    });

    const onResize = hideOnResize ? `
    let resizeTimeout;
    const contentSvg = mapElement.querySelector('svg');
    window.addEventListener('resize', e => {
        contentSvg.style.display = "none"; clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => { contentSvg.style.display = 'block' }, 300);
    });`: '';

    const onMouseEvents = `
        mapElement.addEventListener('mousemove', (e) => {
            ${tooltipEnabled ? 'onMouseMove(e);' : ''}
            const parent = e.target.parentNode;
            if (e.target.tagName === 'path' && parent.tagName === 'g') {
                if (e.target.previousPos === undefined) e.target.previousPos = Array.from(parent.children).indexOf(e.target);
                if (e.target !== parent.lastElementChild) parent.append(e.target);
            } 
        });

        mapElement.addEventListener('mouseout', (e) => {
            const previousPos = e.target.previousPos;
            if (previousPos) {
                const parent = e.target.parentNode;
                parent.insertBefore(e.target, parent.children[previousPos]);
            }
        });
    `;

    const tooltipCode = tooltipEnabled ? `
    const parser = new DOMParser();
    const width = ${width}, height = ${height};
    const frameElement = document.getElementById('frame');
    const tooltip = {shapeId: null, element: null};
    tooltip.element = constructTooltip({}, '');
    mapElement.append(tooltip.element);
    tooltip.element.style.display = 'none';
    const dataByGroup = ${JSON.stringify(finalDataByGroup)};
    function constructTooltip(data, templateStr, shapeId) {
        if(!data) return;
        const elem = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
        elem.setAttribute('width', 1);
        elem.setAttribute('height', 1);
        elem.style.overflow = 'visible';
        const parsed = parser.parseFromString(eval('\`' + templateStr + '\`' ), 'text/html').querySelector('body');
        elem.appendChild(parsed);
        return elem;
    }
    mapElement.addEventListener('mouseleave', hideTooltip);

    function hideTooltip() {
        tooltip.element.style.display = 'none';
        tooltip.element.style.opacity = 0;
    }

    function onMouseMove(e) {
        const parent = e.target.parentNode;
        if (!parent?.hasAttribute?.("id")) return hideTooltip();
        const mapBounds = frameElement.getBoundingClientRect();
        const transformX = width / mapBounds.width;
        const transformY = height / mapBounds.height;
        const ttBounds = tooltip.element.firstChild?.firstChild?.getBoundingClientRect();
        let posX = (e.clientX - mapBounds.left + 10) * transformX, posY = (e.clientY - mapBounds.top + 10) * transformY;
        let tooltipVisibleOpacity = 1;
        const groupId = parent.getAttribute('id');
        const shapeId = e.target.getAttribute('id');
        if (ttBounds?.width > 0) {
            if (mapBounds.right - ttBounds.width < e.clientX + 10) {
                posX = (e.clientX - mapBounds.left - ttBounds.width - 20) * transformX;
            }
            if (mapBounds.bottom - ttBounds.height < e.clientY + 10) {
                posY = (e.clientY - mapBounds.top - ttBounds.height - 20) * transformY;
            }
        }
        else if (shapeId && groupId in dataByGroup.data) {
            tooltipVisibleOpacity = 0;
            setTimeout(() => {
                onMouseMove(e);
            }, 0);
        }
        if (!(groupId in dataByGroup.data)) {
            hideTooltip();
        }
        else if (shapeId && tooltip.shapeId === shapeId) {
            tooltip.element.setAttribute('x', posX);
            tooltip.element.setAttribute('y', posY);
            tooltip.element.style.display = 'block';
            tooltip.element.style.opacity = tooltipVisibleOpacity;
        }
        else {
            const data = dataByGroup.data[groupId][shapeId];
            if (!data) {
                tooltip.element.style.display = 'none';
                return;
            }
            const tt = constructTooltip(data, dataByGroup.tooltips[groupId], shapeId);
            tooltip.element.replaceWith(tt);
            tooltip.element = tt;
            tooltip.shapeId = shapeId;
            tooltip.element.setAttribute('x', posX);
            tooltip.element.setAttribute('y', posY);
            tooltip.element.style.opacity = tooltipVisibleOpacity;
        }
    }` : '';
    let finalScript = `
        function duplicateContours(svgElem) {
            Array.from(svgElem.querySelectorAll('.contour-to-dup')).forEach(el => {
                if (!el.hasAttribute('filter-name')) return;
                const clone = el.cloneNode();
                clone.setAttribute('href', el.getAttribute('href').replace(\`fill='none'\`, ''))
                clone.setAttribute('filter', \`url(#\${el.getAttribute('filter-name')})\`);
                el.parentNode.insertBefore(clone, el);
            });
        }
        const allScripts = document.getElementsByTagName('script');
        const scriptTag = allScripts[allScripts.length - 1];
        const mapElement = scriptTag.parentNode;
        duplicateContours(mapElement);
        ${onResize}
        ${tooltipCode}
        ${onMouseEvents}
        `;

    const styleElem = document.createElementNS("http://www.w3.org/2000/svg", 'style');
    const renderedCss = commonCss.replaceAll(/rgb\(.*?\)/g, rgb2hex);
    styleElem.innerHTML = pathIsBetter ? renderedCss : renderedCss + fontsToCss(usedProvidedFonts);
    optimizedSVG.firstChild.append(styleElem);
    if (!downloadExport) return optimizedSVG.firstChild.outerHTML;
    if (minifyJs != false) {
        const terser = await import('terser');
        finalScript = await terser.minify(finalScript, { toplevel: true, mangle: {eval: true, reserved: ['data', 'shapeId']}});
        finalScript = finalScript.code;
    }
    const scriptElem = document.createElementNS("http://www.w3.org/2000/svg", 'script');
    scriptElem.innerHTML = `<![CDATA[${finalScript}]]>`;
    optimizedSVG.firstChild.append(scriptElem);
    download(optimizedSVG.firstChild.outerHTML, 'text/plain', 'svgscape-export.svg');
}

function getFinalTooltipTemplate(groupId, tooltipDefs) {
    const finalReference = htmlToElement(tooltipDefs[groupId].content);
    const finalTemplate = finalReference.cloneNode(true);
    finalTemplate.innerHTML = tooltipDefs[groupId].template;
    reportStyle(finalReference, finalTemplate);
    return finalTemplate.outerHTML;
}


export { exportSvg, exportFontChoices };