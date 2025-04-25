import svgoConfig from './svgoExport.config';
import { select } from "d3-selection";
import { getRenderedFeatures } from "./util/geometryStitch";
import { cloneDeep, debounce, kebabCase, last, random, set, size } from "lodash-es";
import { color, hsl } from "d3-color";
import { findStyleSheet, fontsToCss, getUsedInlineFonts, updateStyleSheetOrGenerateCss } from "./util/dom";
import { HatchPatternGenerator } from "./svg/patternGenerator";
import { appendClip } from "./svg/svgDefs";
import { discriminateCssForExport, download, findProp } from "./util/common";
import { additionnalCssExport, changeIdAndReferences, exportFontChoices, getIntersectionObservingPart, inlineFontVsPath, rgb2hex } from "./svg/export";
import { createRoundedRectangleGeoJSON } from './util/geometry';
import bboxPolygon from '@turf/bbox-polygon';
import booleanDisjoint from '@turf/boolean-disjoint';
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
    "Railway",
    // "Path minor",
    "Path",
    "Building",
];

const patternGenerator = new HatchPatternGenerator();
export function orderFeaturesByLayer(features) {
    features.sort((a, b) => {
        const layerIdA = interestingBasicV2Layers.indexOf(a.properties.mapLayerId);
        const layerIdB = interestingBasicV2Layers.indexOf(b.properties.mapLayerId);
        const renderHeightA = a.properties['render_height'];
        const renderHeightB = b.properties['render_height'];
        if (renderHeightA != null && renderHeightB != null) return renderHeightA < renderHeightB ? - 1 : 1;
        if (layerIdA < layerIdB) return -1;
        return 1;
    })

}

// const pathStrokeWidth = scaleLinear([15, 22], [0.5, 4]).clamp(true);
// const roadPrimaryStrokeWidth = scaleLinear([14, 18], [5, 14]).clamp(true);
// const roadSecondaryStrokeWidth = scaleLinear([14, 18], [4, 12]).clamp(true);
// const roadTertiaryStrokeWidth = scaleLinear([14, 18], [3, 10]).clamp(true);
// const roadMinorStrokeWidth = scaleLinear([14, 18], [2, 6]).clamp(true);
// const scaleLowZoom = scaleLinear([4, 14], [0.5, 2.5]).clamp(true);

// export function getRoadStrokeWidth(roadFeature, maplibreMap) {
//     if (roadFeature.properties.sourceLayer !== "transportation") return null;
//     const zoom = maplibreMap.getZoom();
//     if (zoom <= 14) return scaleLowZoom(zoom);
//     const computedId = roadFeature.properties.computedId;
//     if (computedId.includes('path')) return pathStrokeWidth(zoom);
//     if (computedId.includes('primary') || computedId.includes('motorway') || computedId.includes('trunk')) return roadPrimaryStrokeWidth(zoom);
//     if (computedId.includes('secondary')) return roadSecondaryStrokeWidth(zoom);
//     if (computedId.includes('tertiary')) return roadTertiaryStrokeWidth(zoom);
//     return roadMinorStrokeWidth(zoom);
// }

export function drawPrettyMap(maplibreMap, svg, d3PathFunction, layerDefinitions, generalParams) {
    console.log('layerDefinitions=', layerDefinitions);
    const mapLibreContainer = select('#maplibre-map');
    const layersToQuery = interestingBasicV2Layers.filter(layer => {
        return layerDefinitions[kebabCase(layer)]?.active !== false;
    });
    updateSvgPatterns(svg.node(), layerDefinitions);
    const geometries = getRenderedFeatures(maplibreMap, { layers: layersToQuery });
    orderFeaturesByLayer(geometries);
    console.log('geometries', geometries);

    const width = findProp('width', generalParams);
    const height = findProp('height', generalParams);
    const borderPadding = findProp('borderPadding', generalParams);
    const borderRadius = findProp('borderRadius', generalParams);

    const outerFrameWidth = width - borderPadding;
    const outerFrameHeight = height - borderPadding;
    const outerFrameRx = (borderRadius / 100) * Math.min(outerFrameWidth, outerFrameHeight);
    // Background layer
    svg.append('rect')
        .attr('id', 'micro-background')
        .attr('x', 0)
        .attr('y', 0)
        .attr('pathLength', 1)
        .attr('width', width)
        .attr('height', height)
        .attr('rx', outerFrameRx);

    svg.append('g')
        .attr('id', 'micro')
        .attr("clip-path", "url(#clipMapBorder)")
        .selectAll('path')
        .data(geometries)
        .enter()
        .append("path")
        .attr('pathLength', 1)
        .attr("d", (d) => d3PathFunction(d.geometry))
        .attr("class", d => {
            const layerIdKebab = kebabCase(d.properties.mapLayerId);
            const classes = [layerIdKebab];
            if (layerIdKebab.includes('path') || layerIdKebab.includes('road')) classes.push('line');
            else classes.push(d.geometry.type.includes("Line") ? 'line' : 'poly');
            const state = layerDefinitions[layerIdKebab];
            if (!state) classes.push('other');
            if (state?.fills) {
                classes.push(`${layerIdKebab}-${random(0, state.fills.length - 1)}`);
            }
            return classes.join(' ');
        })
        .attr("stroke-width", d => d.properties.paint['line-width'] ?? null)
        // .attr("computed-id", d => d.properties.computedId)
        .attr("id", d => d.properties.uuid);
    svg.append('g').attr('id', 'points-labels');
    svg.style("pointer-events", "none");
    mapLibreContainer.style('opacity', 0);

    // Post-clipping - can't get it to work with d3 postclip and custom stream
    setTimeout(() => {
        const innerFrameWidth = outerFrameWidth - borderPadding;
        const innerFrameHeight = outerFrameHeight - borderPadding;
        const innerFrameRadius = (borderRadius / 100) * (Math.min(innerFrameWidth, innerFrameHeight) - (borderPadding));
        const roundedRect = createRoundedRectangleGeoJSON(innerFrameWidth, innerFrameHeight, innerFrameRadius, innerFrameWidth / 2 + borderPadding, innerFrameHeight / 2 + borderPadding);
       
        const toRemove = [];
        document.querySelectorAll('#static-svg-map g path, #static-svg-map g text').forEach(el => {
            const bbox = el.getBBox();
            const bboxRect = [bbox.x, height-bbox.y, bbox.x + bbox.width, height-bbox.y - bbox.height];
            const bboxPoly = bboxPolygon(bboxRect);
            if (booleanDisjoint(roundedRect, bboxPoly)) {
                toRemove.push(el);
            }
        });
        console.log('toRemove', toRemove);
        toRemove.forEach(el => el.remove());
    }, 100);
}

function polyToPath(coords, height) {
    let d = '';
    for (let i = 0; i < coords.length; i++) {
        const p = coords[i];
        if (i === 0) d+= `M${p[0]},${height- p[1]}`;
        else d+= `L${p[0]},${height- p[1]}`;
    }
    return d;
}

export function drawMicroFrame(svg, width, height, borderWidth, borderRadius, borderPadding, borderColor, animated) {
    // Calculate positions and dimensions
    // For the outer frame (border padding)
    const outerFrameHalfWidth = borderPadding / 2;
    const outerFrameX = outerFrameHalfWidth;
    const outerFrameY = outerFrameHalfWidth;
    const outerFrameWidth = width - borderPadding;
    const outerFrameHeight = height - borderPadding;

    // For the inner frame (border width)
    const innerFrameX = outerFrameX + outerFrameHalfWidth;
    const innerFrameY = outerFrameY + outerFrameHalfWidth;
    const innerFrameWidth = outerFrameWidth - borderPadding;
    const innerFrameHeight = outerFrameHeight - borderPadding;
    const innerFrameRx = (borderRadius / 100) * (Math.min(innerFrameWidth, innerFrameHeight) - (borderPadding));

    // Draw the inner frame (border width)
    const frame = svg.append('rect')
        .attr('x', innerFrameX)
        .attr('y', innerFrameY)
        .attr('id', 'frame')
        .attr('pathLength', 1)
        .attr('width', innerFrameWidth)
        .attr('height', innerFrameHeight)
        .attr('rx', innerFrameRx)
        .attr('fill', 'none')
        .attr('stroke', borderColor)
        .attr('stroke-width', borderWidth);
    appendClip(svg, innerFrameWidth, innerFrameHeight, innerFrameRx, innerFrameX, innerFrameY)
    return frame;
}

export function initLayersState(providedPalette) {
    const palette = cloneDeep(providedPalette);
    if (!palette['forest']) palette['forest'] = { ...palette['wood'], active: false };
    if (!palette['path']) palette['path'] = { ...palette['road-network'], active: false };
    if (!palette['railway']) palette['railway'] = { ...palette['railway'], active: false };
    // if (!palette['path-minor']) palette['path-minor'] = { ...palette['road-network'], active: false };
    Object.entries(palette).forEach(([layer, state]) => {
        if (state.menuOpened == null) state.menuOpened = false;
        let pattern = state.pattern;
        if (!pattern && state.fill) {
            state.pattern = pattern = { hatch: '.', active: false };
        } else if (pattern) {
            pattern.active = true;
        }
        if (!pattern) return;
        if (pattern.menuOpened == null) pattern.menuOpened = pattern.active;
        if (!pattern.id) pattern.id = `pattern-${layer}`;
        if (!pattern.color) pattern.color = darken(state.fill);
        if (!pattern.strokeWidth) pattern.strokeWidth = 3;
        if (!pattern.size) pattern.size = 13;
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

function darken(c, quantity = 0.4) {
    return hsl(color(c)).darker(quantity).formatHex();
}

const CSS_PROPS = ['stroke', 'stroke-width', 'fill', 'stroke-dasharray', 'stroke-linejoin', 'stroke-linecap'];

export function generateCssFromState(state) {
    const [sheet, _] = findStyleSheet("#micro .line");
    // "other" default color definitions wil be overriden by mode specific '>' selector
    let css = `
    #micro > .line { 
        fill: none; 
        stroke-linecap: round;
        stroke-linejoin: round;
    }
    #micro > .poly { 
        stroke-linejoin: round;
    }
    `;
    for (const [layer, layerDef] of Object.entries(state)) {
        let ruleContent = {};
        let ruleHoverContent = {};
        if (layerDef.stroke) {
            ruleContent['stroke'] = layerDef.stroke;
            if (!layer.includes('road') && !layer.includes('path') && !layer.includes('rail')) {
                ruleContent['stroke-width'] = layerDef['stroke-width'] ?? '1px';
            }
            if (layer.includes('path') && !layerDef['stroke-dasharray']) {
                ruleContent['stroke-dasharray'] = 5;
            }
            const dashArray = layerDef['stroke-dasharray'];
            if (dashArray) ruleContent['stroke-dasharray'] = dashArray;
            const lighter = lighten(layerDef.stroke);
            ruleHoverContent['stroke'] = lighter;
        }
        if (layerDef.pattern?.active) {
            ruleContent['fill'] = `url(#${layerDef.pattern.id})`;
        }
        else if (layerDef.fill) {
            ruleContent['fill'] = layerDef.fill;
            const lighter = lighten(layerDef.fill);
            ruleHoverContent['fill'] = lighter;
        }
        if (size(ruleContent) > 0) {
            if (layer === "background") {
                css += updateStyleSheetOrGenerateCss(sheet, '#micro-background', ruleContent);
            } else {
                css += updateStyleSheetOrGenerateCss(sheet, `#micro > .${layer}`, ruleContent);
                css += updateStyleSheetOrGenerateCss(sheet, `#micro > .${layer}:hover`, ruleHoverContent);
            }
        }
        if (layerDef.fills) {
            layerDef.fills.forEach((fill, i) => {
                css += updateStyleSheetOrGenerateCss(sheet, `#micro > .${layer}-${i}`, { 'fill': fill });
                css += updateStyleSheetOrGenerateCss(sheet, `#micro > .${layer}-${i}:hover`, { 'fill': lighten(fill) });
            });
        }
    }
    if (sheet) return null;
    return css;
}

// Returns true if we should redraw (layer deactivated for instance)
export function onMicroParamChange(layer, prop, value, layerState) {
    if (prop.includes("pattern")) {
        updateSvgPatterns(document.getElementById('static-svg-map'), layerState);
        replaceCssSheetContent(layerState);
        return false;
    }
    if (prop.includes("active")) {
        return true;
    }
    let ruleTxt = `#micro > .${layer}`;
    if (layer === "background") ruleTxt = "#micro-background";
    // Change "building-0" for instance
    if (prop[0] === "fills") ruleTxt = `#micro > .${layer}-${last(prop)}`;
    const [sheet, rule] = findStyleSheet(ruleTxt);
    if (!rule) return false;
    if (prop[0] === "fills") {
        rule.style.setProperty("fill", value);
    } else {
        if (layerState[layer].pattern?.active) {
            updateSvgPatterns(document.getElementById('static-svg-map'), layerState);
        } else {
            rule.style.setProperty(prop, value);
        }
    }
    replaceCssSheetContent(layerState);
    return false;

}

// Called when CSS is updated with inline style editor. Returns true if we actually updated layer definition
export function syncLayerStateWithCss(eventType, cssProp, value, layerState) {
    if (eventType === "inline") return;
    const cssSelector = eventType.selectorText;
    if (!cssSelector.includes('#micro')) return false;
    if (cssProp === "fill") {
        updateSvgPatterns(document.getElementById('static-svg-map'), layerState);
    }
    const layer = cssSelector.match(/#micro > \.(.*)/)?.[1] ?? 'background';
    let path = [layer, cssProp];
    let isFills = false;
    if (layer.includes('-') && cssProp === "fill") {
        isFills = true;
        path = layer.split('-');
        path.splice(1, 0, 'fills');
    }
    if (!isFills && !CSS_PROPS.includes(last(path))) return false;
    set(layerState, path, value);
    replaceCssSheetContent(layerState);
    return true;
}

export const replaceCssSheetContent = debounce((layerState) => {
    const styleSheet = document.getElementById('common-style-sheet-elem-micro');
    const microCss = generateCssFromState(layerState);
    if (microCss) styleSheet.innerHTML = microCss;
}, 500);

export function updateSvgPatterns(svgNode, layerState) {
    if (!svgNode) return;
    const patterns = Object.values(layerState).map((def) => {
        return {
            ...def.pattern,
            backgroundColor: def.fill
        }
    }).filter(pattern => pattern?.active === true);
    console.log('patterns=', patterns);
    patternGenerator.addOrUpdatePatternsForSVG(svgNode.querySelector('defs'), patterns);
}

const domParser = new DOMParser();
export async function exportMicro(svg, providedFonts, commonCss, animated, { exportFonts = exportFontChoices.convertToPath}) {
        
    const svgNode = svg.node();
    svgNode.removeAttribute('style');
    const usedFonts = getUsedInlineFonts(svgNode);
    const usedProvidedFonts = providedFonts.filter(font => usedFonts.has(font.name));
    const SVGO = await import('svgo/browser');

    const defs = svgNode.querySelector('defs').cloneNode(true);
    svgNode.querySelectorAll('#micro > path').forEach(el => el.removeAttribute('id'));
    // Optimize whole SVG
    const finalSvg = SVGO.optimize(svgNode.outerHTML, svgoConfig).data;
    const optimizedSVG = domParser.parseFromString(finalSvg, 'image/svg+xml');
    let pathIsBetter = false;
    if (exportFonts == exportFontChoices.smallest || exportFonts == exportFontChoices.convertToPath) {
        pathIsBetter = await inlineFontVsPath(optimizedSVG.firstChild, providedFonts);
    }
    else if (exportFonts == exportFontChoices.noExport) {
        pathIsBetter = true;
    }
    const js = animated ? getIntersectionObservingPart(false) : null;

    // Styling
    const styleElem = document.createElementNS("http://www.w3.org/2000/svg", 'style');
    const renderedCss = commonCss.replaceAll(/rgb\(.*?\)/g, rgb2hex) + additionnalCssExport;
    const {mapId, finalCss } = discriminateCssForExport(renderedCss);
    optimizedSVG.firstChild.setAttribute('id', mapId);
    optimizedSVG.firstChild.querySelector('defs').remove();
    optimizedSVG.firstChild.append(defs);
    changeIdAndReferences(optimizedSVG.firstChild, mapId);

    styleElem.innerHTML = pathIsBetter ? finalCss : finalCss + fontsToCss(usedProvidedFonts);
    optimizedSVG.firstChild.append(styleElem);
    optimizedSVG.firstChild.classList.remove('animate-transition');
    optimizedSVG.firstChild.classList.add('cartosvg');
    if (js) {
        const scriptElem = document.createElementNS("http://www.w3.org/2000/svg", 'script');
        const scriptContent = document.createTextNode(js);
        scriptElem.appendChild(scriptContent);
        optimizedSVG.firstChild.append(scriptElem);
    }
    download(optimizedSVG.firstChild.outerHTML, 'text/plain', 'cartosvg-export.svg');

} 