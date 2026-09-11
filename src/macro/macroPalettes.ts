import { color } from "d3-color";
import type { GlowParams } from "../params";
import { macroState } from "../state.svelte";
import { defaultGlowParams } from "../stateDefaults";
import type { CssDict, MacroPalette } from "../types";
import { exportStyleSheet, findStyleSheet, updateStyleSheetOrGenerateCss } from "../util/dom";

/**
 * One-click macro map styles. Mirrors src/micro/microPalettes.ts: each named export is a
 * palette, the export name is its id, and export order is display order.
 */

// --- Classic warm atlas — reproduces the app's own defaults ---
export const atlas: MacroPalette = {
    background: {
        showGraticule: true,
        graticuleStep: 3,
        graticuleColor: "#777777",
        graticuleWidth: 0.5,
        seaColor: "#dde2eeff",
        waterColor: "#dde2eeff",
        roadColor: "#c2a88340",
        mountainColor: "#838483",
    },
    border: { borderRadius: 1.5, borderWidth: 1, borderColor: "#b8b8b8" },
    land: { strokeWidth: 1, strokeColor: "#a0a0a07d", strokeDash: 0, fillColor: "#ffffff" },
    glow: { ...defaultGlowParams },
    country: { fill: "#f3efec", stroke: "#bfbfbf", "stroke-width": "1px" },
    countryHovered: { fill: "#f9f2eb" },
    adm: { fill: "#ffffffd0", stroke: "#c4b8a3ff", "stroke-width": "1px" },
    admHovered: { fill: "#ecd6b6ff", stroke: "#d29d52ff", "stroke-width": "2px" },
    curve: { stroke: "#7c490ea0" },
    point: { fill: "#000000" },
    label: { fill: "#000000" },
    freehand: { fill: "#7c490ea0" },
};

// --- CARTO-Positron-inspired: flat, minimal, no glow ---
export const positron: MacroPalette = {
    background: {
        showGraticule: true,
        graticuleStep: 5,
        graticuleColor: "#707d82",
        graticuleWidth: 0.5,
        seaColor: "#ccd4d8ff",
        waterColor: "#ccd4d8ff",
        roadColor: "#c8c8c240",
        mountainColor: "#838483",
    },
    border: { borderRadius: 1.5, borderWidth: 1, borderColor: "#c9c9c2" },
    land: { strokeWidth: 0.6, strokeColor: "#d3d3ccff", strokeDash: 0, fillColor: "#f2f3f0ff" },
    glow: null,
    country: { fill: "#f2f3f0ff", stroke: "#c9c9c2ff", "stroke-width": "0.6px" },
    countryHovered: { fill: "#e4e6e0ff" },
    adm: { fill: "#f7f8f5ff", stroke: "#d3d3ccff", "stroke-width": "0.6px" },
    admHovered: { fill: "#e4e6e0ff", stroke: "#b8b8b0ff", "stroke-width": "1px" },
    curve: { stroke: "#5b7a8ca0" },
    point: { fill: "#33414a" },
    label: { fill: "#33414a" },
    freehand: { fill: "#5b7a8ca0" },
};

// --- Antique engraved atlas: sepia, outer-glow-only coastal halo ---
export const parchment: MacroPalette = {
    background: {
        showGraticule: true,
        graticuleStep: 5,
        graticuleColor: "#9c8156",
        graticuleWidth: 0.4,
        seaColor: "#c9b795ff",
        waterColor: "#c9b795ff",
        roadColor: "#a9846d40",
        mountainColor: "#838483",
    },
    border: { borderRadius: 2, borderWidth: 2, borderColor: "#7a5a34" },
    land: { strokeWidth: 1.2, strokeColor: "#9c8156ff", strokeDash: 0, fillColor: "#f2e6cbff" },
    glow: {
        innerStrength: 0,
        innerBlur: 0,
        innerColor: "#6b4a28ff",
        outerBlur: 4.5,
        outerStrength: 0.35,
        outerColor: "#6b4a28ff",
    },
    country: { fill: "#ece0c2ff", stroke: "#ab8f61ff", "stroke-width": "1px" },
    countryHovered: { fill: "#f3e9cdff" },
    adm: { fill: "#f5ecd6ff", stroke: "#ab8f61ff", "stroke-width": "1px" },
    admHovered: { fill: "#e8d5a8ff", stroke: "#8a6a3eff", "stroke-width": "2px" },
    curve: { stroke: "#6b4a28a0" },
    point: { fill: "#4a3520" },
    label: { fill: "#4a3520" },
    freehand: { fill: "#6b4a28a0" },
};

// --- Near-black navy, cyan coastline ---
export const midnight: MacroPalette = {
    background: {
        showGraticule: true,
        graticuleStep: 4,
        graticuleColor: "#3f6483",
        graticuleWidth: 0.5,
        seaColor: "#070d17ff",
        waterColor: "#070d17ff",
        roadColor: "#b39b6e40",
        mountainColor: "#838483",
    },
    border: { borderRadius: 1.5, borderWidth: 1, borderColor: "#2c455c" },
    land: { strokeWidth: 1, strokeColor: "#2c455cff", strokeDash: 0, fillColor: "#101c29ff" },
    glow: {
        innerStrength: 0.15,
        innerBlur: 2.2,
        innerColor: "#4a90a8ff",
        outerBlur: 2.5,
        outerStrength: 0.1,
        outerColor: "#2c5f75ff",
    },
    country: { fill: "#14212eff", stroke: "#3c5a75ff", "stroke-width": "1px" },
    countryHovered: { fill: "#1c2f3fff" },
    adm: { fill: "#182838ff", stroke: "#3c5a75ff", "stroke-width": "1px" },
    admHovered: { fill: "#274a63ff", stroke: "#5fa8d0ff", "stroke-width": "2px" },
    curve: { stroke: "#4a90a8a0" },
    point: { fill: "#eaf6ff" },
    label: { fill: "#eaf6ff" },
    freehand: { fill: "#4a90a8a0" },
};

// --- National-Geographic-style expedition atlas: tan land, muted teal sea, brown borders ---
export const expedition: MacroPalette = {
    background: {
        showGraticule: true,
        graticuleStep: 5,
        graticuleColor: "#9c8a68",
        graticuleWidth: 0.3,
        seaColor: "#a8c9d4ff",
        waterColor: "#a8c9d4ff",
        roadColor: "#a9764f40",
        mountainColor: "#838483",
    },
    border: { borderRadius: 1, borderWidth: 1.5, borderColor: "#5c4a30" },
    land: { strokeWidth: 1, strokeColor: "#8a7550ff", strokeDash: 0, fillColor: "#e8ddc0ff" },
    glow: {
        innerStrength: 0.14,
        innerBlur: 2.4,
        innerColor: "#d9b878ff",
        outerBlur: 2.6,
        outerStrength: 0.4,
        outerColor: "#8a7550ff",
    },
    country: { fill: "#f0e6ccff", stroke: "#6b5738ff", "stroke-width": "1px" },
    countryHovered: { fill: "#e6d8b0ff" },
    adm: { fill: "#f5eeddff", stroke: "#8a7550ff", "stroke-width": "1px" },
    admHovered: { fill: "#ddc994ff", stroke: "#5c4a30ff", "stroke-width": "1.5px" },
    curve: { stroke: "#8a7550a0" },
    point: { fill: "#3a2f1f" },
    label: { fill: "#3a2f1f" },
    freehand: { fill: "#8a7550a0" },
};

// --- Classic textbook physical/political map: blue sea, green land, square frame, no glow ---
export const meridian: MacroPalette = {
    background: {
        showGraticule: true,
        graticuleStep: 10,
        graticuleColor: "#7fa8c9",
        graticuleWidth: 0.3,
        seaColor: "#a9cce3ff",
        waterColor: "#a9cce3ff",
        roadColor: "#a9726740",
        mountainColor: "#838483",
    },
    border: { borderRadius: 0, borderWidth: 1.5, borderColor: "#333333" },
    land: { strokeWidth: 0.8, strokeColor: "#5a7a52ff", strokeDash: 0, fillColor: "#c8e6c0ff" },
    glow: null,
    country: { fill: "#eaf3e0ff", stroke: "#4d4d4dff", "stroke-width": "0.8px" },
    countryHovered: { fill: "#dcefe0ff" },
    adm: { fill: "#f2f7ecff", stroke: "#7a9a72ff", "stroke-width": "0.8px" },
    admHovered: { fill: "#d3e8c8ff", stroke: "#4d4d4dff", "stroke-width": "1.5px" },
    curve: { stroke: "#4d4d4da0" },
    point: { fill: "#333333" },
    label: { fill: "#333333" },
    freehand: { fill: "#4d4d4da0" },
};

// --- Monochrome newsprint / print atlas: grayscale, square frame, no glow ---
export const newsprint: MacroPalette = {
    background: {
        showGraticule: true,
        graticuleStep: 6,
        graticuleColor: "#c4c4c4",
        graticuleWidth: 0.3,
        seaColor: "#e8e8e8ff",
        waterColor: "#e8e8e8ff",
        roadColor: "#8a8a8a40",
        mountainColor: "#838483",
    },
    border: { borderRadius: 0, borderWidth: 1, borderColor: "#1a1a1a" },
    land: { strokeWidth: 1, strokeColor: "#555555ff", strokeDash: 0, fillColor: "#ffffffff" },
    glow: null,
    country: { fill: "#f5f5f5ff", stroke: "#333333ff", "stroke-width": "1px" },
    countryHovered: { fill: "#e0e0e0ff" },
    adm: { fill: "#fafafaff", stroke: "#777777ff", "stroke-width": "0.8px" },
    admHovered: { fill: "#d0d0d0ff", stroke: "#222222ff", "stroke-width": "1.5px" },
    curve: { stroke: "#333333a0" },
    point: { fill: "#1a1a1a" },
    label: { fill: "#1a1a1a" },
    freehand: { fill: "#333333a0" },
};

/**
 * Applies a macro palette to state: sea/graticule, border, land contour, glow on every layer
 * that currently has one, and the default .country/.adm/curve/point/label/freehand CSS rules.
 * These CSS defaults only affect elements without an inline style override, so per-element
 * inline styles (fonts, individually recolored elements, etc.) are left untouched.
 */
export function applyMacroPalette(palette: MacroPalette): void {
    Object.assign(macroState.macroParams.Background, palette.background);
    Object.assign(macroState.macroParams.Border, palette.border);
    Object.assign(macroState.contourParams, palette.land);

    if (palette.glow) {
        for (const layer of Object.keys(macroState.zonesGlow)) {
            if (macroState.zonesGlow[layer].enabled) {
                macroState.zonesGlow[layer] = { ...palette.glow, enabled: true };
            }
        }
        macroState.zonesGlow.land = { ...palette.glow, enabled: true };
    } else {
        for (const layer of Object.keys(macroState.zonesGlow)) {
            macroState.zonesGlow[layer] = { ...macroState.zonesGlow[layer], enabled: false };
        }
    }

    const [sheet] = findStyleSheet("#outline");
    updateStyleSheetOrGenerateCss(sheet, ".country", palette.country);
    updateStyleSheetOrGenerateCss(sheet, ".country.hovered", palette.countryHovered);
    updateStyleSheetOrGenerateCss(sheet, ".adm", palette.adm);
    updateStyleSheetOrGenerateCss(sheet, ".adm.hovered", palette.admHovered);
    updateStyleSheetOrGenerateCss(sheet, "#paths path", palette.curve);
    updateStyleSheetOrGenerateCss(sheet, ".shape", palette.point);
    updateStyleSheetOrGenerateCss(sheet, ".text", palette.label);
    updateStyleSheetOrGenerateCss(sheet, "#freehand-drawings .freehand", palette.freehand);
    macroState.baseCss = exportStyleSheet("#outline") ?? macroState.baseCss;
}

const hex8 = (c: string | undefined | null): string | null => (c ? (color(c)?.formatHex8() ?? null) : null);

function cssDictMatches(actual: CssDict, expected: CssDict): boolean {
    return Object.entries(expected).every(([prop, value]) => {
        const actualValue = actual[prop];
        if (prop.includes("color") || prop === "fill" || prop === "stroke") {
            return hex8(actualValue) === hex8(value);
        }
        return actualValue === value;
    });
}

/** Pulls the `.country { ... }` rule body out of baseCss (not `.country.hovered`). */
function extractRuleProps(css: string, selector: string): CssDict {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = new RegExp(`${escaped}\\s*\\{([^}]*)\\}`).exec(css);
    const props: CssDict = {};
    if (!match) return props;
    for (const decl of match[1].split(";")) {
        const [prop, ...rest] = decl.split(":");
        if (!prop || !rest.length) continue;
        props[prop.trim()] = rest.join(":").trim();
    }
    return props;
}

const glowMatches = (actual: GlowParams | undefined, expected: Omit<GlowParams, "enabled"> | null): boolean => {
    const activeActual = actual?.enabled ? actual : undefined;
    if (!expected) return !activeActual;
    if (!activeActual) return false;
    return (
        activeActual.innerStrength === expected.innerStrength &&
        activeActual.innerBlur === expected.innerBlur &&
        hex8(activeActual.innerColor) === hex8(expected.innerColor) &&
        activeActual.outerStrength === expected.outerStrength &&
        activeActual.outerBlur === expected.outerBlur &&
        hex8(activeActual.outerColor) === hex8(expected.outerColor)
    );
};

/** Returns the id of the palette matching current macro state, or "" ("Custom") if none does. */
export function findMatchingPaletteId(palettes: Record<string, MacroPalette>): string {
    const country = extractRuleProps(macroState.baseCss, ".country");
    const curve = extractRuleProps(macroState.baseCss, "#paths path");
    const point = extractRuleProps(macroState.baseCss, ".shape");
    const label = extractRuleProps(macroState.baseCss, ".text");
    const freehand = extractRuleProps(macroState.baseCss, "#freehand-drawings .freehand");
    return (
        Object.keys(palettes).find((id) => {
            const p = palettes[id];
            const bg = macroState.macroParams.Background;
            const border = macroState.macroParams.Border;
            const land = macroState.contourParams;
            return (
                bg.showGraticule === p.background.showGraticule &&
                bg.graticuleStep === p.background.graticuleStep &&
                hex8(bg.graticuleColor) === hex8(p.background.graticuleColor) &&
                bg.graticuleWidth === p.background.graticuleWidth &&
                hex8(bg.seaColor) === hex8(p.background.seaColor) &&
                hex8(border.borderColor) === hex8(p.border.borderColor) &&
                border.borderWidth === p.border.borderWidth &&
                border.borderRadius === p.border.borderRadius &&
                land.strokeWidth === p.land.strokeWidth &&
                hex8(land.strokeColor) === hex8(p.land.strokeColor) &&
                land.strokeDash === p.land.strokeDash &&
                hex8(land.fillColor) === hex8(p.land.fillColor) &&
                glowMatches(macroState.zonesGlow.land, p.glow) &&
                cssDictMatches(country, p.country) &&
                cssDictMatches(curve, p.curve) &&
                cssDictMatches(point, p.point) &&
                cssDictMatches(label, p.label) &&
                cssDictMatches(freehand, p.freehand)
            );
        }) ?? ""
    );
}
