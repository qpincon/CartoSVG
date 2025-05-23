import * as CSS from 'csstype';
import type { MicroBorderParams } from './params';
export type SvgSelection = d3.Selection<d3.BaseType, any, SVGSVGElement, any>;
export type D3Selection<T extends d3.BaseType> = d3.Selection<T, any, T, any>;

type RGB = `rgb(${number}, ${number}, ${number})`;
type RGBA = `rgba(${number}, ${number}, ${number}, ${number})`;
export type HEX = `#${string}`;

export type Color = RGB | RGBA | HEX | CSS.DataType.NamedColor | 'none';
export type Coords = [number, number];
export interface ContourParams {
    strokeWidth: number;
    strokeColor: Color;
    strokeDash: number;
    fillColor: Color;
}

export type InlineStyles = { [elemId: string]: CssDict };
export type CssDict = { [cssProp: string]: string };


export interface PatternDefinition {
    hatch: string;
    id?: string;
    color?: Color;
    strokeWidth?: number;
    scale?: number;
    menuOpened?: boolean;
    active?: boolean;
}

interface CommonMicroLayerDefinition {
    "stroke-width"?: number;
    stroke?: Color;
    disabled?: boolean;
    active?: boolean;
    menuOpened?: boolean;
    pattern?: PatternDefinition;
}

export const MICRO_LAYERS = [
    "residential",
    "forest",
    "sand",
    "grass",
    "wood",
    "water",
    // "River",
    // "Bridge",
    "pier",
    "road-network",
    "railway",
    // "Path minor",
    "path",
    "building",
] as const;

type LayerId = typeof MICRO_LAYERS[number];

interface StandardMicroLayerDefinition extends CommonMicroLayerDefinition {
    fill?: Color;
}
interface MultiFillsMicroLayerDefinition extends CommonMicroLayerDefinition {
    fills?: Color[];
}

type MicroLayerId = LayerId | 'background' | 'other';
export type MicroPalette = {
    [layerId in MicroLayerId]: StandardMicroLayerDefinition | MultiFillsMicroLayerDefinition;
};
export type MicroPaletteWithBorder = MicroPalette & {
    borderParams: MicroBorderParams;
}