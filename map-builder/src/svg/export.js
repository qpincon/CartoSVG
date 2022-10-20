import { htmlToElement } from '../util/common';
import SVGO from 'svgo/dist/svgo.browser';
import svgoConfig from '../svgoExport.config';
import { indexBy, pick, download } from '../util/common';
import { reportStyle } from '../util/dom';


const rgb2hex = (rgb) => `#${rgb.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/).slice(1).map(n => parseInt(n, 10).toString(16).padStart(2, '0')).join('')}`

function exportSvg(svg, width, height, tooltipDefs, chosenCountries, zonesData, cssFonts, onExported, downloadExport=true) {
    svg.select('foreignObject').remove();
    const finalSvg = SVGO.optimize(svg.node().outerHTML, svgoConfig).data;
    const domParser = new DOMParser();
    const optimizedSVG = domParser.parseFromString(finalSvg, 'image/svg+xml');
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
                if(e.target.previousPos === undefined) e.target.previousPos = Array.from(parent.children).indexOf(e.target);
                parent.append(e.target);
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
    styleElem.innerHTML = renderedCss + cssFonts;
    optimizedSVG.firstChild.append(styleElem);
    onExported();
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