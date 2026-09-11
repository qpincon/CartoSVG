import { appState, commonState, macroState } from "src/state.svelte";
import { log } from 'src/util/log';
import { select } from "d3-selection";
import { geoGraticule, geoPath } from "d3-geo";
import { GEO_META_KEYS, geometriesState, initializeAdms, resolvedAdmCountryOutline, resolvedAdmGeometry } from "./geometry-data";
import type { Color, FrameSelection, MacroGroupData, SvgSelection } from "src/types";
import { appendClip, appendGlow, glowFilterId } from "src/svg/svgDefs";
import type { Feature, MultiLineString, Polygon } from "geojson";
import { appendCountryImageNew, appendLandImageNew } from "src/svg/contourMethods";
import { getNumericCols, sortBy } from "src/util/common";
import { applyStyles } from "src/util/dom";
import { saveState } from "src/util/save";
import { addTooltipListener } from "src/tooltip";
import { getProjection } from "src/util/projections";
import { macroPositionVars } from "src/stateDefaults";
import { changeAltitudeScale } from "./interactions";
import { updateZonesDataFormatters } from "./formatting";
import { updateMacroRoads } from "./roads";
import { updateMacroWater } from "./water";
import { updateMacroMountains } from "./mountains";

/** Filters `orderedTabs` down to the layers currently toggled on ("land"/"countries" can be hidden). */
export function visibleOrderedTabs(tabs: string[]): string[] {
    return tabs.filter((x) => {
        if (x === "countries") return macroState.inlinePropsMacro.showCountries;
        if (x === "land") return macroState.inlinePropsMacro.showLand;
        return true;
    });
}

/**
 * Reinserts "land" at the front (bottom, filled) or back (top, contour-only) of the
 * paint-order list based on `inlinePropsMacro.landOnTop`, independent of where "land" sits
 * in `orderedTabs` — that array is only the sidebar's display order.
 */
function orderTabsForPainting(tabs: string[]): string[] {
    if (!tabs.includes("land")) return tabs;
    const rest = tabs.filter((x) => x !== "land");
    return macroState.inlinePropsMacro.landOnTop ? [...rest, "land"] : ["land", ...rest];
}

function macroFrameRect(width: number, height: number, borderWidth: number, borderRadius: number) {
    return {
        rx: Math.max(width, height) * (borderRadius / 100),
        x: borderWidth / 2,
        y: borderWidth / 2,
        width: width - borderWidth,
        height: height - borderWidth,
    };
}

function ensureLayerGroup(svg: SvgSelection, id: string): SVGGElement {
    let group = svg.select<SVGGElement>(`#${id}`).node();
    if (!group) {
        group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        group.setAttribute('id', id);
        // Decorative-only: never intercept clicks/hover, so users can still select/click
        // through to the country shapes and annotations these layers sit on top of.
        group.setAttribute('pointer-events', 'none');
    }
    // Repositioned on every call, not just on creation: drawMacro() removes and rebuilds
    // every `.macro-layer` element on each redraw via D3's `.join("g")`, and since the
    // removal leaves no anchor for the join's enter selection, the rebuilt elements get
    // appended to the end of `svg` — after this group, if it isn't moved back. Re-anchoring
    // here every time keeps it immediately before #points-labels regardless.
    const pointsLabels = svg.select<Element>('#points-labels').node();
    if (pointsLabels) pointsLabels.before(group);
    else svg.node()!.append(group);
    return group;
}

export async function drawMacroBase(svg: SvgSelection, simplified = false): Promise<void> {
    log("drawMacroBase", simplified);
    if (!svg || svg.empty()) return;
    const computedOrderedTabs = orderTabsForPainting(visibleOrderedTabs(macroState.orderedTabs));

    const width = macroState.macroParams.General.width;
    const height = macroState.macroParams.General.height;
    const container = select("#map-container");
    const mapLibreContainer = select("#maplibre-map");

    // .digits(2) trims the "d" attribute precision on country/adm/land paths — matches
    // src/macro/roads.ts, water.ts and mountains.ts, which already do this for payload size.
    appState.path = geoPath(appState.projection).digits(2);
    appState.pathLarger = geoPath(appState.projectionLarger).digits(2);

    await initializeAdms();
    const graticule = geoGraticule().step([macroState.macroParams.Background.graticuleStep, macroState.macroParams.Background.graticuleStep])();
    if (!macroState.macroParams.Background.showGraticule) graticule.coordinates = [];
    if (simplified) {
        svg.remove();
        let canvas = container.select<HTMLCanvasElement>("#canvas");
        if (canvas.empty()) {
            canvas = container.append("canvas").attr("id", "canvas");
        }
        // Setting width/height (even to the same value) resets the canvas bitmap, which is
        // also what clears out whatever the previous simplified draw left behind.
        canvas.attr("width", width).attr("height", height);
        const context = canvas!.node()!.getContext("2d")!;
        context.globalAlpha = 1;
        context.fillStyle = "#55a4c5";
        context.fillRect(0, 0, width, height);
        appState.path = geoPath(appState.projection, context);
        context.beginPath();
        appState.path(graticule);
        context.strokeStyle = "#ddf";
        context.globalAlpha = 0.8;
        context.stroke();
        context.globalAlpha = 1;
        context.fillStyle = "#cdb396";
        context.beginPath();
        appState.path(simplified ? geometriesState.simpleLand : geometriesState.land);
        context.fill();
        return;
    }

    svg.attr("width", `${width}`).attr("height", `${height}`);
    container.style("width", `${width}px`).style("height", `${height}px`);

    const groupData: MacroGroupData[] = [];
    Object.entries(macroState.zonesGlow).forEach(([layer, glowParams]) => {
        if (!glowParams.enabled) return;
        appendGlow(svg, glowFilterId(layer), false, glowParams);
    });
    mapLibreContainer.style("display", "none");
    container.style("display", "block");

    // #clipMapBorder must exist before drawMacro() runs: land/country image layers embed it
    // into their data URI at build time (see embedRefClone in contourMethods.ts), which needs
    // the element in the DOM already — unlike a plain clip-path attribute, that's not a live
    // reference resolved later. drawMacroFrame() recreates the same clipPath afterward once the
    // border is drawn; appendClip() is idempotent (replaces any existing #clipMapBorder).
    const earlyFrameRect = macroFrameRect(width, height, macroState.macroParams.Border.borderWidth, macroState.macroParams.Border.borderRadius);
    appendClip(svg, earlyFrameRect.width, earlyFrameRect.height, earlyFrameRect.rx, earlyFrameRect.x, earlyFrameRect.y);

    drawMacro(svg, graticule, groupData, computedOrderedTabs);

    // Re-raise annotation groups so they render on top of the recreated macro layers
    svg.select('#points-labels').raise();
    svg.select('#paths').raise();
    svg.select('#freehand-drawings').raise();

    updateMacroMountains(ensureLayerGroup(svg, 'mountains-layer'));
    updateMacroWater(ensureLayerGroup(svg, 'water-layer'));
    updateMacroRoads(ensureLayerGroup(svg, 'roads-layer'));

    select("#outline").style("fill", macroState.macroParams.Background.seaColor);

    let frame: FrameSelection;
    frame = drawMacroFrame(
        svg,
        macroState.macroParams.General.width,
        macroState.macroParams.General.height,
        macroState.macroParams.Border.borderWidth,
        macroState.macroParams.Border.borderRadius,
        macroState.macroParams.Border.borderColor,
        false
    );
    updateZonesDataFormatters();

    svg.selectAll("path[pathLength]").attr("pathLength", null);

    /** Wait a bit before attaching the tooltip in order to make it the last element and to appear above everything else */
    setTimeout(() => {
        addTooltipListener(svg.node() as SVGSVGElement, macroState.tooltipDefs, macroState.zonesData, commonState.elementAnnotations);
    }, 500);
}

function drawMacro(svg: SvgSelection, graticule: MultiLineString, groupData: MacroGroupData[], computedOrderedTabs: string[]): void {
    const width = macroState.macroParams.General.width;
    const height = macroState.macroParams.General.height;
    const borderWidth = macroState.macroParams.Border.borderWidth;
    const outline = { type: "Sphere" };
    svg.selectAll('.macro-layer').remove();
    groupData.push({
        name: "outline",
        data: [outline],
        id: null,
        props: [],
        class: "outline",
        filter: null,
    });
    groupData.push({
        name: "graticule",
        data: [graticule],
        id: null,
        props: [],
        class: "graticule",
        filter: null,
    });
    // A country's ADM1/ADM2 file embeds that country's own ADM0 outline, presimplified
    // together with its regions so the two always nest exactly (see geometry-data.ts /
    // scripts/getAndSimplifyWorld.ts). For any country with an active ADM1/ADM2 tab, use
    // that embedded outline instead of the globally-presimplified `geometriesState.countries`
    // version, both for the glow-filter mask below and for the `.country` fill itself.
    const outlineOverrideByCountryName = new Map<string, Feature<Polygon, { name: string }>>();
    computedOrderedTabs.forEach((layer) => {
        if (layer === "countries" || layer === "land") return;
        const outline = resolvedAdmCountryOutline[layer];
        if (outline) {
            const countryOutlineId = layer.substring(0, layer.length - 5);
            outlineOverrideByCountryName.set(countryOutlineId, {
                ...outline,
                properties: { ...outline.properties, name: countryOutlineId },
            });
        }
    });
    computedOrderedTabs.forEach((layer, i) => {
        const filter = macroState.zonesGlow[layer]?.enabled ? glowFilterId(layer) : null;
        if (layer === "countries" && macroState.inlinePropsMacro.showCountries && geometriesState.countries) {
            if (!("countries" in macroState.zonesData) && !macroState.zonesData["countries"]?.provided) {
                const countryProps = geometriesState.countries.features.map((f) => {
                    const props = { ...f.properties };
                    GEO_META_KEYS.forEach((k) => delete (props as any)[k]);
                    return props;
                });
                sortBy(countryProps, "name")!;
                macroState.zonesData["countries"] = {
                    data: countryProps,
                    numericCols: getNumericCols(countryProps),
                };
                // getZonesDataFormatters();
            }
            groupData.push({
                name: "countries",
                data: outlineOverrideByCountryName.size
                    ? {
                          ...geometriesState.countries,
                          features: geometriesState.countries.features.map(
                              (f) => outlineOverrideByCountryName.get(f.properties.name) ?? f,
                          ),
                      }
                    : geometriesState.countries,
                id: "name",
                props: [],
                containerClass: "choro",
                class: "country",
                filter: filter,
            });
        }
        if (layer === "land" && macroState.inlinePropsMacro.showLand) groupData.push({ type: "landImg", showSource: i === 0 });
        // selected country
        else if (layer !== "countries") {
            groupData.push({
                name: layer,
                data: resolvedAdmGeometry[layer],
                id: "name",
                props: [],
                containerClass: "choro",
                class: "adm",
                filter: null,
            });
            const countryOutlineId = layer.substring(0, layer.length - 5);
            const countryData =
                outlineOverrideByCountryName.get(countryOutlineId) ??
                geometriesState.countries?.features.find((country) => country.properties.name === countryOutlineId);
            groupData.push({
                name: `${countryOutlineId}-img`,
                type: "filterImg",
                countryData,
                filter,
            });
        }
    });
    // groupData.push({
    //     name: "paths",
    //     data: [],
    //     props: [],
    //     filter: null,
    // });
    // groupData.push({
    //     name: "points-labels",
    //     data: [],
    //     props: [],
    //     filter: null,
    // });
    // const groups = svg.selectAll('svg').data(groupData).join('svg').attr('id', d => d.name);
    // Image-backed layers (land, per-country glow outlines) render their <image> directly as
    // the .macro-layer element — no wrapping <g> (see appendLandImageNew / appendCountryImageNew
    // in src/svg/contourMethods.ts) — while every other layer is still a <g> of <path>s. d3's
    // .join() can't emit a mixed tag per datum in one call, so the layers are built with a plain
    // sequential loop instead; stacking order only depends on this loop visiting groupData in
    // order and appending each element right after the previous one, regardless of tag.
    const svgNode = svg.node()!;
    const groups = groupData.map((d) => {
        const isImageLayer = d.type === "landImg" || d.type === "filterImg";
        const el = document.createElementNS("http://www.w3.org/2000/svg", isImageLayer ? "image" : "g");
        el.classList.add("macro-layer");
        if (d.name) el.setAttribute("id", d.name);
        // Image layers (land, per-country glow outlines) embed the frame clip inside their data
        // URI instead — see embedRefClone in contourMethods.ts — so the clip stays off the live
        // host attribute and the <image> can be treated as a self-contained raster.
        if (!isImageLayer) el.setAttribute("clip-path", "url(#clipMapBorder)");
        svgNode.appendChild(el);
        return el;
    });

    function drawPaths(this: Element, data: MacroGroupData) {
        if (data.type === "landImg")
            return appendLandImageNew.call(
                this as SVGImageElement,
                data.showSource ?? false,
                width,
                height,
                borderWidth,
                macroState.contourParams,
                geometriesState.land,
                appState.pathLarger!,
                macroState.zonesGlow["land"]?.enabled ? macroState.zonesGlow["land"] : undefined,
            );
        if (data.type === "filterImg")
            return appendCountryImageNew.call(
                this as SVGImageElement,
                data.countryData!,
                data.filter ?? null,
                appState.path!,
                commonState.inlineStyles,
                width,
                height,
            );
        if (!data.data) return;
        const parentPathElem = select(this).style("will-change", "opacity");
        if (data.containerClass) parentPathElem.classed(data.containerClass, true);
        const pathElem = parentPathElem
            .selectAll("path")
            // @ts-expect-error
            .data(data.data.features ? data.data.features : data.data)
            .join("path")
            .attr("pathLength", 1)
            .attr("d", (d) => {
                return appState.path!(d);
            });
        // @ts-expect-error
        if (data.id) pathElem.attr("id", (d) => d.properties[data.id]);
        if (data.class) pathElem.attr("class", data.class);
        if (data.filter) parentPathElem.attr("filter", `url(#${data.filter})`);
        // data.props?.forEach((prop) => pathElem.attr(prop, (d) => d.properties[prop]));
    }
    groups.forEach((el, i) => drawPaths.call(el, groupData[i]));
    svg.select("#graticule").selectAll("path")
        .attr("stroke", macroState.macroParams.Background.graticuleColor)
        .attr("stroke-width", macroState.macroParams.Background.graticuleWidth);
}
export function drawMacroFrame(
    svg: SvgSelection,
    width: number,
    height: number,
    borderWidth: number,
    borderRadius: number,
    borderColor: string,
    animated: boolean
): FrameSelection {
    // Frame position (no padding, just half border width inset)
    const { rx, x: frameX, y: frameY, width: frameWidth, height: frameHeight } = macroFrameRect(width, height, borderWidth, borderRadius);

    svg.select("#frame").remove();

    const frame = svg.append('rect')
        .attr('x', frameX)
        .attr('y', frameY)
        .attr('id', 'frame')
        .attr('width', frameWidth)
        .attr('height', frameHeight)
        .attr('rx', rx)
        .attr('fill', 'none')
        .attr('stroke', borderColor)
        .attr('stroke-width', borderWidth);

    if (animated) frame.attr('pathLength', 1);

    // Add clip path for proper content clipping
    appendClip(svg, frameWidth, frameHeight, rx, frameX, frameY);

    return frame;
}

export function applyInlineStyles(): void {
    applyStyles(commonState.inlineStyles);
    saveState();
}


export async function changeProjection(): Promise<void> {
    const projName = macroState.macroParams.General.projection;
    const alt = macroState.inlinePropsMacro.altitude || macroState.macroParams.General.altitude;
    const projectionParams = {
        projectionName: projName,
        fov: macroState.macroParams.General.fieldOfView,
        width: macroState.macroParams.General.width,
        height: macroState.macroParams.General.height,
        translateX: macroState.inlinePropsMacro.translateX,
        translateY: macroState.inlinePropsMacro.translateY,
        longitude: macroState.inlinePropsMacro.longitude,
        latitude: macroState.inlinePropsMacro.latitude,
        rotation: macroState.inlinePropsMacro.rotation,
        altitude: alt,
        tilt: macroState.inlinePropsMacro.tilt,
        borderWidth: macroState.macroParams.Border.borderWidth,
    };
    appState.projection = getProjection(projectionParams);
    appState.projectionLarger = getProjection({ ...projectionParams, larger: true });
    changeAltitudeScale(false);
}


export function projectAndDraw(svg: SvgSelection, simplified = false): void {
    changeProjection();
    drawMacroBase(svg, simplified);
}

export function handleChangeProp(event: CustomEvent<{ prop: string; value: unknown }> | string, drawSimplifyThenReal?: () => void): void {
    log('handleChangeProp', event)
    let prop: string;
    let value: unknown;
    if (typeof event === "string") {
        prop = event;
    } else {
        prop = event.detail.prop;
        value = event.detail.value;
    }
    if (macroPositionVars.includes(prop)) {
        if (value !== undefined && value !== null) {
            macroState.inlinePropsMacro[prop] = value;
        }
    }
    // Altitude lives in both macroParams (the settings slider) and inlinePropsMacro (zoom +
    // projection). A string-form call comes from the slider, which only wrote macroParams.
    if (prop === "altitude" && value === undefined) {
        macroState.inlinePropsMacro.altitude = macroState.macroParams.General.altitude;
    }
    if (prop === "projection" || prop === "fieldOfView") {
        changeAltitudeScale();
    }
    if (prop === "projection") {
        macroState.inlinePropsMacro.translateX = 0;
        macroState.inlinePropsMacro.translateY = 0;
    }
    if ((prop === "width" || prop === "height") && value) {
        const w = prop === "width" ? value as number : macroState.macroParams.General.width;
        const h = prop === "height" ? value as number : macroState.macroParams.General.height;
        const margin = 10;
        Object.keys(macroState.legendDefs).forEach((tab) => {
            const def = macroState.legendDefs[tab];
            if (def.x > w - margin) def.x = Math.max(margin, w - margin);
            if (def.y > h - margin) def.y = Math.max(margin, h - margin);
            for (const groupId of Object.keys(def.changes)) {
                const c = def.changes[groupId];
                if (def.x + c.dx > w - margin) c.dx = w - margin - def.x;
                if (def.x + c.dx < margin) c.dx = margin - def.x;
                if (def.y + c.dy > h - margin) c.dy = h - margin - def.y;
                if (def.y + c.dy < margin) c.dy = margin - def.y;
            }
        });
    }
    changeProjection();
    // Re-simplifying geometry is expensive; it's deferred to drawSimplifyThenReal's settle
    // callback (called once the gesture pauses) instead of running on every zoom/drag tick.
    if (drawSimplifyThenReal) drawSimplifyThenReal();
}

/** Recolors the sea directly in the DOM, without going through a full draw() cycle. */
export function updateSeaColor(color: Color): void {
    macroState.macroParams.Background.seaColor = color;
    select("#outline").style("fill", color);
}

/** Recolors the map border directly in the DOM, without going through a full draw() cycle. */
export function updateBorderColor(color: Color): void {
    macroState.macroParams.Border.borderColor = color;
    select("#frame").attr("stroke", color);
}