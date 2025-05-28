<script lang="ts">
    import { onMount, tick } from "svelte";
    import * as topojson from "topojson-client";
    import { presimplify, simplify } from "topojson-simplify";
    import { scaleLinear, scalePow, scaleOrdinal, scaleQuantize, scaleQuantile } from "d3-scale";
    import { color as d3Color } from "d3-color";
    import { geoGraticule, geoPath } from "d3-geo";
    import { select, pointer } from "d3-selection";
    import { drag } from "d3-drag";
    import { zoom } from "d3-zoom";
    import { extent } from "d3-array";
    import InlineStyleEditor from "../node_modules/inline-style-editor/dist/inline-style-editor.mjs";
    import "bootstrap/js/dist/dropdown";
    import { debounce, throttle } from "lodash-es";
    import dataExplanation from "./assets/dataColor.svg";
    import { drawCustomPaths, parseAndUnprojectPath } from "./svg/paths";
    import { transitionCssMacro, transitionCssMicro } from "./svg/transition";
    import PathEditor from "./svg/pathEditor";
    import { paramDefs, defaultParams, helpParams, noSatelliteParams, microDefaultParams } from "./params";
    import { appendBgPattern, appendGlow } from "./svg/svgDefs";
    import { splitMultiPolygons } from "./util/geojson";
    import { createD3ProjectionFromMapLibre, getProjection, updateAltitudeRange } from "./util/projections";
    import PaletteEditor from "./components/PaletteEditor.svelte";
    import Geocoding from "./components/Geocoding.svelte";
    import {
        download,
        sortBy,
        indexBy,
        htmlToElement,
        getNumericCols,
        initTooltips,
        getBestFormatter,
        getColumns,
        findProp,
        formatUnicorn,
    } from "./util/common";
    import * as shapes from "./svg/shapeDefs";
    import * as markers from "./svg/markerDefs";
    import {
        setTransformScale,
        closestDistance,
        duplicateContourCleanFirst,
        pathStringFromParsed,
        type DistanceQueryResult,
    } from "./svg/svg";
    import { drawShapes } from "./svg/shape";
    import iso3Data from "./assets/data/iso3_filtered.json";
    import DataTable from "./components/DataTable.svelte";
    import Examples from "./components/Examples.svelte";
    import Legend from "./components/Legend.svelte";
    import defaultBaseCssMacro from "./assets/pagestyleMacro.css?raw";
    import { drawLegend } from "./svg/legend";
    import { freeHandDrawPath } from "./svg/freeHandPath";
    import Modal from "./components/Modal.svelte";
    import Accordions from "./components/Accordions.svelte";
    import Navbar from "./components/Navbar.svelte";
    import ColorPickerPreview from "./components/ColorPickerPreview.svelte";
    import macroImg from "./assets/img/macro.png";
    import microImg from "./assets/img/micro.png";
    import Instructions from "./components/Instructions.svelte";
    import Icon from "./components/Icon.svelte";
    import RangeInput from "./components/RangeInput.svelte";
    import { reportStyle, fontsToCss, exportStyleSheet, getUsedInlineFonts, applyStyles, DOM_PARSER } from "./util/dom";
    import { saveState, getState } from "./util/save";
    import { exportSvg, exportFontChoices } from "./svg/export";
    import { addTooltipListener } from "./tooltip";
    import {
        drawMicroFrame,
        drawPrettyMap,
        exportMicro,
        generateCssFromState,
        initLayersState,
        onMicroParamChange,
        replaceCssSheetContent,
        syncLayerStateWithCss,
        updateSvgPatterns,
    } from "./detailed";
    import { Map } from "maplibre-gl";
    import MicroLayerParams from "./components/MicroLayerParams.svelte";
    import * as _microPalettes from "./microPalettes";
    import { FreehandDrawer } from "./svg/freeHandDraw";
    import { cancelStitch } from "./util/geometryStitch";
    import type {
        SvgSelection,
        D3Selection,
        InlineStyles,
        ZonesData,
        TooltipDefs,
        LegendDef,
        PathDef,
        ShapeDefinition,
        MicroPalette,
        MicroPaletteWithBorder,
        ProjectionParams,
        ContourParams,
        ExportFontChoice,
        ExportOptions,
        LegendColor,
        ProvidedFont,
        CssDict,
        Color,
        InlineProps,
        InlinePropsMicro,
        MicroLayerId,
        MacroGroupData,
        FrameSelection,
        ParsedPath,
        ContextMenuInfo,
        MenuState,
        PathDefImage,
        MarkerName,
        ZoneDataRow,
        ZoneData,
        ShapeName,
        Formatter,
        FormatterObject,
        ColorDef,
        SvgGSelection,
        OrdinalMapping,
        ColorScale,
        Mode,
    } from "./types";
    import type { MacroParams, MicroParams } from "./params";
    import type { Feature, FeatureCollection, MultiLineString, Polygon } from "geojson";
    import { appendCountryImageNew, appendLandImageNew } from "./svg/contourMethods";
    import {
        CATEGORICAL_SCHEMES,
        CONTINUOUS_SCHEMES,
        type AnyScaleKey,
        type CategoricalScaleKey,
        type ContinuousScaleKey,
    } from "./util/color-scales";
    const microPalettes = _microPalettes as Record<string, MicroPaletteWithBorder>;
    const scalesHelp: string = `
<div class="inline-tooltip">  
    <p> 
        <i> Quantiles </i> separate a population into intervals of similar sizes (the 10% poorest, the 50% tallest, the 1% richest…). It is defined by the data itself (a set of values).
         <br/>
        To <i> quantize </i> means to group values with discrete increments. It is defined by the extent (min/max) of the data.
        </p> 
    <img src=${dataExplanation} width="460" height="60"> <br/>
    Those scales are only available when numeric data is associated with the layer. 
</div>
`;
    const defaultTooltipStyle: string = `color:black; will-change: opacity; font-size: 14px; padding: 5px; background-color: #FFFFFF; border: 1px solid black; max-width: 15rem; width: max-content; border-radius:7px;`;

    const icons: Record<string, string> = import.meta.glob("./assets/img/*.svg", { eager: true, query: "?raw" });
    Object.keys(icons).forEach((iconName) => {
        const name = iconName.match(/\w+/)![0]; // remove extension
        icons[name] = icons[iconName];
        delete icons[iconName];
    });
    // const icons: Record<string, string> = Object.keys(iconsReq).reduce<Record<string, string>>((acc, iconFile) => {
    //     const name = iconFile.match(/\w+/)![0]; // remove extension
    //     acc[name] = iconsReq[iconFile];
    //     return acc;
    // }, {});

    let params: MacroParams = JSON.parse(JSON.stringify(defaultParams));
    let microParams: MicroParams = JSON.parse(JSON.stringify(microDefaultParams));
    let currentParams: MacroParams | MicroParams = params;
    $: if (params || microParams || currentMode) {
        let prevParams = currentParams;
        currentParams = currentMode === "micro" ? microParams : params;
        if (prevParams !== currentParams) projectAndDraw();
    }

    $: if (true || mainMenuSelection) {
        tick().then(() => initTooltips());
    }
    const iso3DataById = indexBy(iso3Data, "alpha-3");
    const resolvedAdm: Record<string, any> = {};
    const resolvedAdmTopo: Record<string, any> = {};
    const availableCountriesAdm1 = import.meta.glob("./assets/layers/adm1/*.json");
    Object.keys(availableCountriesAdm1).forEach((adm1FileName) => {
        const name = adm1FileName.match(/[-a-zA-Z-_]+/)![0]; // remove extension
        const resolvedName = iso3DataById[name]?.name;
        const finalName = resolvedName ? `${resolvedName} ADM1` : name;
        availableCountriesAdm1[finalName] = availableCountriesAdm1[adm1FileName];
        delete availableCountriesAdm1[adm1FileName];
    });
    // const availableCountriesAdm1: Record<string, string> = Object.keys(countriesAdm1Resolve).reduce<
    //     Record<string, string>
    // >((acc, file) => {
    //     const name = file.match(/[-a-zA-Z-_]+/)![0]; // remove extension
    //     const resolvedName = iso3DataById[name]?.name;
    //     if (resolvedName) acc[`${resolvedName} ADM1`] = file;
    //     return acc;
    // }, {});

    const availableCountriesAdm2 = import.meta.glob("./assets/layers/adm2/*.json");
    Object.keys(availableCountriesAdm2).forEach((adm1FileName) => {
        const name = adm1FileName.match(/[-a-zA-Z-_]+/)![0]; // remove extension
        const resolvedName = iso3DataById[name]?.name;
        const finalName = resolvedName ? `${resolvedName} ADM2` : name;
        availableCountriesAdm2[finalName] = availableCountriesAdm2[adm1FileName];
        delete availableCountriesAdm2[adm1FileName];
    });

    // const countriesAdm2Resolve = import.meta.glob("./assets/layers/adm2/*.json");
    // const availableCountriesAdm2: Record<string, string> = Object.keys(countriesAdm2Resolve).reduce<
    //     Record<string, string>
    // >((acc, file) => {
    //     const name = file.match(/[-a-zA-Z-_]+/)![0]; // remove extension
    //     const resolvedName = iso3DataById[name]?.name;
    //     if (resolvedName) acc[`${resolvedName} ADM2`] = file;
    //     return acc;
    // }, {});
    const allAvailableAdm: string[] = [
        ...Object.keys(availableCountriesAdm1),
        ...Object.keys(availableCountriesAdm2),
    ].sort();

    const resolvedLocales = import.meta.glob<d3.FormatLocaleDefinition>("../node_modules/d3-format/locale/", {
        eager: true,
    });
    Object.keys(resolvedLocales).forEach((localeFileName) => {
        const name = localeFileName.match(/\w+/)![0]; // remove extension
        icons[name] = icons[localeFileName];
        delete icons[localeFileName];
    });
    // const availableFormatLocales: string[] = Object.keys(formatLocaleResolve).map((file) => {
    //     const name = file.match(/[-a-zA-Z-_]+/)![0]; // remove extension
    //     resolvedLocales[name] = formatLocaleResolve[file];
    //     return name;
    // }, {});

    function resolveAdm(name: string): Promise<any> {
        if (name.includes("ADM1")) return availableCountriesAdm1[name]();
        return availableCountriesAdm2[name]();
    }

    const p = (propName: string, obj: MacroParams | MicroParams = currentParams ?? params): any =>
        findProp(propName, obj);

    const positionVars: string[] = [
        "longitude",
        "latitude",
        "rotation",
        "tilt",
        "altitude",
        "fieldOfView",
        "projection",
        "width",
        "height",
    ];
    let redrawTimeoutId: number;
    let visibleArea: number | undefined;
    let countries: FeatureCollection<Polygon, { name: string }>;
    let land: FeatureCollection<Polygon>;
    let adm0Topo: any = null;
    let simpleLand: Feature | null = null;
    let openContextMenuInfo: ContextMenuInfo;

    const adm0LandTopoPromise = import("./assets/layers/world_adm0_simplified.topojson").then(
        ({ default: topoAdm0 }) => {
            // @ts-expect-error
            adm0Topo = presimplify(topoAdm0);
        },
    );

    function updateLayerSimplification(): void {
        updateAdm0LandAndCountries();
        Object.keys(resolvedAdmTopo).forEach((countryAdm) => {
            const simplified = simplify(resolvedAdmTopo[countryAdm], visibleArea);
            const firstKey = Object.keys(simplified.objects)[0];
            resolvedAdm[countryAdm] = topojson.feature(simplified, simplified.objects[firstKey]);
        });
    }

    function updateAdm0LandAndCountries(): void {
        const simplified = simplify(adm0Topo, visibleArea);
        const firstKey = Object.keys(simplified.objects)[0];
        countries = topojson.feature(simplified, simplified.objects[firstKey]) as FeatureCollection<
            Polygon,
            { name: string }
        >;
        countries.features.forEach((feat: any) => {
            const propertiesFromIso = iso3DataById[feat.properties["shapeGroup"]];
            feat.properties = propertiesFromIso || feat.properties;
        });
        // @ts-expect-error
        land = topojson.merge(simplified, simplified.objects[firstKey].geometries);
        land = splitMultiPolygons(
            {
                type: "FeatureCollection",
                // @ts-expect-error
                features: [{ type: "Feature", geometry: { ...land } }],
            },
            "land",
        );
    }

    const verySimpleLand = import("./assets/layers/world_land_very_simplified.topojson").then(({ default: land }) => {
        const firstKey = Object.keys(land.objects)[0];
        simpleLand = topojson.feature(land, land.objects[firstKey]) as Feature;
    });

    const layerPromises = Promise.all([adm0LandTopoPromise, verySimpleLand]);

    let path: d3.GeoPath<any, any>;
    let pathLarger: d3.GeoPath<any, any>;
    let projection: d3.GeoProjection;
    let projectionLarger: d3.GeoProjection;
    let svg: SvgSelection;
    const defaultLegendDef: LegendDef = {
        title: "",
        x: 20,
        y: Math.max(0, p("height") - 200),
        lineWidth: 100,
        rectWidth: 30,
        rectHeight: 30,
        significantDigits: 3,
        maxWidth: 200,
        direction: "v",
        labelOnLeft: false,
        // title: null,
        // sampleHtml: null,
        noData: {
            active: false,
            manual: false,
            text: "N/A",
            color: "#AAAAAA",
        },
        changes: {},
    };
    const defaultColorDef: ColorDef = {
        enabled: false,
        colorScale: "category",
        colorColumn: "name",
        colorPalette: "Pastel1",
        nbBreaks: 5,
        legendEnabled: false,
    };

    const defaultInlineProps: InlineProps = {
        longitude: 15,
        latitude: 42.5,
        translateX: 0,
        translateY: 0,
        altitude: 3200,
        rotation: 0,
        tilt: 0,
        showLand: true,
        showCountries: true,
    };

    const defaultInlinePropsMicro: InlinePropsMicro = {
        center: [2.3468, 48.8548],
        zoom: 13.8,
        pitch: 0,
        bearing: 0,
    };

    // ====== State micro ====
    let microLayerDefinitions: MicroPalette = initLayersState(microPalettes["peach"]);

    // ====== State macro =======
    let baseCss = defaultBaseCssMacro;
    let providedPaths: PathDef[] = [];
    let providedShapes: ShapeDefinition[] = []; // {name, coords, scale, id}
    let chosenCountriesAdm: string[] = [];
    let inlineProps: InlineProps = JSON.parse(JSON.stringify(defaultInlineProps));
    let inlinePropsMicro: InlinePropsMicro = JSON.parse(JSON.stringify(defaultInlinePropsMicro));

    let providedFonts: ProvidedFont[] = [];
    let shapeCount = 0;
    let inlineStyles: InlineStyles = {}; // elemID -> prop -> value
    let zonesData: ZonesData = {};
    /** For each */
    let zonesFilter: Record<string, string> = { land: "firstGlow" };
    let lastUsedLabelProps: CssDict = { "font-size": "14px" };
    let contourParams: ContourParams = {
        strokeWidth: 1,
        strokeColor: "#a0a0a07d",
        strokeDash: 0,
        fillColor: "#ffffff",
    };
    let tooltipDefs: TooltipDefs = {
        countries: {
            template: defaultTooltipContent(true),
            content: defaultTooltipFull(defaultTooltipContent(true)),
            enabled: false,
            locale: "en-US",
        },
    };

    let colorDataDefs: Record<string, typeof defaultColorDef> = {
        countries: { ...defaultColorDef },
    };
    let legendDefs: Record<string, LegendDef> = {
        countries: JSON.parse(JSON.stringify(defaultLegendDef)),
    };
    let orderedTabs: string[] = ["countries", "land"];
    let customCategoricalPalette: Color[] = ["#ff0000ff", "#00ff00ff", "#0000ffff"];

    // ==== End state =====

    let cssFonts: string | undefined;
    let commonCss: string | undefined;
    const menuStates: MenuState = {
        chosingPoint: false,
        pointSelected: false,
        addingLabel: false,
        pathSelected: false,
        addingImageToPath: false,
        chosingMarker: false,
    };
    let editedLabelId: string | null;
    let textInput: HTMLInputElement;
    let typedText = "";
    let styleEditor: InlineStyleEditor | null = null;
    let contextualMenu: HTMLDivElement & {
        opened?: boolean;
    };
    let showModal = false;
    let showExportConfirm = false;
    let showInstructions = false;
    let exportForm: HTMLFormElement;
    let htmlTooltipElem: HTMLElement;
    let currentMacroLayerTab: string = "land";

    let mainMenuSelection: string = "general";
    let currentMode: Mode = "macro";
    $: if (true || mainMenuSelection) {
        tick().then(() => initTooltips());
    }
    let editingPath = false;
    let isDrawingFreeHand = false;
    let isDrawingPath = false;
    $: iseOnClickEnabled = !editingPath && !isDrawingFreeHand && !isDrawingPath;
    // This contains the common CSS that can ben editor with inline-css-editor
    // we also have a special svelte:head element containing all CSS that is not in baseCss (border style, legend colors, etc.)
    let commonStyleSheetElemMacro: HTMLStyleElement;
    let commonStyleSheetElemMicro: HTMLStyleElement;
    let zoomFunc: d3.ZoomBehavior<any, any>;
    let dragFunc: d3.DragBehavior<any, any, any>;
    /**
     * Map used for drawing zoomed-in cities as SVG using custom palette
     * It is hidden when in "macro" mode.
     * In "micro" mode, it is either:
     *  - visible if the map is not zoomed enough
     *  - hidden if it is zoomed enough. Instead, we have the custom SVG displaying
     */
    let maplibreMap: Map;
    let mapLoadedPromise: Promise<unknown>;
    let microLocked = false;
    onMount(async () => {
        commonStyleSheetElemMacro = document.createElement("style");
        commonStyleSheetElemMacro.setAttribute("id", "common-style-sheet-elem-macro");
        document.head.appendChild(commonStyleSheetElemMacro);
        commonStyleSheetElemMacro.innerHTML = baseCss;

        await layerPromises;
        restoreState();
        createMaplibreMap();

        const microCss = generateCssFromState(microLayerDefinitions);
        if (microCss) {
            commonStyleSheetElemMicro = document.createElement("style");
            commonStyleSheetElemMicro.setAttribute("id", "common-style-sheet-elem-micro");
            document.head.appendChild(commonStyleSheetElemMicro);
            commonStyleSheetElemMicro.innerHTML = microCss;
        } else {
            console.error("No generated CSS");
        }

        await mapLoadedPromise;

        projectAndDraw();
        styleEditor = new InlineStyleEditor({
            onStyleChanged: (
                target: HTMLElement,
                eventType: "inline" | CSSStyleRule,
                cssProp: string,
                value: string,
            ) => {
                const elemId = target.getAttribute("id")!;
                const eventAsRule = eventType as CSSStyleRule;
                if (currentMode === "micro") {
                    if (eventType === "inline" && target.hasAttribute("id")) {
                        handleInlineStyleChange(elemId, target, cssProp, value);
                    }
                    const layerDefChanged = syncLayerStateWithCss(eventType, cssProp, value, microLayerDefinitions);
                    if (layerDefChanged) microLayerDefinitions = microLayerDefinitions;
                    save();
                    return;
                }
                /**
                 * Due to a Firefox bug (the :hover selector is not applied when we move the DOM node when hovering a polygon)
                 * we need to apply the :hover style to a custom class selector .hovered, that will be applied programatically
                 */
                if (eventAsRule.selectorText?.includes?.(":hover")) {
                    const selectorTextToModify = eventAsRule.selectorText.replace(":hover", ".hovered");
                    const rule = Array.from(eventAsRule.parentStyleSheet!.cssRules)
                        .filter((r) => r instanceof CSSStyleRule)
                        .find((r: CSSStyleRule) => r.selectorText === selectorTextToModify);
                    if (rule) {
                        for (const propName of eventAsRule.style) {
                            rule.style.setProperty(propName, eventAsRule.style.getPropertyValue(propName));
                        }
                    }
                }

                if (legendSample && legendSample.contains(target) && cssProp !== "fill") {
                    legendDefs[currentMacroLayerTab].sampleHtml = legendSample.outerHTML;
                    colorizeAndLegend();
                } else if (htmlTooltipElem && htmlTooltipElem.contains(target)) {
                    tooltipDefs[currentMacroLayerTab].content = htmlTooltipElem.outerHTML;
                } else if (eventType === "inline") {
                    if (target.hasAttribute("id")) {
                        handleInlineStyleChange(elemId, target, cssProp, value);
                    }
                }
                /** Update <image> tag corresponding to changed element */
                if (
                    (eventType === "inline" && target.classList.contains("country")) ||
                    eventAsRule?.selectorText === ".country"
                ) {
                    computedOrderedTabs.forEach((tab) => {
                        if (tab.substring(0, tab.length - 5) !== elemId) return;
                        const filter = zonesFilter[tab];
                        const countryData = countries.features.find((country) => country.properties?.name === elemId)!;
                        appendCountryImageNew.call(
                            select(`[id='${elemId}-img']`).node() as SVGGElement,
                            countryData,
                            filter,
                            applyInlineStyles,
                            path,
                            inlineStyles,
                            false,
                            true,
                        );
                        svg.selectAll("g[image-class]").classed("hidden-after", true);
                    });
                }
                save();
            },
            getElems: (el: HTMLElement) => {
                if (el.classList.contains("freehand")) {
                    return [[el.parentElement, "Clicked"]];
                }
                if (el.classList.contains("adm")) {
                    const parent = el.parentNode as HTMLElement;
                    const parentCountry = parent?.getAttribute("id")?.replace(/ ADM(1|2)/, "") || "";
                    const parentCountryIso3 = iso3Data.find((row) => row.name === parentCountry)?.["name"];
                    if (!parentCountryIso3) return [[el, "Clicked"]];
                    const countryElem = document.getElementById(parentCountryIso3);
                    if (!countryElem) return [[el, "Clicked"]];
                    return [
                        [el, "Clicked"],
                        [countryElem, parentCountryIso3],
                    ];
                }
                if (el.tagName === "tspan") {
                    return [
                        [el.parentNode, "text"],
                        [el, "text part"],
                    ];
                }
                return [[el, "Clicked"]];
            },
            customProps: {
                scale: {
                    type: "slider",
                    min: 0.5,
                    max: 5,
                    step: 0.1,
                    getter: (el: HTMLElement) => {
                        if (el.closest("#points-labels") == null) return null;
                        const transform = el.getAttribute("transform");
                        if (!transform) return 1;
                        else {
                            const scaleValue = transform.match(/scale\(([0-9\.]+)\)/);
                            if (scaleValue && scaleValue.length > 1) return parseFloat(scaleValue[1]);
                        }
                        return 1;
                    },
                    setter: (el: SVGElement, val: number) => {
                        const scaleStr = `scale(${val})`;
                        setTransformScale(el, scaleStr);
                    },
                },
            },
            cssRuleFilter: (el: HTMLElement, cssSelector: string) => {
                if (cssSelector.includes(".hovered")) return false;
                if (cssSelector.includes("ssc-")) return false;
                if (cssSelector.includes("#micro path")) return false;
                if (cssSelector.includes("#micro .poly")) return false;
                if (cssSelector.includes("#micro .line")) return false;
                return true;
            },
            inlineDeletable: () => false,
        });
        document.body.append(contextualMenu);
        contextualMenu.style.display = "none";
        contextualMenu.style.position = "absolute";
        contextualMenu.opened = false;
        attachListeners();
        // maplibreMap.showTileBoundaries = true;
        window.addEventListener("keydown", (e) => {
            if (e.code === "Escape") {
                stopDrawFreeHand();
            }
        });
    });

    function lockUnlock(isLocked: boolean) {
        microLocked = isLocked;

        const mapLibreContainer = select("#maplibre-map");
        if (microLocked) {
            svg.style("pointer-events", "auto");
            mapLibreContainer.style("pointer-events", "none");
        } else {
            svg.style("pointer-events", "none");
            mapLibreContainer.style("pointer-events", "auto");
        }
    }

    function createMaplibreMap() {
        maplibreMap = new Map({
            container: "maplibre-map",
            style: "https://api.maptiler.com/maps/basic-v2/style.json?key=FDR0xJ9eyXD87yIqUjOi",
            center: inlinePropsMicro.center,
            zoom: inlinePropsMicro.zoom,
            pitch: inlinePropsMicro.pitch,
            bearing: inlinePropsMicro.bearing,
            attributionControl: false,
        });

        maplibreMap.on("moveend", (event) => {
            if (currentMode !== "micro") return;
            const center = maplibreMap.getCenter().toArray();
            if (center[0] !== 0 && center[1] !== 0) {
                inlinePropsMicro = {
                    center,
                    zoom: maplibreMap.getZoom(),
                    pitch: maplibreMap.getPitch(),
                    bearing: maplibreMap.getBearing(),
                };
            }
            // drawDebounced();
            draw();
        });

        maplibreMap.on("movestart", (event) => {
            // console.log('movestart');
            if (currentMode !== "micro") return;
            cancelStitch();
            select("#maplibre-map").style("opacity", 1);
        });

        maplibreMap.on("click", (event) => {
            console.log(event);
            console.log(maplibreMap.queryRenderedFeatures(event.point));
            console.log(maplibreMap.getStyle());
        });
        maplibreMap.on("contextmenu", (e) => {
            if (!microLocked) {
                lockUnlock(true);
                const clickedElem = document.elementFromPoint(e.originalEvent.clientX, e.originalEvent.clientY);
                Object.defineProperty(e.originalEvent, "target", {
                    writable: false,
                    value: clickedElem,
                });
                (svg.node() as SVGSVGElement).dispatchEvent(e.originalEvent);
            }
        });
        mapLoadedPromise = maplibreMap.once("load") as Promise<unknown>;
    }

    function handleMicroParamChange(
        layer: MicroLayerId,
        prop: string | string[],
        value: number | Color | string | boolean,
    ): void {
        const shouldRedraw = onMicroParamChange(layer, prop, value, microLayerDefinitions);
        if (shouldRedraw) draw();
        save();
    }

    function handleMicroPaletteChange(paletteId: string): void {
        const palette = microPalettes[paletteId];
        if (palette.borderParams) {
            microParams["Border"] = {
                ...microParams["Border"],
                ...palette.borderParams,
            };
        }
        microLayerDefinitions = initLayersState(palette);
        updateSvgPatterns(document.getElementById("static-svg-map") as unknown as SVGSVGElement, microLayerDefinitions);
        replaceCssSheetContent(microLayerDefinitions);
        // handleMicroParamChange('other', ['pattern'])
        draw();
        save();
    }

    function handleInlineStyleChange(elemId: string, target: HTMLElement, cssProp: string, value: string): void {
        if (elemId.includes("label")) {
            lastUsedLabelProps[cssProp] = value;
        }
        if (elemId in inlineStyles) inlineStyles[elemId][cssProp] = value;
        else inlineStyles[elemId] = { [cssProp]: value };
        // update path markers
        if (cssProp === "stroke" && target.hasAttribute("marker-end")) {
            const markerId = target.getAttribute("marker-end")?.match(/url\(#(.*)\)/)?.[1];
            if (!markerId) return;
            const newMarkerId = `${markerId.split("-")[0]}-${value.substring(1)}`;
            select(`#${markerId}`).attr("fill", value).attr("id", newMarkerId);
            select(target).attr("marker-end", `url(#${newMarkerId})`);
        }
    }

    function switchMode(newMode: Mode): void {
        if (currentMode === newMode) return;
        currentMode = newMode;
        const mapLibreContainer = select("#maplibre-map");
        if (currentMode === "micro") {
            mapLibreContainer.style("display", "block");
            mainMenuSelection = "general";
            draw();
        } else {
            projectAndDraw();
        }
        setTimeout(() => initTooltips(), 0);
    }

    function attachListeners(): void {
        const container = select("#map-container");
        dragFunc = drag()
            .filter((e) => currentMode === "macro" && !e.button) // Remove ctrlKey
            .on("drag", dragged)
            .on("start", () => {
                if (menuStates.addingLabel) validateLabel();
                styleEditor.close();
                closeMenu();
            });

        zoomFunc = zoom()
            .filter((e) => currentMode === "macro")
            .wheelDelta((event) => -event.deltaY * (event.deltaMode === 1 ? 0.05 : event.deltaMode ? 1 : 0.002))
            .on("zoom", zoomed)
            .on("start", () => {
                closeMenu();
            });
        container.call(dragFunc);
        container.call(zoomFunc);
    }

    function detachListeners(): void {
        const container = select("#map-container");
        container.on(".drag", null);
        container.on(".zoom", null);
    }

    const redrawThrottle = throttle(redraw, 50);
    function redraw(propName?: string): void {
        if (propName && positionVars.includes(propName)) {
            // mapLibreFitBounds();
            projectAndDraw(true);
        }
        clearTimeout(redrawTimeoutId);
        redrawTimeoutId = setTimeout(() => {
            updateLayerSimplification();
            draw(false);
        }, 300);
    }

    let altScale = scaleLinear().domain([1, 0]).range([100, 10000]);
    // scale for simplification according to zoom
    let threshScale = scalePow().domain([0, 1]).range([0.1, 0]).exponent(0.08);
    function zoomed(event: d3.D3ZoomEvent<SVGSVGElement, unknown>): void {
        if (!event.sourceEvent) return;
        if (event.sourceEvent.type === "dblclick") return;
        if (!projection) return;
        // @ts-expect-error
        event.transform.k = Math.max(Math.min(event.transform.k, 1), 0.00001);
        let newAltitude = Math.round(altScale(event.transform.k));
        // Ensure that zooming at max of scale actlually decreases altitude
        if (event.transform.k === 1) {
            if (p("projection") === "satellite") newAltitude = inlineProps.altitude - 30;
            else newAltitude = inlineProps.altitude + 30;
            newAltitude = Math.max(newAltitude, 30);
        }
        visibleArea = threshScale(event.transform.k);
        params["General"].altitude = newAltitude;
        inlineProps.altitude = newAltitude;
        redrawThrottle("altitude");
    }

    const sensitivity = 75;
    function dragged(event: d3.D3DragEvent<SVGSVGElement, unknown, unknown>): void {
        inlineProps.translateX += event.dx;
        inlineProps.translateY += event.dy;
        const isSatellite = params["General"].projection === "satellite";
        if (isSatellite && event.sourceEvent.shiftKey) {
            inlineProps.tilt += event.dy / 10;
        } else if (isSatellite && (event.sourceEvent.metaKey || event.sourceEvent.ctrlKey)) {
            inlineProps.rotation -= event.dx / 10;
        } else if (projection.rotate) {
            const rotate = projection.rotate();
            let rotRad = (inlineProps.rotation / 180) * Math.PI;
            if (!isSatellite) rotRad = 0;
            const [xPartX, xPartY] = [Math.cos(rotRad), Math.sin(rotRad)];
            const [yPartX, yPartY] = [-Math.sin(rotRad), Math.cos(rotRad)];
            const k = sensitivity / projection.scale();
            const adjustedDx = (event.dx * xPartX + event.dy * yPartX) * k;
            const adjustedDy = (event.dy * yPartY + event.dx * xPartX) * k;
            inlineProps.longitude = -rotate[0] - adjustedDx;
            inlineProps.latitude = -rotate[1] + adjustedDy;
        }
        redraw("longitude");
    }

    function changeAltitudeScale(autoAdjustAltitude = true): void {
        const projName = p("projection");
        const fov = p("fieldOfView");
        let invertAlt = false;
        if (projName === "satellite") {
            const newAltScale = updateAltitudeRange(fov);
            if (newAltScale) altScale = newAltScale;
            invertAlt = true;
        } else {
            altScale = scaleLinear().domain([0, 1]).range([90, 2000]);
        }
        const altitude = inlineProps.altitude || params["General"].altitude;
        const originalScale = altScale.invert(altitude);
        visibleArea = threshScale(originalScale);
        if (!autoAdjustAltitude) return;
        let altChanged = false;
        const firstScaleVal = altScale(invertAlt ? 1 : 0);
        const secondScaleVal = altScale(invertAlt ? 0 : 1);
        if (altitude < firstScaleVal) {
            inlineProps.altitude = firstScaleVal;
            altChanged = true;
        }
        if (altitude > secondScaleVal) {
            inlineProps.altitude = secondScaleVal;
            altChanged = true;
        }
        if (altChanged) {
            params["General"].altitude = inlineProps.altitude;
        }
    }

    let accordionVisiblityParams = {};
    function changeProjection(): void {
        const projName = p("projection");
        if (projName !== "satellite") {
            accordionVisiblityParams = noSatelliteParams;
        } else accordionVisiblityParams = {};
        const alt = inlineProps.altitude || params["General"].altitude;
        const projectionParams = {
            projectionName: projName,
            fov: p("fieldOfView"),
            width: p("width"),
            height: p("height"),
            translateX: inlineProps.translateX,
            translateY: inlineProps.translateY,
            longitude: inlineProps.longitude,
            latitude: inlineProps.latitude,
            rotation: inlineProps.rotation,
            altitude: alt,
            tilt: inlineProps.tilt,
            borderWidth: p("borderWidth"),
        };
        projection = getProjection(projectionParams);
        projectionLarger = getProjection({ ...projectionParams, larger: true });
    }

    function computeCurrentTab(): void {
        computedOrderedTabs = orderedTabs.filter((x) => {
            if (x === "countries") return inlineProps.showCountries;
            if (x === "land") return inlineProps.showLand;
            return true;
        });
        if (!computedOrderedTabs.length || (computedOrderedTabs.length === 1 && computedOrderedTabs[0] === "land"))
            currentMacroLayerTab = "land";
        else if (computedOrderedTabs.length > 0 && currentMacroLayerTab === null) {
            let i = 0;
            while (computedOrderedTabs[i] === "land") ++i;
            currentMacroLayerTab = computedOrderedTabs[i];
        }
    }

    async function initializeAdms(simplified: boolean): Promise<void> {
        for (const countryAdm of chosenCountriesAdm) {
            if (!(countryAdm in resolvedAdm)) {
                const resolved = await resolveAdm(countryAdm);
                resolvedAdmTopo[countryAdm] = presimplify(resolved);
                updateLayerSimplification();
                draw(simplified);
                return;
            }
            if (!(countryAdm in tooltipDefs)) {
                const contentTemplate = defaultTooltipContent(false);
                tooltipDefs[countryAdm] = {
                    template: contentTemplate,
                    content: defaultTooltipFull(contentTemplate),
                    enabled: false,
                    locale: "en-US",
                };
                colorDataDefs[countryAdm] = { ...defaultColorDef };
                legendDefs[countryAdm] = JSON.parse(JSON.stringify(defaultLegendDef));
            }
            if (!(countryAdm in zonesData) && !zonesData?.[countryAdm]?.provided) {
                const data = sortBy(
                    resolvedAdm[countryAdm].features.map((f: Feature) => f.properties),
                    "name",
                )!;
                zonesData[countryAdm] = {
                    data: data,
                    provided: false,
                    numericCols: getNumericCols(data),
                };
            }
        }
    }
    const countryFilteredImages = new Set<string>();
    const freeHandDrawer = new FreehandDrawer();
    let firstDraw = true;
    // without 'countries' if unchecked
    let computedOrderedTabs: string[] = [];
    async function draw(simplified = false) {
        const width = p("width"),
            height = p("height");
        const container = select("#map-container");
        const mapLibreContainer = select("#maplibre-map");
        const animated = p("animate");

        countryFilteredImages.clear();
        computeCurrentTab();
        await initializeAdms(simplified);
        container.html("");
        const graticule = geoGraticule().step([p("graticuleStep"), p("graticuleStep")])();
        if (!p("showGraticule")) graticule.coordinates = [];
        if (simplified) {
            let canvas = container.select<HTMLCanvasElement>("#canvas");
            if (canvas.empty()) {
                canvas = container.append("canvas").attr("id", "canvas").attr("width", width).attr("height", height);
            }
            const context = canvas!.node()!.getContext("2d")!;
            context.fillStyle = "#55a4c5";
            context.rect(0, 0, width, height);
            context.fillStyle = "#cdb396";
            path = geoPath(projection, context);
            context.beginPath(), path(simplified ? simpleLand : land), context.fill();
            context.beginPath(),
                path(graticule),
                (context.strokeStyle = "#ddf"),
                (context.globalAlpha = 0.8),
                context.stroke();
            return;
        }
        svg = container.select("svg") as unknown as SvgSelection;
        if (svg.empty())
            svg = container
                .append("svg")
                .attr("xmlns", "http://www.w3.org/2000/svg")
                .attr("xmlns:xlink", "http://www.w3.org/1999/xlink")
                .attr("id", "static-svg-map") as unknown as SvgSelection;

        svg.classed("animate-transition", true).classed("animate", animated);

        if (p("useViewBox")) {
            svg.attr("viewBox", `0 0 ${width} ${height}`);
        } else {
            svg.attr("width", `${width}`).attr("height", `${height}`);
        }
        container.style("width", `${width}px`).style("height", `${height}px`);
        mapLibreContainer.style("width", `${width}px`).style("height", `${height}px`);
        path = geoPath(projection);
        pathLarger = geoPath(projectionLarger);
        svg.html("");
        svg.append("defs");
        svg.on(
            "contextmenu",
            function (e) {
                console.log("contextmenu!", e);
                if (editingPath) return;
                stopDrawFreeHand();
                e.preventDefault();
                closeMenu();
                let target = null;
                const [x, y] = pointer(e);
                const point = { x, y };
                const pathsElement = document.getElementById("paths");
                if (!pathsElement) return;
                const paths = Array.from(pathsElement.children) as SVGPathElement[];
                const closestPoint = paths.reduce<DistanceQueryResult>((prev: DistanceQueryResult, curElem) => {
                    const curDist = closestDistance(point, curElem);
                    curDist.elem = curElem;
                    return prev.distance! < curDist.distance! ? prev : curDist;
                }, {});
                if (closestPoint.distance && closestPoint.distance < 6) {
                    menuStates.pathSelected = true;
                    target = closestPoint.elem;
                    selectedPathIndex = parseInt(closestPoint.elem!.getAttribute("id")!.match(/\d+$/)![0]);
                }
                showMenu(e, target);
                return false;
            },
            false,
        );

        svg.on("click", function (e) {
            if (contextualMenu.opened) closeMenu();
            else if (styleEditor.isOpened()) styleEditor.close();
            else if (iseOnClickEnabled) openEditor(e);
        });

        const groupData: MacroGroupData[] = [];
        if (currentMode === "macro") {
            Object.values(zonesFilter).forEach((filterName) => {
                if (!filterName) return;
                appendGlow(svg, filterName, false, p(filterName));
            });
            mapLibreContainer.style("display", "none");
            container.style("display", "block");
            drawMacro(graticule, groupData);
            appendBgPattern(svg, "noise", p("seaColor"), p("backgroundNoise"));
        } else if (currentMode === "micro") await drawMicro();
        drawCustomPaths(providedPaths, svg, projection, inlineStyles);

        if (currentMode === "macro") {
            select("#outline").style("fill", "url(#noise)");
            colorizeAndLegend();
        }
        computeCss();
        let frame: FrameSelection;
        if (currentMode === "macro") frame = drawMacroFrame(groupData);
        if (currentMode === "micro")
            frame = drawMicroFrame(
                svg,
                width,
                height,
                p("borderWidth"),
                p("borderRadius"),
                p("borderPadding"),
                p("borderColor"),
                animated,
            );

        if (animated) {
            frame!.on("animationend", (e) => {
                setTimeout(() => {
                    svg.classed("animate", false);
                    svg.selectAll("path[pathLength]").attr("pathLength", null);
                    if (currentMode === "macro") {
                        const landElem = svg.select("#land");
                        const landGroupDef = groupData.find((x) => x.type === "landImg")!;
                        const countryGroupDefs = groupData.filter((x) => x.type === "filterImg");
                        if (!landElem.empty() && landGroupDef) {
                            appendLandImageNew.call(
                                landElem.node() as SVGGElement,
                                landGroupDef.showSource || false,
                                zonesFilter,
                                width,
                                height,
                                p("borderWidth"),
                                contourParams,
                                land,
                                pathLarger,
                                p(zonesFilter["land"]),
                                false,
                            );
                        }
                        countryGroupDefs.forEach((def) => {
                            appendCountryImageNew.call(
                                svg.select(`[id='${def.name}']`).node() as SVGGElement,
                                def.countryData!,
                                def.filter ?? null,
                                applyInlineStyles,
                                path,
                                inlineStyles,
                                false,
                            );
                        });
                        duplicateContourCleanFirst(svg.node() as SVGSVGElement);
                    }
                    setTimeout(() => {
                        svg.selectAll("g[image-class]").classed("hidden-after", true);
                        svg.classed("animate-transition", false);
                    }, 1500);
                }, 200);
            });
        }

        drawAndSetupShapes();
        const map = document.getElementById("static-svg-map") as unknown as SVGSVGElement;
        if (!map) return;
        await tick();
        if (currentMode === "macro") {
            addTooltipListener(map, tooltipDefs, zonesData);
            duplicateContourCleanFirst(svg.node() as SVGSVGElement);
        }
        if (firstDraw) maplibreMap.resize();
        // if (firstDraw) mapLibreFitBounds();
        firstDraw = false;
        if (!animated) {
            svg.selectAll("path[pathLength]").attr("pathLength", null);
            svg.selectAll("g[image-class]").classed("hidden-after", true);
        }
    }

    function drawMacro(graticule: MultiLineString, groupData: MacroGroupData[]): void {
        const width = p("width"),
            height = p("height");
        const borderWidth = p("borderWidth");
        const animated = p("animate");
        const outline = { type: "Sphere" };
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
        computedOrderedTabs.forEach((layer, i) => {
            const filter = zonesFilter[layer] ? zonesFilter[layer] : null;
            if (layer === "countries" && inlineProps.showCountries && countries) {
                if (!("countries" in zonesData) && !zonesData?.["countries"]?.provided) {
                    const countryProps = countries.features.map((f) => f.properties);
                    sortBy(countryProps, "name")!;
                    zonesData["countries"] = {
                        data: countryProps,
                        numericCols: getNumericCols(countryProps),
                    };
                    getZonesDataFormatters();
                }
                groupData.push({
                    name: "countries",
                    data: countries,
                    id: "name",
                    props: [],
                    containerClass: "choro",
                    class: "country",
                    filter: filter,
                });
            }
            if (layer === "land" && inlineProps.showLand) groupData.push({ type: "landImg", showSource: i === 0 });
            // selected country
            else if (layer !== "countries") {
                groupData.push({
                    name: layer,
                    data: resolvedAdm[layer],
                    id: "name",
                    props: [],
                    containerClass: "choro",
                    class: "adm",
                    filter: null,
                });
                const countryOutlineId = layer.substring(0, layer.length - 5);
                const countryData = countries.features.find((country) => country.properties.name === countryOutlineId);
                countryFilteredImages.add(countryOutlineId);
                groupData.push({
                    name: `${countryOutlineId}-img`,
                    type: "filterImg",
                    countryData,
                    filter,
                });
            }
        });
        groupData.push({
            name: "paths",
            data: [],
            props: [],
            filter: null,
        });
        groupData.push({
            name: "points-labels",
            data: [],
            props: [],
            filter: null,
        });
        // const groups = svg.selectAll('svg').data(groupData).join('svg').attr('id', d => d.name);
        const groups = svg
            .append("svg")
            .selectAll("g")
            .data(groupData)
            .join("g")
            .attr("id", (d) => d.name!);
        // .attr('clip-path', 'url(#clipMapBorder)')
        function drawPaths(this: SVGGElement, data: MacroGroupData) {
            if (data.type === "landImg")
                return appendLandImageNew.call(
                    this,
                    data.showSource ?? false,
                    zonesFilter,
                    width,
                    height,
                    borderWidth,
                    contourParams,
                    land,
                    pathLarger,
                    p(zonesFilter["land"]),
                    animated,
                );
            if (data.type === "filterImg")
                return appendCountryImageNew.call(
                    this,
                    data.countryData!,
                    data.filter ?? null,
                    applyInlineStyles,
                    path,
                    inlineStyles,
                    animated,
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
                    return path(d);
                });
            // @ts-expect-error
            if (data.id) pathElem.attr("id", (d) => d.properties[data.id]);
            if (data.class) pathElem.attr("class", data.class);
            if (data.filter) parentPathElem.attr("filter", `url(#${data.filter})`);
            // data.props?.forEach((prop) => pathElem.attr(prop, (d) => d.properties[prop]));
        }
        // @ts-expect-error
        groups.each(drawPaths);
    }

    function drawMacroFrame(groupData: any[]): FrameSelection {
        const borderWidth = p("borderWidth");
        const borderRadius = p("borderRadius");
        const width = p("width"),
            height = p("height");
        const rx = Math.max(width, height) * (borderRadius / 100);
        const frame = svg
            .append("rect")
            .attr("x", borderWidth / 2)
            .attr("y", borderWidth / 2)
            .attr("id", "frame")
            .attr("pathLength", 1)
            .attr("stroke", p("borderColor"))
            .attr("stroke-width", borderWidth)
            .attr("fill", "none")
            .attr("width", width - borderWidth)
            .attr("height", height - borderWidth)
            .attr("rx", rx);
        return frame;
    }
    async function drawMicro(): Promise<void> {
        console.log("drawmicro");
        if (!maplibreMap) return;
        await mapLoadedPromise;
        projection = createD3ProjectionFromMapLibre(maplibreMap);
        path = geoPath(projection);
        drawPrettyMap(maplibreMap, svg, path, microLayerDefinitions, microParams, microLocked);
        freeHandDrawings.forEach((drawingGroup) => {
            const gDrawing = svg.append("g");
            for (const drawing of drawingGroup) {
                const pathElem = gDrawing.append("path").attr("pathLength", 1).classed("freehand", true);
                pathElem.attr("d", pathStringFromParsed(drawing, projection));
            }
        });
        applyInlineStyles();
    }

    function projectAndDraw(simplified = false): void {
        changeProjection();
        draw(simplified);
    }

    let totalCommonCss: string;
    function computeCss(): void {
        if (currentMode === "micro") {
            let css = `
        #paths > path {
            stroke: #7c490ea0;
            stroke-dasharray: 5px;
            stroke-width: 2;
            fill: none;
        }
        #static-svg-map {
            ${p("frameShadow") ? "filter: drop-shadow(2px 2px 8px rgba(0,0,0,.2));" : ""}
        }`;
            if (p("animate")) css += transitionCssMicro;
            commonCss = css;
            totalCommonCss = exportStyleSheet("#micro .poly") + commonCss;
            return;
        }
        const width = p("width");
        const height = p("height");
        const borderRadius = p("borderRadius");
        const finalColorsCss = Object.values(colorsCssByTab).reduce((acc, cur) => {
            acc += cur;
            return acc;
        }, "");
        const wantedRadiusInPx = Math.max(width, height) * (borderRadius / 100);
        const radiusX = Math.round(Math.min((wantedRadiusInPx * 100) / width, 50));
        const radiusY = Math.round(Math.min((wantedRadiusInPx * 100) / height, 50));
        let borderCss = `
    #static-svg-map {
        ${p("frameShadow") ? "filter: drop-shadow(2px 2px 8px rgba(0,0,0,.2));" : ""}
    }`;

        if (currentMode === "macro") {
            borderCss += `#static-svg-map, #static-svg-map > svg {
            border-radius: ${radiusX}%/${radiusY}%;
        }`;
        }
        commonCss = finalColorsCss + borderCss;
        if (p("animate")) commonCss += transitionCssMacro;
        totalCommonCss = exportStyleSheet("#outline") + commonCss;
    }

    function save(): void {
        baseCss = exportStyleSheet("#outline")!;
        saveState({
            params,
            microParams,
            inlineProps,
            inlinePropsMicro,
            baseCss,
            providedFonts,
            providedShapes,
            providedPaths,
            chosenCountriesAdm,
            orderedTabs,
            inlineStyles,
            shapeCount,
            zonesData,
            zonesFilter,
            lastUsedLabelProps,
            tooltipDefs,
            contourParams,
            colorDataDefs,
            legendDefs,
            customCategoricalPalette,
            currentMode,
            microLayerDefinitions,
        });
    }

    function resetState(): void {
        params = JSON.parse(JSON.stringify(defaultParams));
        microParams = JSON.parse(JSON.stringify(microDefaultParams));
        baseCss = defaultBaseCssMacro;
        commonStyleSheetElemMacro.innerHTML = baseCss;
        providedPaths = [];
        providedShapes = [];
        chosenCountriesAdm = [];
        orderedTabs = ["countries", "land"];
        currentMacroLayerTab = "countries";
        inlineProps = JSON.parse(JSON.stringify(defaultInlineProps));
        inlinePropsMicro = JSON.parse(JSON.stringify(defaultInlinePropsMicro));
        microLayerDefinitions = initLayersState(microPalettes["peach"]);
        if (currentMode === "micro") {
            updateSvgPatterns(
                document.getElementById("static-svg-map") as unknown as SVGElement,
                microLayerDefinitions,
            );
            replaceCssSheetContent(microLayerDefinitions);
        }
        setTimeout(() => {
            if (maplibreMap) maplibreMap.jumpTo(inlinePropsMicro);
        }, 500);
        providedFonts = [];
        shapeCount = 0;
        inlineStyles = {};
        zonesData = {};
        zonesFilter = { land: "firstGlow" };
        lastUsedLabelProps = { "font-size": "14px" };
        tooltipDefs = {
            countries: {
                template: defaultTooltipContent(true),
                content: defaultTooltipFull(defaultTooltipContent(true)),
                locale: "en-US",
                enabled: false,
            },
        };
        contourParams = {
            strokeWidth: 1,
            strokeColor: "#a0a0a07d",
            strokeDash: 0,
            fillColor: "#ffffff",
        };
        colorDataDefs = {
            countries: { ...defaultColorDef },
        };
        legendDefs = {
            countries: JSON.parse(JSON.stringify(defaultLegendDef)),
        };
        customCategoricalPalette = ["#ff0000ff", "#00ff00ff", "#0000ffff"];
        // auto adjust altitude when reseting
        changeAltitudeScale();
        updateLayerSimplification();
        projectAndDraw();
    }

    function restoreState(givenState?: any): void {
        let state;
        if (givenState) {
            state = givenState;
        } else state = getState();
        if (!state) return resetState();
        ({
            params,
            inlineProps,
            baseCss,
            providedFonts,
            providedShapes,
            providedPaths,
            chosenCountriesAdm,
            orderedTabs,
            inlineStyles,
            shapeCount,
            zonesData,
            zonesFilter,
            lastUsedLabelProps,
            tooltipDefs,
            contourParams,
            colorDataDefs,
            legendDefs,
        } = JSON.parse(JSON.stringify(state)));
        if (state.microParams) microParams = state.microParams;
        if (state.currentMode) switchMode(state.currentMode);
        if (state.microLayerDefinitions) microLayerDefinitions = state.microLayerDefinitions;
        inlinePropsMicro = state.inlinePropsMicro ?? defaultInlinePropsMicro;
        if (currentMode === "micro") {
            updateSvgPatterns(
                document.getElementById("static-svg-map") as unknown as SVGElement,
                microLayerDefinitions,
            );
            replaceCssSheetContent(microLayerDefinitions);
        }
        setTimeout(() => {
            if (maplibreMap) maplibreMap.jumpTo(inlinePropsMicro);
        }, 500);
        if (!baseCss) baseCss = defaultBaseCssMacro;
        commonStyleSheetElemMacro.innerHTML = baseCss;
        const tabsWoLand = orderedTabs.filter((x) => x !== "land");
        if (tabsWoLand.length) onTabChanged(tabsWoLand[0]);
        getZonesDataFormatters();
        changeAltitudeScale(false);
        updateLayerSimplification();
    }

    function saveProject(): void {
        baseCss = exportStyleSheet("#outline")!;
        const state = {
            params,
            microParams,
            inlineProps,
            baseCss,
            providedFonts,
            providedShapes,
            providedPaths,
            chosenCountriesAdm,
            orderedTabs,
            inlineStyles,
            shapeCount,
            zonesData,
            zonesFilter,
            lastUsedLabelProps,
            tooltipDefs,
            contourParams,
            colorDataDefs,
            legendDefs,
            customCategoricalPalette,
        };
        download(JSON.stringify(state), "text/json", "project.cartosvg");
    }

    function loadProject(e: Event): void {
        // @ts-expect-error
        const file = e.target.files[0];
        const reader = new FileReader();
        reader.addEventListener("load", () => {
            try {
                const providedState = JSON.parse(reader.result as string);
                restoreState(providedState);
                save();
                projectAndDraw();
            } catch (e) {
                console.error("Unable to parse provided file. Should be valid JSON.");
            }
        });
        reader.readAsText(file);
    }

    function loadExample(e: CustomEvent): void {
        if (
            !window.confirm(
                "Caution: Loading the example will discard your current project. Please save it first if you want to keep it.",
            )
        )
            return;
        restoreState(e.detail.projectParams);
        save();
        projectAndDraw();
    }

    function applyInlineStyles(styleAll = false): void {
        applyStyles(inlineStyles, styleAll ? countryFilteredImages : null);
        save();
    }

    function openEditor(e: MouseEvent): void {
        styleEditor.open(e.target, e.pageX, e.pageY);
    }
    let selectedPathIndex: number;

    function editPath(): void {
        closeMenu();
        const pathElem = openContextMenuInfo.target;
        detachListeners();
        editingPath = true;

        new PathEditor(pathElem, svg.node() as SVGSVGElement, (editedPathElem) => {
            // element was deleted
            if (!editedPathElem) {
                providedPaths.splice(selectedPathIndex, 1);
            } else {
                const parsed = parseAndUnprojectPath(editedPathElem, projection);
                providedPaths[selectedPathIndex].d = parsed;
            }
            attachListeners();
            editingPath = false;
            save();
        });
    }

    function deletePath(): void {
        closeMenu();
        providedPaths.splice(selectedPathIndex, 1);
        drawShapesAndSave();
    }

    function addImageToPath(e: Event): void {
        menuStates.pathSelected = false;
        menuStates.addingImageToPath = true;
    }

    function choseMarker(e: Event): void {
        menuStates.pathSelected = false;
        menuStates.chosingMarker = true;
    }

    function importImagePath(e: Event): void {
        // @ts-expect-error
        const file = e.target.files[0];
        const fileName = file.name;
        const reader = new FileReader();
        reader.addEventListener("load", () => {
            const newImage: PathDefImage = { name: fileName, content: reader.result as string };
            providedPaths[selectedPathIndex].image = newImage;
            if (!providedPaths[selectedPathIndex].duration) {
                providedPaths[selectedPathIndex].duration = 10;
                providedPaths[selectedPathIndex].width = 20;
                providedPaths[selectedPathIndex].height = 10;
            }
            drawCustomPaths(providedPaths, svg, projection, inlineStyles);
            applyInlineStyles();
            save();
        });
        reader.readAsDataURL(file);
    }

    const saveDebounced = debounce(save, 200);
    function changeDurationAnimation(e: Event): void {
        providedPaths[selectedPathIndex].duration = parseInt((e!.target! as HTMLInputElement).value);
        drawShapesAndSave();
    }

    function changePathImageWidth(e: Event): void {
        providedPaths[selectedPathIndex].width = parseInt((e!.target! as HTMLInputElement).value);
        drawShapesAndSave();
    }

    function changePathImageHeight(e: Event): void {
        providedPaths[selectedPathIndex].height = parseInt((e!.target! as HTMLInputElement).value);
        drawShapesAndSave();
    }

    function changeMarker(markerName: MarkerName | "delete"): void {
        closeMenu();
        menuStates.chosingMarker = false;
        if (markerName === "delete") delete providedPaths[selectedPathIndex].marker;
        else providedPaths[selectedPathIndex].marker = markerName;
        drawShapesAndSave();
    }

    function deleteImage(): void {
        delete providedPaths[selectedPathIndex].image;
        providedPaths[selectedPathIndex] = providedPaths[selectedPathIndex];
        drawShapesAndSave();
    }

    function drawShapesAndSave(): void {
        drawCustomPaths(providedPaths, svg, projection, inlineStyles);
        applyInlineStyles();
        saveDebounced();
    }

    function getFirstDataRow(zonesDataDef: ZoneData): ZoneDataRow | null {
        if (!zonesData) return null;
        const row = { ...zonesDataDef.data[0] };
        zonesDataDef.numericCols.forEach((colDef) => {
            const col = colDef.column;
            row[col] = zonesDataDef.formatters![col](row[col] as number);
        });
        return row;
    }

    let currentTemplateHasNumeric = false;
    function templateHasNumeric(layerName: string): boolean {
        const toFind = zonesData[layerName]?.numericCols.map((colDef) => `{${colDef.column}}`);
        const template = tooltipDefs[layerName]?.template;
        return toFind?.some((str) => template.includes(str));
    }

    function handleInputFont(e: Event): void {
        // @ts-expect-error
        const file = e.target.files[0];
        const fileName = file.name.split(".")[0];
        const reader = new FileReader();
        reader.addEventListener("load", () => {
            const newFont: ProvidedFont = { name: fileName, content: reader.result as string };
            providedFonts.push(newFont);
            providedFonts = providedFonts;
            save();
        });
        reader.readAsDataURL(file);
    }

    function addPath(): void {
        closeMenu();
        detachListeners();
        isDrawingPath = true;
        freeHandDrawPath(svg.node() as SVGSVGElement, (finishedElem) => {
            console.log("finishedElem", finishedElem);
            const d = finishedElem.getAttribute("d");
            if (!d) return;
            attachListeners();
            const pathIndex = providedPaths.length;
            const id = `path-${pathIndex}`;
            finishedElem.setAttribute("id", id);
            providedPaths.push({ d: parseAndUnprojectPath(d, projection) });
            saveDebounced();
            setTimeout(() => {
                isDrawingPath = false;
            }, 0);
        });
    }

    function drawFreeHand(): void {
        isDrawingFreeHand = true;
        closeMenu();
        detachListeners();
        freeHandDrawer.start(svg.node() as SVGSVGElement);
    }

    let freeHandDrawings: ParsedPath[][] = [];
    function stopDrawFreeHand(): void {
        if (!isDrawingFreeHand) return;
        attachListeners();
        isDrawingFreeHand = false;
        const newGroup = freeHandDrawer.stop();
        const paths = newGroup.querySelectorAll("path");
        if (!paths.length) return;

        // Get first point and store drawing as-is
        // let position = null;
        // for (const pathElem of paths) {
        //     const d = pathElem.getAttribute('d');
        //     if (!d) continue;
        //     position = parseAndUnprojectPath(d, projection)[0];
        //     break;
        // }

        const unprojected: ParsedPath[] = [];
        paths.forEach((pathElem) => {
            const d = pathElem.getAttribute("d");
            if (!d) return;
            const parsed = parseAndUnprojectPath(d, projection);
            unprojected.push(parsed);
            console.log(parsed);
        });
        if (unprojected.length) freeHandDrawings.push(unprojected);
    }

    function handleChangeProp(event: CustomEvent<{ prop: string; value: unknown }>): void {
        if (firstDraw) return;
        const { prop, value } = event.detail;
        if (positionVars.includes(prop)) {
            // @ts-expect-error
            inlineProps[prop] = value;
        }
        if (prop === "projection" || prop === "fieldOfView") {
            changeAltitudeScale();
        }
        if (prop === "projection") {
            inlineProps.translateX = 0;
            inlineProps.translateY = 0;
        }
        if (prop === "height") {
            Object.keys(legendDefs).forEach((tab) => {
                legendDefs[tab].y = (value as number) - 100;
            });
        }
        redrawThrottle(prop);
    }

    function closeMenu(): void {
        contextualMenu.style.display = "none";
        contextualMenu.opened = false;
        menuStates.chosingPoint = false;
        menuStates.pointSelected = false;
        menuStates.addingLabel = false;
        menuStates.pathSelected = false;
        menuStates.addingImageToPath = false;
        editedLabelId = null;
    }

    function editStyles(): void {
        closeMenu();
        styleEditor.open(openContextMenuInfo.target, openContextMenuInfo.event.pageX, openContextMenuInfo.event.pageY);
    }
    function addPoint(): void {
        menuStates.chosingPoint = true;
    }

    async function addLabel(): Promise<void> {
        menuStates.addingLabel = true;
        await tick();
        textInput.focus();
        textInput.addEventListener("keydown", ({ key }) => {
            if (key === "Enter") {
                validateLabel();
            }
        });
    }

    function validateLabel(): void {
        if (typedText.length) {
            if (editedLabelId) {
                const labelDef = providedShapes.find((def) => def.id === editedLabelId)!;
                labelDef.text = typedText;
            } else {
                const labelId = `label-${shapeCount++}`;
                providedShapes.push({
                    pos: openContextMenuInfo.position,
                    scale: 1,
                    id: labelId,
                    text: typedText,
                });
                inlineStyles[labelId] = { ...lastUsedLabelProps };
            }
            typedText = "";
        }
        drawAndSetupShapes();
        closeMenu();
    }

    function drawAndSetupShapes(): void {
        const container = document.getElementById("points-labels");
        if (!container) return;
        drawShapes(providedShapes, container, projection, save);
        select(container).on("dblclick", (e) => {
            const target = e.target;
            let targetId = target.getAttribute("id");
            if (target.tagName == "tspan") targetId = target.parentNode.getAttribute("id");
            if (targetId.includes("label")) {
                editedLabelId = targetId;
                const labelDef = providedShapes.find((def) => def.id === editedLabelId)!;
                typedText = labelDef.text!;
                addLabel();
                showMenu(e);
            }
            e.preventDefault();
            e.stopPropagation();
        });
        select(container).on(
            "contextmenu",
            function (e) {
                e.stopPropagation();
                e.preventDefault();
                menuStates.pointSelected = true;
                showMenu(e);
                return false;
            },
            false,
        );
        applyInlineStyles();
    }

    function showMenu(e: MouseEvent, target: EventTarget | null = null): void {
        openContextMenuInfo = {
            event: e,
            position: projection.invert!(pointer(e))!,
            target: (target ? target : e.target) as SVGPathElement,
        };
        contextualMenu.opened = true;
        contextualMenu.style.display = "block";
        contextualMenu.style.left = e.pageX + "px";
        contextualMenu.style.top = e.pageY + "px";
    }

    async function addShape(shapeName: ShapeName): Promise<void> {
        const shapeId = `${shapeName}-${shapeCount++}`;
        providedShapes.push({
            name: shapeName,
            pos: openContextMenuInfo.position,
            scale: 1,
            id: shapeId,
        });
        drawAndSetupShapes();
        closeMenu();
        await tick();
        setTimeout(() => {
            const lastShape = document.getElementById(providedShapes[providedShapes.length - 1].id);
            styleEditor.open(lastShape, openContextMenuInfo.event.pageX, openContextMenuInfo.event.pageY);
        }, 0);
    }

    function copySelection(): void {
        let objectId = openContextMenuInfo.target.getAttribute("id");
        if (openContextMenuInfo.target.tagName === "tspan") {
            objectId = (openContextMenuInfo.target.parentNode as HTMLElement).getAttribute("id");
        }
        const newDef: ShapeDefinition = { ...providedShapes.find((def) => def.id === objectId)! };
        const projected = projection(newDef.pos)!;
        newDef.pos = projection.invert!([projected[0] - 10, projected[1]])!;
        const newShapeId = `${newDef.name ? newDef.name : "label"}-${shapeCount++}`;
        inlineStyles[newShapeId] = { ...inlineStyles[newDef.id] };
        newDef.id = newShapeId;
        providedShapes.push(newDef);
        drawAndSetupShapes();
        closeMenu();
    }

    function deleteSelection(): void {
        let pointId = openContextMenuInfo.target.getAttribute("id")!;
        delete inlineStyles[pointId];
        if (openContextMenuInfo.target.tagName === "tspan") {
            pointId = (openContextMenuInfo.target.parentNode as HTMLElement).getAttribute("id")!;
            delete inlineStyles[pointId];
        }
        providedShapes = providedShapes.filter((def) => def.id !== pointId);
        drawAndSetupShapes();
        closeMenu();
    }

    const onModalClose = () => {
        showModal = false;
    };

    function exportJson(data: any): void {
        download(JSON.stringify(data, null, "\t"), "text/json", "data.json");
    }

    function getZonesDataFormatters(): void {
        Object.entries(zonesData).forEach(([name, def]) => {
            const locale = tooltipDefs[name].locale;
            const formatters: FormatterObject = {};
            if (def.numericCols.length) {
                def.numericCols.forEach((colDef) => {
                    const col = colDef.column;
                    formatters[col] = getBestFormatter(
                        def.data.map((row) => row[col] as number),
                        resolvedLocales[locale],
                    );
                });
            }
            zonesData[name].formatters = formatters;
        });
    }

    function handleDataImport(e: Event): void {
        const file = (e.target as HTMLInputElement).files![0];
        const reader = new FileReader();
        reader.addEventListener("load", () => {
            try {
                let parsed = JSON.parse(reader.result as string);
                const currentNames = new Set<string | undefined>(
                    zonesData[currentMacroLayerTab].data.map((line) => line.name),
                );
                currentNames.delete(undefined);
                if (!Array.isArray(parsed)) {
                    return window.alert("JSON should be a list of objects, each object reprensenting a line.");
                }
                const noNameLinesMsg = parsed.reduce((errorMsg, entry, index) => {
                    if (entry.name === undefined) {
                        errorMsg += `Entry ${index} is ${JSON.stringify(entry)} \n`;
                    }
                    return errorMsg;
                }, "");
                if (parsed.some((line) => line.name === undefined)) {
                    return window.alert(`All lines should have a 'name' property \n${noNameLinesMsg}`);
                }
                const newNames = new Set(parsed.map((line) => line.name));
                const difference = new Set([...currentNames].filter((x) => !newNames.has(x)));
                if (difference.size) {
                    return window.alert(`Missing names ${[...difference]}`);
                }
                zonesData[currentMacroLayerTab] = {
                    data: parsed,
                    provided: true,
                    numericCols: getNumericCols(parsed),
                };
                getZonesDataFormatters();
                autoSelectColors();
                save();
            } catch (e) {
                console.log("Parse error:", e);
                window.alert("Provided file should be valid JSON.");
            }
        });
        reader.readAsText(file);
    }

    function defaultTooltipContent(isCountry: boolean): string {
        return `<div>
    <span> ${isCountry ? "Country" : "Region"}: {name}</span>
</div>
    `;
    }

    function defaultTooltipFull(template: string): string {
        return `<div id="tooltip-preview" style="${defaultTooltipStyle}">
        ${template}
    </div>`;
    }

    function editTooltip(e: MouseEvent): void {
        const rect = (e.target as HTMLElement).getBoundingClientRect();
        styleEditor.open(e.target, rect.right, rect.bottom);
    }

    let templateErrorMessages: Record<string, boolean> = {};
    function onTemplateChange(): void {
        const parsed = DOM_PARSER.parseFromString(tooltipDefs[currentMacroLayerTab].template, "application/xml");
        const errorNode = parsed.querySelector("parsererror");
        if (errorNode) {
            templateErrorMessages[currentMacroLayerTab] = true;
        } else {
            tooltipDefs[currentMacroLayerTab].content = htmlTooltipElem.outerHTML;
            currentTemplateHasNumeric = templateHasNumeric(currentMacroLayerTab);
            delete templateErrorMessages[currentMacroLayerTab];
        }
        save();
    }

    function changeNumericFormatter(): void {
        getZonesDataFormatters();
        colorizeAndLegend();
    }

    async function onTabChanged(newTabTitle: string): Promise<void> {
        currentMacroLayerTab = newTabTitle;
        currentTemplateHasNumeric = templateHasNumeric(currentMacroLayerTab) === true;
        await tick();
        initTooltips();
        applyStylesToTemplate();
    }

    function applyStylesToTemplate(): void {
        if (htmlTooltipElem && tooltipDefs[currentMacroLayerTab]?.enabled) {
            const tmpElem = htmlToElement(tooltipDefs[currentMacroLayerTab].content!)!;
            reportStyle(tmpElem, htmlTooltipElem);
        }
        if (legendSample && colorDataDefs[currentMacroLayerTab]?.legendEnabled) {
            const tmpElem = htmlToElement(legendDefs[currentMacroLayerTab].sampleHtml!)!;
            reportStyle(tmpElem, legendSample);
        }
    }

    async function addNewCountry(e: Event): Promise<void> {
        const target = e.target as HTMLSelectElement;
        const newLayerName = target.value;
        if (chosenCountriesAdm.includes(newLayerName)) return;
        let searchedAdm;
        if (newLayerName.slice(-1) === "1") searchedAdm = newLayerName.replace("ADM1", "ADM2");
        else searchedAdm = newLayerName.replace("ADM2", "ADM1");
        const existingIndex = chosenCountriesAdm.indexOf(searchedAdm);
        if (existingIndex > -1) {
            deleteCountry(searchedAdm, false);
        }
        chosenCountriesAdm.push(newLayerName);
        orderedTabs.push(newLayerName);
        chosenCountriesAdm = chosenCountriesAdm;
        orderedTabs = orderedTabs;
        target.selectedIndex = 0;
        await draw();
        onTabChanged(newLayerName);
    }

    function deleteCountry(country: string, drawAfter = true): void {
        chosenCountriesAdm = chosenCountriesAdm.filter((x) => x !== country);
        orderedTabs = orderedTabs.filter((x) => x !== country);
        currentMacroLayerTab = orderedTabs[0];
        delete tooltipDefs[country];
        delete legendDefs[country];
        delete colorDataDefs[country];
        delete zonesData[country];
        if (drawAfter) draw();
    }

    // === Drag and drop behaviour ===

    let hoveringTab: number | null = null;
    let dragStartIndex = 0;

    function drop(event: DragEvent, target: number): void {
        event.dataTransfer!.dropEffect = "move";
        const newList = orderedTabs;

        if (dragStartIndex < target) {
            newList.splice(target + 1, 0, newList[dragStartIndex]);
            newList.splice(dragStartIndex, 1);
        } else {
            newList.splice(target, 0, newList[dragStartIndex]);
            newList.splice(dragStartIndex + 1, 1);
        }
        orderedTabs = newList;
        hoveringTab = null;
        draw();
    }

    function dragstart(event: DragEvent, i: number, prevent = false): void {
        if (prevent) {
            return event.preventDefault();
        }
        event.dataTransfer!.effectAllowed = "move";
        event.dataTransfer!.dropEffect = "move";
        dragStartIndex = i;
    }

    function validateExport(): void {
        const formData = Object.fromEntries(new FormData(exportForm).entries());
        if (currentMode === "macro") {
            exportSvg(
                svg,
                p("width"),
                p("height"),
                tooltipDefs,
                chosenCountriesAdm,
                zonesData,
                providedFonts,
                true,
                totalCommonCss,
                p("animate"),
                formData,
            );
            fetch("/exportSvgMacro");
        } else {
            const attributionColor = microLayerDefinitions["road-network"]["stroke"] ?? "#aaa";
            console.log("attributionColor=", attributionColor);
            exportMicro(svg, microParams, providedFonts, totalCommonCss, p("animate"), attributionColor, formData);
            fetch("/exportSvgMicro");
        }
        showExportConfirm = false;
    }

    // === Export as PNG behaviour ===
    // import * as saveSvgAsPng from 'save-svg-as-png';
    // async function exportRaster() {
    //     const optimized = await exportSvg(svg, p('width'), p('height'), tooltipDefs, chosenCountriesAdm, zonesData, providedFonts, false, totalCommonCss, {});
    //     const elem = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    //     document.body.append(elem);
    //     elem.outerHTML = optimized;
    //     saveSvgAsPng.saveSvgAsPng(document.body.lastChild, 'test.png');
    //     document.body.lastChild.remove();
    //     fetch('/exportRaster');
    // }

    let inlineFontUsed = false;
    function onExportSvgClicked() {
        const usedFonts = getUsedInlineFonts(svg.node()!);
        const usedProvidedFonts = providedFonts.filter((font) => usedFonts.has(font.name));
        inlineFontUsed = usedProvidedFonts.length > 0;
        if (currentMode === "micro" && !inlineFontUsed) {
            validateExport();
            return;
        }
        showExportConfirm = true;
    }
    // === Colorize by data behaviour ===

    // --- Computed ---
    let availableColumns: string[] = [],
        availablePalettes: string[] = [];
    $: availableColorTypes = zonesData?.[currentMacroLayerTab]?.numericCols?.length
        ? ["category", "quantile", "quantize"]
        : ["category"];
    $: curDataDefs = colorDataDefs?.[currentMacroLayerTab];
    let currentIsColorByNumeric = ["quantile", "quantize"].includes(curDataDefs?.colorScale);

    function autoSelectColors() {
        if (!zonesData[currentMacroLayerTab]) return;
        if (curDataDefs.colorScale === null) {
            if (curDataDefs.colorColumn !== null) {
                if (zonesData[currentMacroLayerTab].numericCols.find((x) => x.column === curDataDefs.colorColumn)) {
                    curDataDefs.colorScale = "quantile";
                } else curDataDefs.colorScale = "category";
            } else curDataDefs.colorScale = "category";
        }
        availableColumns =
            curDataDefs.colorScale === "category"
                ? getColumns(zonesData[currentMacroLayerTab].data)
                : zonesData?.[currentMacroLayerTab]?.numericCols.map((x) => x.column);
        availablePalettes =
            curDataDefs.colorScale === "category" ? Object.keys(CATEGORICAL_SCHEMES) : Object.keys(CONTINUOUS_SCHEMES);
        if (!availableColumns.includes(curDataDefs.colorColumn)) {
            curDataDefs.colorColumn = availableColumns[0];
        }
        if (!availablePalettes.includes(curDataDefs.colorPalette!))
            curDataDefs.colorPalette = availablePalettes[0] as AnyScaleKey;
        if (svg) colorizeAndLegend();
    }

    $: if (colorDataDefs[currentMacroLayerTab]) {
        const x = { ...colorDataDefs[currentMacroLayerTab] };
        // TODO: test this works
        autoSelectColors();
    }

    const colorsCssByTab: Record<string, string> = {};
    let legendSample: SVGGElement;
    let displayedLegend: Record<string, SvgGSelection> = {};
    let sampleLegend = {
        color: "black",
        text: "test",
    };
    let showCustomPalette = false;
    // tab => {x => color} used for custom palette
    const ordinalMapping: OrdinalMapping = {};
    async function colorizeAndLegend(e?: Event): Promise<void> {
        await tick();
        initTooltips();
        legendDefs = legendDefs;
        const legendEntries = select("#svg-map-legend");
        if (!legendEntries.empty()) legendEntries.remove();
        const legendSelection = svg.select("svg").append("g").attr("id", "svg-map-legend") as SvgGSelection;
        Object.entries(colorDataDefs).forEach(([tab, dataColorDef], tabIndex) => {
            if (!zonesData[tab]) return;
            if (!legendDefs[tab].noData.manual) legendDefs[tab].noData.active = false;
            // reset present classes
            document.querySelectorAll(`g[id="${tab}"] [class*="ssc"]`).forEach((el) => {
                [...el.classList].forEach((cls) => {
                    if (cls.includes("ssc")) el.classList.remove(cls);
                });
            });
            if (!dataColorDef.enabled) {
                dataColorDef.legendEnabled = false;
                colorsCssByTab[tab] = "";
                if (displayedLegend[tab]) displayedLegend[tab].remove();
                zonesData[tab].data.forEach((row) => {
                    const d = row[dataColorDef.colorColumn];
                    const key = row.name;
                    const elem = document.querySelector(`g[id="${tab}"] [id="${key}"]`);
                    if (!elem) return;
                    [...elem.classList].forEach((cls) => {
                        if (cls.includes("ssc")) elem.classList.remove(cls);
                    });
                });
                return;
            }
            const paletteName = `scheme${dataColorDef.colorPalette}`;
            // filter out undef or null data
            const data = zonesData[tab].data.reduce<(string | number)[]>((acc, row) => {
                const d = row[dataColorDef.colorColumn];
                if (d === null || d === undefined) {
                    if (!legendDefs[tab].noData.manual) legendDefs[tab].noData.active = true;
                    return acc;
                }
                acc.push(d);
                return acc;
            }, []);
            let scale: ColorScale;
            if (dataColorDef.colorScale === "category") {
                if (dataColorDef.colorPalette === "Custom") {
                    ordinalMapping[tab] = {};
                    scale = scaleOrdinal(customCategoricalPalette);
                } else scale = scaleOrdinal(CATEGORICAL_SCHEMES[paletteName as CategoricalScaleKey]);
            } else if (dataColorDef.colorScale === "quantile") {
                scale = scaleQuantile<string, number>()
                    .domain(data as number[])
                    .range(CONTINUOUS_SCHEMES[paletteName as ContinuousScaleKey][dataColorDef.nbBreaks]);
            } else if (dataColorDef.colorScale === "quantize") {
                const dataExtent = extent(data as number[]) as [number, number];
                scale = scaleQuantize<string, number>()
                    .domain(dataExtent)
                    .range(CONTINUOUS_SCHEMES[paletteName as ContinuousScaleKey][dataColorDef.nbBreaks]);
            }
            const usedColors: Color[] = [];
            zonesData[tab].data.forEach((row) => {
                const d = row[dataColorDef.colorColumn];
                const key = row.name;
                const elem = document.querySelector(`g[id="${tab}"] [id="${key}"]`);
                if (!elem) return;
                let color: Color;
                if (d === null || d === undefined) {
                    color = legendDefs[tab].noData.color;
                } else {
                    // @ts-expect-error
                    color = scale(d) as Color;
                    if (ordinalMapping[tab]) {
                        if (!ordinalMapping[tab][color]) ordinalMapping[tab][color] = new Set([d as string]);
                        else ordinalMapping[tab][color].add(d as string);
                    }
                }
                if (!usedColors.includes(color)) usedColors.push(color);
                const cssClass = `ssc-${tabIndex}-${usedColors.indexOf(color)}`;

                elem.classList.add(cssClass);
            });
            let newCss = "";
            usedColors.forEach((color, i) => {
                newCss += `path.ssc-${tabIndex}-${i}{fill:${color};}
            path.ssc-${tabIndex}-${i}.hovered{fill:${d3Color(color)!.brighter(0.2).hex()};}`;
            });
            colorsCssByTab[tab] = newCss;
            const legendColors = getLegendColors(dataColorDef, tab, scale!, data);
            if (!legendColors) return;
            if (tab === currentMacroLayerTab)
                sampleLegend = {
                    color: legendColors[0][0],
                    text: legendColors[0][1],
                };
            const sampleElem = htmlToElement<SVGSVGElement>(legendDefs[tab].sampleHtml!)!;
            displayedLegend[tab] = drawLegend(
                legendSelection,
                legendDefs[tab],
                legendColors,
                dataColorDef.colorScale === "category",
                sampleElem,
                tab,
                saveDebounced,
                applyInlineStyles,
            );
        });
        computeCss();
        applyInlineStyles();
        applyStylesToTemplate();
    }

    // ==== Legend ===

    function getLegendColors(
        dataColorDef: ColorDef,
        tab: string,
        scale: ColorScale,
        data: (string | number)[],
    ): LegendColor[] | undefined {
        if (!dataColorDef.legendEnabled) {
            if (displayedLegend[tab]) displayedLegend[tab].remove();
            return;
        }
        if (legendSample && legendDefs[tab].sampleHtml === null) legendDefs[tab].sampleHtml = legendSample.outerHTML;
        if (legendDefs[tab].title === null) legendDefs[tab].title = dataColorDef.colorColumn;
        let threshValues: number[];
        let formatter = (x: number | string) => x;
        if (dataColorDef.colorScale === "category") {
            threshValues = [...new Set(data as number[])];
        } else {
            // @ts-expect-error
            formatter = d3
                .formatLocale(resolvedLocales[tooltipDefs[tab].locale])
                .format(`,.${legendDefs[tab].significantDigits}r`);
            const minValue = Math.min(...(data as number[]));
            const scaleQuantile = scale as d3.ScaleQuantile<string, number>;
            const scaleQuantize = scale as d3.ScaleQuantize<string, number>;
            if (scaleQuantile.quantiles) threshValues = scaleQuantile.quantiles();
            else if (scaleQuantize.thresholds) threshValues = scaleQuantize.thresholds();
            threshValues!.unshift(minValue);
        }
        const legendColors = threshValues!.reduce((acc, cur) => {
            // @ts-expect-error
            acc.push([scale(cur) as Color, formatter(cur)]);
            return acc;
        }, [] as LegendColor[]);
        if (legendDefs[tab].direction === "v") return legendColors.reverse();
        return legendColors;
    }

    // TODO: check menu opened to avoid it being display on page land
</script>

<svelte:head>
    {@html `<${""}style> ${commonCss} </${""}style>`}
    {@html `<${""}style> ${cssFonts} </${""}style>`}
</svelte:head>

<div id="contextmenu" class="border rounded" bind:this={contextualMenu} class:hidden={!contextualMenu?.opened}>
    {#if menuStates.chosingPoint}
        {#each Object.keys(shapes) as shapeName (shapeName)}
            <div role="button" class="px-2 py-1" on:click={() => addShape(shapeName as ShapeName)}>
                {shapeName}
            </div>
        {/each}
    {:else if menuStates.addingLabel}
        <input type="text" bind:this={textInput} bind:value={typedText} />
    {:else if menuStates.pointSelected}
        <div role="button" class="px-2 py-1" on:click={editStyles}>Edit styles</div>
        <div role="button" class="px-2 py-1" on:click={copySelection}>Copy</div>
        <div role="button" class="px-2 py-1" on:click={deleteSelection}>Delete</div>
    {:else if menuStates.pathSelected}
        <div role="button" class="px-2 py-1" on:click={editPath}>Edit path</div>
        <div role="button" class="px-2 py-1" on:click={editStyles}>Edit style</div>
        <div role="button" class="px-2 py-1" on:click={deletePath}>Delete path</div>
        <div role="button" class="px-2 py-1" on:click={addImageToPath}>Image along path</div>
        <div role="button" class="px-2 py-1" on:click={choseMarker}>Chose marker</div>
    {:else if menuStates.chosingMarker}
        <div class="d-flex">
            <div role="button" class="px-2 py-1" on:click={() => changeMarker("delete")}>
                <Icon fillColor="red" svg={icons["trash"]} />
            </div>
            {#each Object.entries(markers) as [markerName, markerDef] (markerName)}
                <div role="button" class="px-2 py-1" on:click={() => changeMarker(markerName as MarkerName)}>
                    <svg width="30" height="30" viewBox={`0 0 ${markerDef.width} ${markerDef.height}`}>
                        <path d={markerDef.d} />
                    </svg>
                </div>
            {/each}
        </div>
    {:else if menuStates.addingImageToPath}
        <div class="d-flex align-items-center">
            <div class="m-1">
                <label for="image-select" class="m-2 d-flex align-items-center btn btn-sm btn-light">
                    File: {providedPaths[selectedPathIndex].image?.name || "Import image"}
                </label>
                <input type="file" id="image-select" accept=".png,.jpg,.svg" on:change={importImagePath} />
            </div>
            <div role="button" class="" on:click={deleteImage}>
                <Icon fillColor="red" svg={icons["trash"]} />
            </div>
        </div>
        <div class="row m-1">
            <label for="duration-select" class="col-6 col-form-label col-form-label-sm"> Duration </label>
            <div class="col-6">
                <input
                    id="duration-select"
                    class="form-control form-control-sm"
                    type="number"
                    value={providedPaths[selectedPathIndex].duration}
                    on:change={changeDurationAnimation}
                />
            </div>
        </div>
        <div class="row m-1">
            <label for="path-img-width" class="col-6 col-form-label col-form-label-sm"> Image width </label>
            <div class="col-6">
                <input
                    id="path-img-width"
                    class="form-control form-control-sm"
                    type="number"
                    value={providedPaths[selectedPathIndex].width}
                    on:change={changePathImageWidth}
                />
            </div>
        </div>
        <div class="row m-1">
            <label for="path-img-height" class="col-6 col-form-label col-form-label-sm"> Image height </label>
            <div class="col-6">
                <input
                    id="path-img-height"
                    class="form-control form-control-sm"
                    type="number"
                    value={providedPaths[selectedPathIndex].height}
                    on:change={changePathImageHeight}
                />
            </div>
        </div>
    {:else}
        <div role="button" class="px-2 py-1" on:click={editStyles}>Edit styles</div>
        <div role="button" class="px-2 py-1" on:click={addPath}>Draw path</div>
        <div role="button" class="px-2 py-1" on:click={drawFreeHand}>Draw freehand</div>
        <div role="button" class="px-2 py-1" on:click={addPoint}>Add point</div>
        <div role="button" class="px-2 py-1" on:click={addLabel}>Add label</div>
    {/if}
</div>

<div class="d-flex align-items-start h-100">
    <aside id="params" class="h-100">
        <div id="main-panel" class="d-flex flex-column align-items-center pt-4 h-100">
            <div class="mode-selection btn-group" role="group">
                <input
                    type="radio"
                    class="btn-check"
                    name="mainModeSwitch"
                    id="switchMacro"
                    on:change={(e) => switchMode(e.currentTarget.value as Mode)}
                    value="macro"
                    autocomplete="off"
                />
                <label class="btn btn-outline-primary fs-3" for="switchMacro" class:active={currentMode === "macro"}>
                    <img src={macroImg} width="50" height="50" />
                    Macro
                </label>

                <input
                    type="radio"
                    class="btn-check"
                    name="mainModeSwitch"
                    id="switchMicro"
                    autocomplete="off"
                    on:change={(e) => switchMode(e.currentTarget.value as Mode)}
                    value="micro"
                />
                <label class="btn btn-outline-primary fs-3" for="switchMicro" class:active={currentMode === "micro"}>
                    Detailed
                    <img src={microImg} width="50" height="50" />
                </label>
            </div>

            <div class="w-100">
                <ul class="nav nav-tabs align-items-center justify-content-center m-1">
                    <li class="nav-item d-flex align-items-center mx-1">
                        <a
                            href="javascript:;"
                            class="nav-link d-flex align-items-center position-relative fs-5"
                            on:click={() => (mainMenuSelection = "general")}
                            class:active={mainMenuSelection === "general"}
                        >
                            General
                        </a>
                    </li>
                    <li class="nav-item d-flex align-items-center mx-1">
                        <a
                            href="javascript:;"
                            class="nav-link d-flex align-items-center position-relative fs-5"
                            on:click={() => (mainMenuSelection = "layers")}
                            class:active={mainMenuSelection === "layers"}
                        >
                            Layers
                        </a>
                    </li>
                </ul>
            </div>
            <div id="main-menu" class="mt-4">
                {#if mainMenuSelection === "general"}
                    <Accordions
                        sections={currentParams as unknown as Record<string, Record<string, number>>}
                        {paramDefs}
                        {helpParams}
                        otherParams={accordionVisiblityParams}
                        on:change={handleChangeProp}
                    ></Accordions>
                {:else if mainMenuSelection === "layers" && currentMode === "macro"}
                    <div class="border border-primary rounded">
                        <div class="p-2">
                            <div class="form-check form-switch">
                                <input
                                    class="form-check-input"
                                    type="checkbox"
                                    role="switch"
                                    id="showLand"
                                    bind:checked={inlineProps.showLand}
                                    on:change={() => draw()}
                                />
                                <label class="form-check-label" for="showLand"> Show land</label>
                            </div>
                            <div class="form-check form-switch">
                                <input
                                    class="form-check-input"
                                    type="checkbox"
                                    role="switch"
                                    id="showCountries"
                                    bind:checked={inlineProps.showCountries}
                                    on:change={() => draw()}
                                />
                                <label class="form-check-label" for="showCountries"> Show countries</label>
                            </div>
                        </div>

                        <ul class="nav nav-tabs align-items-center m-1">
                            {#each computedOrderedTabs as tabTitle, index (tabTitle)}
                                {@const isLand = tabTitle === "land"}
                                <li
                                    class="nav-item d-flex align-items-center mx-1"
                                    draggable={isLand}
                                    on:dragstart={(event) => dragstart(event, index, tabTitle !== "land")}
                                    on:drop|preventDefault={(event) => drop(event, index)}
                                    on:dragover={() => false}
                                    on:dragenter={() => (hoveringTab = index)}
                                    class:is-dnd-hovering-right={hoveringTab === index && index > dragStartIndex}
                                    class:is-dnd-hovering-left={hoveringTab === index && index < dragStartIndex}
                                    class:grabbable={isLand}
                                >
                                    <a
                                        href="javascript:;"
                                        class:active={currentMacroLayerTab === tabTitle}
                                        class="nav-link d-flex align-items-center position-relative"
                                        on:click={() => onTabChanged(tabTitle)}
                                    >
                                        {#if isLand}
                                            <Icon svg={icons["draggable"]} />
                                        {/if}
                                        {tabTitle}
                                        {#if tabTitle !== "countries" && !isLand}
                                            <span
                                                role="button"
                                                class="delete-tab"
                                                on:click={() => deleteCountry(tabTitle)}
                                            >
                                                ✕
                                            </span>
                                        {/if}
                                    </a>
                                </li>{/each}

                            <li class="nav-item icon-add">
                                <select role="button" id="country-select" on:change={addNewCountry}>
                                    <option disabled selected value> -- select a country -- </option>
                                    {#each allAvailableAdm as country}
                                        <option value={country}>{country}</option>
                                    {/each}
                                </select>
                                <span class="nav-link d-flex">
                                    <Icon fillColor="none" svg={icons["add"]} />
                                </span>
                            </li>
                        </ul>
                        <div class="p-2">
                            {#if currentMacroLayerTab !== "countries"}
                                <div class="d-flex m-1 align-items-center">
                                    <div class="form-floating flex-grow-1">
                                        <select
                                            id="choseFilter"
                                            class="form-select form-select-sm"
                                            bind:value={zonesFilter[currentMacroLayerTab]}
                                            on:change={() => draw()}
                                        >
                                            <option value={null}> None </option>
                                            <option value="firstGlow"> First glow </option>
                                            <option value="secondGlow"> Second glow </option>
                                        </select>
                                        <label for="choseFilter">Glow filter</label>
                                    </div>
                                    <span
                                        class="help-tooltip"
                                        data-bs-toggle="tooltip"
                                        data-bs-title="Two filters are available, that are customizable in the 'General' panel (first / second glow sections)."
                                        >?</span
                                    >
                                </div>
                            {/if}
                            {#if currentMacroLayerTab === "land"}
                                <div>
                                    <div class="field">
                                        <RangeInput
                                            id="contourwidth"
                                            title="Contour width"
                                            onChange={() => redraw()}
                                            bind:value={contourParams.strokeWidth}
                                            min="0"
                                            max="5"
                                            step="0.5"
                                        ></RangeInput>
                                    </div>
                                    <div class="field">
                                        <ColorPickerPreview
                                            id="contourpicker"
                                            popup="right"
                                            title="Contour color"
                                            value={contourParams.strokeColor}
                                            onChange={(col) => {
                                                contourParams.strokeColor = col;
                                                redraw();
                                            }}
                                        ></ColorPickerPreview>
                                    </div>
                                    <div class="field">
                                        <RangeInput
                                            id="contour dash"
                                            title="Contour dash"
                                            onChange={() => redraw()}
                                            bind:value={contourParams.strokeDash}
                                            min="0"
                                            max="20"
                                            step="0.5"
                                        ></RangeInput>
                                    </div>
                                    {#if computedOrderedTabs.findIndex((x) => x === "land") === 0}
                                        <ColorPickerPreview
                                            id="fillpicker"
                                            popup="right"
                                            title="Fill color"
                                            value={contourParams.fillColor}
                                            onChange={(col) => {
                                                contourParams.fillColor = col;
                                                redraw();
                                            }}
                                        ></ColorPickerPreview>
                                    {/if}
                                </div>
                            {/if}
                            {#if zonesData?.[currentMacroLayerTab]?.["data"]}
                                <div class="d-flex align-items-center">
                                    <div>
                                        <label for="data-input-json" class="m-2 btn btn-light">
                                            Import data for {currentMacroLayerTab}
                                        </label>
                                        <input
                                            id="data-input-json"
                                            type="file"
                                            accept=".json"
                                            on:change={(e) => handleDataImport(e)}
                                        />
                                    </div>
                                    <span
                                        class="help-tooltip"
                                        data-bs-toggle="tooltip"
                                        data-bs-title="Import data for current layer. The 'name' property must be defined for each line. You can export the default data to have a template to start from."
                                        >?</span
                                    >
                                    <div
                                        class="mx-2 ms-auto btn btn-outline-primary"
                                        on:click={() => exportJson(zonesData?.[currentMacroLayerTab]?.["data"])}
                                    >
                                        Export JSON
                                    </div>
                                </div>
                                <div class="data-table border rounded-2 mb-2" on:click={() => (showModal = true)}>
                                    <DataTable data={zonesData?.[currentMacroLayerTab]?.["data"]}></DataTable>
                                </div>
                                <div class="mx-2 form-check form-switch">
                                    <input
                                        type="checkbox"
                                        role="switch"
                                        class="form-check-input"
                                        id="showTooltip"
                                        bind:checked={tooltipDefs[currentMacroLayerTab].enabled}
                                        on:click={() =>
                                            setTimeout(() => {
                                                initTooltips();
                                                save();
                                                applyStylesToTemplate();
                                            }, 0)}
                                    />
                                    <label for="showTooltip" class="form-check-label"> Show tooltip on hover </label>
                                </div>
                                {#if tooltipDefs[currentMacroLayerTab].enabled}
                                    <div class="m-2 has-validation">
                                        <label for="templatetooltip" class="form-label">
                                            Tooltip template
                                            <span
                                                class="help-tooltip"
                                                data-bs-toggle="tooltip"
                                                data-bs-title="The template must be valid HTML (<br/> can be used to break lines). Brackets  &#123; &#125; can be used to reference columns from the data above.  "
                                                >?</span
                                            >
                                        </label>
                                        <textarea
                                            class="form-control"
                                            class:is-invalid={templateErrorMessages[currentMacroLayerTab]}
                                            id="templatetooltip"
                                            rows="7"
                                            bind:value={tooltipDefs[currentMacroLayerTab].template}
                                            on:change={onTemplateChange}
                                        />
                                        {#if templateErrorMessages[currentMacroLayerTab]}
                                            <div class="invalid-feedback">
                                                <span> Malformed HTML. Please fix the template </span> <br />
                                                <!-- {templateErrorMessages[currentTab]} -->
                                            </div>
                                        {/if}
                                    </div>
                                    <div class="mx-2 d-flex align-items-center">
                                        <label for="tooltip-preview-{currentMacroLayerTab}">
                                            Example tooltip:
                                            <span
                                                class="help-tooltip"
                                                data-bs-toggle="tooltip"
                                                data-bs-title="Click on the example to update style. Pro tip: changes made in the developer panel are also reported."
                                                >?</span
                                            >
                                        </label>
                                        <div class="tooltip-preview">
                                            <div
                                                id="tooltip-preview-{currentMacroLayerTab}"
                                                bind:this={htmlTooltipElem}
                                                on:click={editTooltip}
                                                style="${defaultTooltipStyle}"
                                            >
                                                {@html formatUnicorn(
                                                    tooltipDefs[currentMacroLayerTab].template,
                                                    getFirstDataRow(zonesData[currentMacroLayerTab]) as Record<
                                                        string,
                                                        string
                                                    >,
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                {/if}
                                <!-- COLORING -->
                                <div class="mx-2 form-check form-switch">
                                    <input
                                        type="checkbox"
                                        role="switch"
                                        class="form-check-input"
                                        id="colorData"
                                        bind:checked={curDataDefs.enabled}
                                        on:change={colorizeAndLegend}
                                    />
                                    <label for="colorData" class="form-check-label"> Color using data </label>
                                </div>
                                {#if curDataDefs.enabled}
                                    <div class="d-flex m-1 align-items-center">
                                        <div class="form-floating flex-grow-1">
                                            <select
                                                class="form-select form-select-sm"
                                                id="choseColorType"
                                                bind:value={curDataDefs.colorScale}
                                            >
                                                {#each availableColorTypes as colorType}
                                                    <option value={colorType}>
                                                        {colorType}
                                                    </option>
                                                {/each}
                                            </select>
                                            <label for="choseColorType">Color type</label>
                                        </div>
                                        <span class="help-tooltip" data-bs-toggle="tooltip" data-bs-title={scalesHelp}
                                            >?</span
                                        >
                                    </div>

                                    <div class="d-flex align-items-center justify-content-between">
                                        <div class="flex-grow-1 m-1 form-floating">
                                            <select
                                                class="form-select form-select-sm"
                                                id="choseColorColumn"
                                                bind:value={curDataDefs.colorColumn}
                                                on:change={(e) =>
                                                    (legendDefs[currentMacroLayerTab].title = (
                                                        e.target as HTMLSelectElement
                                                    ).value)}
                                            >
                                                {#each availableColumns as colorColumn}
                                                    <option value={colorColumn}>
                                                        {colorColumn}
                                                    </option>
                                                {/each}
                                            </select>
                                            <label for="choseColorColumn"> Value color</label>
                                        </div>
                                        <div class="flex-grow-1 m-1 form-floating">
                                            <select
                                                class="form-select form-select-sm"
                                                id="choseColorPalette"
                                                bind:value={curDataDefs.colorPalette}
                                            >
                                                {#each availablePalettes as palette}
                                                    <option value={palette}>
                                                        {palette}
                                                    </option>
                                                {/each}
                                            </select>
                                            <label for="choseColorPalette"> Palette </label>
                                        </div>
                                        {#if curDataDefs.colorPalette === "Custom"}
                                            <span
                                                class="btn btn-outline-primary"
                                                on:click={() => (showCustomPalette = true)}
                                            >
                                                Edit palette</span
                                            >
                                        {/if}
                                    </div>
                                    {#if curDataDefs.colorScale !== "category"}
                                        <div>
                                            <RangeInput
                                                title="Number of breaks"
                                                bind:value={curDataDefs.nbBreaks}
                                                min="3"
                                                max="9"
                                            ></RangeInput>
                                        </div>
                                    {/if}
                                    <!-- LEGEND -->
                                    <div class="mx-2 form-check form-switch">
                                        <input
                                            type="checkbox"
                                            class="form-check-input"
                                            id="showLegend"
                                            role="switch"
                                            bind:checked={colorDataDefs[currentMacroLayerTab].legendEnabled}
                                            on:change={colorizeAndLegend}
                                        />
                                        <label for="showLegend" class="form-check-label">
                                            Show legend
                                            <span
                                                class="help-tooltip"
                                                data-bs-toggle="tooltip"
                                                data-bs-title="Drag the title of the legend to move it, as well as the entries."
                                                >?</span
                                            >
                                        </label>
                                    </div>
                                {/if}
                                {#if curDataDefs.legendEnabled}
                                    <Legend
                                        definition={legendDefs[currentMacroLayerTab]}
                                        on:change={colorizeAndLegend}
                                        categorical={colorDataDefs[currentMacroLayerTab].colorScale === "category"}
                                    />
                                    <svg width="75%" height={legendDefs[currentMacroLayerTab].rectHeight + 20}>
                                        <g bind:this={legendSample}>
                                            <rect
                                                x="10"
                                                y="10"
                                                width={legendDefs[currentMacroLayerTab].rectWidth}
                                                height={legendDefs[currentMacroLayerTab].rectHeight}
                                                fill={sampleLegend.color}
                                                stroke="black"
                                                on:click={openEditor}
                                            ></rect>
                                            <text
                                                x={legendDefs[currentMacroLayerTab].rectWidth + 15}
                                                y={legendDefs[currentMacroLayerTab].rectHeight / 2 + 10}
                                                text-anchor="start"
                                                dominant-baseline="middle"
                                                on:click={openEditor}
                                                style="font-size: 12px;"
                                            >
                                                {sampleLegend.text}
                                            </text>
                                        </g>
                                    </svg>
                                    <span
                                        class="help-tooltip"
                                        data-bs-toggle="tooltip"
                                        data-bs-title="Click to update style (the legend is SVG).">?</span
                                    >
                                {/if}
                            {/if}
                            {#if currentIsColorByNumeric || currentTemplateHasNumeric}
                                <div class="mt-1 form-floating">
                                    <select
                                        class="form-select form-select-sm"
                                        id="choseFormatLocale"
                                        bind:value={tooltipDefs[currentMacroLayerTab].locale}
                                        on:change={changeNumericFormatter}
                                    >
                                        {#each Object.keys(resolvedLocales) as locale}
                                            <option value={locale}>
                                                {locale}
                                            </option>
                                        {/each}
                                    </select>
                                    <label for="choseFormatLocale">Number formatting language</label>
                                </div>
                            {/if}
                        </div>
                    </div>
                {:else if mainMenuSelection === "layers" && currentMode === "micro"}
                    <MicroLayerParams
                        layerDefinitions={microLayerDefinitions}
                        onUpdate={handleMicroParamChange}
                        availablePalettes={microPalettes}
                        onPaletteChange={handleMicroPaletteChange}
                    ></MicroLayerParams>
                {/if}
            </div>
        </div>
    </aside>
    <div class="w-auto d-flex flex-grow-1 flex-column align-items-center h-100">
        <Navbar>
            <div class="d-flex justify-content-center align-items-center">
                <span
                    class="px-2 py-1 btn btn-outline-primary"
                    role="button"
                    on:click={() => (showInstructions = true)}
                >
                    <Icon marginRight="0px" width="1.8rem" svg={icons["help"]} />
                    Instructions
                </span>
                <Examples on:example={loadExample} />
            </div>
        </Navbar>
        <div class="d-flex flex-column justify-content-center align-items-center h-100">
            {#if currentMode === "micro"}
                <div class="micro-top mb-4 mx-auto d-flex align-items-center justify-content-between">
                    <Geocoding {maplibreMap}></Geocoding>
                    <div class="d-flex mx-2 align-items-center justify-content-center">
                        <input
                            type="checkbox"
                            class="btn-check"
                            id="lock-unlock"
                            bind:checked={microLocked}
                            on:change={(e) => lockUnlock(microLocked)}
                        />
                        <label class="btn btn-outline-primary" class:active={microLocked} for="lock-unlock">
                            <Icon svg={microLocked ? icons["lock"] : icons["unlock"]} />
                            {microLocked ? "View locked" : "View unlocked"}
                        </label>
                    </div>
                </div>
            {/if}

            <div id="map-content" style="position: relative;">
                <div id="map-container" class="col mx-4"></div>
                <div id="maplibre-map"></div>
            </div>
            {#if currentMode === "micro"}
                <div class="ms-auto me-4 mt-2">
                    Map data:
                    <a href="https://www.maptiler.com/copyright/" target="_blank">&copy; MapTiler</a>
                    <a href="https://www.openstreetmap.org/copyright" target="_blank"
                        >&copy; OpenStreetMap contributors</a
                    >
                </div>
            {/if}
            <div class="mt-4 d-flex align-items-center justify-content-center">
                <div class="mx-2">
                    <label for="fontinput" class="m-2 d-flex align-items-center btn btn-outline-primary">
                        <Icon svg={icons["font"]} /> Add font</label
                    >
                    <input type="file" id="fontinput" accept=".ttf,.woff,.woff2,.otf" on:change={handleInputFont} />
                </div>
                <div class="dropdown mx-2">
                    <button
                        class="btn btn-secondary dropdown-toggle"
                        type="button"
                        data-bs-toggle="dropdown"
                        aria-expanded="false"
                    >
                        <Icon fillColor="white" svg={icons["map"]} /> Project
                    </button>
                    <ul class="dropdown-menu">
                        <li>
                            <a class="dropdown-item" href="#" on:click={resetState}>
                                <Icon svg={icons["reset"]} />Reset
                            </a>
                        </li>
                        <li>
                            <a class="dropdown-item" href="#" on:click={saveProject}>
                                <Icon fillColor="none" svg={icons["save"]} />
                                Save project
                            </a>
                        </li>
                        <li>
                            <a class="dropdown-item" href="#">
                                <label role="button" for="project-import">
                                    <Icon svg={icons["restore"]} /> Load project</label
                                >
                                <input id="project-import" type="file" accept=".cartosvg" on:change={loadProject} />
                            </a>
                        </li>
                    </ul>
                </div>
                <div class="dropdown mx-2">
                    <button class="btn btn-outline-success" type="button" on:click={onExportSvgClicked}>
                        <Icon fillColor="none" svg={icons["download"]} /> Export
                    </button>
                </div>
            </div>
        </div>
    </div>
</div>
<Modal open={showModal} onClosed={() => onModalClose()}>
    <DataTable slot="content" data={zonesData?.[currentMacroLayerTab]?.["data"]}></DataTable>
</Modal>

<Modal open={showExportConfirm} onClosed={() => (showExportConfirm = false)} modalWidth="35%">
    <div slot="header">
        <h2 class="fs-3 p-2 m-0">Export options</h2>
    </div>
    <form slot="content" bind:this={exportForm}>
        {#if inlineFontUsed}
            <h3 class="fs-4">Font export</h3>
            <div class="form-check">
                <input
                    class="form-check-input"
                    type="radio"
                    name="exportFonts"
                    value={exportFontChoices.noExport}
                    id="exportFonts1"
                />
                <label class="form-check-label" for="exportFonts1">
                    Do not export fonts
                    <span
                        class="help-tooltip"
                        data-bs-toggle="tooltip"
                        data-bs-title="If the final HTML document containing the map contains imported fonts, no need to export it as part of the SVG"
                        >?</span
                    >
                </label>
            </div>
            <div class="form-check">
                <input
                    class="form-check-input"
                    type="radio"
                    name="exportFonts"
                    value={exportFontChoices.convertToPath}
                    id="exportFonts2"
                />
                <label class="form-check-label" for="exportFonts2">
                    Convert texts with imported fonts to path
                    <span
                        class="help-tooltip"
                        data-bs-toggle="tooltip"
                        data-bs-title="Convert text to <path> elements to remove dependency on the imported font(s)"
                        >?</span
                    >
                </label>
            </div>
            <div class="form-check">
                <input
                    class="form-check-input"
                    type="radio"
                    name="exportFonts"
                    value={exportFontChoices.embedFont}
                    id="exportFonts3"
                />
                <label class="form-check-label" for="exportFonts3">
                    Embed font(s)
                    <span
                        class="help-tooltip"
                        data-bs-toggle="tooltip"
                        data-bs-title="Always embed imported font(s) (only used fonts will be exported)">?</span
                    >
                </label>
            </div>
            <div class="form-check">
                <input
                    class="form-check-input"
                    type="radio"
                    name="exportFonts"
                    id="exportFonts4"
                    value={exportFontChoices.smallest}
                    checked
                />
                <label class="form-check-label" for="exportFonts4">
                    Smallest of the 2
                    <span
                        class="help-tooltip"
                        data-bs-toggle="tooltip"
                        data-bs-title="Automatically determine the smallest file size between converting to <path> and embedding font"
                        >?</span
                    >
                </label>
            </div>
        {/if}
        {#if currentMode === "macro"}
            <h3 class="fs-4">Resize</h3>
            <div class="form-check form-switch">
                <input
                    class="form-check-input"
                    name="hideOnResize"
                    type="checkbox"
                    role="switch"
                    id="hideOnResize"
                    checked
                />
                <label class="form-check-label" for="hideOnResize">
                    Hide svg on resize
                    <span
                        class="help-tooltip"
                        data-bs-toggle="tooltip"
                        data-bs-title="On some browsers, resizing the window triggers a re-render, which can cause a slowdown. If activated, the SVG will be hidden while the window is being resized, thus reducing the computing load."
                        >?</span
                    >
                </label>
            </div>
            <h3 class="fs-4">Javascript</h3>
            <div class="form-check form-switch">
                <input class="form-check-input" name="minifyJs" type="checkbox" role="switch" id="minifyJs" checked />
                <label class="form-check-label" for="minifyJs">
                    Minify javascript
                    <span
                        class="help-tooltip"
                        data-bs-toggle="tooltip"
                        data-bs-title="Some JS is included in the SVG (for the tooltip for instance). Minifying it will make the file smaller, but more difficult to edit."
                        >?</span
                    >
                </label>
            </div>
        {/if}
    </form>
    <div slot="footer" class="d-flex justify-content-end">
        <button type="button" class="btn btn-success" data-goatcounter-click="export-svg" on:click={validateExport}>
            Export
        </button>
    </div>
</Modal>

<Modal open={showInstructions} onClosed={() => (showInstructions = false)}>
    <div slot="header">
        <h1>Instructions</h1>
    </div>
    <div slot="content">
        <Instructions></Instructions>
    </div>
</Modal>

<Modal open={showCustomPalette} onClosed={() => (showCustomPalette = false)}>
    <div slot="content">
        <PaletteEditor {customCategoricalPalette} mapping={ordinalMapping[currentMacroLayerTab]} onChange={draw}
        ></PaletteEditor>
    </div>
</Modal>

<style lang="scss" scoped>
    #params {
        flex: 1 1 400px;
        min-width: 300px;
        max-width: 550px;
        background-color: #ebf0f8;
        border-right: 1px solid #c8d4e3;
        overflow-x: hidden;
        overflow-y: auto;
    }

    #main-panel > .btn-group {
        .btn-check:checked + .btn {
            background-color: #465da3;
        }
        .btn {
            width: 100px;
        }

        &.mode-selection {
            margin-bottom: 20px;
            width: 80%;
            .btn {
                display: flex;
                align-items: center;
                justify-content: space-around;
                img {
                    border: 2px solid transparent;
                    border-radius: 3px;
                }
                &.active img {
                    border: 2px solid white;
                }
            }
        }
    }

    .micro-top {
        width: 40rem;
    }

    #country-select:hover ~ span {
        color: #aeafaf;
    }

    .data-table {
        max-height: 10rem;
        overflow-y: scroll;
    }
    .tooltip-preview {
        padding: 5px;
    }
    #map-container {
        margin: 0 auto;
        flex: 0 0 auto;
    }
    #maplibre-map {
        position: absolute;
        top: 0px;
        left: 1.5rem;
        background-color: white;
    }
    #country-select {
        opacity: 0;
        position: absolute;
        height: 38px;
        width: 4rem;
    }

    input[type="file"] {
        display: none;
    }

    :global(.is-dnd-hovering-right) {
        border-right: 3px solid black;
    }
    :global(.is-dnd-hovering-left) {
        border-left: 3px solid black;
    }
    .delete-tab {
        position: absolute;
        right: 2px;
        top: 7px;
        &:hover {
            color: #67777a;
        }
    }
    .grabbable {
        cursor: grab !important;
    }

    textarea {
        font-size: 0.82rem;
    }
</style>
