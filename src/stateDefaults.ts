import { initLayersState } from "./micro/drawing";
import type { GlowParams, MacroParams, MicroParams } from "./params";
import type { InlinePropsMacro, InlinePropsMicro, LegendDef, ColorDef, ContourParams, GlobalState, Color } from "./types";
import { playful } from './micro/microPalettes'
import defaultBaseCssMacro from "./assets/pagestyleMacro.css?raw";
const defaultMacroParams: MacroParams = {
    General: {
        width: 600,
        height: 670,
        projection: 'satellite',
        fieldOfView: 50,
        altitude: 3200,
    },
    Border: {
        borderRadius: 1.5,
        borderWidth: 1,
        borderColor: "#b8b8b8",
    },
    Background: {
        showGraticule: true,
        graticuleStep: 3,
        graticuleColor: "#777777",
        graticuleWidth: 0.5,
        seaColor: "#dde2eeff",
        roadColor: "#ffffff",
        waterColor: "#80deea",
        mountainColor: "#838483",
    },
};

const defaultMicroParams: MicroParams = {
    General: {
        width: 700,
        height: 700,
    },
    Border: {
        borderRadius: 1.5,
        borderPadding: 15,
        borderWidth: 1,
        borderColor: "#b8b8b8",
    },
};

const defaultInlinePropsMacro: InlinePropsMacro = {
    longitude: 15,
    latitude: 42.5,
    translateX: 0,
    translateY: 0,
    altitude: 3200,
    rotation: 0,
    tilt: 0,
    showLand: true,
    showCountries: true,
    showRoads: false,
    showWater: false,
    showMountains: false,
    landOnTop: true,
};

const defaultInlinePropsMicro: InlinePropsMicro = {
    center: [2.3468, 48.8548],
    zoom: 13.8,
    pitch: 0,
    bearing: 0,
};

export const defaultGlowParams: GlowParams = {
    enabled: true,
    innerStrength: 0.3,
    innerBlur: 4.8,
    innerColor: "#ffbc6eff",
    outerBlur: 3.5,
    outerStrength: 0.2,
    outerColor: "#ffffffff",
};

const defaultZonesGlow: Record<string, GlowParams> = { land: { ...defaultGlowParams } };

const defaultLastUsedLabelProps: Record<string, string> = { "font-size": "14px" };

const defaultContourParams: ContourParams = {
    strokeWidth: 1,
    strokeColor: "#a0a0a07d",
    strokeDash: 0,
    fillColor: "#ffffff",
};

export const defaultColorDef: ColorDef = {
    enabled: false,
    colorScale: "category",
    colorColumn: "name",
    colorPalette: "Pastel1",
    nbBreaks: 5,
    legendEnabled: false,
    noDataColor: {
        enabled: false,
        color: "#AAAAAA",
    },
};

export const defaultLegendDef: LegendDef = {
    x: 20,
    y: defaultMacroParams.General.height - 200,
    lineWidth: 100,
    rectWidth: 30,
    rectHeight: 30,
    significantDigits: 3,
    maxWidth: 200,
    direction: "v",
    labelOnLeft: false,
    noDataInLegend: true,
    noDataText: "N/A",
    changes: {},
};

export const defaultCustomCategoricalPalette: Color[] = ["#4e79a7ff", "#f28e2bff", "#e15759ff", "#76b7b2ff", "#59a14fff", "#edc948ff", "#b07aa1ff", "#9c755fff"];
export const defaultCustomContinuousPalette: Color[] = ["#f7fbffff", "#6baed6ff", "#08306bff"];

export function defaultTooltipContent(isCountry: boolean): string {
    return `<div>${isCountry ? "Country" : "Region"}: __name__</div>`;
}

/** Visual-only container styles for tooltips. Runtime properties (z-index, will-change, width, max-width) are applied in tooltip.ts / export.ts */
export const defaultTooltipStyle: Record<string, string> = {
    "color": "black",
    "background-color": "#FFFFFF",
    "border": "1px solid black",
    "border-radius": "4px",
    "font-size": "12px",
    "padding": "4px",
    "box-shadow": "0 2px 6px #00000026",
};

/** Default container style for a brand-new element tooltip/popover annotation (no prior one to copy). */
export const defaultAnnotationStyle: Record<string, string> = {
    "background-color": "white",
    "padding": "4px 8px",
    "border-radius": "4px",
    "font-size": "0.82rem",
    "max-width": "15rem",
    "width": "max-content",
};

export const defaultInlineStyles: Record<string, any> = {};

export const macroPositionVars: string[] = [
    "longitude",
    "latitude",
    "rotation",
    "tilt",
    "altitude",
    "fieldOfView",
    "projection",
    "width",
    "height",
];

export const defaultState: GlobalState = {
    stateMacro: {
        baseCss: defaultBaseCssMacro,
        macroParams: defaultMacroParams,
        inlinePropsMacro: defaultInlinePropsMacro,
        chosenCountriesAdm: [],
        zonesData: {},
        zonesGlow: defaultZonesGlow,
        contourParams: defaultContourParams,
        colorDataDefs: { countries: defaultColorDef },
        legendDefs: { "countries": defaultLegendDef },
        tooltipDefs: {
            countries: {
                template: defaultTooltipContent(true),
                containerStyle: { ...defaultTooltipStyle },
                enabled: false,
                locale: "en-US",
            },
        },
        customCategoricalPalette: defaultCustomCategoricalPalette,
        customContinuousPalette: defaultCustomContinuousPalette,
        orderedTabs: ["countries", "land"],
        visibleArea: 0.02
    },
    stateMicro: {
        microParams: defaultMicroParams,
        inlinePropsMicro: defaultInlinePropsMicro,
        microLayerDefinitions: initLayersState(playful),
        baseCss: '',
    },
    stateCommon: {
        lastUsedLabelProps: defaultLastUsedLabelProps,
        lastUsedAnnotationStyle: {},
        lastUsedAnnotationFont: {},
        providedFonts: [],
        providedShapes: [],
        providedPaths: [],
        providedFreeHand: [],
        inlineStyles: defaultInlineStyles,
        elementLinks: {},
        elementAnnotations: {},
        shapeCount: 0,
        currentMode: "macro",
    },
};

