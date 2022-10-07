
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

export { reportStyle };