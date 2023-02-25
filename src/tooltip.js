import { reportStyle } from './util/dom';
import { htmlToElement } from './util/common';

function addTooltipListener(map, tooltipDefs, zonesData) {
    const tooltip = {shapeId: null, element: document.createElement('div')};
    map.append(tooltip.element);
    tooltip.element.style.display = 'none';
    map.addEventListener('mouseleave', (e) => {
        tooltip.element.style.display = 'none';
        tooltip.element.style.opacity = 0;
    });
    map.addEventListener('mousemove', (e) => {
        onMouseMove(e, map, tooltipDefs, zonesData, tooltip);
        const parent = e.target.parentNode;
        if (e.target.tagName === 'path' && parent.tagName === 'g') {
            if(e.target.previousPos === undefined) e.target.previousPos = Array.from(parent.children).indexOf(e.target);
            if (e.target !== parent.lastElementChild) parent.append(e.target);
        } 
    });
    map.addEventListener('mouseout', (e) => {
        const previousPos = e.target.previousPos;
        if (previousPos) {
            const parent = e.target.parentNode;
            parent.insertBefore(e.target, parent.children[previousPos]);
            delete e.target.previousPos;
        }
    });
}

function hideTooltip(tooltip) {
    tooltip.element.style.display = 'none';
    tooltip.element.style.opacity = 0;
}

function onMouseMove(e, map, tooltipDefs, zonesData, tooltip) {
    const parent = e.target.parentNode;
    if (!parent?.hasAttribute?.("id")) return hideTooltip(tooltip);
    let groupId = parent.getAttribute('id');
    if (!tooltipDefs?.[groupId]?.enabled) return hideTooltip(tooltip);
    const shapeId = e.target.getAttribute('id');
    const mapBounds = map.getBoundingClientRect();
    const ttBounds = tooltip.element.firstChild?.firstChild?.getBoundingClientRect();
    let posX = e.clientX - mapBounds.left + 10, posY = e.clientY - mapBounds.top + 10;
    let tooltipVisibleOpacity = 1;
    if (ttBounds?.width > 0) {
        if (mapBounds.right - ttBounds.width < e.clientX + 10) {
            posX -= ttBounds.width + 20;
        }
        if (mapBounds.bottom - ttBounds.height < e.clientY + 10) {
            posY -=  ttBounds.height + 20;
        }
    }
    else if(groupId in zonesData) {
        tooltipVisibleOpacity = 0;
        setTimeout(() => {
            onMouseMove(e, map, tooltipDefs, zonesData, tooltip);
        }, 0);
    }
    if (!(groupId in zonesData)) {
        hideTooltip(tooltip);
    }
    else if (shapeId && tooltip.shapeId === shapeId) {
        tooltip.element.setAttribute('x', posX);
        tooltip.element.setAttribute('y', posY);
        tooltip.element.style.display = 'block';
        tooltip.element.style.opacity = tooltipVisibleOpacity;
    }
    else {
        const data = {...zonesData[groupId].data.find(row => row.name === shapeId)};
        zonesData[groupId].numericCols.forEach(colDef => {
            const col = colDef.column;
            data[col] = zonesData[groupId].formatters[col](data[col]);
        });
        if (!data) {
            tooltip.element.style.display = 'none';
            tooltip.element.style.opacity = 0;
            return;
        }
        const tt = instanciateTooltip(data, groupId, tooltipDefs);
        tooltip.element.replaceWith(tt);
        tooltip.element = tt;
        tooltip.shapeId = shapeId;
        tooltip.element.setAttribute('x', posX);
        tooltip.element.setAttribute('y', posY);
        tooltip.element.style.opacity = tooltipVisibleOpacity;
    }
}

function instanciateTooltip(dataRow, groupId, tooltipDefs) {
    if (!dataRow) return;
    const elem = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
    elem.setAttribute('width', 1);
    elem.setAttribute('height', 1);
    elem.style.overflow = 'visible';
    const body = document.createElementNS('http://www.w3.org/1999/xhtml', 'body');
    const tooltip = document.createElement('div');
    tooltip.innerHTML = tooltipDefs?.[groupId]?.template?.formatUnicorn(dataRow) || '';
    reportStyle(htmlToElement(tooltipDefs?.[groupId]?.content || ''), tooltip);
    body.innerHTML = tooltip.outerHTML;
    elem.append(body);
    return elem;
}

export { addTooltipListener };