import { appState, macroState } from "src/state.svelte";

// Exponential simplification: area = minArea * (maxArea/minArea) ^ (t^curve)
// t goes from 0 (fully zoomed in) to 1 (fully zoomed out), clamped
function makeSimplificationScale(
    zoomedInValue: number, zoomedOutValue: number,
    minArea: number, maxArea: number, curve: number,
) {
    const range = zoomedOutValue - zoomedInValue;
    const ratio = maxArea / minArea;
    return (value: number) => {
        if (!range || !Number.isFinite(value)) return minArea;
        const raw = (value - zoomedInValue) / range;
        const t = Number.isFinite(raw) ? Math.max(0, Math.min(1, raw)) : 0;
        return minArea * Math.pow(ratio, Math.pow(t, curve));
    };
}

let threshScale = makeSimplificationScale(10000, 100, 0.0001, 0.03, 0.78);

export function zoomed(event: d3.D3ZoomEvent<SVGSVGElement, unknown>): void {
    const src = event.sourceEvent;
    if (!src || (!src.deltaY && !src.deltaX)) return;
    if (src.type === "dblclick") return;
    if (!appState.projection) return;

    const delta = -src.deltaY * (src.deltaMode === 1 ? 0.05 : src.deltaMode ? 1 : 0.002);
    const zoomFactor = Math.pow(2, delta);

    const isSatellite = macroState.macroParams.General.projection === "satellite";
    const oldAltitude = macroState.inlinePropsMacro.altitude;
    let newAltitude = oldAltitude * (isSatellite ? 1 / zoomFactor : zoomFactor);
    newAltitude = Math.round(Math.max(appState.altMin, Math.min(appState.altMax, newAltitude)));

    // Zoom toward cursor: adjust center so the point under the cursor stays fixed
    const projection = appState.projection;
    if (projection.invert) {
        const container = (src.target as Element).closest("#map-container");
        if (container) {
            const rect = container.getBoundingClientRect();
            const cx = src.clientX - rect.left;
            const cy = src.clientY - rect.top;
            const cursorGeo = projection.invert([cx, cy]);
            if (cursorGeo && isFinite(cursorGeo[0]) && isFinite(cursorGeo[1])) {
                const altRatio = newAltitude / oldAltitude;
                if (isSatellite) {
                    // Satellite: lon/lat control the center (translateX/Y are ignored)
                    const lon = macroState.inlinePropsMacro.longitude;
                    const lat = macroState.inlinePropsMacro.latitude;
                    macroState.inlinePropsMacro.longitude = lon + ((cursorGeo[0] - lon) * (1 - altRatio));
                    macroState.inlinePropsMacro.latitude = lat + ((cursorGeo[1] - lat) * (1 - altRatio));
                } else {
                    // Standard: translateX/Y control the pixel offset
                    const w = container.clientWidth;
                    const h = container.clientHeight;
                    const centerX = w / 2 + macroState.inlinePropsMacro.translateX;
                    const centerY = h / 2 + macroState.inlinePropsMacro.translateY;
                    macroState.inlinePropsMacro.translateX -= (cx - centerX) * (altRatio - 1);
                    macroState.inlinePropsMacro.translateY -= (cy - centerY) * (altRatio - 1);
                }
            }
        }
    }

    macroState.macroParams.General.altitude = newAltitude;
    macroState.inlinePropsMacro.altitude = newAltitude;
    clampMercatorTranslate();
    macroState.visibleArea = threshScale(newAltitude);
}

const sensitivity = 75;
export function dragged(event: d3.D3DragEvent<SVGSVGElement, unknown, unknown>): void {
    macroState.inlinePropsMacro.translateX += event.dx;
    macroState.inlinePropsMacro.translateY += event.dy;
    const isSatellite = macroState.macroParams.General.projection === "satellite";
    if (isSatellite && (event.sourceEvent.metaKey || event.sourceEvent.ctrlKey)) {
        const MAX_TILT = 35;
        macroState.inlinePropsMacro.tilt = Math.min(MAX_TILT, Math.max(0, macroState.inlinePropsMacro.tilt - event.dy / 10));
        macroState.inlinePropsMacro.rotation -= event.dx / 10;
    } else if (appState.projection?.rotate) {
        const rotate = appState.projection.rotate();
        let rotRad = (macroState.inlinePropsMacro.rotation / 180) * Math.PI;
        if (!isSatellite) rotRad = 0;
        const [xPartX, xPartY] = [Math.cos(rotRad), Math.sin(rotRad)];
        const [yPartX, yPartY] = [-Math.sin(rotRad), Math.cos(rotRad)];
        const k = sensitivity / appState.projection.scale();
        const adjustedDx = (event.dx * xPartX + event.dy * yPartX) * k;
        const adjustedDy = (event.dy * yPartY + event.dx * xPartY) * k;
        macroState.inlinePropsMacro.longitude = -rotate[0] - adjustedDx;
        macroState.inlinePropsMacro.latitude = -rotate[1] + adjustedDy;
    }
    clampMercatorTranslate();
}

export function updateVisibleAreaScale(): void {
    const fov = macroState.macroParams.General.fieldOfView;
    if (macroState.macroParams.General.projection === "satellite") {
        const fovExtent = Math.tan((0.5 * fov * Math.PI) / 180);
        appState.altMin = Math.max(1, Math.round((1 / fovExtent) * 220));
        appState.altMax = Math.max(appState.altMin + 1, Math.round((1 / fovExtent) * 4000));
        // low altitude (zoomed in) → small area, high altitude (zoomed out) → large area
        threshScale = makeSimplificationScale(appState.altMin, appState.altMax, 0.00005, 0.08, 0.78);
    } else if (macroState.macroParams.General.projection === "mercator") {
        // Below scale 130 the world is narrower than most canvas widths, which is what the
        // translateX/Y clamp below relies on to always keep the map covering the canvas.
        appState.altMin = 130;
        appState.altMax = 2800;
        threshScale = makeSimplificationScale(appState.altMax, 300, 0.0001, 0.03, 0.78);
    } else {
        appState.altMin = 90;
        appState.altMax = 2800;
        // high scale (zoomed in) → small area, low scale (zoomed out) → large area
        // Simplification maxes out at scale 300, below that stays at 0.03
        threshScale = makeSimplificationScale(appState.altMax, 300, 0.0001, 0.03, 0.78);
    }
}

/**
 * Mercator is cylindrical: the full world is exactly 2*scale*PI px wide, and clamping the
 * vertical span to the same size (the standard "square world" Web Mercator convention, matching
 * the ~85.05° latitude cutoff) lets translateX/Y be clamped with the same formula. This keeps the
 * map always covering the canvas instead of panning past the world's edge into blank space.
 */
function clampMercatorTranslate(): void {
    if (macroState.macroParams.General.projection !== "mercator") return;
    const { width, height } = macroState.macroParams.General;
    const scale = macroState.inlinePropsMacro.altitude || macroState.macroParams.General.altitude;
    const halfWorld = scale * Math.PI;

    const boundX = Math.abs(halfWorld - width / 2);
    macroState.inlinePropsMacro.translateX = Math.max(-boundX, Math.min(boundX, macroState.inlinePropsMacro.translateX));

    const boundY = Math.abs(halfWorld - height / 2);
    macroState.inlinePropsMacro.translateY = Math.max(-boundY, Math.min(boundY, macroState.inlinePropsMacro.translateY));
}
export function changeAltitudeScale(autoAdjustAltitude = true): void {
    updateVisibleAreaScale();

    let altitude = macroState.inlinePropsMacro.altitude || macroState.macroParams.General.altitude;

    if (autoAdjustAltitude) {
        const clamped = Math.min(appState.altMax, Math.max(appState.altMin, altitude));
        if (clamped !== altitude) {
            altitude = clamped;
            macroState.inlinePropsMacro.altitude = clamped;
            macroState.macroParams.General.altitude = clamped;
        }
    }

    clampMercatorTranslate();
    macroState.visibleArea = threshScale(altitude);
}
