import type { Color, Flatten, Prettify, UnionToIntersection } from "./types";



export interface GlowParams {
    innerBlur: number;
    innerStrength: number;
    innerColor: Color;
    outerBlur: number;
    outerStrength: number;
    outerColor: Color;
}

export type ProjectionName = 'satellite' | 'mercator';
export interface MacroGeneralParams {
    width: number;
    height: number;
    useViewBox: boolean;
    projection: ProjectionName;
    fieldOfView: number;
    altitude: number;
    animate: boolean;
}
export interface MacroBorderParams {
    borderRadius: number;
    borderWidth: number;
    borderColor: Color;
    frameShadow?: boolean;
}

export interface MacroBackgroundParams {
    showGraticule: boolean;
    graticuleStep: number;
    seaColor: Color;
    backgroundNoise: boolean;
}

export interface MacroParams {
    General: MacroGeneralParams;
    Border: MacroBorderParams;
    Background: MacroBackgroundParams;
    firstGlow: GlowParams;
    secondGlow: GlowParams;
}

export const defaultParams: MacroParams = {
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
}

export interface MicroGeneralParams {
    width: number;
    height: number;
    useViewBox: boolean;
    animate: boolean;
}

export interface MicroBorderParams extends MacroBorderParams {
    borderPadding: number;
}

export interface MicroParams {
    General: MicroGeneralParams;
    Border: MicroBorderParams;
}

export const microDefaultParams: MicroParams = {
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

export interface RangeDefinition {
    type: 'range';
    min: number;
    max: number;
    step?: number;
}

export interface SelectDefinition {
    type: 'select';
    choices: string[];
}

export type ParamDefinition = RangeDefinition | SelectDefinition;

export type ParamDefinitions = { [paramName: string]: ParamDefinition };
export const paramDefs: ParamDefinitions = {
    width: { type: 'range', min: 100, max: 1000 },
    height: { type: 'range', min: 100, max: 1000 },
    fieldOfView: { type: 'range', min: 15, max: 180 },
    altitude: { type: 'range', min: 1, max: 30000, step: 10 },
    innerBlur: { type: 'range', min: 0, max: 10, step: 0.1 },
    innerStrength: { type: 'range', min: 0, max: 6, step: 0.1 },
    outerBlur: { type: 'range', min: 0, max: 10, step: 0.1 },
    outerStrength: { type: 'range', min: 0, max: 6, step: 0.1 },
    graticuleStep: { type: 'range', min: 0.1, max: 20, step: 0.1 },
    borderRadius: { type: 'range', min: 0, max: 50, step: 0.5 },
    borderWidth: { type: 'range', min: 0, max: 10 },
    borderPadding: { type: 'range', min: 0, max: 30 },
    filter: { type: 'select', choices: ['none', 'firstGlow', 'secondGlow'] },
    projection: { type: 'select', choices: ['satellite', 'mercator', 'equalEarth', 'geoNaturalEarth', 'geoAlbersUsa', 'geoBaker'] }
};

export type OtherParams = {
    [param: string]: {
        disabled?: boolean;
        rename?: string;
    }
}
export const noSatelliteParams: OtherParams = {
    fieldOfView: {
        disabled: true,
    },
    altitude: {
        rename: 'scale',
    }
};
export type ParamKey = Prettify<keyof Flatten<MacroParams> | keyof MacroParams>;
export type HelpParams = Partial<Record<ParamKey, string>>;
const glowHelpGeneral = `The glow effect is used by default on the "land" layer. You can tweak the parameters on how the inner and outer effect are achieved.`;
const blurHelp = "The quantity of blur applied on the glow.";
const strengthHelp = "The thickness of the glow effect.";
export const helpParams: HelpParams = {
    firstGlow: glowHelpGeneral,
    secondGlow: glowHelpGeneral,
    innerBlur: blurHelp,
    innerStrength: strengthHelp,
    useViewBox: `If checked, the exported SVG will fit to its container and will not define its own width/height.`,
    animate: `The map will animate when entering the viewport on your page. You can turn it off during edition of the map, as it will trigger on every change.`,
};