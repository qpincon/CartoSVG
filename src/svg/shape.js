import * as d3 from 'd3';

import { createSvgFromPart, setTransformTranslate, getTranslateFromTransform } from './svg';
import * as shapes from './shapeDefs';

let currentlyDragging;
function drawShapes(shapeDefinitions, container, projection, dragCb) {
    if (!container) return;
    container.innerHTML = '';
    shapeDefinitions.forEach((shapeDef) => {
        // shape is a symbol
        const projectedPos = projection(shapeDef.pos);
        let svgShape;
        if (shapeDef.name) {
            svgShape = createSvgFromPart(shapes[shapeDef.name]);
        }
        // shape is a label
        else {
            svgShape = addSvgText(shapeDef.text, shapeDef.id).node();
        }
        const transform = `translate(${projectedPos[0]} ${projectedPos[1]})`;
        svgShape.setAttribute('transform', transform);
        svgShape.setAttribute('id', shapeDef.id);
        container.appendChild(svgShape);
    });
    let dragging = false;
    d3.select(container).call(d3.drag()
        .on("drag", function(event) {
            dragging = true;
            const [x, y] = getTranslateFromTransform(currentlyDragging);
            setTransformTranslate(currentlyDragging, `translate(${x + event.dx} ${y + event.dy})`);
        })
        .on('start', (e) => {
            if (e.sourceEvent.target.tagName === 'tspan') currentlyDragging = e.sourceEvent.target.parentNode;
            else currentlyDragging = e.sourceEvent.target
        })
        .on('end', (e) => {
            if (!dragging) return;
            dragging = false;
            const pointId = currentlyDragging.getAttribute('id');
            const pointDef = shapeDefinitions.find(def => def.id === pointId);
            const [x, y] = getTranslateFromTransform(currentlyDragging);
            pointDef.pos = projection.invert([x, y]);
            currentlyDragging = null;
            dragCb();
        })
    );
}

const separator = '++';
function addSvgText(text, id) {
    const parts = text.split(separator);
    const textElem = d3.create('svg:text')
        .style('stroke-width', 0)
        .attr('id', id);
        
    const countPrefixSpace = str => {
        let i = 0;
        while (i < str.length && str[i] === ' ') ++i;
        return i;
    };
    textElem.selectAll('tspan')
        .data(parts)
        .join('tspan')
            .attr('x', 0)
            .attr('dx', (d) => `${countPrefixSpace(d) / 3}em`)
            .attr('dy', (_, i) => (i ? '1.1em' : 0))
            .attr('id', (_, i) => (`${id}-${i}`))
            .text(d => d);

    return textElem;
}

export { drawShapes, addSvgText };