
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
            if (selectorText?.includes(selectorToFind)) {
                return [sheets[i], rules[r]];
            }
        }
    }
}

function exportStyleSheet(selectorToFind) {
    const [sheet, _] = findStyleSheet(selectorToFind);
    if (sheet) return styleSheetToText(sheet);
}
export { reportStyle, reportStyleElem, fontsToCss, exportStyleSheet, getUsedInlineFonts, findStyleSheet };