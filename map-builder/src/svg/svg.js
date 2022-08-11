// remove buggy paths, covering the whole svg element
function removeCoveringAll(groupElement) {
    if (!groupElement) return;
    const parent = groupElement.closest('svg');
    const containerRect = parent.getBoundingClientRect();
    for (let child of groupElement.children) {
        if (child.tagName != 'path') continue;
        const d = child.getAttribute('d');
        // ignore empty path, and big ones (that actually draw something)
        if (!d || d.length > 100) continue;
        const rect = child.getBoundingClientRect();
        const includes = rect.x <= containerRect.x && rect.right >= containerRect.right 
            && rect.y <= containerRect.y && rect.bottom >= containerRect.bottom;
        if (includes) {
            console.log('removing', child);
            child.remove();
        }
    }
}