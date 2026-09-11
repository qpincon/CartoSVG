<script lang="ts">
    import { onDestroy, onMount, tick } from "svelte";
    import { log } from '../../util/log';
        import {
        extractTemplateVariables,
        getColumns,
        getNumericCols,
        htmlToElement,
        initTooltips,
    } from "../../util/common";
    import { exportStyleSheet, reportStyle } from "../../util/dom";
        import { appState, commonState, macroState } from "../../state.svelte";
    import Icon from "../../components/Icon.svelte";
    import { icons } from "../../shared/icons";
    import { track } from "../../util/analytics";
    import { allAvailableAdm, geometriesState, initWorldData, resolvedAdmGeometry, updateLayerSimplification } from "../geometry-data";
    import RangeInput from "src/components/RangeInput.svelte";
    import ColorPickerPreview from "src/components/ColorPickerPreview.svelte";
    import type {
        Color,
        ColorDef,
        ColorScale,
        LegendColor,
        MacroPalette,
        OrdinalMapping,
        SvgGSelection,
        SvgSelection,
        ZoneData,
        ZoneDataRow,
    } from "src/types";
    import Svelecte from "svelecte";
    import { color as d3Color } from "d3-color";
    import { formatLocale } from "d3-format";
    import { paramDefs, type RangeDefinition } from "../../params";

    const glowRange = (key: string) => paramDefs[key] as RangeDefinition;

    import { saveState } from "src/util/save";
    import DataManager from "./DataManager.svelte";
    import Legend from "src/components/Legend.svelte";
    import { select } from "d3-selection";
    import { scaleOrdinal, scaleQuantize, scaleQuantile } from "d3-scale";

    import {
        CATEGORICAL_SCHEMES,
        CONTINUOUS_SCHEMES,
        type AnyScaleKey,
        type CategoricalScaleKey,
        type ContinuousScaleKey,
    } from "src/util/color-scales";
    import { drawLegend } from "src/svg/legend";
    import { debounce } from "lodash-es";
    import { extent, quantize } from "d3";
    import { interpolateRgbBasis } from "d3-interpolate";

    import dataExplanation from "../../assets/dataColor.svg";
    import { applyInlineStyles, drawMacroBase, handleChangeProp, projectAndDraw, visibleOrderedTabs } from "../drawing";
    import { appendCountryImageNew } from "src/svg/contourMethods";
    import { glowFilterId } from "src/svg/svgDefs";
    import { defaultGlowParams } from "src/stateDefaults";
    import { dragged, updateVisibleAreaScale, zoomed } from "../interactions";
    import Modal from "src/components/Modal.svelte";
    import PaletteEditor from "src/components/PaletteEditor.svelte";
    import MacroPalettePicker from "src/components/MacroPalettePicker.svelte";
    import * as _macroPalettes from "../macroPalettes";
    import { applyMacroPalette, findMatchingPaletteId } from "../macroPalettes";
    import QuillEditor from "src/components/QuillEditor.svelte";
    import { getLocaleDisplayName, resolvedLocales, updateZonesDataFormatters } from "../formatting";
    import { handleInlineStyleChange } from "src/svg/svg";

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

    let currentMacroLayerTab = $state<string>("land");
    let currentTemplateHasNumeric = $state<boolean>(false);
    let showDataManager = $state<boolean>(false);
    let templateErrorMessages = $state<Record<string, string | null>>({});
    let commonCss = $state<string | undefined>();
    let availableColumns = $state<string[]>([]);
    let availablePalettes = $state<string[]>([]);
    let showCustomPalette = $state<boolean>(false);
    let legendSample: SVGGElement | null = $state(null);
    let tooltipMenuOpenedByTab = $state<Record<string, boolean>>({});
    let colorDataMenuOpenedByTab = $state<Record<string, boolean>>({});
    let glowMenuOpenedByTab = $state<Record<string, boolean>>({});
    let commonStyleSheetElem: HTMLStyleElement;

    const macroColorPalettes = Object.fromEntries(
        Object.entries(_macroPalettes).filter(([, value]) => typeof value === "object"),
    ) as Record<string, MacroPalette>;
    let currentMacroPaletteId = $derived(findMatchingPaletteId(macroColorPalettes));

    function handleMacroPaletteChange(paletteId: string) {
        applyMacroPalette(macroColorPalettes[paletteId]);
        draw();
        saveState();
    }

    let computedOrderedTabs = $derived(visibleOrderedTabs(macroState.orderedTabs));
    function setLandPlacement(onTop: boolean): void {
        macroState.inlinePropsMacro.landOnTop = onTop;
        drawMacroTotal();
    }

    let curDataDefs = $derived(macroState.colorDataDefs[currentMacroLayerTab]);
    let currentIsColorByNumeric = $derived(["quantile", "quantize"].includes(curDataDefs?.colorScale));
    let availableColorTypes = $derived(
        macroState.zonesData[currentMacroLayerTab]?.numericCols?.length
            ? ["category", "quantile", "quantize"]
            : ["category"],
    );

    interface Props {
        openPropertiesPanel: (el: Element) => void;
        svg: SvgSelection;
        draw: (simplified?: boolean) => void;
    }

    let { openPropertiesPanel, svg, draw }: Props = $props();

    let drawDebounced = debounce((simplified?: boolean) => draw(simplified), 100);
    onMount(() => {
        log("macro onmount");
        commonStyleSheetElem = document.createElement("style");
        commonStyleSheetElem.setAttribute("id", "style-sheet-macro");
        document.head.appendChild(commonStyleSheetElem);
        commonStyleSheetElem.innerHTML = macroState.baseCss;
        initWorldData().then(() => {
            updateVisibleAreaScale();
            draw();
            setTimeout(() => { initTooltips(); applyStylesToLegend(); }, 200);
        });
    });

    onDestroy(() => {
        commonStyleSheetElem.remove();
    });

    export function resetTabSelection(): void {
        currentMacroLayerTab = "land";
    }

    export function applyStateAndDraw(simplified = false) {
        for (const key of Object.keys(colorsCssByTab)) delete colorsCssByTab[key];
        for (const key of Object.keys(displayedLegend)) delete displayedLegend[key];
        currentMacroLayerTab = macroState.orderedTabs[0] ?? "land";
        commonStyleSheetElem.innerHTML = macroState.baseCss;
        projectAndDraw(svg, simplified);
    }

    export function onZoom(e: d3.D3ZoomEvent<SVGSVGElement, unknown>) {
        if (e.sourceEvent.type === "dblclick") return;
        zoomed(e);
        handleChangeProp("altitude", drawSimplifyThenReal);
    }

    export function onDrag(e: d3.D3DragEvent<SVGSVGElement, unknown, unknown>) {
        dragged(e);
        handleChangeProp("longitude", drawSimplifyThenReal);
    }

    export async function drawMacroTotal(simplified = false) {
        commonStyleSheetElem.innerHTML = macroState.baseCss;
        await drawMacroBase(svg, simplified);
        colorizeAndLegend(svg);
    }

    export function onStyleChanged(
        target: HTMLElement,
        eventType: "inline" | CSSStyleRule,
        cssProp: string,
        value: string,
    ): void {
        const elemId = target.getAttribute("id")!;
        const eventAsRule = eventType as CSSStyleRule;
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
        if (legendSample && legendSample.contains(target)) {
            /** Do nothing on legend fill rectangle as it would make the legend useless */
            if (cssProp === "fill" && target.tagName === "rect") {
                target.style.removeProperty("fill");
                return;
            }
            // Strip fill from rect inline style before capturing outerHTML to prevent
            // overwriting individual legend entry colors
            const rect = legendSample.querySelector("rect");
            const savedRectFill = rect?.style.getPropertyValue("fill");
            if (rect) rect.style.removeProperty("fill");
            macroState.legendDefs[currentMacroLayerTab].sampleHtml = legendSample.outerHTML;
            if (rect && savedRectFill) rect.style.setProperty("fill", savedRectFill);
            colorizeAndLegend(svg);
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
                const filter = macroState.zonesGlow[tab]?.enabled ? glowFilterId(tab) : null;
                const countryData = geometriesState.countries.features.find(
                    (country) => country.properties?.name === elemId,
                )!;
                appendCountryImageNew.call(
                    select(`[id='${elemId}-img']`).node() as SVGImageElement,
                    countryData,
                    filter,
                    appState.path!,
                    commonState.inlineStyles,
                    macroState.macroParams.General.width,
                    macroState.macroParams.General.height,
                );
            });
        }
        macroState.baseCss = exportStyleSheet("#outline")!;
        saveState();
    }

    let drawTimeoutId: number;
    function drawSimplifyThenReal(): void {
        draw(true);
        clearTimeout(drawTimeoutId);
        drawTimeoutId = window.setTimeout(async () => {
            await updateLayerSimplification();
            draw(false);
        }, 500);
    }

    const saveDebounced = debounce(saveState, 200);

    function handleLayerToggle(): void {
        const newTabs = visibleOrderedTabs(macroState.orderedTabs);
        if (currentMacroLayerTab && newTabs.length > 0 && !newTabs.includes(currentMacroLayerTab)) {
            onTabChanged(newTabs[0]);
        }
        drawMacroTotal();
    }

    function toggleLayerRow(tabTitle: string): void {
        if (currentMacroLayerTab === tabTitle) {
            currentMacroLayerTab = "";
            return;
        }
        onTabChanged(tabTitle);
    }

    function handleShowRoadsToggle(): void {
        drawMacroTotal();
    }

    function handleShowWaterToggle(): void {
        drawMacroTotal();
    }

    function openEditor(e: MouseEvent): void {
        openPropertiesPanel(e.target as Element);
    }

    function applyStylesToLegend(): void {
        if (legendSample && macroState.colorDataDefs[currentMacroLayerTab]?.legendEnabled) {
            const sampleHtml = macroState.legendDefs[currentMacroLayerTab]?.sampleHtml;
            if (sampleHtml) {
                const tmpElem = htmlToElement(sampleHtml)!;
                reportStyle(tmpElem, legendSample);
            }
        }
    }

    async function onTabChanged(newTabTitle: string): Promise<void> {
        currentMacroLayerTab = newTabTitle;
        currentTemplateHasNumeric = templateHasNumeric(currentMacroLayerTab) === true;
        await tick();
        initTooltips();
        applyStylesToLegend();
        autoSelectColors();
    }

    function templateHasNumeric(layerName: string): boolean {
        const toFind = macroState.zonesData[layerName]?.numericCols.map((colDef) => `__${colDef.column}__`);
        const template = macroState.tooltipDefs[layerName]?.template;
        return toFind?.some((str) => template.includes(str));
    }

    function deleteCountry(country: string, drawAfter = true, event?: MouseEvent): void {
        if (event) event.stopPropagation();
        macroState.chosenCountriesAdm = macroState.chosenCountriesAdm.filter((x) => x !== country);
        macroState.orderedTabs = macroState.orderedTabs.filter((x) => x !== country);
        currentMacroLayerTab = macroState.orderedTabs[0];
        delete macroState.tooltipDefs[country];
        delete macroState.legendDefs[country];
        delete macroState.colorDataDefs[country];
        delete macroState.zonesData[country];
        delete macroState.zonesGlow[country];
        if (drawAfter) draw();
    }

    async function addNewCountry(newLayerName: string): Promise<void> {
        if (macroState.chosenCountriesAdm.includes(newLayerName)) return;
        track('layer_add', { kind: newLayerName.includes('ADM2') ? 'adm2' : 'adm1' });
        let searchedAdm;
        if (newLayerName.slice(-1) === "1") searchedAdm = newLayerName.replace("ADM1", "ADM2");
        else searchedAdm = newLayerName.replace("ADM2", "ADM1");
        const existingIndex = macroState.chosenCountriesAdm.indexOf(searchedAdm);
        if (existingIndex > -1) {
            deleteCountry(searchedAdm, false);
        }
        macroState.chosenCountriesAdm.push(newLayerName);
        macroState.orderedTabs.push(newLayerName);
        await onTabChanged(newLayerName);
        draw();
    }

    let countrySelectValue: string | null = $state(null);
    $effect(() => {
        if (countrySelectValue) {
            const newLayerName = countrySelectValue;
            countrySelectValue = null;
            addNewCountry(newLayerName);
        }
    });

    // Svelecte's virtual list keeps its previous scroll offset when the filtered
    // option count shrinks, which can leave the dropdown looking empty until the
    // user scrolls back up. Snap it to the top whenever the search text changes.
    let countrySelectWrapper: HTMLDivElement;
    function resetCountryDropdownScroll(e: Event): void {
        if (!(e.target as HTMLElement).matches(".sv-input--text")) return;
        // With virtualList, the actual scrollable node is the <svelecte-list-viewport>
        // custom element rendered inside .sv-dropdown-scroll, not .sv-dropdown-scroll itself.
        // querySelector with a comma-list returns document order, so .sv-dropdown-scroll
        // (the ancestor) would win over it — query them separately instead.
        const scrollEl = (countrySelectWrapper.querySelector("svelecte-list-viewport") ??
            countrySelectWrapper.querySelector(".sv-dropdown-scroll")) as HTMLElement | null;
        if (scrollEl) scrollEl.scrollTop = 0;
    }
    onMount(() => {
        countrySelectWrapper.addEventListener("input", resetCountryDropdownScroll);
        return () => countrySelectWrapper.removeEventListener("input", resetCountryDropdownScroll);
    });

    function getGeoNames(layerTab: string): string[] {
        if (layerTab === "countries") {
            return geometriesState.countries.features.map((f) => f.properties?.name).filter((n): n is string => !!n);
        }
        if (resolvedAdmGeometry[layerTab]) {
            return resolvedAdmGeometry[layerTab].features
                .map((f: any) => f.properties?.name)
                .filter((n: any): n is string => !!n);
        }
        return macroState.zonesData[layerTab]?.data.map((r) => r.name) ?? [];
    }

    function handleDataManagerSave(newData: ZoneDataRow[]): void {
        macroState.zonesData[currentMacroLayerTab] = {
            data: newData,
            provided: true,
            numericCols: getNumericCols(newData),
        };
        updateZonesDataFormatters();
        autoSelectColors();
        saveState();
    }

    function changeNumericFormatter(): void {
        updateZonesDataFormatters();
        colorizeAndLegend(svg);
    }



    function onTemplateChange(): void {
        const template = macroState.tooltipDefs[currentMacroLayerTab].template;
        const variables = extractTemplateVariables(template);
        const zoneData = macroState.zonesData[currentMacroLayerTab];

        if (zoneData?.data?.length > 0) {
            const availableCols = Object.keys(zoneData.data[0]);
            const missingVars = variables.filter((v) => !availableCols.includes(v));

            if (missingVars.length > 0) {
                templateErrorMessages[currentMacroLayerTab] = `Unknown variable(s): ${missingVars.join(", ")}`;
            } else {
                currentTemplateHasNumeric = templateHasNumeric(currentMacroLayerTab);
                templateErrorMessages[currentMacroLayerTab] = null;
            }
        } else {
            currentTemplateHasNumeric = templateHasNumeric(currentMacroLayerTab);
            templateErrorMessages[currentMacroLayerTab] = null;
        }
        saveState();
    }

    const colorsCssByTab: Record<string, string> = {};
    const displayedLegend: Record<string, SvgGSelection> = {};
    const ordinalMapping: OrdinalMapping = $state({});
    let hasNoDataForTab: Record<string, boolean> = $state({});
    let sampleLegend = $state({
        color: "black",
        text: "test",
    });

    export function computeCss(): string {
        const finalColorsCss = Object.values(colorsCssByTab).reduce((acc, cur) => {
            acc += cur;
            return acc;
        }, "");
        let borderCss = "";
        commonCss = finalColorsCss + borderCss;
        // const style = exportStyleSheet("#outline");
        return macroState.baseCss + commonCss;
    }

    function autoSelectColors() {
        log("autoSelectColors");
        if (!macroState.zonesData[currentMacroLayerTab]) return;
        if (curDataDefs.colorScale === null) {
            if (curDataDefs.colorColumn !== null) {
                if (
                    macroState.zonesData[currentMacroLayerTab].numericCols.find(
                        (x) => x.column === curDataDefs.colorColumn,
                    )
                ) {
                    curDataDefs.colorScale = "quantile";
                } else curDataDefs.colorScale = "category";
            } else curDataDefs.colorScale = "category";
        }
        availableColumns =
            curDataDefs.colorScale === "category"
                ? getColumns(macroState.zonesData[currentMacroLayerTab].data)
                : macroState.zonesData?.[currentMacroLayerTab]?.numericCols.map((x) => x.column);
        availablePalettes = [
            "Custom",
            ...(curDataDefs.colorScale === "category"
                ? Object.keys(CATEGORICAL_SCHEMES)
                : Object.keys(CONTINUOUS_SCHEMES)),
        ];
        if (!availableColumns.includes(curDataDefs.colorColumn)) {
            curDataDefs.colorColumn = availableColumns[0];
        }
        if (!availablePalettes.includes(curDataDefs.colorPalette!))
            curDataDefs.colorPalette = availablePalettes[0] as AnyScaleKey;
        if (svg) colorizeAndLegend(svg);
    }

    function isZoneVisible(tab: string, zoneName: string): boolean {
        const elem = document.querySelector(`g[id="${tab}"] [id="${zoneName}"]`) as SVGPathElement | null;
        if (!elem) return false;
        const d = elem.getAttribute("d");
        if (!d) return false;
        try {
            const bbox = elem.getBBox();
            if (bbox.width === 0 && bbox.height === 0) return false;
            const svgWidth = macroState.macroParams.General.width;
            const svgHeight = macroState.macroParams.General.height;
            return bbox.x + bbox.width > 0 && bbox.y + bbox.height > 0 && bbox.x < svgWidth && bbox.y < svgHeight;
        } catch {
            return false;
        }
    }

    async function colorizeAndLegend(svg: SvgSelection): Promise<void> {
        log("colorizeAndLegend");
        await tick();
        initTooltips();
        let legendSelection: SvgGSelection = select("#svg-map-legend")! as unknown as SvgGSelection;
        if (legendSelection.empty()) {
            legendSelection = svg.append("g").attr("id", "svg-map-legend") as SvgGSelection;
        } else {
            legendSelection.selectAll("*").remove(); // Clear existing contents
        }
        // Keep legend on top: drawMacroBase() re-anchors layer groups after it on every redraw.
        legendSelection.raise();
        Object.entries(macroState.colorDataDefs).forEach(([tab, dataColorDef], tabIndex) => {
            if (!macroState.zonesData[tab]) return;
            if (!dataColorDef.noDataColor) dataColorDef.noDataColor = { enabled: false, color: "#AAAAAA" };
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
                macroState.zonesData[tab].data.forEach((row) => {
                    const key = row.name;
                    const elem = document.querySelector(`g[id="${tab}"] [id="${key}"]`);
                    if (!elem) return;
                    [...elem.classList].forEach((cls) => {
                        if (cls.includes("ssc")) elem.classList.remove(cls);
                    });
                });
                return;
            }
            const paletteName = dataColorDef.colorPalette;
            // build set of visible zone names for this tab
            const visibleZoneNames = new Set<string>();
            macroState.zonesData[tab].data.forEach((row) => {
                if (isZoneVisible(tab, row.name)) visibleZoneNames.add(row.name);
            });
            // collect data from visible zones only (with allData fallback)
            let tabHasNoData = false;
            const allData: (string | number)[] = [];
            const visibleData: (string | number)[] = [];
            macroState.zonesData[tab].data.forEach((row) => {
                const d = row[dataColorDef.colorColumn];
                if (d === null || d === undefined || d === "") {
                    tabHasNoData = true;
                    return;
                }
                allData.push(d);
                if (visibleZoneNames.has(row.name)) visibleData.push(d);
            });
            const data = visibleData.length > 0 ? visibleData : allData;
            hasNoDataForTab[tab] = tabHasNoData;
            let scale: ColorScale;
            if (dataColorDef.colorScale === "category") {
                if (dataColorDef.colorPalette === "Custom") {
                    ordinalMapping[tab] = {};
                    scale = scaleOrdinal(macroState.customCategoricalPalette);
                } else scale = scaleOrdinal(CATEGORICAL_SCHEMES[paletteName as CategoricalScaleKey]);
            } else if (dataColorDef.colorScale === "quantile") {
                const range =
                    dataColorDef.colorPalette === "Custom"
                        ? quantize(interpolateRgbBasis(macroState.customContinuousPalette), dataColorDef.nbBreaks)
                        : CONTINUOUS_SCHEMES[paletteName as ContinuousScaleKey][dataColorDef.nbBreaks];
                scale = scaleQuantile<string, number>()
                    .domain(data as number[])
                    .range(range);
            } else if (dataColorDef.colorScale === "quantize") {
                const range =
                    dataColorDef.colorPalette === "Custom"
                        ? quantize(interpolateRgbBasis(macroState.customContinuousPalette), dataColorDef.nbBreaks)
                        : CONTINUOUS_SCHEMES[paletteName as ContinuousScaleKey][dataColorDef.nbBreaks];
                const dataExtent = extent(data as number[]) as [number, number];
                scale = scaleQuantize<string, number>().domain(dataExtent).range(range);
            }
            const usedColors: Color[] = [];
            macroState.zonesData[tab].data.forEach((row) => {
                const d = row[dataColorDef.colorColumn];
                const key = row.name;
                const elem = document.querySelector(`g[id="${tab}"] [id="${key}"]`);
                if (!elem) return;
                let color: Color;
                if (d === null || d === undefined || d === "") {
                    if (!dataColorDef.noDataColor.enabled) return;
                    color = dataColorDef.noDataColor.color;
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
                newCss += `path.ssc-${tabIndex}-${i}{fill:${color};}path.ssc-${tabIndex}-${i}.hovered{fill:${d3Color(color)!.brighter(0.2).hex()};}`;
            });
            colorsCssByTab[tab] = newCss;
            const legendColors = getLegendColors(dataColorDef, tab, scale!, data);
            if (!legendColors) return;
            if (tab === currentMacroLayerTab)
                sampleLegend = {
                    color: legendColors[0][0],
                    text: legendColors[0][1],
                };
            const sampleElem = htmlToElement<SVGGElement>(macroState.legendDefs[tab].sampleHtml!)!;
            displayedLegend[tab] = drawLegend(
                legendSelection,
                macroState.legendDefs[tab],
                legendColors,
                dataColorDef.colorScale === "category",
                sampleElem,
                tab,
                saveDebounced,
                tabHasNoData ? dataColorDef.noDataColor : undefined,
            );
        });
        computeCss();
        applyInlineStyles();
        applyStylesToLegend();
    }

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
        if (legendSample && macroState.legendDefs[tab].sampleHtml == null) {
            macroState.legendDefs[tab].sampleHtml = legendSample.outerHTML;
        }
        let threshValues: number[];
        let formatter = (x: number | string) => x;
        if (dataColorDef.colorScale === "category") {
            threshValues = [...new Set(data as number[])];
        } else {
            // @ts-expect-error
            formatter = formatLocale(resolvedLocales[macroState.tooltipDefs[tab].locale]).format(
                `,.${macroState.legendDefs[tab].significantDigits}r`,
            );
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
        if (macroState.legendDefs[tab].direction === "v") return legendColors.reverse();
        return legendColors;
    }
</script>

<svelte:head>
    {@html `<${""}style> ${commonCss} </${""}style>`}
</svelte:head>

<div class="border border-primary rounded layers">
            <MacroPalettePicker
                palettes={macroColorPalettes}
                currentPaletteId={currentMacroPaletteId}
                onPaletteChange={handleMacroPaletteChange}
            ></MacroPalettePicker>
            <div class="p-2">
                <div class="form-check form-switch">
                    <input
                        class="form-check-input"
                        type="checkbox"
                        role="switch"
                        id="showLand"
                        bind:checked={macroState.inlinePropsMacro.showLand}
                        onchange={handleLayerToggle}
                    />
                    <label class="form-check-label" for="showLand"
                        data-bs-toggle="tooltip"
                        data-bs-trigger="hover"
                        data-bs-placement="right"
                        title="Display a filled land layer underneath country borders. Useful as a base colour for the map."
                    > Show land</label>
                </div>
                <div class="form-check form-switch">
                    <input
                        class="form-check-input"
                        type="checkbox"
                        role="switch"
                        id="showCountries"
                        bind:checked={macroState.inlinePropsMacro.showCountries}
                        onchange={handleLayerToggle}
                    />
                    <label class="form-check-label" for="showCountries"
                        data-bs-toggle="tooltip"
                        data-bs-trigger="hover"
                        data-bs-placement="right"
                        title="Display individual country shapes. Required for choropleth colouring and country-level data."
                    > Show countries</label>
                </div>
                <hr class="my-2" style="opacity: 0.1;" />
                <div class="d-flex flex-wrap align-items-center">
                    <div class="form-check form-switch layer-toggle-label">
                        <input
                            class="form-check-input"
                            type="checkbox"
                            role="switch"
                            id="showWater"
                            bind:checked={macroState.inlinePropsMacro.showWater}
                            onchange={handleShowWaterToggle}
                        />
                        <label class="form-check-label" for="showWater"
                            data-bs-toggle="tooltip"
                            data-bs-trigger="hover"
                            data-bs-placement="right"
                            title="Display lakes and rivers, fetched from vector tile data."
                        > Show water elements</label>
                    </div>
                    {#if macroState.inlinePropsMacro.showWater}
                        <ColorPickerPreview
                            labelAbove
                            additionalClasses="ms-3"
                            id="watercolorpicker"
                            popup="right"
                            title=""
                            value={macroState.macroParams.Background.waterColor}
                            onChange={(col) => {
                                macroState.macroParams.Background.waterColor = col;
                                drawDebounced();
                            }}
                        ></ColorPickerPreview>
                    {/if}
                </div>
                <div class="d-flex flex-wrap align-items-center">
                    <div class="form-check form-switch layer-toggle-label">
                        <input
                            class="form-check-input"
                            type="checkbox"
                            role="switch"
                            id="showRoads"
                            bind:checked={macroState.inlinePropsMacro.showRoads}
                            onchange={handleShowRoadsToggle}
                        />
                        <label class="form-check-label" for="showRoads"
                            data-bs-toggle="tooltip"
                            data-bs-trigger="hover"
                            data-bs-placement="right"
                            title="Display the major road network, fetched from vector tile data."
                        > Show roads</label>
                    </div>
                    {#if macroState.inlinePropsMacro.showRoads}
                        <ColorPickerPreview
                            labelAbove
                            additionalClasses="ms-3"
                            id="roadcolorpicker"
                            popup="right"
                            title=""
                            value={macroState.macroParams.Background.roadColor}
                            onChange={(col) => {
                                macroState.macroParams.Background.roadColor = col;
                                drawDebounced();
                            }}
                        ></ColorPickerPreview>
                    {/if}
                </div>
            </div>

            <div class="layer-item-add d-flex align-items-center p-1" bind:this={countrySelectWrapper}>
                <Svelecte
                    class="country-select-svelecte"
                    options={allAvailableAdm}
                    bind:value={countrySelectValue}
                    placeholder="Add regions"
                    virtualList
                >
                    {#snippet prepend()}
                        <Icon fillColor="none" svg={icons["add"]} />
                    {/snippet}
                </Svelecte>
            </div>

            <div class="layers-list m-1">
                {#each computedOrderedTabs as tabTitle (tabTitle)}
                    {@const isLand = tabTitle === "land"}
                    {@const isActive = currentMacroLayerTab === tabTitle}
                    <div class="layer-item" class:active={isActive}>
                        <div
                            class="layer-item-header d-flex align-items-center"
                            role="button"
                            tabindex="0"
                            onclick={() => toggleLayerRow(tabTitle)}
                            onkeydown={(e) => { if (e.key === "Enter" || e.key === " ") toggleLayerRow(tabTitle); }}
                        >
                            <div class="toggle layer-item-chevron" class:opened={isActive}></div>
                            <span class="layer-item-title flex-grow-1">{tabTitle}</span>
                            {#if tabTitle !== "countries" && !isLand}
                                <span
                                    role="button"
                                    class="delete-tab"
                                    title="Delete this layer"
                                    onclick={(e) => deleteCountry(tabTitle, true, e)}
                                >
                                    <Icon svg={icons["trash"]} width="0.95rem" marginRight="0" />
                                </span>
                            {/if}
                        </div>
                        {#if isActive}
                        <div class="layer-item-body p-2">
                {#if currentMacroLayerTab === "land"}
                    <div>
                        <div class="field field-column">
                            <label class="form-label mb-1">Land placement</label>
                            <div class="form-check">
                                <input
                                    class="form-check-input"
                                    type="radio"
                                    name="landPlacement"
                                    id="landBelow"
                                    checked={!macroState.inlinePropsMacro.landOnTop}
                                    onclick={() => setLandPlacement(false)}
                                />
                                <label class="form-check-label" for="landBelow">Below other layers</label>
                            </div>
                            <div class="form-check">
                                <input
                                    class="form-check-input"
                                    type="radio"
                                    name="landPlacement"
                                    id="landAbove"
                                    checked={macroState.inlinePropsMacro.landOnTop}
                                    onclick={() => setLandPlacement(true)}
                                />
                                <label class="form-check-label" for="landAbove">Above other layers</label>
                            </div>
                        </div>
                        <div class="field">
                            <RangeInput
                                id="contourwidth"
                                title="Contour width"
                                onChange={() => drawDebounced()}
                                bind:value={macroState.contourParams.strokeWidth}
                                min={0}
                                max={3}
                                step={0.2}
                            ></RangeInput>
                        </div>
                        <div class="field">
                            <ColorPickerPreview
                                id="contourpicker"
                                popup="right"
                                title="Contour color"
                                value={macroState.contourParams.strokeColor}
                                onChange={(col) => {
                                    macroState.contourParams.strokeColor = col;
                                    drawDebounced();
                                }}
                            ></ColorPickerPreview>
                        </div>
                        <div class="field">
                            <RangeInput
                                id="contour dash"
                                title="Contour dash"
                                onChange={() => drawDebounced()}
                                bind:value={macroState.contourParams.strokeDash}
                                min={0}
                                max={5}
                                step={0.5}
                            ></RangeInput>
                        </div>
                        {#if !macroState.inlinePropsMacro.landOnTop}
                            <ColorPickerPreview
                                id="fillpicker"
                                popup="right"
                                title="Fill color"
                                value={macroState.contourParams.fillColor}
                                onChange={(col) => {
                                    macroState.contourParams.fillColor = col;
                                    drawDebounced();
                                }}
                            ></ColorPickerPreview>
                        {/if}
                    </div>
                {/if}
                {#if macroState.zonesData[currentMacroLayerTab]?.["data"]}
                    <button
                        id="manage-data-btn"
                        class="btn btn-outline-teal w-100 text-start mt-3 mb-2 p-2"
                        onclick={() => (showDataManager = true)}
                    >
                        <div class="d-flex align-items-center gap-1">
                            <Icon
                                svg={icons["table"]}
                                width="1rem"
                                height="1rem"
                                fillColor="currentColor"
                                marginRight="0"
                            />
                            <strong>Manage Data</strong>
                        </div>
                        <div class="small text-muted mt-1 d-flex flex-wrap gap-1">
                            {#each getColumns(macroState.zonesData[currentMacroLayerTab].data) as col}
                                <span class="px-2 badge bg-light text-dark border">{col}</span>
                            {/each}
                        </div>
                    </button>
                    <div
                        class="d-flex align-items-center layer-row"
                        onclick={() => { if (macroState.tooltipDefs[currentMacroLayerTab].enabled) { const cur = tooltipMenuOpenedByTab[currentMacroLayerTab] ?? true; tooltipMenuOpenedByTab[currentMacroLayerTab] = !cur; } }}
                    >
                        <div class="mx-2 form-check form-switch" onclick={(e) => e.stopPropagation()}>
                            <input
                                type="checkbox"
                                role="switch"
                                class="form-check-input"
                                id="showTooltip"
                                bind:checked={macroState.tooltipDefs[currentMacroLayerTab].enabled}
                                onclick={() =>
                                    setTimeout(() => {
                                        initTooltips();
                                        saveState();
                                        applyStylesToLegend();
                                        if (macroState.tooltipDefs[currentMacroLayerTab].enabled) tooltipMenuOpenedByTab[currentMacroLayerTab] = true;
                                    }, 0)}
                            />
                            <label for="showTooltip" class="form-check-label"> Show tooltip on hover </label>
                        </div>
                        {#if macroState.tooltipDefs[currentMacroLayerTab].enabled}
                            <div class="toggle" class:opened={tooltipMenuOpenedByTab[currentMacroLayerTab] !== false}></div>
                        {/if}
                    </div>
                    {#if macroState.tooltipDefs[currentMacroLayerTab].enabled && (tooltipMenuOpenedByTab[currentMacroLayerTab] ?? true)}
                        <div class="m-2 has-validation">
                            <label for="templatetooltip" class="form-label">
                                Tooltip template
                                <span
                                    class="help-tooltip"
                                    data-bs-toggle="tooltip"
                                    data-bs-title="Use double underscore __column__ to reference columns from the data above."
                                    >?</span
                                >
                            </label>
                            <QuillEditor
                                bind:value={macroState.tooltipDefs[currentMacroLayerTab].template}
                                bind:containerStyle={macroState.tooltipDefs[currentMacroLayerTab].containerStyle}
                                onchange={onTemplateChange}
                                hasError={!!templateErrorMessages[currentMacroLayerTab]}
                                fonts={commonState.providedFonts.map(f => f.name)}
                            />
                            {#if templateErrorMessages[currentMacroLayerTab]}
                                <div class="invalid-feedback d-block">
                                    {templateErrorMessages[currentMacroLayerTab]}
                                </div>
                            {/if}
                        </div>
                    {/if}
                    <!-- COLORING -->
                    <div
                        class="d-flex align-items-center layer-row"
                        onclick={() => { if (curDataDefs.enabled) { const cur = colorDataMenuOpenedByTab[currentMacroLayerTab] ?? true; colorDataMenuOpenedByTab[currentMacroLayerTab] = !cur; } }}
                    >
                        <div class="mx-2 form-check form-switch" onclick={(e) => e.stopPropagation()}>
                            <input
                                type="checkbox"
                                role="switch"
                                class="form-check-input"
                                id="colorData"
                                bind:checked={curDataDefs.enabled}
                                onchange={() => { autoSelectColors(); if (curDataDefs.enabled) colorDataMenuOpenedByTab[currentMacroLayerTab] = true; }}
                            />
                            <label for="colorData" class="form-check-label"> Color using data </label>
                        </div>
                        {#if curDataDefs.enabled}
                            <div class="toggle" class:opened={colorDataMenuOpenedByTab[currentMacroLayerTab] !== false}></div>
                        {/if}
                    </div>
                    {#if curDataDefs.enabled && (colorDataMenuOpenedByTab[currentMacroLayerTab] ?? true)}
                        <div class="d-flex m-1 align-items-center">
                            <div class="form-floating flex-grow-1">
                                <select
                                    class="form-select form-select-sm"
                                    id="choseColorType"
                                    bind:value={curDataDefs.colorScale}
                                    onchange={autoSelectColors}
                                >
                                    {#each availableColorTypes as colorType}
                                        <option value={colorType}>
                                            {colorType}
                                        </option>
                                    {/each}
                                </select>
                                <label for="choseColorType">Color type</label>
                            </div>
                            <span
                                class="help-tooltip"
                                data-bs-toggle="tooltip"
                                data-bs-html="true"
                                data-bs-title={scalesHelp}>?</span
                            >
                        </div>

                        <div class="d-flex align-items-center justify-content-between">
                            <div class="flex-grow-1 m-1 form-floating">
                                <select
                                    class="form-select form-select-sm"
                                    id="choseColorColumn"
                                    bind:value={curDataDefs.colorColumn}
                                    onchange={() => autoSelectColors()}
                                >
                                    {#each availableColumns as colorColumn}
                                        <option value={colorColumn}>
                                            {colorColumn}
                                        </option>
                                    {/each}
                                </select>
                                <label for="choseColorColumn"> Color on:</label>
                            </div>
                            <div class="flex-grow-1 m-1 form-floating">
                                <select
                                    class="form-select form-select-sm"
                                    id="choseColorPalette"
                                    bind:value={curDataDefs.colorPalette}
                                    onchange={autoSelectColors}
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
                                    class="btn btn-outline-primary btn-sm py-0 px-1"
                                    onclick={() => (showCustomPalette = true)}
                                >
                                    Edit</span
                                >
                            {/if}
                        </div>
                        {#if curDataDefs.colorScale !== "category"}
                            <div>
                                <RangeInput
                                    id="nbBreaks"
                                    title="Number of breaks"
                                    bind:value={curDataDefs.nbBreaks}
                                    onChange={autoSelectColors}
                                    min={3}
                                    max={9}
                                ></RangeInput>
                            </div>
                        {/if}
                        <!-- NO DATA COLOR -->
                        {#if hasNoDataForTab[currentMacroLayerTab] && curDataDefs.noDataColor}
                            <div class="mx-2 form-check form-switch">
                                <input
                                    type="checkbox"
                                    class="form-check-input"
                                    id="noDataColor"
                                    role="switch"
                                    bind:checked={curDataDefs.noDataColor.enabled}
                                    onchange={() => colorizeAndLegend(svg)}
                                />
                                <label for="noDataColor" class="form-check-label">No data color</label>
                            </div>
                            {#if curDataDefs.noDataColor.enabled}
                                <div class="mx-2 mb-2">
                                    <ColorPickerPreview
                                        id="nodatacolorpicker"
                                        popup="top"
                                        title="No data color"
                                        value={curDataDefs.noDataColor.color}
                                        onChange={(col) => {
                                            curDataDefs.noDataColor.color = col;
                                            colorizeAndLegend(svg);
                                        }}
                                    />
                                </div>
                            {/if}
                        {/if}
                        <!-- LEGEND -->
                        <div class="mx-2 form-check form-switch">
                            <input
                                type="checkbox"
                                class="form-check-input"
                                id="showLegend"
                                role="switch"
                                bind:checked={macroState.colorDataDefs[currentMacroLayerTab].legendEnabled}
                                onchange={(e) => colorizeAndLegend(svg)}
                            />
                            <label for="showLegend" class="form-check-label">
                                Show legend
                                <span
                                    class="help-tooltip"
                                    data-bs-toggle="tooltip"
                                    data-bs-title="Drag the legend to move it around.">?</span
                                >
                            </label>
                        </div>
                    {/if}
                    {#if curDataDefs.legendEnabled && (colorDataMenuOpenedByTab[currentMacroLayerTab] ?? true)}
                        <Legend
                            bind:definition={macroState.legendDefs[currentMacroLayerTab]}
                            on:change={(e) => colorizeAndLegend(svg)}
                            categorical={macroState.colorDataDefs[currentMacroLayerTab].colorScale === "category"}
                            noDataActive={curDataDefs.noDataColor?.enabled && hasNoDataForTab[currentMacroLayerTab]}
                        />
                        <svg width="75%" height={macroState.legendDefs[currentMacroLayerTab].rectHeight + 20}>
                            <g bind:this={legendSample}>
                                <rect
                                    x="10"
                                    y="10"
                                    width={macroState.legendDefs[currentMacroLayerTab].rectWidth}
                                    height={macroState.legendDefs[currentMacroLayerTab].rectHeight}
                                    fill={sampleLegend.color}
                                    stroke="black"
                                    onclick={openEditor}
                                ></rect>
                                <text
                                    x={macroState.legendDefs[currentMacroLayerTab].rectWidth + 15}
                                    y={macroState.legendDefs[currentMacroLayerTab].rectHeight / 2 + 10}
                                    text-anchor="start"
                                    dominant-baseline="middle"
                                    onclick={openEditor}
                                    style="font-size: 12px;"
                                >
                                    {sampleLegend.text}
                                </text>
                            </g>
                        </svg>
                        <span
                            class="help-tooltip"
                            data-bs-toggle="tooltip"
                            data-bs-title="Click the legend entry to update its style">?</span
                        >
                    {/if}
                {/if}
                {#if (currentIsColorByNumeric || currentTemplateHasNumeric) && macroState.tooltipDefs[currentMacroLayerTab]}
                    <div class="mt-1 form-floating">
                        <select
                            class="form-select form-select-sm"
                            id="choseFormatLocale"
                            bind:value={macroState.tooltipDefs[currentMacroLayerTab].locale}
                            onchange={changeNumericFormatter}
                        >
                            {#each Object.keys(resolvedLocales) as locale}
                                <option value={locale}>
                                    {getLocaleDisplayName(locale)}
                                </option>
                            {/each}
                        </select>
                        <label for="choseFormatLocale">Number formatting language</label>
                    </div>
                {/if}
                {#if currentMacroLayerTab !== "countries"}
                    <div
                        class="d-flex align-items-center layer-row mt-2"
                        onclick={() => { if (macroState.zonesGlow[currentMacroLayerTab]?.enabled) { const cur = glowMenuOpenedByTab[currentMacroLayerTab] ?? true; glowMenuOpenedByTab[currentMacroLayerTab] = !cur; } }}
                    >
                        <div class="mx-2 form-check form-switch" onclick={(e) => e.stopPropagation()}>
                            <input
                                class="form-check-input"
                                type="checkbox"
                                role="switch"
                                id="glowToggle"
                                checked={macroState.zonesGlow[currentMacroLayerTab]?.enabled ?? false}
                                onchange={(e) => {
                                    if ((e.target as HTMLInputElement).checked) {
                                        macroState.zonesGlow[currentMacroLayerTab] = {
                                            ...(macroState.zonesGlow[currentMacroLayerTab] ?? macroState.zonesGlow.land ?? defaultGlowParams),
                                            enabled: true,
                                        };
                                        glowMenuOpenedByTab[currentMacroLayerTab] = true;
                                    } else {
                                        macroState.zonesGlow[currentMacroLayerTab] = {
                                            ...macroState.zonesGlow[currentMacroLayerTab],
                                            enabled: false,
                                        };
                                    }
                                    draw();
                                }}
                            />
                            <label class="form-check-label" for="glowToggle">Glow</label>
                        </div>
                        {#if macroState.zonesGlow[currentMacroLayerTab]?.enabled}
                            <div class="toggle" class:opened={glowMenuOpenedByTab[currentMacroLayerTab] !== false}></div>
                        {/if}
                    </div>
                    {#if macroState.zonesGlow[currentMacroLayerTab]?.enabled && (glowMenuOpenedByTab[currentMacroLayerTab] ?? true)}
                        <div class="mx-2 mt-1">
                            <p class="glow-section-label">Inner</p>
                            <div class="field">
                                <RangeInput id="ge-inner-blur" title="Blur"
                                    bind:value={macroState.zonesGlow[currentMacroLayerTab].innerBlur}
                                    min={glowRange("innerBlur").min} max={glowRange("innerBlur").max} step={glowRange("innerBlur").step ?? 1}
                                    onChange={() => drawDebounced()} />
                            </div>
                            <div class="field">
                                <RangeInput id="ge-inner-strength" title="Strength"
                                    bind:value={macroState.zonesGlow[currentMacroLayerTab].innerStrength}
                                    min={glowRange("innerStrength").min} max={glowRange("innerStrength").max} step={glowRange("innerStrength").step ?? 1}
                                    onChange={() => drawDebounced()} />
                            </div>
                            <div class="field">
                                <ColorPickerPreview id="ge-inner-color" title="Color" popup="right"
                                    value={macroState.zonesGlow[currentMacroLayerTab].innerColor}
                                    onChange={(c) => { macroState.zonesGlow[currentMacroLayerTab].innerColor = c; drawDebounced(); }} />
                            </div>
                            <p class="glow-section-label mt-2">Outer</p>
                            <div class="field">
                                <RangeInput id="ge-outer-blur" title="Blur"
                                    bind:value={macroState.zonesGlow[currentMacroLayerTab].outerBlur}
                                    min={glowRange("outerBlur").min} max={glowRange("outerBlur").max} step={glowRange("outerBlur").step ?? 1}
                                    onChange={() => drawDebounced()} />
                            </div>
                            <div class="field">
                                <RangeInput id="ge-outer-strength" title="Strength"
                                    bind:value={macroState.zonesGlow[currentMacroLayerTab].outerStrength}
                                    min={glowRange("outerStrength").min} max={glowRange("outerStrength").max} step={glowRange("outerStrength").step ?? 1}
                                    onChange={() => drawDebounced()} />
                            </div>
                            <div class="field">
                                <ColorPickerPreview id="ge-outer-color" title="Color" popup="right"
                                    value={macroState.zonesGlow[currentMacroLayerTab].outerColor}
                                    onChange={(c) => { macroState.zonesGlow[currentMacroLayerTab].outerColor = c; drawDebounced(); }} />
                            </div>
                        </div>
                    {/if}
                {/if}
                        </div>
                        {/if}
                    </div>
                {/each}
            </div>
        </div>

{#if macroState.zonesData[currentMacroLayerTab]?.data}
    <DataManager
        bind:open={showDataManager}
        onClose={() => (showDataManager = false)}
        data={macroState.zonesData[currentMacroLayerTab].data}
        geoNames={getGeoNames(currentMacroLayerTab)}
        layerName={currentMacroLayerTab}
        onSave={handleDataManagerSave}
    />
{/if}

<Modal open={showCustomPalette} onClosed={() => (showCustomPalette = false)}>
    <div slot="content">
        <PaletteEditor
            palette={curDataDefs?.colorScale === "category"
                ? macroState.customCategoricalPalette
                : macroState.customContinuousPalette}
            mapping={curDataDefs?.colorScale === "category" ? ordinalMapping[currentMacroLayerTab] : undefined}
            mode={curDataDefs?.colorScale === "category" ? "categorical" : "continuous"}
            nbBreaks={curDataDefs?.nbBreaks}
            onChange={draw}
        />
    </div>
</Modal>

<style lang="scss" scoped>
    :global(.country-select-svelecte) {
        --sv-min-height: 30px;
        --sv-border: none;
        --sv-control-bg: transparent;
        --sv-placeholder-color: #6c757d;
        --sv-icon-color: #6c757d;
        --sv-dropdown-width: 16rem;
        width: 12rem;
        flex: 0 0 auto;
        font-size: 0.85rem;
    }
    :global(.country-select-svelecte .sv-control) {
        cursor: pointer;
        padding: 0 0.25rem;
    }
    :global(.country-select-svelecte:hover) {
        --sv-placeholder-color: #aeafaf;
    }
    :global(.country-select-svelecte.is-open) {
        --sv-control-bg: #fff;
        --sv-border: 1px solid #ccc;
    }
    // Fixed width so the "Show water"/"Show roads" color pickers line up with each other
    // regardless of label text width. Wide enough to fit "Show water elements" without
    // wrapping; overflow/ellipsis guards against any longer label overlapping the swatch.
    .layer-toggle-label {
        width: 13rem;
        flex-shrink: 0;
        white-space: nowrap;
        overflow: hidden;

        .form-check-label {
            overflow: hidden;
            text-overflow: ellipsis;
        }
    }

    .layers-list {
        display: flex;
        flex-direction: column;
        gap: 2px;
    }

    .layer-item {
        border: 1px solid transparent;
        border-radius: 4px;

        &.active {
            background-color: rgba(80, 103, 132, 0.06);
            border-color: rgba(80, 103, 132, 0.2);
        }
    }

    .layer-item-header {
        padding: 0.35rem 0.5rem;
        border-left: 3px solid transparent;
        cursor: pointer;
        transition:
            background-color 0.1s ease,
            border-color 0.15s ease;

        &:hover {
            background-color: rgba(80, 103, 132, 0.08);
        }

        .layer-item.active & {
            border-left-color: #506784;
        }
    }

    .layer-item-title {
        margin-left: 0.5rem;
        .layer-item.active & {
            color: #506784;
            font-weight: 600;
        }
    }

    .layer-item-chevron {
        transform: rotate(-90deg);
        &.opened {
            transform: rotate(0deg);
        }
    }

    .layer-item-body {
        border-top: 1px solid rgba(80, 103, 132, 0.15);
    }

    .field-column {
        flex-direction: column;
        align-items: flex-start;
    }

    .layer-item-add {
        margin: 0.25rem 0.25rem 0.5rem;
        border: 1px dashed rgba(80, 103, 132, 0.4);
        border-radius: 4px;
        background-color: rgba(80, 103, 132, 0.04);
        transition: border-color 0.15s ease, background-color 0.15s ease;

        &:hover {
            border-color: #506784;
            background-color: rgba(80, 103, 132, 0.08);
        }
    }

    .delete-tab {
        display: inline-flex;
        align-items: center;
        margin-left: 0.5rem;
        color: #c94a4a;
        border-radius: 3px;
        padding: 0.15rem;
        transition: color 0.15s ease, background-color 0.15s ease;
        &:hover {
            color: #dc3545;
            background-color: rgba(220, 53, 69, 0.1);
        }
    }

    .layers {
        background-color: white;
    }

    .glow-section-label {
        font-size: 11px;
        font-weight: 600;
        color: #506784;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        margin-bottom: 2px;
    }

    .layer-row {
        padding: 0.2rem 0.4rem;
        border-radius: 4px;
        transition: background-color 0.1s ease;
        cursor: pointer;
        &:hover {
            background-color: rgba(13, 110, 253, 0.08);
        }
    }

    .toggle {
        width: 1rem;
        height: 1rem;
        flex-shrink: 0;
        background-image: url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='%32dee2e6'><path fill-rule='evenodd' d='M1.646 4.646a.5.5 0 0 1 .708 0L8 10.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708z'/></svg>");
        transition: transform 0.15s ease;
        &.opened {
            transform: rotate(180deg);
        }
    }

</style>
