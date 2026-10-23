<script lang="ts">
    import { log } from 'src/util/log';
    import MicroLayerParams from "src/components/MicroLayerParams.svelte";
    import { cancelPendingCutout, drawPrettyMap, generateCssFromState, initLayersState } from "src/micro/drawing";
    import { type MicroParams } from "src/params";
    import { appState, commonState, microState } from "src/state.svelte";
    import {
        NON_LAYER_PALETTE_KEYS,
        type Color,
        type MicroLayerDefinition,
        type MicroLayerId,
        type MicroPalette,
        type MicroPaletteWithBorder,
        type StateMicro,
        type SvgSelection,
    } from "src/types";
    import * as _microPalettes from "../microPalettes";
    import { onMicroParamChange, replaceCssSheetContent, updateSvgPatterns } from "../change";
    import { saveState } from "src/util/save";
    import { exportStyleSheet } from "src/util/dom";
    import { resolveBunnyFontByName } from "src/util/bunnyFonts";
    import { addProtocol, Map, Point, setWorkerUrl } from "maplibre-gl";
    import type { StyleSpecification } from "@maplibre/maplibre-gl-style-spec";
    import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
    import { cancelStitch } from "src/util/geometryStitch";
    import { select, selectAll } from "d3-selection";
    import { onDestroy, onMount } from "svelte";
    import { Protocol } from "pmtiles";

    import { createD3ProjectionFromMapLibre } from "src/util/projections";
    import { geoPath } from "d3-geo";
    import { handleInlineStyleChange } from "src/svg/svg";
    import mapStyle from "./mapstyle.json";
    import { initTooltips } from "src/util/common";
    import type { SearchResult } from "src/components/Geocoding.svelte";
    import { unlockView } from "src/util/viewLock.svelte";

    // maplibre-gl v6 is ESM-only: under a bundler, import.meta.url inside the
    // package doesn't resolve to the worker file, so it must be pointed here.
    setWorkerUrl(workerUrl);

    let protocol = new Protocol();
    addProtocol("pmtiles", protocol.tile);

    const microPalettes = _microPalettes as Record<string, MicroPaletteWithBorder>;

    const LAYER_DATA_FIELDS = ["fill", "fills", "stroke", "stroke-width", "stroke-dasharray"] as const;
    const PATTERN_DATA_FIELDS = ["hatch", "color", "strokeWidth", "scale", "backgroundColor"] as const;

    function matchesPalette(current: MicroPalette, palette: Partial<MicroPaletteWithBorder>): boolean {
        const initialized = initLayersState(palette);
        const layerEntries = Object.entries(current).filter(
            ([layerId]) => !NON_LAYER_PALETTE_KEYS.has(layerId),
        ) as [MicroLayerId, MicroLayerDefinition][];
        for (const [layerId, curDef] of layerEntries) {
            const palDef = initialized[layerId as MicroLayerId];
            if (!palDef) return false;
            for (const field of LAYER_DATA_FIELDS) {
                if (JSON.stringify((curDef as any)[field]) !== JSON.stringify((palDef as any)[field])) return false;
            }
            const curPat = curDef.pattern;
            const palPat = palDef.pattern;
            if ((curPat == null) !== (palPat == null)) return false;
            if (curPat && palPat) {
                for (const field of PATTERN_DATA_FIELDS) {
                    if (curPat[field] !== palPat[field]) return false;
                }
            }
        }
        if (JSON.stringify(current.point ?? {}) !== JSON.stringify(palette.point ?? {})) return false;
        // `current.label` may carry a resolved "font-family" that `palette.label` never has directly
        // (see `labelFontName`, resolved and applied asynchronously once its Bunny font is loaded).
        const { "font-family": _currentFont, ...currentLabelRest } = current.label ?? {};
        if (JSON.stringify(currentLabelRest) !== JSON.stringify(palette.label ?? {})) return false;
        if ((current.labelFontName ?? undefined) !== (palette.labelFontName ?? undefined)) return false;
        if (JSON.stringify(current.curve ?? {}) !== JSON.stringify(palette.curve ?? {})) return false;
        if (JSON.stringify(current.freehand ?? {}) !== JSON.stringify(palette.freehand ?? {})) return false;
        if (palette.borderParams) {
            const b = microState.microParams.Border;
            const pb = palette.borderParams;
            if (
                b.borderColor !== pb.borderColor ||
                b.borderWidth !== pb.borderWidth ||
                b.borderRadius !== pb.borderRadius ||
                b.borderPadding !== pb.borderPadding
            )
                return false;
        }
        return true;
    }

    const currentPaletteId = $derived(
        Object.keys(microPalettes).find((id) => matchesPalette(microState.microLayerDefinitions, microPalettes[id])) ??
            "",
    );

    interface Props {
        svg: SvgSelection;
        draw: (simplified?: boolean) => void;
        /** Not passed, we just need to access it from the parent*/
        maplibreMap?: Map | null;
        onMapMoveStart?: () => void;
        /**
         * Bound up to App.svelte so it can disable the "Map" mode-switch button until this is
         * true. Starts false on every (re)mount; App.svelte resets it before mounting a fresh
         * instance. Becomes true once the map's first "idle" fires (or "error", or teardown —
         * see createMaplibreMap/onDestroy — so a failed load can't leave the button disabled
         * forever).
         */
        mapReady?: boolean;
    }

    let { svg, draw, maplibreMap, onMapMoveStart, mapReady = $bindable(false) }: Props = $props();

    let additionalCss = $derived(computeCss(microState.microParams));

    onMount(() => setTimeout(() => initTooltips(), 10));

    /**
     * Map used for drawing zoomed-in cities as SVG using custom palette
     * It is hidden when in "macro" mode.
     * In "micro" mode, it is either:
     *  - visible if the map is not zoomed enough
     *  - hidden if it is zoomed enough. Instead, we have the custom SVG displaying
     */
    // let maplibreMap: Map | null = $props(null);
    let mapLoadedPromise: Promise<unknown> | null = $state(null);
    // Resolver for mapLoadedPromise, kept so onDestroy can force it to settle even if the map's
    // first "idle" never fires (e.g. removed while still loading) — without this, drawMicroTotal
    // below stays suspended forever, which (absent App.svelte's try/finally) would permanently
    // wedge the isDrawing flag.
    let mapLoadedResolve: (() => void) | null = null;
    let styleSheetElem: HTMLStyleElement;
    export async function drawMicroTotal() {
        if (!maplibreMap) return;
        await mapLoadedPromise;
        const translateAmount =
            microState.microParams.Border.borderPadding + microState.microParams.Border.borderWidth / 2;
        appState.projection = createD3ProjectionFromMapLibre(maplibreMap, translateAmount);
        appState.path = geoPath(appState.projection);
        return drawPrettyMap(maplibreMap, svg, appState.path, microState.microLayerDefinitions, microState.microParams);
    }

    export function queryFeaturesAt(e: MouseEvent): void {
        if (!maplibreMap) return;
        const rect = maplibreMap.getContainer().getBoundingClientRect();
        const point = new Point(e.clientX - rect.left, e.clientY - rect.top);
        log(maplibreMap.queryRenderedFeatures(point));
    }

    export function onStyleChanged(
        target: HTMLElement,
        eventType: "inline" | CSSStyleRule,
        cssProp: string,
        value: string,
    ): void {
        const elemId = target.getAttribute("id")!;
        if (eventType === "inline" && target.hasAttribute("id")) {
            handleInlineStyleChange(elemId, target, cssProp, value);
        }
        saveState();
    }

    export function applyLayerStyles(): void {
        if (microState.baseCss) {
            // Restore persisted stylesheet (preserves common class changes like .text, .shape),
            // then update micro-layer rules in-place from state.
            styleSheetElem.innerHTML = microState.baseCss;
            generateCssFromState(microState.microLayerDefinitions);
        } else {
            styleSheetElem.innerHTML = '';
            const microCss = generateCssFromState(microState.microLayerDefinitions);
            if (microCss != null) styleSheetElem.innerHTML = microCss;
        }
        microState.baseCss = exportStyleSheet("#micro .line") ?? '';
    }

    export function applyMapPosition(): void {
        log(microState.inlinePropsMicro.center);
        maplibreMap?.jumpTo({
            center: microState.inlinePropsMicro.center,
            zoom: microState.inlinePropsMicro.zoom,
            pitch: microState.inlinePropsMicro.pitch,
            bearing: microState.inlinePropsMicro.bearing,
        });
    }

    export function onPlaceSelected(result: SearchResult): void {
        // Searching for a place is a deliberate re-framing of the map, not an accidental nudge.
        unlockView();
        maplibreMap!.jumpTo({
            center: [parseFloat(result.lon), parseFloat(result.lat)],
            zoom: 14,
            bearing: 0,
            pitch: 0,
        });
    }

    onMount(() => {
        styleSheetElem = document.createElement("style");
        styleSheetElem.setAttribute("id", "style-sheet-micro");
        document.head.appendChild(styleSheetElem);
        if (microState.baseCss) {
            styleSheetElem.innerHTML = microState.baseCss;
            generateCssFromState(microState.microLayerDefinitions);
        } else {
            const microCss = generateCssFromState(microState.microLayerDefinitions);
            if (microCss != null) styleSheetElem.innerHTML = microCss;
        }
        // else console.error("Problem: the generated style sheet is null");

        createMaplibreMap();
    });

    function createMaplibreMap() {
        log("createMaplibreMap!!!", maplibreMap);
        if (!select(".maplibregl-canvas-container").empty()) return;
        maplibreMap = new Map({
            container: "maplibre-map",
            style: mapStyle as StyleSpecification,
            center: microState.inlinePropsMicro.center,
            zoom: microState.inlinePropsMicro.zoom,
            pitch: microState.inlinePropsMicro.pitch,
            bearing: microState.inlinePropsMicro.bearing,
            attributionControl: false,
            // maplibre-gl v6 defaults to slicing vector tiles above the source's max
            // zoom instead of overscaling the deepest tile. Our own tile-stitching
            // logic (src/util/geometryStitch.ts) assumes the v5 overscaling behavior
            // (it reconstructs a fixed tile grid capped at MAX_ZOOM=15); tile slicing
            // breaks that assumption and drops line features (roads, paths, railways)
            // entirely at typical detailed-view zoom levels. Restore v5 behavior.
            zoomLevelsToOverscale: undefined,
        });
        const translateAmount =
            microState.microParams.Border.borderPadding + microState.microParams.Border.borderWidth / 2;
        appState.projection = createD3ProjectionFromMapLibre(maplibreMap!, translateAmount);
        appState.path = geoPath(appState.projection);
        // maplibreMap.showTileBoundaries = true;
        maplibreMap.on("moveend", async () => {
            const center = maplibreMap!.getCenter().toArray();
            if (center[0] !== 0 && center[1] !== 0) {
                microState.inlinePropsMicro = {
                    center,
                    zoom: maplibreMap!.getZoom(),
                    pitch: maplibreMap!.getPitch(),
                    bearing: maplibreMap!.getBearing(),
                };
            }
            await maplibreMap!.once("idle");
            draw();
        });

        maplibreMap.on("movestart", () => {
            onMapMoveStart?.();
            cancelStitch();
            cancelPendingCutout();
            select("#maplibre-map").style("opacity", 1);
            selectAll("#static-svg-map g, #static-svg-map rect").remove();
        });

        mapLoadedPromise = new Promise<void>((resolve) => {
            mapLoadedResolve = () => {
                resolve();
                mapReady = true;
            };
            maplibreMap!.once("idle", () => mapLoadedResolve!());
            // A style/tile load failure must not leave drawMicroTotal parked forever, nor the
            // mode-switch button (gated on mapReady) disabled forever.
            maplibreMap!.once("error", () => mapLoadedResolve!());
        });
        return mapLoadedPromise;
    }

    onDestroy(() => {
        // Force mapLoadedPromise to settle even though the map's first "idle" may never fire
        // now that we're about to remove() it — otherwise anything still awaiting it
        // (drawMicroTotal) stays suspended forever.
        mapLoadedResolve?.();
        mapLoadedResolve = null;
        styleSheetElem.remove();
        maplibreMap?.remove();
    });

    function computeCss(microParams: MicroParams): string {
        return "";
    }

    function handleMicroParamChange(
        layer: MicroLayerId,
        prop: string | string[],
        value: number | Color | string | boolean,
    ) {
        const shouldRedraw = onMicroParamChange(layer, prop, value, microState.microLayerDefinitions);
        if (shouldRedraw) draw();
        saveState();
    }

    async function handleMicroPaletteChange(paletteId: string) {
        const palette = microPalettes[paletteId];
        if (palette.borderParams) {
            microState.microParams["Border"] = {
                ...microState.microParams["Border"],
                ...palette.borderParams,
            };
        }
        microState.microLayerDefinitions = initLayersState(palette);
        updateSvgPatterns(
            document.getElementById("static-svg-map") as unknown as SVGElement,
            microState.microLayerDefinitions,
        );
        replaceCssSheetContent(microState.microLayerDefinitions);
        draw();
        saveState();

        // Bunny fonts aren't natively available: load the palette's preset label font (if any)
        // asynchronously, same mechanism as manually picking one via FontPicker.
        if (palette.labelFontName) {
            const font = await resolveBunnyFontByName(palette.labelFontName);
            if (!font || microState.microLayerDefinitions.labelFontName !== palette.labelFontName) return;
            if (!commonState.providedFonts.some((f) => f.slug === font.slug && f.weight === font.weight && f.style === font.style)) {
                commonState.providedFonts.push(font);
            }
            microState.microLayerDefinitions.label = { ...(microState.microLayerDefinitions.label ?? {}), "font-family": font.name };
            replaceCssSheetContent(microState.microLayerDefinitions);
            draw();
            saveState();
        }
    }
</script>

<svelte:head>
    {@html `<${""}style> ${additionalCss} </${""}style>`}
</svelte:head>

<MicroLayerParams
    bind:layerDefinitions={microState.microLayerDefinitions}
    onUpdate={handleMicroParamChange}
    availablePalettes={microPalettes}
    onPaletteChange={handleMicroPaletteChange}
    {currentPaletteId}
></MicroLayerParams>

<style lang="scss">
</style>
