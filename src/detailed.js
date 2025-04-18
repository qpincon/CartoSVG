import { scaleLinear } from "d3-scale";
import {select} from "d3-selection";
import { getRenderedFeatures } from "./util/geometryStitch";
import { kebabCase } from "lodash-es";

export const interestingBasicV2Layers = [
    "Residential",
    "Forest",
    "Sand",
    "Grass",
    "Wood",
    "Water",
    "River",
    "Bridge",
    "Road network",
    "Path minor",
    "Path",
    "Building",
];

export function orderFeaturesByLayer(features) {
    features.sort((a, b) => {
        const layerIdA = interestingBasicV2Layers.indexOf(a.properties.mapLayerId);
        const layerIdB = interestingBasicV2Layers.indexOf(b.properties.mapLayerId);
        if (layerIdA < layerIdB) return -1;
        return 1;
    })

}

const pathStrokeWidth = scaleLinear([15, 22], [0.5, 4]).clamp(true);
const roadPrimaryStrokeWidth = scaleLinear([14, 18], [5, 14]).clamp(true);
const roadSecondaryStrokeWidth = scaleLinear([14, 18], [4, 12]).clamp(true);
const roadTertiaryStrokeWidth = scaleLinear([14, 18], [3, 10]).clamp(true);
const roadMinorStrokeWidth = scaleLinear([14, 18], [2, 6]).clamp(true);
const scaleLowZoom = scaleLinear([4, 14], [0.5, 2.5]).clamp(true);

export function getRoadStrokeWidth(roadFeature, zoom) {
    if (roadFeature.properties.sourceLayer !== "transportation") return null;
    if (zoom <= 14) return scaleLowZoom(zoom);
    const computedId = roadFeature.properties.computedId;
    if (computedId.includes('path')) return pathStrokeWidth(zoom);
    if (computedId.includes('primary') || computedId.includes('motorway') || computedId.includes('trunk')) return roadPrimaryStrokeWidth(zoom);
    if (computedId.includes('secondary')) return roadSecondaryStrokeWidth(zoom);
    if (computedId.includes('tertiary')) return roadTertiaryStrokeWidth(zoom);
    return roadMinorStrokeWidth(zoom);
}

export function drawPrettyMap(maplibreMap, svg, d3PathFunction, inlineStyles) {
    const zoom = maplibreMap.getZoom();
    const mapLibreContainer = select('#maplibre-map');
    const geometries = getRenderedFeatures(maplibreMap, { layers: interestingBasicV2Layers });
    orderFeaturesByLayer(geometries);
    console.log('geometries', geometries);
    svg.style("background-color", "#e8e8da");
    svg.append('g')
        .attr('id', 'micro')
        .selectAll('path')
        .data(geometries)
        .enter()
        .append("path")
        .attr("d", (d) => d3PathFunction(d.geometry))
        // .attr("class", d => kebabCase(d.properties.mapLayerId))
        .attr("class", d => d.properties.tileExtent ? 'tileExtent' : kebabCase(d.properties.mapLayerId))
        .attr("stroke-width", d => getRoadStrokeWidth(d, zoom))
        .attr("computed-id", d => d.properties.computedId)
        .attr("id", d => d.properties.uuid);
        // .attr("id", d => d.id);
    svg.append('g').attr('id', 'points-labels');

    mapLibreContainer.classed('transparent', true);
}