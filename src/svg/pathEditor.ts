import parsePath from 'parse-svg-path';
import { pointer } from 'd3';
import { markCurveActive, unmarkCurveActive } from './paths';

type Coordinate = [number, number];
type BezierCurve = [Coordinate, Coordinate, Coordinate, Coordinate];

interface Drag {
    kind: 'path' | 'point';
    index: number;
    startClient: Coordinate;
    start: Coordinate;
    last: Coordinate;
    moved: boolean;
    // whether dragging a handle also rotates the opposite handle (keeping its length)
    mirror: boolean;
}

interface Handle {
    index: number;
    circle: SVGCircleElement;
    line: SVGLineElement;
}

const SVG_NS = 'http://www.w3.org/2000/svg';
export const COLOR = '#528af4';
export const ANCHOR_R = 5;
export const HANDLE_R = 3.5;
const HIT_WIDTH = 12;
export const DRAG_THRESHOLD = 3; // px, below this a mousedown+mouseup is a click
const SAMPLES = 24; // per-segment samples when looking for the closest point on the curve
const MAX_HISTORY = 50;
const COLLINEAR_TOLERANCE = 0.02; // |sin(angle)| under which two handles are considered smooth

const lerp = (a: Coordinate, b: Coordinate, t: number): Coordinate => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const dist = (a: Coordinate, b: Coordinate): number => Math.hypot(b[0] - a[0], b[1] - a[1]);
const isAnchor = (index: number): boolean => index % 3 === 0;
const sameCoords = (a: Coordinate[], b: Coordinate[]): boolean =>
    a.length === b.length && a.every((c, i) => c[0] === b[i][0] && c[1] === b[i][1]);

function svgEl<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}): SVGElementTagNameMap[K] {
    const el = document.createElementNS(SVG_NS, tag);
    for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, String(value));
    return el;
}

function isTextTarget(e: Event): boolean {
    const t = e.target as HTMLElement | null;
    return t?.tagName === 'INPUT' || t?.tagName === 'TEXTAREA' || !!t?.isContentEditable;
}

/**
 * Edits a path made only of cubic Béziers (M followed by C commands).
 * `pathData` is the single source of truth: [anchor, handle, handle, anchor, handle, handle, anchor...].
 * Only the anchors are drawn; the two handles of the selected anchor are shown on demand.
 *
 * - drag an anchor / handle (the opposite handle follows if the anchor is smooth, Alt breaks it)
 * - click an anchor to select it, arrow keys nudge it, Delete removes it, double-click toggles corner/smooth
 * - click on the curve to insert an anchor, drag it to move the whole path
 */
export default class PathEditor {
    private pathData: Coordinate[] = [];
    private root = svgEl('svg', { overflow: 'visible' });
    private group = svgEl('g');
    private overlay = svgEl('path', { stroke: COLOR, 'stroke-width': 1.5, fill: 'none', 'pointer-events': 'none' });
    private hit = svgEl('path', { stroke: 'transparent', 'stroke-width': HIT_WIDTH, fill: 'none', 'pointer-events': 'stroke', cursor: 'copy' });
    private ghost = svgEl('circle', { r: 4, fill: COLOR, opacity: 0.5, 'pointer-events': 'none', display: 'none' });
    private linesGroup = svgEl('g');
    private anchorsGroup = svgEl('g');
    private handlesGroup = svgEl('g');
    private anchors: SVGCircleElement[] = [];
    private handles: Handle[] = [];
    private selected: number | null = null;
    private drag: Drag | null = null;
    private history: Coordinate[][] = [];
    private historyIndex = -1;

    constructor(
        private pathElem: SVGPathElement,
        private svgContainer: SVGElement,
        private onFinish: (pathElem: SVGPathElement | null) => void
    ) {
        for (const seg of parsePath(pathElem.getAttribute('d') || '')) {
            for (let i = 1; i + 1 < seg.length; i += 2) this.pathData.push([seg[i] as number, seg[i + 1] as number]);
        }
        if (this.pathData.length < 4 || (this.pathData.length - 1) % 3 !== 0) {
            console.error('Wrong number of elements after path parsing');
            // can't edit this path: leave edit mode once the caller has stored the editor
            queueMicrotask(() => this.onFinish(this.pathElem));
            return;
        }

        const transform = pathElem.getAttribute('transform');
        if (transform) this.group.setAttribute('transform', transform);
        this.group.append(this.overlay, this.hit, this.linesGroup, this.anchorsGroup, this.handlesGroup, this.ghost);
        this.root.append(this.group);
        pathElem.parentNode?.append(this.root);

        this.hit.addEventListener('mousedown', this.onHitMouseDown);
        this.hit.addEventListener('mousemove', this.onHitMouseMove);
        this.hit.addEventListener('mouseleave', this.hideGhost);
        // anchors, handles and the curve stop propagation, so only clicks on the empty map get here
        this.svgContainer.addEventListener('mousedown', this.onEmptyMouseDown);
        window.addEventListener('mousemove', this.onWindowMouseMove);
        window.addEventListener('mouseup', this.onWindowMouseUp);
        document.addEventListener('keydown', this.onKeyDown);
        document.addEventListener('keyup', this.onKeyUp);

        this.rebuild();
        markCurveActive(this.pathElem);
        this.commit();
    }

    finish(): void {
        this.cleanup();
        this.onFinish(this.pathElem);
    }

    private cleanup(): void {
        unmarkCurveActive(this.pathElem);
        this.root.remove();
        this.svgContainer.removeEventListener('mousedown', this.onEmptyMouseDown);
        window.removeEventListener('mousemove', this.onWindowMouseMove);
        window.removeEventListener('mouseup', this.onWindowMouseUp);
        document.removeEventListener('keydown', this.onKeyDown);
        document.removeEventListener('keyup', this.onKeyUp);
    }

    // --- local (in-editor) undo/redo history, independent from the app-wide history ---

    private commit(): void {
        const snapshot = this.pathData.map((c): Coordinate => [c[0], c[1]]);
        if (this.history[this.historyIndex] && sameCoords(this.history[this.historyIndex], snapshot)) return;
        this.history = this.history.slice(0, this.historyIndex + 1);
        this.history.push(snapshot);
        if (this.history.length > MAX_HISTORY) this.history.shift();
        this.historyIndex = this.history.length - 1;
    }

    private restore(snapshot: Coordinate[]): void {
        this.pathData = snapshot.map((c): Coordinate => [c[0], c[1]]);
        this.selected = null;
        this.rebuild();
    }

    undo(): void {
        if (this.historyIndex > 0) this.restore(this.history[--this.historyIndex]);
    }

    redo(): void {
        if (this.historyIndex < this.history.length - 1) this.restore(this.history[++this.historyIndex]);
    }

    // --- rendering ---

    /** Recreates the anchor circles (the number of points changed) and the handles of the selection. */
    private rebuild(): void {
        this.anchorsGroup.replaceChildren();
        this.anchors = [];
        for (let index = 0; index < this.pathData.length; index += 3) {
            const circle = svgEl('circle', { r: ANCHOR_R, stroke: COLOR, 'stroke-width': 1.5, cursor: 'move' });
            circle.addEventListener('mousedown', e => this.onAnchorMouseDown(e, index));
            circle.addEventListener('dblclick', () => this.toggleSmooth(index));
            this.anchorsGroup.append(circle);
            this.anchors.push(circle);
        }
        this.rebuildHandles();
    }

    private rebuildHandles(): void {
        this.linesGroup.replaceChildren();
        this.handlesGroup.replaceChildren();
        this.handles = [];
        if (this.selected !== null) {
            for (const index of [this.selected - 1, this.selected + 1]) {
                if (index < 0 || index >= this.pathData.length) continue;
                const line = svgEl('line', { stroke: COLOR, 'stroke-width': 1, 'pointer-events': 'none' });
                const circle = svgEl('circle', { r: HANDLE_R, fill: COLOR, stroke: '#fff', 'stroke-width': 1, cursor: 'move' });
                circle.addEventListener('mousedown', e => this.onHandleMouseDown(e, index));
                circle.addEventListener('dblclick', () => this.toggleSmooth(this.anchorOf(index)));
                this.linesGroup.append(line);
                this.handlesGroup.append(circle);
                this.handles.push({ index, circle, line });
            }
        }
        this.anchors.forEach((c, k) => c.setAttribute('fill', k * 3 === this.selected ? COLOR : '#fff'));
        this.render();
    }

    /** Pushes `pathData` to the path, the overlay and every visible point. */
    private render(): void {
        const [first, ...rest] = this.pathData;
        let d = `M ${first[0]} ${first[1]} `;
        rest.forEach((c, i) => (d += `${i % 3 === 0 ? 'C' : ''}${c[0]} ${c[1]} `));
        for (const el of [this.pathElem, this.overlay, this.hit]) el.setAttribute('d', d);

        const place = (circle: SVGCircleElement, [x, y]: Coordinate) => {
            circle.setAttribute('cx', String(x));
            circle.setAttribute('cy', String(y));
        };
        this.anchors.forEach((circle, k) => place(circle, this.pathData[k * 3]));
        for (const { index, circle, line } of this.handles) {
            const [x1, y1] = this.pathData[this.anchorOf(index)];
            const [x2, y2] = this.pathData[index];
            place(circle, [x2, y2]);
            line.setAttribute('x1', String(x1));
            line.setAttribute('y1', String(y1));
            line.setAttribute('x2', String(x2));
            line.setAttribute('y2', String(y2));
        }
    }

    private select(index: number | null): void {
        if (this.selected === index) return;
        this.selected = index;
        this.rebuildHandles();
    }

    // --- geometry helpers ---

    private anchorOf(index: number): number {
        return index % 3 === 0 ? index : index % 3 === 1 ? index - 1 : index + 1;
    }

    /** Index of the handle on the other side of the anchor, or -1 for the extremities. */
    private oppositeOf(handle: number): number {
        const opposite = 2 * this.anchorOf(handle) - handle;
        return opposite >= 0 && opposite < this.pathData.length ? opposite : -1;
    }

    private translate(index: number, dx: number, dy: number): void {
        this.pathData[index][0] += dx;
        this.pathData[index][1] += dy;
    }

    /** Moves an anchor along with its two handles. */
    private moveAnchor(anchor: number, dx: number, dy: number): void {
        for (let i = anchor - 1; i <= anchor + 1; i++) {
            if (i >= 0 && i < this.pathData.length) this.translate(i, dx, dy);
        }
    }

    /** Rotates the opposite handle so it stays collinear with `handle`, keeping its own length. */
    private mirrorOpposite(handle: number): void {
        const opposite = this.oppositeOf(handle);
        const a = this.pathData[this.anchorOf(handle)];
        const h = this.pathData[handle];
        const length = dist(h, a);
        if (opposite < 0 || length === 0) return;
        const oppositeLength = dist(this.pathData[opposite], a);
        this.pathData[opposite] = [a[0] - (h[0] - a[0]) / length * oppositeLength, a[1] - (h[1] - a[1]) / length * oppositeLength];
    }

    /** True when the two handles of an anchor form a straight, opposite-facing tangent. */
    private isSmooth(handle: number): boolean {
        const opposite = this.oppositeOf(handle);
        if (opposite < 0) return false;
        const a = this.pathData[this.anchorOf(handle)];
        const v = this.pathData[handle];
        const w = this.pathData[opposite];
        const [vx, vy, wx, wy] = [v[0] - a[0], v[1] - a[1], w[0] - a[0], w[1] - a[1]];
        const norm = Math.hypot(vx, vy) * Math.hypot(wx, wy);
        if (norm < 1e-9) return false;
        return Math.abs(vx * wy - vy * wx) / norm < COLLINEAR_TOLERANCE && vx * wx + vy * wy < 0;
    }

    private bezierAt(segment: number, t: number): Coordinate {
        const [p0, p1, p2, p3] = this.pathData.slice(segment * 3, segment * 3 + 4);
        const u = 1 - t;
        const at = (i: 0 | 1) => u ** 3 * p0[i] + 3 * u ** 2 * t * p1[i] + 3 * u * t ** 2 * p2[i] + t ** 3 * p3[i];
        return [at(0), at(1)];
    }

    /** Closest point of the curve to `pos`: segment index, parameter t in that segment and the point itself. */
    private nearest(pos: Coordinate): { segment: number; t: number; point: Coordinate } {
        let best = { segment: 0, t: 0, point: this.pathData[0], d: Infinity };
        const test = (segment: number, t: number) => {
            const point = this.bezierAt(segment, t);
            const d = dist(point, pos);
            if (d < best.d) best = { segment, t, point, d };
        };
        const segments = (this.pathData.length - 1) / 3;
        for (let s = 0; s < segments; s++) {
            for (let i = 0; i <= SAMPLES; i++) test(s, i / SAMPLES);
        }
        const { segment, t } = best;
        for (let i = -8; i <= 8; i++) test(segment, Math.min(1, Math.max(0, t + i / 8 / SAMPLES)));
        return best;
    }

    // De Casteljau split of a cubic segment at t into two cubics
    private splitSegment(segment: number, t: number): [BezierCurve, BezierCurve] {
        const [p0, p1, p2, p3] = this.pathData.slice(segment * 3, segment * 3 + 4) as BezierCurve;
        const a = lerp(p0, p1, t);
        const b = lerp(p1, p2, t);
        const c = lerp(p2, p3, t);
        const d = lerp(a, b, t);
        const e = lerp(b, c, t);
        const f = lerp(d, e, t);
        return [[p0, a, d, f], [f, e, c, p3]];
    }

    // --- editing operations ---

    private insertPoint(pos: Coordinate): void {
        const { segment, t } = this.nearest(pos);
        const [first, second] = this.splitSegment(segment, Math.min(0.98, Math.max(0.02, t)));
        this.pathData.splice(segment * 3 + 1, 3, first[1], first[2], first[3], second[1], second[2], second[3]);
        this.selected = (segment + 1) * 3;
        this.rebuild();
        this.commit();
    }

    private deletePoint(anchor: number): void {
        const n = this.pathData.length;
        if (n <= 4) {
            // fewer than 2 anchors would remain: delete the whole path
            this.pathElem.remove();
            this.cleanup();
            this.onFinish(null);
            return;
        }
        // drop the anchor with its handles, keeping the outer handles of the neighbouring segments
        this.pathData.splice(anchor === 0 ? 0 : anchor === n - 1 ? n - 3 : anchor - 1, 3);
        this.selected = null;
        this.rebuild();
        this.commit();
    }

    /** Corner: both handles collapse on the anchor. Smooth: handles are re-created along the neighbours' direction. */
    private toggleSmooth(anchor: number): void {
        const pd = this.pathData;
        const prev = anchor >= 3 ? pd[anchor - 3] : null;
        const next = anchor + 3 < pd.length ? pd[anchor + 3] : null;
        const handles = [anchor - 1, anchor + 1].filter(i => i >= 0 && i < pd.length);
        const isCorner = handles.every(i => dist(pd[i], pd[anchor]) < 1e-6);

        if (!isCorner) {
            handles.forEach(i => (pd[i] = [pd[anchor][0], pd[anchor][1]]));
        } else {
            const a = pd[anchor];
            const dir: Coordinate = prev && next ? [next[0] - prev[0], next[1] - prev[1]] : next ? [next[0] - a[0], next[1] - a[1]] : [a[0] - prev![0], a[1] - prev![1]];
            const norm = Math.hypot(dir[0], dir[1]);
            if (norm === 0) return;
            const unit = [dir[0] / norm, dir[1] / norm];
            if (next) { const l = dist(a, next) / 3; pd[anchor + 1] = [a[0] + unit[0] * l, a[1] + unit[1] * l]; }
            if (prev) { const l = dist(a, prev) / 3; pd[anchor - 1] = [a[0] - unit[0] * l, a[1] - unit[1] * l]; }
        }
        this.render();
        this.commit();
    }

    // --- mouse / keyboard interactions ---

    private pointerPos(e: MouseEvent): Coordinate {
        return pointer(e, this.group) as Coordinate;
    }

    private startDrag(e: MouseEvent, kind: Drag['kind'], index = 0, mirror = false): void {
        const start = this.pointerPos(e);
        this.drag = { kind, index, startClient: [e.clientX, e.clientY], start, last: start, moved: false, mirror };
        this.hideGhost();
    }

    private onAnchorMouseDown(e: MouseEvent, index: number): void {
        if (e.button !== 0) return;
        e.stopPropagation();
        e.preventDefault();
        if (e.ctrlKey) return this.deletePoint(index);
        this.select(index);
        this.startDrag(e, 'point', index);
    }

    private onHandleMouseDown(e: MouseEvent, index: number): void {
        if (e.button !== 0) return;
        e.stopPropagation();
        e.preventDefault();
        this.startDrag(e, 'point', index, !e.altKey && this.isSmooth(index));
    }

    private onHitMouseDown = (e: MouseEvent): void => {
        if (e.button !== 0) return;
        e.stopPropagation();
        e.preventDefault();
        if (e.ctrlKey) return this.insertPoint(this.pointerPos(e));
        this.startDrag(e, 'path');
    };

    private onHitMouseMove = (e: MouseEvent): void => {
        if (this.drag) return;
        const [x, y] = this.nearest(this.pointerPos(e)).point;
        this.ghost.setAttribute('cx', String(x));
        this.ghost.setAttribute('cy', String(y));
        this.ghost.removeAttribute('display');
    };

    private hideGhost = (): void => {
        this.ghost.setAttribute('display', 'none');
    };

    private onEmptyMouseDown = (): void => {
        this.select(null);
    };

    private onWindowMouseMove = (e: MouseEvent): void => {
        const drag = this.drag;
        if (!drag) return;
        if (!drag.moved) {
            if (Math.hypot(e.clientX - drag.startClient[0], e.clientY - drag.startClient[1]) < DRAG_THRESHOLD) return;
            drag.moved = true;
        }
        const pos = this.pointerPos(e);
        const dx = pos[0] - drag.last[0];
        const dy = pos[1] - drag.last[1];
        drag.last = pos;

        if (drag.kind === 'path') {
            this.pathData.forEach((_, i) => this.translate(i, dx, dy));
        } else if (isAnchor(drag.index)) {
            this.moveAnchor(drag.index, dx, dy);
        } else {
            this.translate(drag.index, dx, dy);
            if (drag.mirror) this.mirrorOpposite(drag.index);
        }
        this.render();
    };

    private onWindowMouseUp = (): void => {
        const drag = this.drag;
        this.drag = null;
        if (!drag) return;
        if (drag.moved) this.commit();
        else if (drag.kind === 'path') this.insertPoint(drag.start);
    };

    private onKeyDown = (e: KeyboardEvent): void => {
        if (isTextTarget(e) || e.ctrlKey || e.metaKey) return;
        if (e.key === 'Enter') return this.finish();
        if (this.selected === null) return;
        const step = e.shiftKey ? 10 : 1;
        const arrows: Record<string, Coordinate> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
        if (e.key === 'Delete' || e.key === 'Backspace') {
            e.preventDefault();
            this.deletePoint(this.selected);
        } else if (arrows[e.key]) {
            e.preventDefault();
            this.moveAnchor(this.selected, ...arrows[e.key]);
            this.render();
        }
    };

    private onKeyUp = (e: KeyboardEvent): void => {
        if (e.key.startsWith('Arrow')) this.commit();
    };
}
