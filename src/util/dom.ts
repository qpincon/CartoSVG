import { setTransformScale } from "../svg/svg";

type Font = { name: string; content: string };
export type InlineStyles = Record<string, Record<string, string | number | null>>;

export function reportStyle(reference: Element, target: Element): void {
    const walkerRef = document.createTreeWalker(reference, NodeFilter.SHOW_ELEMENT);
    const walkerTarget = document.createTreeWalker(target, NodeFilter.SHOW_ELEMENT);
    reportStyleElem(walkerRef.currentNode as Element, walkerTarget.currentNode as Element);
    while (walkerRef.nextNode()) {
        walkerTarget.nextNode();
        reportStyleElem(walkerRef.currentNode as Element, walkerTarget.currentNode as Element);
    }
}

export function reportStyleElem(ref: Element, target: Element): void {
    const refStyle = ref.getAttribute('style');
    if (refStyle && refStyle !== "null") {
        target.setAttribute('style', refStyle);
    }
    const transform = ref.getAttribute('transform');
    if (transform && transform !== "null") {
        target.setAttribute('transform', transform);
    }
}

export function fontsToCss(fonts: Font[]): string {
    return fonts.map(({ name, content }) => {
        return `@font-face {
            font-family: ${name};
            src: url("${content}");
        }`;
    }).join('\n') || '';
}

export function getUsedInlineFonts(svg: SVGSVGElement): Set<string> {
    const fonts = new Set<string>();
    for (const node of svg.querySelectorAll<SVGElement>('*')) {
        if (!node.style) continue;
        const fontFamily = node.style.fontFamily || null;
        if (fontFamily) fonts.add(fontFamily);
    }
    return fonts;
}

export function styleSheetToText(sheet: CSSStyleSheet): string {
    let styleTxt = '';
    const rules = sheet.cssRules;
    for (const r of Array.from(rules)) {
        styleTxt += (r as CSSStyleRule).cssText;
    }
    return styleTxt.replace(/undefined/g, '');
}

// Returns [sheet, rule]
export function findStyleSheet(selectorToFind: string): [CSSStyleSheet | null, CSSStyleRule | null] {
    const sheets = document.styleSheets;
    for (const sheet of Array.from(sheets)) {
        const rules = (sheet as CSSStyleSheet).cssRules;
        for (const rule of Array.from(rules)) {
            const selectorText = (rule as CSSStyleRule).selectorText;
            if (selectorText === selectorToFind) {
                return [sheet as CSSStyleSheet, rule as CSSStyleRule];
            }
        }
    }
    return [null, null];
}

export function exportStyleSheet(selectorToFind: string): string | undefined {
    const [sheet] = findStyleSheet(selectorToFind);
    if (sheet) return styleSheetToText(sheet);
}

// If countryFilteredImages set is passed, we ignore elements with IDs in the set
export function applyStyles(inlineStyles: InlineStyles, countryFilteredImages: Set<string> | null = null): void {
    Object.entries(inlineStyles).forEach(([elemId, style]) => {
        if (countryFilteredImages != null && countryFilteredImages.has(elemId)) return;
        const elem = document.getElementById(elemId) as unknown as SVGElement;
        if (!elem) return;
        Object.entries(style).forEach(([cssProp, cssValue]) => {
            if (cssProp === 'scale') {
                setTransformScale(elem, `scale(${cssValue})`);
            } else if (cssProp === 'bringtofront') {
                elem.parentNode?.appendChild(elem);
            } else if (cssProp === 'stroke-width' && cssValue === null) {
                elem.style.removeProperty('stroke-width');
                elem.style.removeProperty('stroke');
            } else {
                elem.style.setProperty(cssProp, cssValue as string);
            }
        });
    });
}

export function updateStyleSheetOrGenerateCss(
    stylesheet: CSSStyleSheet | null,
    cssSelector: string,
    styleDict: Record<string, string | number>
): string {
    if (stylesheet) {
        let rule: CSSStyleRule | null = null;
        for (const r of Array.from(stylesheet.cssRules)) {
            if ((r as CSSStyleRule).selectorText === cssSelector) {
                rule = r as CSSStyleRule;
                break;
            }
        }
        if (rule) {
            Object.entries(styleDict).forEach(([propName, propValue]) => {
                rule!.style.setProperty(propName, propValue as string);
            });
        } else {
            const ruleToInsert = `${cssSelector} { ${styleDictToCssRulesStr(styleDict)} }`;
            stylesheet.insertRule(ruleToInsert);
        }
        return '';
    }
    return `${cssSelector} { ${styleDictToCssRulesStr(styleDict)} }`;
}

export function styleDictToCssRulesStr(styleDict: Record<string, string | number>): string {
    let cssString = '';
    Object.entries(styleDict).forEach(([propName, propValue]) => {
        cssString += `${propName}: ${propValue};`;
    });
    return cssString;
}
