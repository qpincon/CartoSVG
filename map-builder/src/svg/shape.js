import * as d3 from 'd3';

import { createSvgFromPart, setTransformTranslate, getTranslateFromTransform } from './svg';
import * as shapes from './shapeDefs';

let currentlyDragging;
function drawShapes(shapeDefinitions, container, projection) {
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
            const svgPart = `<text stroke-width="0"> ${shapeDef.text} </text>`;
            svgShape = createSvgFromPart(svgPart);
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
            // setTransformTranslate(currentlyDragging, `translate(${event.x} ${event.y})`);
        })
        .on('start', (e) => currentlyDragging = e.sourceEvent.target)
        .on('end', (e) => {
            if (!dragging) return;
            dragging = false;
            const pointId = currentlyDragging.getAttribute('id');
            const pointDef = shapeDefinitions.find(def => def.id === pointId);
            const [x, y] = getTranslateFromTransform(currentlyDragging);
            pointDef.pos = projection.invert([x, y]);
            currentlyDragging = null;
        })
    );
}
export { drawShapes };