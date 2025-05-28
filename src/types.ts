import * as CSS from 'csstype';
import type { MicroBorderParams } from './params';
import * as markers from './svg/markerDefs';
import * as shapes from './svg/shapeDefs';
import type { Feature, FeatureCollection, Geometry, MultiLineString, Polygon } from 'geojson';
import type { AnyScaleKey } from './util/color-scales';

export type SvgSelection = d3.Selection<SVGSVGElement, any, SVGSVGElement, any>;
export type D3Selection<T extends d3.BaseType> = d3.Selection<T, any, T, any>;
export type SvgGSelection = d3.Selection<SVGGElement, unknown, SVGGElement, undefined>;
export type FrameSelection = d3.Selection<SVGRectElement, unknown, SVGSVGElement, unknown>;
export type ShapeName = keyof typeof shapes;
export type Prettify<T> = {
    [K in keyof T]: T[K];
} & {};

type FlattenObject<T> = T[keyof T];
// Helper utility to convert union to intersection
export type UnionToIntersection<U> =
    (U extends any ? (k: U) => void : never) extends (k: infer I) => void ? I : never;
export type Flatten<T> = UnionToIntersection<FlattenObject<T>>;
type RGB = `rgb(${number}, ${number}, ${number})`;
type RGBA = `rgba(${number}, ${number}, ${number}, ${number})`;
export type HEX = `#${string}`;

export type Color = RGB | RGBA | HEX | CSS.DataType.NamedColor | 'none' | 'currentColor';
export type Coords = [number, number];
export interface Point {
    x: number;
    y: number;
}
export interface ContextMenuInfo {
    event: MouseEvent;
    position: [number, number];
    target: SVGPathElement;
}

export interface MenuState {
    chosingPoint: boolean;
    pointSelected: boolean;
    addingLabel: boolean;
    pathSelected: boolean;
    addingImageToPath: boolean;
    chosingMarker: boolean;
}

export interface ProjectionParams {
    width: number;
    height: number;
    translateX: number;
    translateY: number;
    altitude: number;
    latitude: number;
    longitude: number;
    rotation: number;
    borderWidth: number;
    larger?: boolean;
    fov?: number;
    tilt: number;
    projectionName?: string;
};

export interface MacroGroupData {
    name?: string;
    type?: string;
    data?: FeatureCollection<Geometry> | MultiLineString[] | [{ type: string }]
    id?: string | null;
    // TODO: delete
    props?: unknown[];
    class?: string;
    countryData?: Feature<Polygon, { name: string }>;
    filter?: string | null;
    showSource?: boolean;
    containerClass?: string;
}

export type InlineProps = Prettify<Pick<ProjectionParams, 'longitude' | 'latitude' | 'translateX' | 'translateY' | 'altitude' | 'rotation' | 'tilt'> & {
    showLand: boolean;
    showCountries: boolean;
}>

export type ParsedPathGroup = [string, number, number];
export type ParsedPath = ParsedPathGroup[];
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
        locale: string;
    };
}

export interface ProvidedFont {
    name: string;
    content: string;
}


export interface ZoneDataRow {
    name: string;
    [key: string]: string | number;
}
interface ColumnDefinition {
    column: string;
}

export type Formatter = (value: number) => string;
export type FormatterObject = { [column: string]: Formatter };
export interface ZoneData {
    data: ZoneDataRow[];
    provided?: boolean;
    numericCols: ColumnDefinition[];
    formatters?: FormatterObject;
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
        manual: boolean;
    };
    direction: 'h' | 'v';
    maxWidth: number;
    rectWidth: number;
    rectHeight: number;
    lineWidth: number;
    significantDigits?: number;
    x: number;
    y: number;
    title: string;
    // template string
    sampleHtml?: string;
    titleChanged?: boolean;
    labelOnLeft?: boolean;
    changes: Record<string, { dx: number; dy: number; title?: string }>;
}

export interface ColorDef {
    enabled: boolean;
    colorScale: "category" | "quantile" | "quantize";
    colorColumn: string;
    colorPalette: AnyScaleKey | 'Custom';
    nbBreaks: 5;
    legendEnabled: false;
}

export type ColorScale = d3.ScaleQuantile<string, number>
    | d3.ScaleQuantize<string, number>
    | d3.ScaleOrdinal<string, string>;

export type Mode = 'micro' | 'macro';
export type OrdinalMapping = Record<string, Record<string, Set<string>>>;

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
    scale: number;
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

export type InlinePropsMicro = {
    center: [number, number],
    zoom: number;
    pitch: number;
    bearing: number;
}