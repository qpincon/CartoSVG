declare module '*.png' {
  const value: number;
  export = value;
}
declare module '*inline' {
  const value: text;
  export = value;
}

declare module '*.jpg' {
  const value: number;
  export = value;
}
declare module '*.svg' {
  const value: text;
  export = value;
}

declare module 'd3-geo-projection' {
  import { GeoProjection, GeoStreamWrapper } from 'd3-geo';

  export function geoSatellite(): GeoProjection;
  export function geoBaker(): GeoProjection;
  export function geoClipCircle(angle: number): GeoStreamWrapper;
}

declare module 'parse-svg-path' {
  export default function parsePath(d: string): [string, number, number][];
}