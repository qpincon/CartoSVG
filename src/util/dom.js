import { setTransformScale } from "../svg/svg";

function reportStyle(reference, target) {
    const walkerRef = document.createTreeWalker(reference, NodeFilter.SHOW_ELEMENT);
    const walkerTarget = document.createTreeWalker(target, NodeFilter.SHOW_ELEMENT);
    reportStyleElem(walkerRef.currentNode, walkerTarget.currentNode);
    while (walkerRef.nextNode()) {
        walkerTarget.nextNode();
        reportStyleElem(walkerRef.currentNode, walkerTarget.currentNode);
    }
}

function reportStyleElem(ref, target) {
    const refStyle = ref.getAttribute('style');
    if (refStyle && refStyle !== "null") {
        target.setAttribute('style', refStyle);
    }
    const transform = ref.getAttribute('transform');
    if (transform && transform !== "null") {
        target.setAttribute('transform', transform);
    }
}

function fontsToCss(fonts) {
    return fonts.map(({ name, content }) => {
        return `@font-face {
            font-family: ${name};
            src: url("${content}");
        }`;
    }).join('\n') || '';
}

function getUsedInlineFonts(svg) {
    const fonts = new Set();
    for (let node of svg.querySelectorAll('*')) {
        if (!node.style) continue
        const fontFamily = node.style['font-family'] || null;
        if (fontFamily) fonts.add(fontFamily);
    }
    return fonts;
}


function styleSheetToText(sheet) {
    let styleTxt = '';
    const rules = sheet.cssRules;
    for (let r in rules) {
        styleTxt += rules[r].cssText;
    }
    return styleTxt.replace(/undefined/g, '');
}

// returns [sheet, rule]
function findStyleSheet(selectorToFind) {
    const sheets = document.styleSheets;
    for (let i in sheets) {
        const rules = sheets[i].cssRules;
        for (let r in rules) {
            const selectorText = rules[r].selectorText;
            if (selectorText === selectorToFind) {
                return [sheets[i], rules[r]];
            }
        }
    }
    return [null, null]
}

function exportStyleSheet(selectorToFind) {
    const [sheet, _] = findStyleSheet(selectorToFind);
    if (sheet) return styleSheetToText(sheet);
}

//  if countryFilteredImages set is passed, we ignore elements with ids in the set
function applyStyles(inlineStyles, countryFilteredImages = null) {
    // apply inline styles
    Object.entries(inlineStyles).forEach((([elemId, style]) => {
        if (countryFilteredImages != null && countryFilteredImages.has(elemId)) return;
        const elem = document.getElementById(elemId);
        if (!elem) return;
        Object.entries(style).forEach(([cssProp, cssValue]) => {
            if (cssProp === 'scale') {
                setTransformScale(elem, `scale(${cssValue})`);
            }
            else if (cssProp === 'bringtofront') {
                elem.parentNode.append(elem);
            }
            // if no width, remove width and color. Width will be inherited
            else if (cssProp === 'stroke-width' && cssValue === null) {
                elem.style.removeProperty('stroke-width');
                elem.style.removeProperty('stroke');
            }
            else elem.style[cssProp] = cssValue;
        });
    }));
}

function updateStyleSheetOrGenerateCss(stylesheet, cssSelector, styleDict) {
    if (stylesheet) {
        let rule = null;
        for (const r of stylesheet.cssRules) {
            if (r.selectorText === cssSelector) {
                rule = r;
                break;
            }
        }
        if (rule) {
            Object.entries(styleDict).forEach(([propName, propValue]) => {
                rule.style.setProperty(propName, propValue);
            });
        } else {
            const ruleToInsert = `${cssSelector} { ${styleDictToCssRulesStr(styleDict)} }`;
            console.log('ruleToInsert=',ruleToInsert );
            stylesheet.insert(ruleToInsert)
        }
        return '';
    }
    return `${cssSelector} { ${styleDictToCssRulesStr(styleDict)} }`;
}

function styleDictToCssRulesStr(styleDict) {
    let cssString='';
    Object.entries(styleDict).forEach(([propName, propValue]) => {
        cssString += `${propName}: ${propValue};`;
    }); 
    return cssString;

}


export { reportStyle, reportStyleElem, fontsToCss, exportStyleSheet, getUsedInlineFonts, findStyleSheet, applyStyles, updateStyleSheetOrGenerateCss };