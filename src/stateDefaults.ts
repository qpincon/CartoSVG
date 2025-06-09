import { initLayersState } from "./detailed";
import type { MacroParams, MicroParams } from "./params";
import type { InlinePropsMacro, InlinePropsMicro, LegendDef, ColorDef, ContourParams, GlobalState, Color } from "./types";
import { styleDictToCssRulesStr } from "./util/dom";
import { peach } from './microPalettes'
import defaultBaseCssMacro from "./assets/pagestyleMacro.css?raw";
const defaultMacroParams: MacroParams = {
    General: {
        width: 600,
        height: 670,
        useViewBox: false,
        projection: 'satellite',
        fieldOfView: 50,
        altitude: 3200,
        animate: false,
    },
    Border: {
        borderRadius: 1.5,
        borderWidth: 1,
        borderColor: "#b8b8b8",
        frameShadow: true,
    },
    Background: {
        showGraticule: true,
        graticuleStep: 3,
        seaColor: "#dde2eeff",
        backgroundNoise: true,
    },

    firstGlow: {
        innerStrength: 0.3,
        innerBlur: 4.8,
        innerColor: "#ffbc6eff",
        outerBlur: 3.5,
        outerStrength: 0.2,
        outerColor: "#ffffffff"
    },
    secondGlow: {
        innerStrength: 1.5, innerBlur: 0.2, innerColor: "#ffffff",
        outerBlur: 3, outerStrength: 0.1, outerColor: '#2d2626ff',
    },
};

const defaultMicroParams: MicroParams = {
    General: {
        width: 700,
        height: 700,
        useViewBox: false,
        animate: false,
    },
    Border: {
        borderRadius: 1.5,
        borderPadding: 15,
        borderWidth: 1,
        borderColor: "#b8b8b8",
        frameShadow: true,
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
};

const defaultInlinePropsMicro: InlinePropsMicro = {
    center: [2.3468, 48.8548],
    zoom: 13.8,
    pitch: 0,
    bearing: 0,
};

const defaultZonesFilter: Record<string, string> = { land: "firstGlow" };

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
};

export const defaultLegendDef: LegendDef = {
    title: "",
    x: 20,
    y: defaultMacroParams.General.height - 200,
    lineWidth: 100,
    rectWidth: 30,
    rectHeight: 30,
    significantDigits: 3,
    maxWidth: 200,
    direction: "v",
    labelOnLeft: false,
    noData: {
        active: false,
        manual: false,
        text: "N/A",
        color: "#AAAAAA",
    },
    changes: {},
};

export const defaultCustomCategoricalPalette: Color[] = ["#ff0000ff", "#00ff00ff", "#0000ffff"];

function defaultTooltipContent(isCountry: boolean): string {
    return `<div>
<span> ${isCountry ? "Country" : "Region"}: {name}</span>
</div>
`;
}

function defaultTooltipFull(template: string): string {
    return `<div id="tooltip-preview" style="${styleDictToCssRulesStr(defaultTooltipStyle)}">
    ${template}
</div>`;
}

export const defaultTooltipStyle: Record<string, string> = {
    "background-color": "#000000ff",
    "border-radius": "4px",
    "color": "#ffffff",
    "font-size": "12px",
    "padding": "4px",
    "pointer-events": "none",
    "z-index": "1000",
};

export const defaultInlineStyles: Record<string, any> = {};

export const defaultState: GlobalState = {
    stateMacro: {
        macroParams: defaultMacroParams,
        inlinePropsMacro: defaultInlinePropsMacro,
        chosenCountriesAdm: [],
        zonesData: {},
        zonesFilter: defaultZonesFilter,
        lastUsedLabelProps: defaultLastUsedLabelProps,
        contourParams: defaultContourParams,
        colorDataDefs: { countries: defaultColorDef },
        legendDefs: { "countries": defaultLegendDef },
        customCategoricalPalette: defaultCustomCategoricalPalette,
    },
    stateMicro: {
        microParams: defaultMicroParams,
        inlinePropsMicro: defaultInlinePropsMicro,
        microLayerDefinitions: initLayersState(peach),
    },
    stateCommon: {
        baseCss: defaultBaseCssMacro,
        providedFonts: [],
        providedShapes: [],
        providedPaths: [],
        orderedTabs: ["countries", "land"],
        inlineStyles: defaultInlineStyles,
        shapeCount: 0,
        tooltipDefs: {
            countries: {
                template: defaultTooltipContent(true),
                content: defaultTooltipFull(defaultTooltipContent(true)),
                enabled: false,
                locale: "en-US",
            },
        },
        currentMode: "macro",
    },
};

