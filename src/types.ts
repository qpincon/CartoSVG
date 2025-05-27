import * as CSS from 'csstype';
import type { MicroBorderParams } from './params';
export type SvgSelection = d3.Selection<d3.BaseType, any, SVGSVGElement, any>;
export type D3Selection<T extends d3.BaseType> = d3.Selection<T, any, T, any>;
import * as markers from './svg/markerDefs';
import * as shapes from './svg/shapeDefs';

export type ShapeName = keyof typeof shapes;

type RGB = `rgb(${number}, ${number}, ${number})`;
type RGBA = `rgba(${number}, ${number}, ${number}, ${number})`;
export type HEX = `#${string}`;

export type Color = RGB | RGBA | HEX | CSS.DataType.NamedColor | 'none';
export type Coords = [number, number];

export interface ProjectionParams {
    width: number;
    height: number;
    translateX?: number;
    translateY?: number;
    altitude: number;
    latitude?: number;
    longitude?: number;
    rotation?: number;
    borderWidth: number;
    larger?: boolean;
    fov?: number;
    tilt?: number;
    projectionName?: string;
};

export interface ContourParams {
    strokeWidth: number;
    strokeColor: Color;
    strokeDash: number;
    fillColor: Color;
}

export type InlineStyles = { [elemId: string]: CssDict };
export type CssDict = { [cssProp: string]: string };
export interface Tooltip {
    shapeId: string | null;
    element: SVGElement;
}

export interface TooltipDefs {
    [groupId: string]: {
        enabled: boolean;
        template: string;
        content?: string;
    };
}

export interface ProvidedFont {
    name: string;
    content: string;
}


interface ZoneDataRow {
    name: string;
    [key: string]: any;
}
interface ColumnDefinition {
    column: string;
}
interface ZoneData {
    data: ZoneDataRow[];
    numericCols: ColumnDefinition[];
    formatters: { [column: string]: (value: any) => string };
}

export interface ZonesData {
    [groupId: string]: ZoneData;
}

export enum ExportFontChoice {
    noExport = 0,
    convertToPath = 1,
    embedFont = 2,
    smallest = 3,
}

export interface ExportOptions {
    exportFonts?: ExportFontChoice;
    hideOnResize?: boolean;
    minifyJs?: boolean;
}

export type LegendColor = [Color, string];

export interface LegendDef {
    noData: {
        active: boolean;
        color: Color;
        text: string;
    };
    direction: 'h' | 'v';
    maxWidth: number;
    rectWidth: number;
    rectHeight: number;
    lineWidth: number;
    x: number;
    y: number;
    title: string;
    titleChanged?: boolean;
    labelOnLeft?: boolean;
    changes: Record<string, { dx: number; dy: number; title?: string }>;
}

export interface PathDefImage {
    name: string;
    content: string;
}

export type MarkerName = keyof typeof markers;

export interface PathDef {
    image?: PathDefImage;
    marker?: MarkerName;
    d: any; // Parsed path data structure
    height?: number;
    width?: number;
    duration?: number;
    index?: number;
}

export interface ShapeDefinition {
    id: string;
    pos: Coords;
    name?: ShapeName; // for symbols
    text?: string; // for labels
}


export interface PatternDefinition {
    hatch?: string;
    id?: string;
    backgroundColor?: Color;
    color?: Color;
    strokeWidth?: number;
    scale?: number;
    menuOpened?: boolean;
    active?: boolean;
}

interface MicroLayerDefinition {
    "stroke-width"?: number;
    "stroke-dasharray"?: number;
    stroke?: Color;
    disabled?: boolean;
    active?: boolean;
    menuOpened?: boolean;
    pattern?: PatternDefinition;
    fill?: Color;
    fills?: Color[];
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

export type MicroLayerId = LayerId | 'background' | 'other';
export type MicroPalette = {
    [layerId in MicroLayerId]: MicroLayerDefinition;
};
export type MicroPaletteWithBorder = MicroPalette & {
    borderParams: MicroBorderParams;
}