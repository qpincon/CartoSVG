function saveState(params, key = 'map-builder-state') {
    const serialized = JSON.stringify(params);
    localStorage.setItem(key, serialized);
}

function getState(key = 'map-builder-state') {
    const state = localStorage.getItem(key);
    if (!state) return null;
    return JSON.parse(state);
}

export { saveState, getState };