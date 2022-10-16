import { htmlToElement } from '../util/common';
import SVGO from 'svgo/dist/svgo.browser';
import svgoConfig from '../svgoExport.config';
import { indexBy, pick, download } from '../util/common';
import { reportStyle } from '../util/dom';

function exportSvg(svg, width, height, tooltipContents, tooltipTemplates, chosenCountries, zonesData, cssFonts, downloadExport=true) {
    const finalSvg = SVGO.optimize(svg.node().outerHTML, svgoConfig).data;
    
    const domParser = new DOMParser();
    const optimizedSVG = domParser.parseFromString(finalSvg, 'image/svg+xml');
    const finalDataByGroup = {data: {}, tooltips: {}};
    [...chosenCountries, 'countries'].forEach(groupId => {
        const containerId = groupId !== 'countries' ? groupId + '-adm1' : groupId;
        const group = optimizedSVG.getElementById(containerId);
        if (!group) return;
        const ttTemplate = getFinalTooltipTemplate(groupId, tooltipContents, tooltipTemplates);
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
            const body = document.createElementNS('http://www.w3.org/1999/xhtml', 'body');
            body.innerHTML = eval('\`' + templateStr + '\`' );
            elem.append(body);
            return elem;
        }
        mapElement.addEventListener('mouseleave', (e) => {
            tooltip.element.style.display = 'none';
            tooltip.element.style.opacity = 0;
        });
        mapElement.addEventListener('mousemove', (e) => {
            onMouseMove(e);
        });
        function onMouseMove(e) {
            const parent = e.target.parentNode;
            if (!parent?.hasAttribute?.("id")) {
                tooltip.element.style.display = 'none';
                tooltip.element.style.opacity = 0;
                return;
            };
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
                tooltip.element.style.display = 'none';
                tooltip.element.style.opacity = 0;
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
    const renderedCss = exportStyleSheet('map-style');
    styleElem.innerHTML = renderedCss + cssFonts;
    optimizedSVG.firstChild.append(styleElem);
    if (!downloadExport) return optimizedSVG.firstChild.outerHTML;
    const scriptElem = document.createElementNS("http://www.w3.org/2000/svg", 'script');
    scriptElem.innerHTML = finalScript;
    optimizedSVG.firstChild.append(scriptElem);
    download(optimizedSVG.firstChild.outerHTML, 'text/plain', 'mySvg.svg');
}

function getFinalTooltipTemplate(groupId, tooltipContents, tooltipTemplates) {
    const finalReference = htmlToElement(tooltipContents[groupId]);
    const finalTemplate = finalReference.cloneNode(true);
    finalTemplate.innerHTML = tooltipTemplates[groupId];
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