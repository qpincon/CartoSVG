const LOCAL_STORAGE_KEY = "map-builder-state";
export function saveState(params: Object) {
    const serialized = JSON.stringify(params);
    localStorage.setItem(LOCAL_STORAGE_KEY, serialized);
}

export function getState(): Object | null {
    const state = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!state) return null;
    return JSON.parse(state);
}
