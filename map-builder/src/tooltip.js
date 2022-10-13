// let tooltip = {currentId: null, element: null};
import { reportStyle } from './util/dom';
import { htmlToElement } from './util/common';

function addTooltipListener(map, tooltipTemplates, popupContents, zonesData) {
    const tooltip = {shapeId: null, element: document.createElement('div')};
    map.append(tooltip.element);
    tooltip.element.style.display = 'none';
    map.addEventListener('mouseleave', (e) => {
        tooltip.element.style.display = 'none';
        tooltip.element.style.opacity = 0;
    });
    map.addEventListener('mousemove', (e) => {
        onMouseMove(e, map, tooltipTemplates, popupContents, zonesData, tooltip);
    });
}

function onMouseMove(e, map, tooltipTemplates, popupContents, zonesData, tooltip) {
    const parent = e.target.parentNode;
    if (!parent?.hasAttribute?.("id")) {
        tooltip.element.style.display = 'none';
        tooltip.element.style.opacity = 0;
        return;
    };
    const groupId = parent.getAttribute('id').replace('-adm1', '');
    const shapeId = e.target.getAttribute('id');
    const mapBounds = map.getBoundingClientRect();
    const ttBounds = tooltip.element.firstChild?.firstChild?.getBoundingClientRect();
    let posX = e.clientX - mapBounds.left + 10, posY = e.clientY - mapBounds.top + 10;
    let popupVisibleOpacity = 1;
    if (ttBounds?.width > 0) {
        if (mapBounds.right - ttBounds.width < e.clientX + 10) {
            posX -= ttBounds.width + 10;
        }
        if (mapBounds.bottom - ttBounds.height < e.clientY + 10) {
            posY -=  ttBounds.height + 10;
        }
    }
    else if(groupId in zonesData) {
        popupVisibleOpacity = 0;
        setTimeout(() => {
            onMouseMove(e, map, tooltipTemplates, popupContents, zonesData, tooltip);
        }, 0);
    }
    if (!(groupId in zonesData)) {
        tooltip.element.style.display = 'none';
        tooltip.element.style.opacity = 0;
    }
    else if (shapeId && tooltip.shapeId === shapeId) {
        tooltip.element.setAttribute('x', posX);
        tooltip.element.setAttribute('y', posY);
        tooltip.element.style.display = 'block';
        tooltip.element.style.opacity = popupVisibleOpacity;
    }
    else {
        e.target.parentNode.append(e.target);
        const idCol = groupId === 'countries' ? 'alpha-3' : 'shapeName';
        const data = zonesData[groupId].data.find(row => row[idCol] === shapeId);
        if (!data) {
            tooltip.element.style.display = 'none';
            tooltip.element.style.opacity = 0;
            return;
        }
        const tt = instanciateTooltip(data, groupId, tooltipTemplates, popupContents);
        tooltip.element.replaceWith(tt);
        tooltip.element = tt;
        tooltip.shapeId = shapeId;
        tooltip.element.setAttribute('x', posX);
        tooltip.element.setAttribute('y', posY);
        tooltip.element.style.opacity = popupVisibleOpacity;
    }
}

function instanciateTooltip(dataRow, groupId, tooltipTemplates, popupContents) {
    if (!dataRow) return;
    const elem = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
    elem.setAttribute('width', 1);
    elem.setAttribute('height', 1);
    elem.style.overflow = 'visible';
    const body = document.createElementNS('http://www.w3.org/1999/xhtml', 'body');
    const tooltip = document.createElement('div');
    tooltip.innerHTML = tooltipTemplates?.[groupId]?.formatUnicorn(dataRow) || '';
    reportStyle(htmlToElement(popupContents?.[groupId] || ''), tooltip);
    body.innerHTML = tooltip.outerHTML;
    elem.append(body);
    return elem;
}

export { addTooltipListener };