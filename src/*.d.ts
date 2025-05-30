
declare module '*.png' {
  const value: string;
  export = value;
}

declare module '*.jpg' {
  const value: number;
  export = value;
}
declare module '*.svg' {
  const value: string;
  export = value;
}

// declare module 'layers/.*.json' {
//   const value: TopoJSON.Topology;
//   export default value;
// }

declare module 'd3-geo-projection' {
  import { GeoProjection, GeoStreamWrapper } from 'd3-geo';

  export function geoSatellite(): GeoProjection;
  export function geoBaker(): GeoProjection;
  export function geoClipCircle(angle: number): GeoStreamWrapper;
}

declare module 'parse-svg-path' {
  import type { ParsedPathGroup } from './types';

  export default function parsePath(d: string): ParsedPathGroup[];
}
