import { pointer } from 'd3';
import { markCurveActive } from './paths';
import { COLOR, ANCHOR_R, HANDLE_R, DRAG_THRESHOLD } from './pathEditor';

type Coordinate = [number, number];

interface PenAnchor {
    p: Coordinate;
    in: Coordinate;
    out: Coordinate;
}

const SVG_NS = 'http://www.w3.org/2000/svg';
const FINISH_RADIUS = 6; // px, a mousedown this close to the last anchor finishes the path
const SNAP_STEP = Math.PI / 4;

let svgElem: SVGSVGElement | null = null;
let endCb: ((path: SVGPathElement) => void) | undefined;
let pathElem: SVGPathElement | null = null;
let preview: SVGGElement | null = null;
let anchors: PenAnchor[] = [];
let cursor: Coordinate | null = null;
// anchor being created by the current mousedown: dragging pulls its handles out
let drag: { startClient: Coordinate; moved: boolean } | null = null;

const dist = (a: Coordinate, b: Coordinate): number => Math.hypot(b[0] - a[0], b[1] - a[1]);

function svgEl<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>): SVGElementTagNameMap[K] {
    const el = document.createElementNS(SVG_NS, tag);
    for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, String(value));
    return el;
}

function toD(): string {
    if (anchors.length < 2) return '';
    let d = `M ${anchors[0].p[0]} ${anchors[0].p[1]} `;
    for (let i = 1; i < anchors.length; i++) {
        const prev = anchors[i - 1];
        const cur = anchors[i];
        d += `C ${prev.out[0]} ${prev.out[1]}, ${cur.in[0]} ${cur.in[1]}, ${cur.p[0]} ${cur.p[1]} `;
    }
    return d;
}

/** Redraws the path being built plus the rubber-band segment, anchor dots and the active handles. */
function render(): void {
    if (!pathElem || !preview) return;
    pathElem.setAttribute('d', toD());
    preview.replaceChildren();

    const last = anchors[anchors.length - 1];
    if (last && cursor && !drag) {
        const rubber = svgEl('path', { stroke: COLOR, 'stroke-width': 1.5, 'stroke-dasharray': '4 3', fill: 'none' });
        rubber.setAttribute('d', `M ${last.p[0]} ${last.p[1]} C ${last.out[0]} ${last.out[1]}, ${cursor[0]} ${cursor[1]}, ${cursor[0]} ${cursor[1]}`);
        preview.append(rubber);
    }
    if (last && drag?.moved) {
        for (const h of [last.in, last.out]) {
            preview.append(svgEl('line', { x1: last.p[0], y1: last.p[1], x2: h[0], y2: h[1], stroke: COLOR, 'stroke-width': 1 }));
            preview.append(svgEl('circle', { cx: h[0], cy: h[1], r: HANDLE_R, fill: COLOR, stroke: '#fff', 'stroke-width': 1 }));
        }
    }
    anchors.forEach((a, i) => {
        preview!.append(svgEl('circle', {
            cx: a.p[0], cy: a.p[1], r: ANCHOR_R, stroke: COLOR, 'stroke-width': 1.5,
            fill: i === anchors.length - 1 ? COLOR : '#fff',
        }));
    });
}

function pos(e: MouseEvent): Coordinate {
    return pointer(e, svgElem) as Coordinate;
}

function onMouseDown(e: MouseEvent): void {
    if (e.button !== 0 || !svgElem) return;
    e.preventDefault();
    const p = pos(e);
    const last = anchors[anchors.length - 1];
    if (last && dist(last.p, p) < FINISH_RADIUS) {
        finishPenDrawPath();
        return;
    }
    anchors.push({ p, in: p, out: p });
    drag = { startClient: [e.clientX, e.clientY], moved: false };
    render();
}

function onMouseMove(e: MouseEvent): void {
    if (!svgElem) return;
    cursor = pos(e);
    const last = anchors[anchors.length - 1];
    if (drag && last) {
        if (!drag.moved) {
            if (Math.hypot(e.clientX - drag.startClient[0], e.clientY - drag.startClient[1]) < DRAG_THRESHOLD) return;
            drag.moved = true;
        }
        let out = cursor;
        if (e.shiftKey) {
            const angle = Math.round(Math.atan2(out[1] - last.p[1], out[0] - last.p[0]) / SNAP_STEP) * SNAP_STEP;
            const length = dist(last.p, out);
            out = [last.p[0] + Math.cos(angle) * length, last.p[1] + Math.sin(angle) * length];
        }
        last.out = out;
        // Alt moves only the outgoing handle, producing a cusp
        last.in = e.altKey ? last.p : [2 * last.p[0] - out[0], 2 * last.p[1] - out[1]];
    }
    render();
}

function onMouseUp(): void {
    drag = null;
    render();
}

function onKeyDown(e: KeyboardEvent): void {
    const t = e.target as HTMLElement | null;
    if (t?.tagName === 'INPUT' || t?.tagName === 'TEXTAREA' || t?.isContentEditable) return;
    if (e.key === 'Enter') {
        e.preventDefault();
        finishPenDrawPath();
    } else if (e.key === 'Backspace') {
        e.preventDefault();
        removeLastPenPoint();
    }
}

export function penDrawPath(svg: SVGSVGElement, onEnd: (path: SVGPathElement) => void): void {
    svgElem = svg;
    endCb = onEnd;
    anchors = [];
    cursor = null;
    drag = null;
    // Use svg.querySelector to avoid matching non-SVG elements with the same id (e.g. layer checkboxes in the sidebar)
    const container = svg.querySelector('#paths') ?? svg;
    pathElem = svgEl('path', {});
    container.append(pathElem);
    markCurveActive(pathElem);
    preview = svgEl('g', { 'pointer-events': 'none' });
    svg.append(preview);

    svg.addEventListener('mousedown', onMouseDown);
    svg.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    document.addEventListener('keydown', onKeyDown);
}

function detach(): void {
    svgElem?.removeEventListener('mousedown', onMouseDown);
    svgElem?.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
    document.removeEventListener('keydown', onKeyDown);
    preview?.remove();
    preview = null;
    drag = null;
}

/** Drops the last anchor (Backspace / Ctrl+Z while drawing). */
export function removeLastPenPoint(): void {
    if (!pathElem) return;
    anchors.pop();
    render();
}

export function isPenDrawing(): boolean {
    return pathElem !== null;
}

/** Keeps what was drawn: hands the path over to the end callback (an empty `d` if fewer than 2 anchors). */
export function finishPenDrawPath(): void {
    if (!pathElem) return;
    const path = pathElem;
    const cb = endCb;
    path.setAttribute('d', toD());
    detach();
    pathElem = null;
    anchors = [];
    cb?.(path);
}

/** Discards everything (tool switched). */
export function cancelPenDrawPath(): void {
    detach();
    pathElem?.remove();
    pathElem = null;
    anchors = [];
}
