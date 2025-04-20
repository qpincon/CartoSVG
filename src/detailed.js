import { scaleLinear } from "d3-scale";
import { select } from "d3-selection";
import { getRenderedFeatures } from "./util/geometryStitch";
import { debounce, has, kebabCase, last, random, set } from "lodash-es";
import { color, hsl } from "d3-color";
import { findStyleSheet } from "./util/dom";
export const interestingBasicV2Layers = [
    "Residential",
    "Forest",
    "Sand",
    "Grass",
    "Wood",
    "Water",
    // "River",
    // "Bridge",
    "Pier",
    "Road network",
    // "Path minor",
    "Path",
    "Building",
];

export function orderFeaturesByLayer(features) {
    features.sort((a, b) => {
        const layerIdA = interestingBasicV2Layers.indexOf(a.properties.mapLayerId);
        const layerIdB = interestingBasicV2Layers.indexOf(b.properties.mapLayerId);
        const renderHeightA = a.properties['render_height'];
        const renderHeightB = b.properties['render_height'];
        if (renderHeightA != null && renderHeightB != null) return renderHeightA > renderHeightB ? - 1 : 1;
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

export function drawPrettyMap(maplibreMap, svg, d3PathFunction, layerDefinitions) {
    console.log('layerDefinitions=', layerDefinitions);
    const zoom = maplibreMap.getZoom();
    const mapLibreContainer = select('#maplibre-map');
    const layersToQuery = interestingBasicV2Layers.filter(layer => {
        return layerDefinitions[kebabCase(layer)]?.active === true;
    }); 
    console.log(layersToQuery);
    const geometries = getRenderedFeatures(maplibreMap, { layers: layersToQuery });
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
        .attr("class", d => {
            const layerIdKebab = kebabCase(d.properties.mapLayerId);
            const classes = [layerIdKebab];
            classes.push(d.geometry.type.includes("Line") ? 'line' : 'poly');
            const state = layerDefinitions[layerIdKebab];
            if (state?.fills) {
                classes.push(`${layerIdKebab}-${random(0, state.fills.length - 1)}`);
            }
            return classes.join(' ');
        })
        .attr("stroke-width", d => getRoadStrokeWidth(d, zoom))
        .attr("computed-id", d => d.properties.computedId)
        .attr("id", d => d.properties.uuid);
    svg.append('g').attr('id', 'points-labels');
    svg.style("pointer-events", "none");
    mapLibreContainer.style('opacity', 0);
}

export const peachPalette = {
    background: { fill: "#F2F4CB", disabled: true, active:true},
    other: { fill: "#F2F4CB", stroke: "#2F3737", disabled: true, active:true },
    building: { fills: ["#C5283D", "#E9724C", "#FFC857"], stroke: "#2F3737", active: true },
    water: { fill: "#a1e3ff", stroke: "#85c9e6", active: true },
    grass: { fill: "#D0F1BF", stroke: "#2F3737", active: true },
    wood: { fill: "#64B96A", stroke: "#2F3737", active: true },
    "road-network": { stroke: "#2F3737", active: true },
};

export function initLayersState(providedPalette) {
    const palette = { ...providedPalette };
    if (!palette['forest']) palette['forest'] = { ...palette['wood'], active: false };
    if (!palette['path']) palette['path'] = { ...palette['road-network'], active: false };
    // if (!palette['path-minor']) palette['path-minor'] = { ...palette['road-network'], active: false };
    Object.values(palette).forEach( state => {
        state.menuOpened = state.active;
    });
    // if (!palette['building1']) {
    //     const strokeRef = palette['building0'].stroke;
    //     const fillRef = hsl(color(palette['building0'].fill));
    //     console.log(fillRef);
    //     const lighter1 = fillRef.brighter(0.2).formatHex();
    //     const lighter2 = fillRef.brighter(0.4).formatHex();
    //     palette['building1'] = { stroke: strokeRef, fill: lighter1 };
    //     palette['building2'] = { stroke: strokeRef, fill: lighter2 };
    // }
    return palette;
}

function lighten(c, quantity = 0.2) {
    return hsl(color(c)).brighter(quantity).formatHex();
}

export function generateCssFromState(state) {

    const otherStroke = state['other'].stroke;
    const otherFill = state['other'].fill;

    // "other" default color definitions wil be overriden by mode specific '>' selector
    let css = `
    #micro .line { 
        fill: none; 
        stroke-linecap: round;
        stroke-linejoin: round;
        stroke: ${otherStroke};
    }
    #micro .poly { 
        stroke-linejoin: round;
        fill: ${otherFill};
    }
    `;
    for (const [layer, layerDef] of Object.entries(state)) {
        if (layer === "other") continue;
        let ruleContent = '';
        let ruleHoverContent = '';
        if (layerDef.stroke) {
            ruleContent += `stroke: ${layerDef.stroke};`;
            if (!layer.includes('road') && !layer.includes('path'))  {
                ruleContent += `stroke-width: 1px;`;
            }
            if (layer.includes('path')) {
                ruleContent += `stroke-dasharray: 5;`;
            }
            const lighter = lighten(layerDef.stroke);
            ruleHoverContent += `stroke: ${lighter};`;
        }
        if (layerDef.fill) {
            ruleContent += `fill: ${layerDef.fill};`;
            const lighter = lighten(layerDef.fill);
            ruleHoverContent += `fill: ${lighter};`;
        }
        if (ruleContent.length) {
            css += `#micro > .${layer} { ${ruleContent} }`;
            css += `#micro > .${layer}:hover { ${ruleHoverContent} }`;
        }
        if (layerDef.fills) {
            layerDef.fills.forEach((fill, i) => {
                css += `#micro > .${layer}-${i} { fill: ${fill}; }`;
                css += `#micro > .${layer}-${i}:hover { fill: ${lighten(fill)}; }`;
            });
        }
    }
    return css;
}

// Returns true if we should redraw (layer deactivated for instance)
export function onMicroParamChange(layer, prop, value, layerState) {
    if (prop === "active") {
        return true;
    }
    let ruleTxt = `#micro > .${layer}`;
    // Change "building-0" for instance
    if (Array.isArray(prop)) ruleTxt = `#micro > .${layer}-${last(prop)}`;
    const [sheet, rule] = findStyleSheet(ruleTxt);
    if (!rule) return false;
    if (Array.isArray(prop) && prop[0] === "fills") {
        rule.style.setProperty("fill", value);
    } else {
        rule.style.setProperty(prop, value);
    }
    replaceCssSheetContent(layerState);
    return false;

}

// Called when CSS is update with inline style editor
export function syncLayerStateWithCss(eventType, cssProp, value, layerState) {
    const cssSelector = eventType.selectorText;
    if (!cssSelector.includes('#micro >')) return false;
    const layer = cssSelector.match(/#micro > \.(.*)/)[1];
    let path = [layer, cssProp];
    if (layer.includes('-') && cssProp === "fill") {
        path = layer.split('-');
        path.splice(1, 0, 'fills');
    }
    if (!has(layerState, path)) return false;
    set(layerState, path, value);
    replaceCssSheetContent(layerState);
    return true;
}

const replaceCssSheetContent = debounce((layerState) => {
    const styleSheet = document.getElementById('common-style-sheet-elem-micro');
    const microCss = generateCssFromState(layerState);
    styleSheet.innerHTML = microCss;
}, 500);