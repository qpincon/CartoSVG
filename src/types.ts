import * as CSS from 'csstype';
export type SvgSelection = d3.Selection<d3.BaseType, any, SVGSVGElement, any>

type RGB = `rgb(${number}, ${number}, ${number})`;
type RGBA = `rgba(${number}, ${number}, ${number}, ${number})`;
export type HEX = `#${string}`;

export type Color = RGB | RGBA | HEX | CSS.DataType.NamedColor;