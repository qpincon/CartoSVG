import { create } from 'd3-selection';
import { createSvgFromPart, createSvgAnchor } from './svg';
import * as shapes from './shapeDefs';
import type { Coords, ShapeDefinition } from 'src/types';
import type { GeoProjection } from 'd3-geo';

export function drawShapes(
    shapeDefinitions: ShapeDefinition[],
    container: HTMLElement | null,
    projection: GeoProjection,
    elementLinks: { [elemId: string]: string } = {},
): void {
    if (!container) return;

    container.innerHTML = '';

    shapeDefinitions.forEach((shapeDef: ShapeDefinition) => {
        // shape is a symbol
        const projectedPos: Coords | null = projection(shapeDef.pos);
        if (!projectedPos) return; // e.g. geoAlbersUsa outside the US
        let svgShape: SVGElement;

        if (shapeDef.customImage) {
            const { content, width, height } = shapeDef.customImage;
            svgShape = document.createElementNS("http://www.w3.org/2000/svg", "image") as unknown as SVGElement;
            svgShape.setAttribute("href", content);
            svgShape.setAttribute("width", String(width));
            svgShape.setAttribute("height", String(height));
            // Bottom-middle at (0,0): shift left by half width, shift up by full height
            svgShape.setAttribute("x", String(-width / 2));
            svgShape.setAttribute("y", String(-height));
            svgShape.classList.add("shape");
        } else if (shapeDef.name) {
            svgShape = createSvgFromPart(shapes[shapeDef.name]);
            svgShape.classList.add("shape");
        }
        // shape is a label
        else if (shapeDef.text) {
            svgShape = addSvgText(shapeDef.text, shapeDef.id).node() as SVGElement;
        } else {
            // Handle case where neither name nor text is provided
            throw new Error(`Shape definition ${shapeDef.id} must have either 'name' or 'text' property`);
        }

        let transform: string = `translate(${projectedPos[0]} ${projectedPos[1]})`;
        if (shapeDef.rotation) {
            transform += ` rotate(${shapeDef.rotation})`;
        }
        if (shapeDef.scale && shapeDef.scale !== 1) {
            transform += ` scale(${shapeDef.scale})`;
        }
        svgShape.setAttribute('transform', transform);
        svgShape.setAttribute('id', shapeDef.id);

        const url = elementLinks[shapeDef.id];
        if (url) {
            const a = createSvgAnchor(url);
            a.appendChild(svgShape);
            container.appendChild(a);
        } else {
            container.appendChild(svgShape);
        }
    });
}


export function addSvgText(text: string, id: string) {
    const parts: string[] = text.split('\n');
    const textElem = create('svg:text')
        .attr('class', 'text')
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
