
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
    target.setAttribute('style', ref.getAttribute('style'));
}

function fontsToCss(fonts) {
    return fonts.map(({name, content}) => {
        return `@font-face {
            font-family: ${name};
            src: url("${content}");
        }`;
    }).join('\n') || '';
}

function styleSheetToText(sheet) {
    let styleTxt = '';
    const rules = sheet.cssRules;
    for (let r in rules) {
        styleTxt += rules[r].cssText;
    }
    return styleTxt.replace(/undefined/g, '');
}

function exportStyleSheet(selectorToFind) {
    const sheets = document.styleSheets;
    for (let i in sheets) {
        const rules = sheets[i].cssRules;
        for (let r in rules) {
            const selectorText = rules[r].selectorText;
            if (selectorText?.includes(selectorToFind)) return styleSheetToText(sheets[i]);
        }
    }
}
export { reportStyle, fontsToCss, exportStyleSheet };