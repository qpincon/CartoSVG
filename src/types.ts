import type { DataType } from 'csstype';
import type { GlowParams, MacroBackgroundParams, MacroBorderParams, MacroParams, MicroBorderParams, MicroParams } from './params';
import * as markers from './svg/markerDefs';
import * as shapes from './svg/shapeDefs';
import type { Feature, FeatureCollection, Geometry, MultiLineString, Polygon } from 'geojson';
import type { AnyScaleKey } from './util/color-scales';

export type SvgSelection = d3.Selection<SVGSVGElement, any, SVGSVGElement, any>;
export type DefsSelection = d3.Selection<SVGDefsElement, any, SVGDefsElement, any>;
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

export type Color = RGB | RGBA | HEX | DataType.NamedColor | 'none' | 'currentColor';
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

export type ElementAnnotations = {
    [elemId: string]: {
        tooltip?: string;   // fully-styled HTML for tooltip (inline styles included)
        popover?: string;   // fully-styled HTML for popover (inline styles included)
    }
};

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

export type InlinePropsMacro = Prettify<Pick<ProjectionParams, 'longitude' | 'latitude' | 'translateX' | 'translateY' | 'altitude' | 'rotation' | 'tilt'> & {
    showLand: boolean;
    showCountries: boolean;
    showRoads: boolean;
    showWater: boolean;
    showMountains: boolean;
    landOnTop: boolean;
}>

export type ParsedPathGroup = [string, number, number];
export type ParsedPath = ParsedPathGroup[];
export interface ContourParams {
    strokeWidth: number;
    strokeColor: Color;
    strokeDash: number;
    fillColor: Color;
}

/** A one-click macro map style: sea/graticule, border, land contour, glow, and default country/adm CSS. */
export interface MacroPalette {
    background: MacroBackgroundParams;
    border: MacroBorderParams;
    land: ContourParams;
    /** null = no glow filter on any layer. `enabled` is decided per-layer when the palette is applied. */
    glow: Omit<GlowParams, "enabled"> | null;
    country: CssDict;
    countryHovered: CssDict;
    adm: CssDict;
    admHovered: CssDict;
    /** Default color for newly-drawn curves (`#paths path`). */
    curve: CssDict;
    /** Default color for newly-placed points/icons (`.shape`). */
    point: CssDict;
    /** Default color for newly-added labels (`.text`). */
    label: CssDict;
    /** Default color for freehand drawings (`#freehand-drawings .freehand`). */
    freehand: CssDict;
}

export type InlineStyles = { [elemId: string]: CssDict };
export type CssDict = { [cssProp: string]: string };
export interface Tooltip {
    shapeId: string | null;
    fo: SVGForeignObjectElement;
    div: HTMLDivElement;
    html?: string;
    measuring?: boolean;
}

export interface TooltipDefs {
    [groupId: string]: {
        enabled: boolean;
        template: string;
        containerStyle: Record<string, string>;
        locale: string;
    };
}

export interface ProvidedFont {
    name: string;       // familyName (e.g., "Roboto")
    slug: string;       // Bunny Fonts slug (e.g., "roboto")
    weight: number;     // e.g., 400
    style: string;      // "normal"
    defSubset: string;  // "latin"
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
    [admId: string]: ZoneData;
}


export type LegendColor = [Color, string];

export interface LegendDef {
    noDataInLegend: boolean;
    noDataText: string;
    direction: 'h' | 'v';
    maxWidth: number;
    rectWidth: number;
    rectHeight: number;
    lineWidth: number;
    significantDigits?: number;
    x: number;
    y: number;
    // template string
    sampleHtml?: string;
    labelOnLeft?: boolean;
    changes: Record<string, { dx: number; dy: number }>;
}

export interface ColorDef {
    enabled: boolean;
    colorScale: "category" | "quantile" | "quantize";
    colorColumn: string;
    colorPalette: AnyScaleKey | 'Custom';
    nbBreaks: 5;
    legendEnabled: false;
    noDataColor: {
        enabled: boolean;
        color: Color;
    };
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
    imageRotate?: boolean; // whether the image rotates following path curvature (default true)
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
    rotation?: number; // degrees, for labels only
    name?: ShapeName; // for symbols
    text?: string; // for labels
    fontManual?: boolean; // for labels: true if font-family was manually set by user
    customImage?: { name: string; content: string; width: number; height: number };
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

export interface MicroLayerDefinition {
    "stroke-width"?: number;
    "stroke-dasharray"?: number;
    active?: boolean;
    stroke?: Color;
    disabled?: boolean;
    menuOpened?: boolean;
    pattern?: PatternDefinition;
    fill?: Color;
    fills?: Color[];
    "3dBuildings"?: boolean;
    defaultBuildingHeight?: number;
}

export const MICRO_LAYERS = [
    "water",
    "grass",
    "forest",
    "sand",
    "roads",
    "railways",
    "paths",
    "buildings",
] as const;

type LayerId = typeof MICRO_LAYERS[number];

export type MicroLayerId = LayerId | 'background';
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


export interface StateMacro {
    baseCss: string;
    macroParams: MacroParams;
    inlinePropsMacro: InlinePropsMacro;
    orderedTabs: string[];
    chosenCountriesAdm: string[];
    zonesData: ZonesData;
    zonesGlow: Record<string, GlowParams>;
    // Use for land contour
    contourParams: ContourParams;
    // TODO: check what this is actually
    colorDataDefs: Record<string, ColorDef>;
    legendDefs: Record<string, LegendDef>;
    tooltipDefs: TooltipDefs;
    customCategoricalPalette: Color[];
    customContinuousPalette: Color[];
    visibleArea: number;
}

export interface StateMicro {
    microParams: MicroParams;
    inlinePropsMicro: InlinePropsMicro;
    microLayerDefinitions: MicroPalette;
    baseCss: string;
}

export interface StateCommon {
    providedFonts: ProvidedFont[];
    providedShapes: ShapeDefinition[];
    providedPaths: PathDef[];
    providedFreeHand: ParsedPath[][];
    inlineStyles: InlineStyles;
    elementLinks?: { [elemId: string]: string };
    elementAnnotations?: ElementAnnotations;
    // TODO: remove and compute from shape + label size
    shapeCount: number;
    currentMode: Mode;
    // TODO: remove and compute from last shape
    lastUsedLabelProps: CssDict;
    lastUsedAnnotationStyle?: { tooltip?: CssDict; popover?: CssDict };
    // Last-used text formatting (color, font-size, font-family) typed inside a tooltip/popover.
    lastUsedAnnotationFont?: { tooltip?: CssDict; popover?: CssDict };
}

export interface GlobalState {
    stateMacro: StateMacro;
    stateMicro: StateMicro;
    stateCommon: StateCommon;
}

export type SelectableEntityType = "shape" | "path" | "freehand";