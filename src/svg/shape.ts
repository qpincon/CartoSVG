import { select, create } from 'd3-selection';
import { drag, type D3DragEvent } from 'd3-drag';
import { createSvgFromPart, setTransformTranslate, getTranslateFromTransform } from './svg';
import * as shapes from './shapeDefs';
import type { Coords, ShapeDefinition } from 'src/types';
import type { GeoProjection } from 'd3-geo';



type DragCallback = () => void;

// Global state
let currentlyDragging: SVGElement | null = null;

export function drawShapes(
    shapeDefinitions: ShapeDefinition[],
    container: HTMLElement | null,
    projection: GeoProjection,
    dragCb: DragCallback
): void {
    if (!container) return;

    container.innerHTML = '';

    shapeDefinitions.forEach((shapeDef: ShapeDefinition) => {
        // shape is a symbol
        const projectedPos: Coords = projection(shapeDef.pos)!;
        let svgShape: SVGElement;

        if (shapeDef.name) {
            svgShape = createSvgFromPart(shapes[shapeDef.name]);
        }
        // shape is a label
        else if (shapeDef.text) {
            svgShape = addSvgText(shapeDef.text, shapeDef.id).node() as SVGElement;
        } else {
            // Handle case where neither name nor text is provided
            throw new Error(`Shape definition ${shapeDef.id} must have either 'name' or 'text' property`);
        }

        const transform: string = `translate(${projectedPos[0]} ${projectedPos[1]})`;
        svgShape.setAttribute('transform', transform);
        svgShape.setAttribute('id', shapeDef.id);
        container.appendChild(svgShape);
    });

    let dragging: boolean = false;

    select(container).call(drag<HTMLElement, unknown>()
        .on("drag", function (event: D3DragEvent<HTMLElement, unknown, unknown>) {
            dragging = true;
            if (!currentlyDragging) return;

            const [x, y]: Coords = getTranslateFromTransform(currentlyDragging)!;
            setTransformTranslate(currentlyDragging, `translate(${x + event.dx} ${y + event.dy})`);
        })
        .on('start', (event: D3DragEvent<HTMLElement, unknown, unknown>) => {
            const target = event.sourceEvent.target as Element;
            if (target.tagName === 'tspan') {
                currentlyDragging = target.parentNode as SVGElement;
            } else {
                currentlyDragging = target as SVGElement;
            }
        })
        .on('end', (event: D3DragEvent<HTMLElement, unknown, unknown>) => {
            if (!dragging || !currentlyDragging) return;

            dragging = false;
            const pointId: string | null = currentlyDragging.getAttribute('id');

            if (!pointId) {
                currentlyDragging = null;
                return;
            }

            const pointDef: ShapeDefinition | undefined = shapeDefinitions.find(def => def.id === pointId);
            if (!pointDef) {
                currentlyDragging = null;
                return;
            }

            const [x, y]: Coords = getTranslateFromTransform(currentlyDragging)!;
            pointDef.pos = projection.invert ? projection.invert([x, y])! : [x, y];
            currentlyDragging = null;
            dragCb();
        })
    );
}

const separator: string = '++';

export function addSvgText(text: string, id: string) {
    const parts: string[] = text.split(separator);
    const textElem = create('svg:text')
        .style('stroke-width', 0)
        .attr('id', id);

    const countPrefixSpace = (str: string): number => {
        let i = 0;
        while (i < str.length && str[i] === ' ') ++i;
        return i;
    };

    textElem.selectAll('tspan')
        .data(parts)
        .join('tspan')
        .attr('x', 0)
        .attr('dx', (d: string) => `${countPrefixSpace(d) / 3}em`)
        .attr('dy', (_: string, i: number) => (i ? '1.1em' : 0))
        .attr('id', (_: string, i: number) => (`${id}-${i}`))
        .text((d: string) => d);

    return textElem;
}
