const key = 'map-builder-state';

function saveState(params) {
    const serialized = JSON.stringify(params);
    localStorage.setItem(key, serialized);
}

function getState() {
    const state = localStorage.getItem(key);
    if (!state) return null;
    return JSON.parse(state);
}

export { saveState, getState };