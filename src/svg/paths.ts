import parsePath from 'parse-svg-path';
import * as markers from './markerDefs';
import { RGBAToHexA } from '../util/common';
import { pathStringFromParsed } from './svg';
import type { Coords, D3Selection, MarkerName, PathDef, SvgSelection } from 'src/types';



export type Project = (coords: Coords) => Coords;
export type Projection = Project & {
    invert(coordinates: Coords): Coords;
}

interface InlineStyles {
    [key: string]: {
        stroke?: string;
        [property: string]: any;
    };
}

type ParsedPathGroup = (string | number)[];
type ParsedPath = ParsedPathGroup[];

export function drawCustomPaths(
    pathDefs: PathDef[],
    svg: SvgSelection,
    projection: Projection,
    inlineStyles: InlineStyles = {}
): void {
    if (!pathDefs) return;

    let elem: D3Selection<SVGGElement> = svg.select('#paths');
    if (elem.empty()) elem = svg.append('g').attr('id', 'paths');
    else elem.html('');

    let exists = false;
    const images: Record<string, string> = {}; // imageName => content

    let imagesElem: D3Selection<SVGGElement> = svg.select('#path-images');
    if (imagesElem.empty()) imagesElem = svg.append('g').attr('id', 'path-images');
    else {
        imagesElem.html('');
        exists = true;
    }

    pathDefs.forEach((pathDef, index) => {
        if (pathDef.image) {
            if (!(pathDef.image.name in images)) {
                images[pathDef.image.name] = pathDef.image.content;
            }
        }

        const id = `path-${index}`;
        const pathElem = elem.append('path').attr('id', id).attr('pathLength', exists ? null : 1);

        if (pathDef.marker) {
            let color = inlineStyles[id]?.stroke;
            if (!color) {
                const node = svg.select(`#path-${index}`).node();
                if (node) {
                    color = RGBAToHexA(getComputedStyle(node as Element)['stroke']);
                }
            }
            const markerId = appendMarkerDef(svg, pathDef.marker, color);
            pathElem.attr('marker-end', `url(#${markerId})`);
        }

        pathDef.index = index;
        const newPath = pathStringFromParsed(pathDef.d, projection);
        pathElem.attr('d', newPath);
        appendImageAnimated(imagesElem, pathDef);
    });

    // remove node if no image
    const imagesNode = imagesElem?.node();
    if (!imagesNode?.children || imagesNode.children.length === 0) {
        imagesElem.html('');
    } else {
        let defs: D3Selection<SVGDefsElement> = svg.select('defs');
        if (defs.empty()) defs = svg.append('defs');
        defs.selectAll('.image-def').remove();

        Object.entries(images).forEach(([name, content]) => {
            defs.append('image')
                .attr('class', 'image-def')
                .attr('id', `img-${name}`)
                .attr('href', content)
                .style('width', 'var(--width)')
                .style('height', 'var(--height)');
        });
    }
}

function appendMarkerDef(svg: SvgSelection, markerName: MarkerName, color?: string): string {
    const id = `${markerName}${color ? '-' + color.substring(1) : ''}`;
    const existingDef = svg.select(`defs #${id}`);
    const markerDef = markers[markerName];

    if (!existingDef.empty()) return id;

    if (svg.select('defs').empty()) svg.append('defs');

    svg.select('defs').append('marker')
        .attr('id', id)
        .attr('markerWidth', 5)
        .attr('markerHeight', 5)
        .attr('viewBox', `0 0 ${markerDef.width} ${markerDef.height}`)
        .attr('orient', 'auto-start-reverse')
        .attr('refX', markerDef.center[0])
        .attr('refY', markerDef.center[1])
        .attr('fill', color || 'black')
        .attr('markerUnits', 'strokeWidth')
        .append("path").attr('d', markerDef.d);

    return id;
}

function appendImageAnimated(selection: D3Selection<SVGGElement>, pathDef: PathDef): void {
    if (!pathDef.image || !pathDef.width || !pathDef.height || !pathDef.duration) return;

    selection.append('use')
        .style('--height', `${pathDef.height}px`)
        .style('--width', `${pathDef.width}px`)
        .attr('x', (-pathDef.width / 2))
        .attr('y', (-pathDef.height / 2))
        .attr('href', `#img-${pathDef.image.name}`)
        .append('animateMotion')
        .attr('dur', `${pathDef.duration}s`)
        .attr('repeatCount', 'indefinite')
        .attr('rotate', 'auto')
        .attr('keyPoints', '0.001;0.1;0.9;0.999;0.9;0.1;0.001')
        .attr('keyTimes', '0;0.1;0.4;0.5;0.6;0.9;1')
        .attr('calcMode', 'linear')
        .append('mpath')
        .attr('xlink:href', `#path-${pathDef.index}`);
}

function parseMatrixAttr(matrixStr: string): number[] | null {
    const numOnly = matrixStr.match(/[-0-9]+/g);
    if (numOnly && numOnly.length === 6) {
        return numOnly.map(n => parseInt(n, 10));
    }
    return null;
}

function extractTranslateFromElem(elem: Element): [number | null, number | null] {
    const transform = elem.getAttribute('transform');
    if (transform) {
        const parsedMatrix = parseMatrixAttr(transform);
        if (parsedMatrix) {
            return [parsedMatrix[4], parsedMatrix[5]];
        }
    }
    return [null, null];
}

export function parseAndUnprojectPath(
    pathElemOrStr: string | Element,
    projection: Projection
): ParsedPath {
    let pathStr: string;
    let xTranslate = 0;
    let yTranslate = 0;

    if (typeof pathElemOrStr !== 'string') {
        pathStr = pathElemOrStr.getAttribute('d') || '';
        const [xTrans, yTrans] = extractTranslateFromElem(pathElemOrStr);
        xTranslate = xTrans || 0;
        yTranslate = yTrans || 0;
    } else {
        pathStr = pathElemOrStr;
    }

    const parsed = parsePath(pathStr);
    const toCoords: ParsedPath = parsed.map(group => {
        const transformed: (string | number)[] = [group[0]];
        for (let i = 1; i < group.length; i += 2) {
            const x = group[i] as number;
            const y = group[i + 1] as number;
            const inverted = projection.invert([x + xTranslate, y + yTranslate]);
            transformed.push(...inverted);
        }
        return transformed;
    });

    return toCoords;
}