import type { Coords } from "src/types";
import type { Projection } from "./paths";

const domParser = new DOMParser();

// remove buggy paths, covering the whole svg element
export function removeCoveringAll(groupElement: SVGGElement | null): void {
    if (!groupElement) return;
    const parent = groupElement.closest('svg');
    if (!parent) return;
    const containerRect = parent.getBoundingClientRect();
    for (const child of Array.from(groupElement.children)) {
        if (child.tagName !== 'path') continue;
        const d = child.getAttribute('d');
        // ignore empty path, and big ones (that actually draw something)
        if (!d || d.length > 100) continue;
        const rect = (child as SVGPathElement).getBoundingClientRect();
        const includes = rect.x <= containerRect.x && rect.right >= containerRect.right
            && rect.y <= containerRect.y && rect.bottom >= containerRect.bottom;
        if (includes) {
            console.log('removing', child);
            child.remove();
        }
    }
}

export function distance(p1: DOMPoint, p2: DOMPoint): number {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    return Math.sqrt(dx * dx + dy * dy);
}

export function closestDistance(point: DOMPoint, pathElem: SVGPathElement): { distance: number; point: DOMPoint; advancement: number } {
    const pathLength = pathElem.getTotalLength();
    const delta = 10;
    const nbSample = Math.ceil(pathLength / delta);
    let minDist = Number.MAX_SAFE_INTEGER;
    let minDistPoint: DOMPoint | undefined;
    let advancement = 0;
    for (let i = 0; i < nbSample; i++) {
        const pathPoint = pathElem.getPointAtLength(i * delta);
        const dist = distance(pathPoint, point);
        if (dist < minDist) {
            minDist = dist;
            minDistPoint = pathPoint;
            advancement = (i * delta) / pathLength;
        }
    }
    return { distance: minDist, point: minDistPoint!, advancement };
}

export function setTransformScale(el: SVGElement, scaleStr: string): void {
    const existingTransform = el.getAttribute('transform');
    if (!existingTransform) {
        el.setAttribute("transform", scaleStr);
    } else if (existingTransform.length && !existingTransform.includes('scale')) {
        el.setAttribute("transform", `${existingTransform} ${scaleStr}`);
    } else {
        const newAttr = existingTransform.replace(/scale\(.*?\)/, scaleStr);
        el.setAttribute("transform", newAttr);
    }
}

export function getTranslateFromTransform(el: SVGElement): Coords | null {
    const existingTransform = el.getAttribute('transform');
    if (!existingTransform) return null;
    const matched = existingTransform.match(/([\-0-9\.]+),? ([\-0-9\.]+)/);
    if (matched && matched.length === 3) return [parseFloat(matched[1]), parseFloat(matched[2])];
    return null;
}

export function setTransformTranslate(el: SVGElement, translateStr: string): void {
    const existingTransform = el.getAttribute('transform');
    if (!existingTransform) {
        el.setAttribute("transform", translateStr);
    } else if (existingTransform.length && !existingTransform.includes('translate')) {
        el.setAttribute("transform", `${translateStr} ${existingTransform}`);
    } else {
        const newAttr = existingTransform.replace(/translate\(.*?\)/, translateStr);
        el.setAttribute("transform", newAttr);
    }
}

export function createSvgFromPart(partStr: string): SVGElement {
    const svgStr = `<svg xmlns="http://www.w3.org/2000/svg">${partStr}</svg>`;
    const parsed = domParser.parseFromString(svgStr, 'text/html').body.childNodes[0];
    return parsed?.firstChild as SVGElement;
}

export function duplicateContourCleanFirst(svgElem: SVGSVGElement): void {
    Array.from(svgElem.querySelectorAll('.contour-to-dup[filter]')).forEach(el => el.remove());
    duplicateContours(svgElem);
}

/** Duplicate contour <image> tags, that only contain stroke, to have a new one with a fill and a filter applied */
export function duplicateContours(svgElem: SVGSVGElement): void {
    Array.from(svgElem.querySelectorAll('.contour-to-dup')).forEach(el => {
        if (!el.hasAttribute('filter-name')) return;
        const clone = el.cloneNode() as SVGElement;
        const href = el.getAttribute('href');
        if (href) {
            clone.setAttribute('href', href.replace(`fill='none'`, ''));
        }
        const filterName = el.getAttribute('filter-name');
        if (filterName) {
            clone.setAttribute('filter', `url(#${filterName})`);
        }
        // set opacity to 0 once to initiate transition
        (clone.style as CSSStyleDeclaration).opacity = '0';
        setTimeout(() => {
            (clone.style as CSSStyleDeclaration).opacity = '1';
        }, 0);
        el.parentNode?.insertBefore(clone, el);
    });
}

export function pathStringFromParsed(parsedD: [string, ...number[]][], projection: Projection): string {
    return parsedD.reduce((d, curGroup) => {
        const [instruction, ...data] = curGroup;
        let newData = '';
        for (let i = 0; i < data.length; i += 2) {
            newData += projection([data[i], data[i + 1]]) + ' ';
        }
        d += `${instruction}${newData}`;
        return d;
    }, '');
}
