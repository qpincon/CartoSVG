import SVGO from 'svgo/dist/svgo.browser';
import svgoConfig from '../svgoExport.config';
import svgoConfigText from '../svgoExportText.config';

import TextToSVG from 'text-to-svg';
// import paper from 'paper';
// paper.setup([1000, 1000]);
import { htmlToElement } from '../util/common';
import { indexBy, pick, download } from '../util/common';
import { reportStyle, fontsToCss } from '../util/dom';
const domParser = new DOMParser();

const rgb2hex = (rgb) => `#${rgb.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/).slice(1).map(n => parseInt(n, 10).toString(16).padStart(2, '0')).join('')}`

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
function replaceTextsWithPaths(svgElem, transformedTexts) {
    const texts = Array.from(svgElem.querySelectorAll('text'));
    texts.forEach(textElem => {
        const fontFamily = textElem.style['font-family'];
        const text = textElem.textContent.trim();
        const transformed = transformedTexts[fontFamily][text];
        if (!transformed) return;
        const pathElem = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        pathElem.setAttribute('d', transformed);
        pathElem.setAttribute('transform', textElem.getAttribute('transform'));
        reportStyle(textElem, pathElem);
        textElem.replaceWith(pathElem);
        // textElem.parentElement.append(pathElem);
    });
}

async function inlineFontVsPath(svgElem, providedFonts) {
    let nbFontChars = 0; 
    let nbPathChars = 0;
    const transformedTexts = {};
    const defaultStyles = getComputedStyle(document.body);
    await Promise.all(providedFonts.map(({name, content}) => {
        transformedTexts[name] = {};
        nbFontChars += content.length;
        const texts = Array.from(svgElem.querySelectorAll('text'));
        return new Promise(resolve => { 
            TextToSVG.load(content, function(err, textToSVG) {
                texts.forEach(textElem => {
                    const fontFamily = textElem.style['font-family'] || defaultStyles.getPropertyValue('font-family');
                    console.log(defaultStyles.getPropertyValue('font-size'));
                    if (fontFamily === name) {
                        const text = textElem.textContent.trim();
                        const anchor = anchorToAnchor[textElem.getAttribute('text-anchor')] || 'left';
                        const baseline = domBaselineToBaseline[textElem.getAttribute('dominant-baseline')] || 'baseline';
                        const options = {
                            x: textElem.getAttribute('x') || 0,
                            y: textElem.getAttribute('y') || 0,
                            fontSize: parseInt(textElem.style['font-size'] || defaultStyles.getPropertyValue('font-size')),
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
                        // const paperPath = new paper.Path(path);
                        // paperPath.simplify(1);
                        // console.log(paperPath.pathData)
                    }
                });
                resolve();
            });
        });
    }));
    console.log('font chars=', nbFontChars);
    console.log('path chars=', nbPathChars);
    const pathIsBetter = nbPathChars + 10000  < nbFontChars;
    if (pathIsBetter) {
        replaceTextsWithPaths(svgElem, transformedTexts);
        return true;
    }
    return false;
}

async function exportSvg(svg, width, height, tooltipDefs, chosenCountries, zonesData, providedFonts, downloadExport=true) {
    // svg.select('foreignObject').remove();
    const fo = svg.select('foreignObject').node();
    if (fo) document.body.append(fo);
    // const clonedSvg = svg.node().cloneNode(true);
    // document.body.append(clonedSvg);
    const svgNode = svg.node();
    const cssFonts = fontsToCss(providedFonts);
    
    const finalSvg = SVGO.optimize(svgNode.outerHTML, svgoConfig).data;
    if (fo) svg.node().append(fo);
    const optimizedSVG = domParser.parseFromString(finalSvg, 'image/svg+xml');
    const pathIsBetter = await inlineFontVsPath(optimizedSVG.firstChild, providedFonts);
    const finalDataByGroup = {data: {}, tooltips: {}};
    [...chosenCountries, 'countries'].forEach(groupId => {
        const containerId = groupId !== 'countries' ? groupId + '-adm1' : groupId;
        const group = optimizedSVG.getElementById(containerId);
        if (!group || !tooltipDefs[groupId].enabled) return;
        const ttTemplate = getFinalTooltipTemplate(groupId, tooltipDefs);
        let usedVars = [...ttTemplate.matchAll(/\{(\w+)\}/g)].map(group => {
            return group[1];
        });
        usedVars = [...new Set(usedVars)];
        const functionStr = ttTemplate.replaceAll(/\{(\w+)\}/gi, '${data.$1}');
        finalDataByGroup.tooltips[groupId] = functionStr;
        const indexed = indexBy(zonesData[groupId].data, groupId === 'countries' ? 'alpha-3': 'shapeName');
        const finalData = {};
        for (let child of group.children) {
            const id = child.getAttribute('id');
            if (!id) continue;
            finalData[id] = pick(indexed[id], usedVars);
        }
        finalDataByGroup.data[groupId] = finalData;
    });

    const finalScript = `
    <![CDATA[
        window.addEventListener('DOMContentLoaded', () => {
        const parser = new DOMParser();
        const width = ${width}, height = ${height};
        const mapElement = document.getElementById('static-svg-map');
        const frameElement = document.getElementById('frame');
        const tooltip = {shapeId: null, element: null};
        tooltip.element = constructTooltip({}, '');
        mapElement.append(tooltip.element);
        tooltip.element.style.display = 'none';
            
        let resizeTimeout;
        const contentSvg = mapElement.firstChild;
        window.addEventListener('resize', e => {
            contentSvg.style.display = "none"; clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => { contentSvg.style.display = 'block' }, 100);
        });

        const dataByGroup = ${JSON.stringify(finalDataByGroup)};
        function constructTooltip(data, templateStr) {
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
        mapElement.addEventListener('mousemove', (e) => {
            onMouseMove(e);
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
            const groupId = parent.getAttribute('id').replace('-adm1', '');
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
                parent.append(e.target);
                const data = dataByGroup.data[groupId][shapeId];
                if (!data) {
                    tooltip.element.style.display = 'none';
                    return;
                }
                const tt = constructTooltip(data, dataByGroup.tooltips[groupId]);
                tooltip.element.replaceWith(tt);
                tooltip.element = tt;
                tooltip.shapeId = shapeId;
                tooltip.element.setAttribute('x', posX);
                tooltip.element.setAttribute('y', posY);
                tooltip.element.style.opacity = tooltipVisibleOpacity;
            }
        }
    });]]>`;
    const styleElem = document.createElementNS("http://www.w3.org/2000/svg", 'style');
    let renderedCss = exportStyleSheet('map-style');
    renderedCss = renderedCss.replaceAll(/rgb\(.*?\)/g, rgb2hex);
    styleElem.innerHTML = pathIsBetter ? renderedCss : renderedCss + cssFonts;
    optimizedSVG.firstChild.append(styleElem);
    if (!downloadExport) return optimizedSVG.firstChild.outerHTML;
    const scriptElem = document.createElementNS("http://www.w3.org/2000/svg", 'script');
    scriptElem.innerHTML = finalScript;
    optimizedSVG.firstChild.append(scriptElem);
    download(optimizedSVG.firstChild.outerHTML, 'text/plain', 'mySvg.svg');
}

function getFinalTooltipTemplate(groupId, tooltipDefs) {
    const finalReference = htmlToElement(tooltipDefs[groupId].content);
    const finalTemplate = finalReference.cloneNode(true);
    finalTemplate.innerHTML = tooltipDefs[groupId].template;
    reportStyle(finalReference, finalTemplate);
    return finalTemplate.outerHTML;
}

function styleSheetToText(sheet) {
    let styleTxt = '';
    const rules = sheet.cssRules;
    for (let r in rules) {
        styleTxt += rules[r].cssText;
    }
    return styleTxt.replace(/undefined/g, '');
}

function exportStyleSheet() {
    const sheets = document.styleSheets;
    for (let i in sheets) {
        const rules = sheets[i].cssRules;
        for (let r in rules) {
            const selectorText = rules[r].selectorText;
            if (selectorText?.includes("#paths path")) return styleSheetToText(sheets[i]);
        }
    }
}

export { exportSvg };