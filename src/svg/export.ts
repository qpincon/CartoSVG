import svgoConfig from '../svgoExport.config';
import svgoConfigText from '../svgoExportText.config';

import { imageFromSpecialGElemStr, encodeSVGDataImageStr } from './contourMethods';
import { htmlToElement } from '../util/common';
import { indexBy, pick, download, discriminateCssForExport } from '../util/common';
import { reportStyle, reportStyleElem, fontsToCss, getUsedInlineFonts } from '../util/dom';
import { type Selection } from 'd3-selection';
import type { Config } from 'svgo/browser';

export interface ProvidedFont {
    name: string;
    content: string;
}

interface TooltipDefinition {
    enabled: boolean;
    content: string;
    template: string;
}

interface TooltipDefinitions {
    [groupId: string]: TooltipDefinition;
}

interface ColumnDefinition {
    column: string;
}

interface ZoneDataRow {
    name: string;
    [key: string]: any;
}

interface ZoneData {
    data: ZoneDataRow[];
    numericCols: ColumnDefinition[];
    formatters: { [column: string]: (value: any) => string };
}

interface ZonesData {
    [groupId: string]: ZoneData;
}

interface ExportOptions {
    exportFonts?: ExportFontChoice;
    hideOnResize?: boolean;
    minifyJs?: boolean;
}

interface Position {
    x: number;
    y: number;
}

interface TransformedTexts {
    [fontFamily: string]: {
        [text: string]: string;
    };
}

interface FinalDataByGroup {
    data: { [groupId: string]: { [shapeId: string]: any } };
    tooltips: { [groupId: string]: string };
}

interface Tooltip {
    shapeId: string | null;
    element: SVGForeignObjectElement | null;
}

// Enums and constants
const domParser = new DOMParser();

export const rgb2hex = (rgb: string): string =>
    `#${rgb.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/)!.slice(1).map(n => parseInt(n, 10).toString(16).padStart(2, '0')).join('')}`;

export function isHexColor(hex: string): boolean {
    return (hex.length === 6 || hex.length === 3 || hex.length === 8) && !isNaN(Number('0x' + hex));
}

export const replaceReferenceValue = (value: string, prefix: string): string | undefined => {
    let newValue: string | undefined;
    // discriminate colors in hex notation
    if (value[0] === '#' && !isHexColor(value.slice(1))) {
        newValue = `#${prefix}-${value.slice(1)}`;
    }
    if (value.slice(0, 3) === 'url') {
        const existing = value.match(/url\(\"?#(.*?)\"?\)/)?.[1];
        if (existing) {
            newValue = `url("#${prefix}-${existing}")`;
        }
    }
    return newValue;
};

export enum ExportFontChoice {
    noExport = 0,
    convertToPath = 1,
    embedFont = 2,
    smallest = 3,
}

export const exportFontChoices = Object.freeze(ExportFontChoice);

const domBaselineToBaseline: Record<string, string> = {
    hanging: "top",
    auto: "middle",
    middle: "middle",
    "text-top": "bottom"
};

const anchorToAnchor: Record<string, string> = {
    left: 'left',
    middle: 'center',
    right: 'right'
};

export const additionnalCssExport = '#points-labels {pointer-events:none}';
const cssFontProps = ['font-family', 'font-size', 'font-weight', 'color'];

export function getTextElems(svgElem: SVGElement): Element[] {
    const texts = Array.from(svgElem.querySelectorAll('text')).concat(Array.from(svgElem.querySelectorAll('tspan')));
    // ignore text elements containing tspans
    return texts.filter(t => !(t.tagName === 'text' && (t.firstChild as Element)?.tagName === 'tspan'));
}

export function getInlineStyle(el: Element, defaultStyles: CSSStyleDeclaration, propName: string): string {
    const isTspan = el.tagName === 'tspan';
    const elementStyle = (el as HTMLElement).style;
    const parentStyle = isTspan ? (el.parentNode as HTMLElement)?.style : null;
    return elementStyle[propName as any] || parentStyle?.[propName as any] || defaultStyles.getPropertyValue(propName);
}

export function replaceTextsWithPaths(svgElem: SVGElement, transformedTexts: TransformedTexts): void {
    const defaultStyles = getComputedStyle(document.body);
    const texts = getTextElems(svgElem);

    texts.forEach(textElem => {
        const fontFamily = getInlineStyle(textElem, defaultStyles, 'font-family');
        const text = textElem.textContent?.trim() || '';
        const transformed = transformedTexts[fontFamily]?.[text];
        if (!transformed) return;

        const pathElem = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        pathElem.setAttribute('d', transformed);
        reportStyleElem(textElem, pathElem);

        if (textElem.tagName === 'tspan') {
            textElem.parentNode?.parentNode?.appendChild(pathElem);
            if (textElem.parentNode) {
                reportStyleElem(textElem.parentNode as Element, pathElem);
            }
            textElem.remove();
        } else {
            textElem.replaceWith(pathElem);
        }

        // no need to keep font-xxx properties on a path
        cssFontProps.forEach(prop => (pathElem.style as any).removeProperty(prop));
    });

    // Remove now empty <text>s
    svgElem.querySelectorAll('text:empty').forEach(el => el.remove());
}

export function getTextPosition(textElem: Element, defaultStyles: CSSStyleDeclaration): Position {
    const getShift = (elem: Element, attr: string): number => {
        const fontSize = parseFloat(getInlineStyle(elem, defaultStyles, 'font-size'));
        const delta = elem.getAttribute(attr);
        if (delta && delta.includes('em')) return parseFloat(delta) * fontSize;
        return 0;
    };

    const getPos = (elem: Element, direction: 'x' | 'y'): number => {
        let attributes = { delta: 'dx', pos: 'x' };
        if (direction === 'y') attributes = { delta: 'dy', pos: 'y' };

        let pos = parseFloat(elem.getAttribute(attributes.pos) || '0') || 0;
        pos += getShift(elem, attributes.delta);
        let prevSibling = elem.previousSibling;

        // if "y" is omitted, "dy" is cumulative
        while (prevSibling !== null && !(prevSibling as Element).hasAttribute?.(attributes.pos)) {
            pos += getShift(prevSibling as Element, attributes.delta);
            prevSibling = prevSibling.previousSibling;
        }
        return pos;
    };

    const x = getPos(textElem, 'x');
    const y = getPos(textElem, 'y');
    return { x, y };
}

export async function inlineFontVsPath(
    svgElem: SVGElement,
    providedFonts: ProvidedFont[],
    exportFontsOption: ExportFontChoice
): Promise<boolean> {
    let nbFontChars = 0;
    let nbPathChars = 0;
    const transformedTexts: TransformedTexts = {};
    const SVGO = await import('svgo/browser');
    const TextToSVG = (await import('text-to-svg')).default;
    const defaultStyles = getComputedStyle(document.body);

    await Promise.all(providedFonts.map(({ name, content }) => {
        transformedTexts[name] = {};
        nbFontChars += content.length;
        const texts = getTextElems(svgElem);

        return new Promise<void>(resolve => {
            TextToSVG.load(content, function (err: any, textToSVG: any) {
                texts.forEach(textElem => {
                    if (textElem.tagName === 'text' && (textElem.firstChild as Element)?.tagName === 'tspan') return;

                    const fontFamily = getInlineStyle(textElem, defaultStyles, 'font-family');
                    if (fontFamily === name) {
                        const text = textElem.textContent?.trim() || '';
                        const anchor = anchorToAnchor[textElem.getAttribute('text-anchor') || ''] || 'left';
                        const baseline = domBaselineToBaseline[textElem.getAttribute('dominant-baseline') || ''] || 'baseline';
                        const fontSize = parseFloat(getInlineStyle(textElem, defaultStyles, 'font-size'));
                        const { x, y } = getTextPosition(textElem, defaultStyles);

                        const options = {
                            x: x,
                            y: y,
                            fontSize: fontSize,
                            anchor: `${anchor} ${baseline}`
                        };

                        let path = textToSVG.getD(text, options);
                        const tmpSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                        const tmpPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                        tmpPath.setAttribute('d', path);
                        tmpSvg.append(tmpPath);

                        const optimized = domParser.parseFromString(SVGO.optimize(tmpSvg.outerHTML, svgoConfigText as Config).data, 'image/svg+xml');
                        path = optimized.querySelector('path')?.getAttribute('d');
                        if (!path) return;

                        transformedTexts[name][text] = path;
                        nbPathChars += path.length;
                    }
                });
                resolve();
            });
        });
    }));

    const pathIsBetter = nbPathChars + 10000 < nbFontChars;
    if (exportFontsOption === ExportFontChoice.convertToPath || pathIsBetter) {
        replaceTextsWithPaths(svgElem, transformedTexts);
        return true;
    }
    return false;
}

const urlUsingAttributes = ['marker-start', 'marker-mid', 'marker-end', 'clip-path', 'fill', 'filter', '*|href'];

export function changeIdAndReferences(exportedMapElem: Element, newMapId: string): void {
    // change SVG definitions IDs
    exportedMapElem.querySelectorAll('defs > [id], #paths > [id]').forEach(elem => {
        const existingId = elem.getAttribute('id');
        if (existingId) {
            elem.setAttribute('id', `${newMapId}-${existingId}`);
        }
    });

    // change image-filter-name special attribute for contours
    exportedMapElem.querySelectorAll('[image-filter-name]').forEach(elem => {
        const existingFilterName = elem.getAttribute('image-filter-name');
        if (existingFilterName) {
            elem.setAttribute('image-filter-name', `${newMapId}-${existingFilterName}`);
        }
    });

    // change inline styles with url(#...)
    exportedMapElem.querySelectorAll('[style*="url"]').forEach(elem => {
        const computed = window.getComputedStyle(elem as Element);
        const elementStyle = (elem as HTMLElement).style;

        for (const prop of elementStyle) {
            const propValue = computed[prop as any];
            if (!propValue?.includes('url')) continue;
            const newValue = replaceReferenceValue(propValue, newMapId);
            if (newValue) elementStyle[prop as any] = newValue;
        }
    });

    // change SVG elements attributes that could contain a reference to another element
    exportedMapElem.querySelectorAll(urlUsingAttributes.map(x => `[${x}]`).join(',')).forEach(elem => {
        for (const attributeName of urlUsingAttributes) {
            let attributesToCheck = [attributeName];
            if (attributeName.includes('href')) attributesToCheck = ['href', 'xlink:href'];

            for (const finalAttributeName of attributesToCheck) {
                const attribute = elem.getAttribute(finalAttributeName);
                if (!attribute) continue;
                const newValue = replaceReferenceValue(attribute, newMapId);
                if (newValue) elem.setAttribute(finalAttributeName, newValue);
            }
        }
    });
}

export function getIntersectionObservingPart(isMacro: boolean): string {
    const intersectionObservingPart = `
        const observerOptions = {
            root: null,
            rootMargin: "0px",
            threshold: 0.3,
        };
        mapElement.style['visibility'] = 'hidden';
        let rendered = false;
        function intersectionCallback(entries) {
            if (rendered || !entries[0].isIntersecting) return;
            rendered = true;
            // add some delay to ensure the map is in the viewport
            setTimeout(() => {
                mapElement.style['visibility'] = 'visible';
                mapElement.classList.add('animate');
                mapElement.querySelectorAll('path').forEach(pathElem => {
                    pathElem.setAttribute('pathLength', 1);
                });
                setTimeout(() => {
                    mapElement.classList.add('animate-transition');
                }, 1000);
                mapElement.querySelector('#frame').addEventListener('animationend', () => {
                    mapElement.classList.remove('animate');
                    ${isMacro ? 'gElemsToImages(true);' : ''}
                    mapElement.querySelectorAll('path[pathLength]').forEach(el => {el.removeAttribute('pathLength')});
                    setTimeout(() => {
                        mapElement.classList.remove('animate-transition');
                    }, 1000);
                });
            }, 500);
        }
        const observer = new IntersectionObserver(intersectionCallback, observerOptions);
        observer.observe(mapElement);
    `;

    if (isMacro) return intersectionObservingPart;
    return `
    const allScripts = document.getElementsByTagName('script');
    const scriptTag = allScripts[allScripts.length - 1];
    const mapElement = scriptTag.parentNode;
    ${intersectionObservingPart}
    `;
}

export async function exportSvg(
    svg: Selection<SVGSVGElement, unknown, null, undefined>,
    width: number,
    height: number,
    tooltipDefs: TooltipDefinitions,
    chosenCountries: string[],
    zonesData: ZonesData,
    providedFonts: ProvidedFont[],
    downloadExport: boolean = true,
    commonCss: string,
    animated: boolean,
    options: ExportOptions = {}
): Promise<string | void> {
    const {
        exportFonts = ExportFontChoice.convertToPath,
        hideOnResize = false,
        minifyJs = false
    } = options;

    const fo = svg.select('foreignObject').node();
    // remove foreign object from dom when exporting
    if (fo) document.body.append(fo as Node);
    const svgNode = svg.node()!;

    // === Remove contours images (keep only <g> element to duplicate afterwards) ==
    let contours = Array.from(svgNode.querySelectorAll('image.contour-to-dup'));
    const contoursWithParents: [Element, Element][] = contours.map(el => {
        const parent = el.parentNode as Element;
        document.body.append(el);
        return [el, parent];
    });

    /** Add an element using the SVG filter, otherwise it gets removed by SVGO as it's never used directly but later in JS*/
    svgNode.querySelectorAll('[image-filter-name]').forEach(elem => {
        const filterName = elem.getAttribute('image-filter-name');
        if (filterName) {
            const emptyElementTrickSvgo = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            emptyElementTrickSvgo.classList.add('svgo-trick');
            emptyElementTrickSvgo.setAttribute('filter', `url(#${filterName})`);
            svgNode.append(emptyElementTrickSvgo);
        }
    });
    // === End remove contours ==

    const usedFonts = getUsedInlineFonts(svgNode);
    const usedProvidedFonts = providedFonts.filter(font => usedFonts.has(font.name));

    const SVGO = await import('svgo/browser');

    // Optimize whole SVG
    const finalSvg = SVGO.optimize(svgNode.outerHTML, svgoConfig as Config).data;

    // === re-insert tooltip and contours ===
    if (fo) svg.node()!.append(fo as Node);
    contoursWithParents.forEach(([el, parent]) => {
        parent.insertBefore(el, parent.firstChild);
    });
    svgNode.querySelectorAll('.svgo-trick').forEach(el => el.remove());
    // === End re-insertion === 

    const optimizedSVG = domParser.parseFromString(finalSvg, 'image/svg+xml');
    optimizedSVG.querySelectorAll('.svgo-trick').forEach(el => el.remove());

    let pathIsBetter = false;
    if (exportFonts === ExportFontChoice.smallest || exportFonts === ExportFontChoice.convertToPath) {
        pathIsBetter = await inlineFontVsPath(optimizedSVG.firstChild as SVGElement, providedFonts, exportFonts);
    } else if (exportFonts === ExportFontChoice.noExport) {
        pathIsBetter = true;
    }

    const finalDataByGroup: FinalDataByGroup = { data: {}, tooltips: {} };
    let tooltipEnabled = false;

    [...chosenCountries, 'countries'].forEach(groupId => {
        const group = optimizedSVG.getElementById(groupId);
        if (!group || !tooltipDefs[groupId]?.enabled) return;

        tooltipEnabled = true;
        const ttTemplate = getFinalTooltipTemplate(groupId, tooltipDefs);
        let usedVars = [...ttTemplate.matchAll(/\{(\w+)\}/g)].map(group => group[1]);
        usedVars = [...new Set(usedVars)];
        usedVars = usedVars.filter(v => v !== 'name');

        let functionStr = ttTemplate.replaceAll(/\{(\w+)\}/gi, '${data.$1}');
        functionStr = functionStr.replace('data.name', 'shapeId');
        finalDataByGroup.tooltips[groupId] = functionStr;

        const zonesDataDup = JSON.parse(JSON.stringify(zonesData[groupId].data));
        zonesData[groupId].numericCols.forEach(colDef => {
            const col = colDef.column;
            zonesDataDup.forEach((row: any) => {
                row[col] = zonesData[groupId].formatters[col](row[col]);
            });
        });

        const indexed = indexBy(zonesDataDup, 'name');
        const finalData: { [shapeId: string]: any } = {};

        for (const child of group.children) {
            const id = child.getAttribute('id');
            if (!id || !indexed[id]) continue;
            // @ts-ignore
            finalData[id] = pick(indexed[id], usedVars);
        }
        finalDataByGroup.data[groupId] = finalData;
    });

    const onResize = hideOnResize ? `
    let resizeTimeout;
    const contentSvg = mapElement.querySelector('svg');
    window.addEventListener('resize', e => {
        contentSvg.style.display = "none"; clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => { contentSvg.style.display = 'block' }, 300);
    });` : '';

    const onMouseEvents = `
        mapElement.addEventListener('mousemove', (e) => {
            ${tooltipEnabled ? 'onMouseMove(e);' : ''}
            const parent = e.target.parentNode;
            if (e.target.tagName === 'path' && parent.tagName === 'g') {
                if (e.target.previousPos === undefined) e.target.previousPos = Array.from(parent.children).indexOf(e.target);
                if (e.target !== parent.lastElementChild) {
                    parent.append(e.target);
                    e.target.classList.add('hovered');
                }
            } 
        });

        mapElement.addEventListener('mouseout', (e) => {
            e.target.classList.remove('hovered');
            const previousPos = e.target.previousPos;
            if (previousPos) {
                const parent = e.target.parentNode;
                parent.insertBefore(e.target, parent.children[previousPos]);
            }
        });
    `;

    const tooltipCode = tooltipEnabled ? `
    const parser = new DOMParser();
    const width = ${width}, height = ${height};
    const inverseScreenCTM = mapElement.getScreenCTM().inverse();
    const tooltip = {shapeId: null, element: null};
    tooltip.element = constructTooltip({}, '', 1, 1);
    mapElement.append(tooltip.element);
    tooltip.element.style.display = 'none';
    const dataByGroup = ${JSON.stringify(finalDataByGroup)};
    function constructTooltip(data, templateStr, shapeId, scaleX, scaleY) {
        if(!data) return;
        const elem = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
        elem.setAttribute('width', 1);
        elem.setAttribute('height', 1);
        elem.style.overflow = 'visible';
        const parsed = parser.parseFromString(eval('\`' + templateStr + '\`' ), 'text/html').querySelector('body');
        const container = document.createElementNS('http://www.w3.org/1999/xhtml', 'div')
        container.style['position'] = 'fixed'; 
        container.classList.add('.body');
        container.append(parsed.firstChild);
        elem.appendChild(container);
        return elem;
    }
    mapElement.addEventListener('mouseleave', hideTooltip);

    function hideTooltip() {
        tooltip.element.style.display = 'none';
        tooltip.element.style.opacity = 0;
    }

    function onMouseMove(e) {
        const parent = e.target.parentNode;
        if (!parent?.hasAttribute?.("id")) return hideTooltip();
        const mapBounds = mapElement.querySelector('#frame').getBoundingClientRect();
        const scaleX = width / mapBounds.width;
        const scaleY = height / mapBounds.height;
        const ttBounds = tooltip.element.firstChild?.firstChild?.getBoundingClientRect?.();
        let posX = (e.clientX - mapBounds.left + 10) * scaleX, posY = (e.clientY - mapBounds.top + 10) * scaleY;
        let tooltipVisibleOpacity = 1;
        const groupId = parent.getAttribute('id');
        const shapeId = e.target.getAttribute('id');
        if (ttBounds?.width > 0) {
            if (mapBounds.right - ttBounds.width < e.clientX + 10) {
                posX = (e.clientX - mapBounds.left - ttBounds.width - 20) * scaleX;
            }
            if (mapBounds.bottom - ttBounds.height < e.clientY + 10) {
                posY = (e.clientY - mapBounds.top - ttBounds.height - 20) * scaleY;
            }
        }
        else if (shapeId && groupId in dataByGroup.data) {
            tooltipVisibleOpacity = 0;
            setTimeout(() => {
                onMouseMove(e);
            }, 0);
        }
        if (!(groupId in dataByGroup.data)) {
            hideTooltip();
        }
        else if (shapeId && tooltip.shapeId === shapeId) {
            tooltip.element.setAttribute('x', posX);
            tooltip.element.setAttribute('y', posY);
            // webkit positioning fix
            tooltip.element.firstChild.style['position'] = 'absolute';
            setTimeout(() => {tooltip.element.firstChild.style['position'] = 'fixed'}, 0)
            tooltip.element.style.display = 'block';
            tooltip.element.style.opacity = tooltipVisibleOpacity;
        }
        else {
            const data = dataByGroup.data[groupId][shapeId];
            if (!data) {
                tooltip.element.style.display = 'none';
                return;
            }
            const tt = constructTooltip(data, dataByGroup.tooltips[groupId], shapeId, scaleX, scaleY);
            tooltip.element.replaceWith(tt);
            tooltip.element = tt;
            tooltip.shapeId = shapeId;
            tooltip.element.setAttribute('x', posX);
            tooltip.element.setAttribute('y', posY);
            tooltip.element.style.opacity = tooltipVisibleOpacity;
        }
    }` : '';

    let finalScript = `
    (function() {
        ${encodeSVGDataImageStr}
        function duplicateContours(svgElem, transition=false) {
            Array.from(svgElem.querySelectorAll('.contour-to-dup')).forEach(el => {
                if (!el.hasAttribute('filter-name')) return;
                const clone = el.cloneNode();
                clone.setAttribute('href', el.getAttribute('href').replace(\`fill='none'\`, ''))
                clone.setAttribute('filter', \`url(#\${el.getAttribute('filter-name')})\`);
                if (transition) {
                    clone.style['opacity'] = 0;
                    setTimeout(() => {
                        clone.style['opacity'] = 1;
                    }, 0);
                }
                el.parentNode.insertBefore(clone, el);
            });
        }
        const allScripts = document.getElementsByTagName('script');
        const scriptTag = allScripts[allScripts.length - 1];
        const mapElement = scriptTag.parentNode;

        function gElemsToImages(transition=false) {
            const toTransformToImg = mapElement.querySelectorAll('g[image-class]');
            toTransformToImg.forEach(gElem => {
                const image = ${imageFromSpecialGElemStr}(gElem);
                gElem.parentNode.append(image);
                if (transition) {
                    setTimeout(() => {
                        gElem.remove();
                    }, 500);
                }
                else gElem.remove();
            });
            duplicateContours(mapElement, transition);
        }
        ${onResize}
        ${tooltipCode}
        ${onMouseEvents}
        ${animated ? getIntersectionObservingPart(true) : 'gElemsToImages()'}
    })()
        `;

    // === Styling ===
    const styleElem = document.createElementNS("http://www.w3.org/2000/svg", 'style');
    const renderedCss = commonCss.replaceAll(/rgb\(.*?\)/g, rgb2hex) + additionnalCssExport;
    const { mapId, finalCss } = discriminateCssForExport(renderedCss);
    (optimizedSVG.firstChild as Element).setAttribute('id', mapId);
    changeIdAndReferences(optimizedSVG.firstChild as Element, mapId);
    // === End styling ===

    styleElem.innerHTML = pathIsBetter ? finalCss : finalCss + fontsToCss(usedProvidedFonts);
    (optimizedSVG.firstChild as Element)!.append(styleElem);
    (optimizedSVG.firstChild as Element).classList.remove('animate-transition');
    (optimizedSVG.firstChild as Element).classList.add('cartosvg');

    if (!downloadExport) return (optimizedSVG.firstChild as Element).outerHTML;

    if (minifyJs !== false) {
        const terser = await import('terser');
        const minified = await terser.minify(finalScript, {
            toplevel: true,
            mangle: { eval: true, reserved: ['data', 'shapeId'] }
        });
        finalScript = minified.code || finalScript;
    }

    const scriptElem = document.createElementNS("http://www.w3.org/2000/svg", 'script');
    const scriptContent = document.createTextNode(finalScript);
    scriptElem.appendChild(scriptContent);
    (optimizedSVG.firstChild as Element)!.append(scriptElem);
    download((optimizedSVG.firstChild as Element).outerHTML, 'text/plain', 'cartosvg-export.svg');
}

export function getFinalTooltipTemplate(groupId: string, tooltipDefs: TooltipDefinitions): string {
    const finalReference = htmlToElement(tooltipDefs[groupId].content)!;
    const finalTemplate = finalReference.cloneNode(true) as Element;
    finalTemplate.innerHTML = tooltipDefs[groupId].template;
    reportStyle(finalReference, finalTemplate);
    return finalTemplate.outerHTML;
}
