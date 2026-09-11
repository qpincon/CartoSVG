import type { Color, Flatten, Prettify, UnionToIntersection } from "./types";



export interface GlowParams {
    enabled: boolean;
    innerBlur: number;
    innerStrength: number;
    innerColor: Color;
    outerBlur: number;
    outerStrength: number;
    outerColor: Color;
}

export type ProjectionName = 'satellite' | 'mercator' | 'equalEarth' | 'geoNaturalEarth' | 'geoAlbersUsa' | 'geoBaker' | 'geoEckert4';
export interface MacroGeneralParams {
    width: number;
    height: number;
    projection: ProjectionName;
    fieldOfView: number;
    altitude: number;
}
export interface MacroBorderParams {
    borderRadius: number;
    borderWidth: number;
    borderColor: Color;
}

export interface MacroBackgroundParams {
    showGraticule: boolean;
    graticuleStep: number;
    graticuleColor: Color;
    graticuleWidth: number;
    seaColor: Color;
    roadColor: Color;
    waterColor: Color;
    mountainColor: Color;
}

export interface MacroParams {
    General: MacroGeneralParams;
    Border: MacroBorderParams;
    Background: MacroBackgroundParams;
}

export interface MicroGeneralParams {
    width: number;
    height: number;
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
    },
    Border: {
        borderRadius: 1.5,
        borderPadding: 15,
        borderWidth: 1,
        borderColor: "#b8b8b8",
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
    width: { type: 'range', min: 100, max: 1000, step: 10 },
    height: { type: 'range', min: 100, max: 1000, step: 10 },
    fieldOfView: { type: 'range', min: 15, max: 170 },
    altitude: { type: 'range', min: 1, max: 30000, step: 10 },
    innerBlur: { type: 'range', min: 0, max: 10, step: 0.1 },
    innerStrength: { type: 'range', min: 0, max: 2.5, step: 0.1 },
    outerBlur: { type: 'range', min: 0, max: 6, step: 0.1 },
    outerStrength: { type: 'range', min: 0, max: 6, step: 0.1 },
    graticuleStep: { type: 'range', min: 2, max: 30, step: 0.5 },
    graticuleWidth: { type: 'range', min: 0.1, max: 2, step: 0.1 },
    borderRadius: { type: 'range', min: 0, max: 50, step: 0.5 },
    borderWidth: { type: 'range', min: 0, max: 10, step: 0.2 },
    borderPadding: { type: 'range', min: 0, max: 30 },
    projection: { type: 'select', choices: ['satellite', 'mercator', 'equalEarth', 'geoNaturalEarth', 'geoAlbersUsa', 'geoBaker', 'geoEckert4'] }
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
export type ParamKey = Prettify<keyof Flatten<MacroParams> | keyof MacroParams | keyof GlowParams>;
export type HelpParams = Partial<Record<ParamKey, string>>;
const blurHelp = "The quantity of blur applied on the glow.";
const strengthHelp = "The thickness of the glow effect.";
export const helpParams: HelpParams = {
    innerBlur: blurHelp,
    innerStrength: strengthHelp,
    showGraticule: "A graticule is the grid of latitude and longitude lines overlaid on the map.",
};