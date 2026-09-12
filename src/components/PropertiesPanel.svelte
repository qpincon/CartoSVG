<script lang="ts">
    import { onMount, untrack } from "svelte";
    import { Tooltip } from "bootstrap";
    import { rgbToHex, parseColorValue, resolveColorToHex } from "../util/colorMath";
    import { getMatchedCSSRules, getRuleValue, setRuleValue, getElementsAffectedByProp, type StyleRule, type PropAffectResult } from "../util/cssRules";
    import StyleColorPicker from "./StyleColorPicker.svelte";
    import * as markers from "../svg/markerDefs";

    // ── Bootstrap tooltip action ─────────────────────────────────────
    function bsTooltip(el: HTMLElement, title: string) {
        const opts = { placement: "top" as const, trigger: "hover", animation: false };
        let t = new Tooltip(el, { ...opts, title });
        return {
            update(newTitle: string) { t.dispose(); t = new Tooltip(el, { ...opts, title: newTitle }); },
            destroy() { t.dispose(); },
        };
    }

    const TOOLTIP_CASCADE = "Using the value from a shared style.";

    interface Props {
        cssRuleFilter?: (el: Element, cssSelector: string) => boolean;
        getCssRuleName?: (ruleName: string, el: Element) => string;
        onStyleChanged?: (target: Element, rule: StyleRule, prop: string, value: string) => void;
        suppressRing?: boolean;
        availableFonts?: string[];
        onOpenFontPicker?: () => void;
        entityType?: "path" | "freehand" | "shape" | null;
        entityId?: string | null;
        isEditingPath?: boolean;
        onEditPath?: () => void;
        onExitEditPath?: () => void;
        onDelete?: () => void;
        onSaveLink?: (id: string, url: string) => void;
        onAddTooltip?: (id: string) => void;
        onRemoveTooltip?: (id: string) => void;
        onAddPopover?: (id: string) => void;
        onRemovePopover?: (id: string) => void;
        getAnnotations?: (id: string) => { tooltip?: string; popover?: string } | null;
        getLink?: (id: string) => string | null;
        onBringToFront?: () => void;
        isOnTop?: (el: Element) => boolean;
        getPathImage?: (id: string) => { name: string; duration?: number; width?: number; height?: number; imageRotate?: boolean } | null;
        onImportPathImage?: (file: File) => void;
        onDeletePathImage?: () => void;
        onChangePathImageDuration?: (value: number) => void;
        onChangePathImageWidth?: (value: number) => void;
        onChangePathImageHeight?: (value: number) => void;
        onTogglePathImageRotate?: (value: boolean) => void;
        getPathMarker?: (id: string) => string | null;
        onChangePathMarker?: (markerName: string | "delete") => void;
        getShapePosition?: (id: string) => { lat: number; lng: number } | null;
        onChangeShapePosition?: (lat: number, lng: number) => void;
    }

    let {
        cssRuleFilter, getCssRuleName, onStyleChanged = () => {}, suppressRing = false,
        availableFonts = [], onOpenFontPicker,
        entityType = null, entityId = null, isEditingPath = false,
        onEditPath, onExitEditPath, onDelete, onSaveLink,
        onAddTooltip, onRemoveTooltip, onAddPopover, onRemovePopover,
        getAnnotations, getLink, onBringToFront, isOnTop,
        getPathImage, onImportPathImage, onDeletePathImage,
        onChangePathImageDuration, onChangePathImageWidth,
        onChangePathImageHeight, onTogglePathImageRotate,
        getPathMarker, onChangePathMarker,
        getShapePosition, onChangeShapePosition,
    }: Props = $props();

    const STROKE_WIDTHS = ["0.5", "1", "2", "3", "4", "6", "8", "12"];

    const DASH_PRESETS = [
        { label: "Solid",     value: "" },
        { label: "Dashed",    value: "6 4" },
        { label: "Dotted",    value: "1 4" },
        { label: "Dash-dot",  value: "8 3 1 3" },
        { label: "Long dash", value: "12 4" },
    ];

    const SYSTEM_FONTS = [
        "Arial", "Verdana", "Helvetica", "Tahoma", "Trebuchet MS",
        "Georgia", "Palatino Linotype", "Times New Roman", "Courier New", "Impact",
    ];

    const IC = {
        font:    `<svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true" fill="currentColor"><text x="1" y="13" font-size="13" font-weight="700" font-family="serif">A</text></svg>`,
        fill:    `<svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true" fill="currentColor"><path d="M16.56 8.94L7.62 0 6.21 1.41l2.38 2.38-5.15 5.15a1.49 1.49 0 000 2.12l5.5 5.5c.29.29.68.44 1.06.44s.77-.15 1.06-.44l5.5-5.5c.59-.58.59-1.53 0-2.12zM5.21 10L10 5.21 14.79 10H5.21zM19 11.5s-2 2.17-2 3.5c0 1.1.9 2 2 2s2-.9 2-2c0-1.33-2-3.5-2-3.5z"/></svg>`,
        stroke:  `<svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 000-1.41l-2.34-2.34a1 1 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>`,
        width:   `<svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true" fill="currentColor"><rect x="2" y="3" width="12" height="1.5" rx="0.75"/><rect x="2" y="7" width="12" height="2.5" rx="1.25"/><rect x="2" y="12" width="12" height="3" rx="1.5"/></svg>`,
        dash:    `<svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true" fill="currentColor"><rect x="1" y="7" width="4" height="2" rx="1"/><rect x="6.5" y="7" width="4" height="2" rx="1"/><rect x="12" y="7" width="3" height="2" rx="1"/></svg>`,
        link:    `<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="currentColor"><path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z"/></svg>`,
        tooltip: `<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="currentColor"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>`,
        popover: `<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="currentColor"><path d="M21 6.5C21 5.12 19.88 4 18.5 4h-13C4.12 4 3 5.12 3 6.5v7C3 14.88 4.12 16 5.5 16H6v3.5c0 .41.47.65.8.4l4.2-3.9h7.5c1.38 0 2.5-1.12 2.5-2.5v-7z"/></svg>`,
    };

    import type StyleColorPickerType from "./StyleColorPicker.svelte";
    let fillPicker:   StyleColorPickerType | null = $state(null);
    let strokePicker: StyleColorPickerType | null = $state(null);

    let element: Element | null = $state(null);
    let isAlreadyOnTop = $state(false);
    let matchedRules: StyleRule[] = $state([]);
    let selectedRuleIndex = $state(0);
    let widthOpen = $state(false); let dashOpen = $state(false); let fontOpen = $state(false);

    let currentFill = $state(""); let currentStroke = $state("");
    let currentStrokeWidth = $state(""); let currentDasharray = $state("");
    let currentFontFamily = $state("");

    const isTextElement = $derived(!!element && ["text", "tspan"].includes(element.tagName.toLowerCase()));
    const isMacroRegion = $derived(!!element && (element.classList.contains("country") || element.classList.contains("adm")));
    const allFonts = $derived([...availableFonts.filter((f) => !SYSTEM_FONTS.includes(f)), ...SYSTEM_FONTS]);
    const selectedRule = $derived(matchedRules[selectedRuleIndex] ?? null);

    // Active element id: prefer entity id, fall back to the panel's current element id.
    const activeId = $derived(entityId ?? (element?.id || null));
    const resolvedAnnotations = $derived(activeId ? (getAnnotations?.(activeId) ?? null) : null);
    const resolvedLink = $derived(activeId ? (getLink?.(activeId) ?? null) : null);
    const resolvedPathImage = $derived(entityType === "path" && activeId ? (getPathImage?.(activeId) ?? null) : null);
    const resolvedPathMarker = $derived(entityType === "path" && activeId ? (getPathMarker?.(activeId) ?? null) : null);
    const resolvedShapePos = $derived(entityType === "shape" && activeId ? (getShapePosition?.(activeId) ?? null) : null);
    const roundCoord = (v: number) => Math.round(v * 1e6) / 1e6;

    let pathImageInputEl: HTMLInputElement | null = $state(null);

    let ringStyle = $state(""); let ringVisible = $state(false); let ringRaf = 0;

    // ── Link inline editor ───────────────────────────────────────────
    let linkExpanded = $state(false);
    let linkInputVal = $state("");
    let linkInputEl: HTMLInputElement | null = $state(null);

    $effect(() => {
        entityId;
        untrack(() => { linkExpanded = false; });
    });

    function toggleLink() {
        linkInputVal = resolvedLink ?? "";
        linkExpanded = !linkExpanded;
        if (linkExpanded) requestAnimationFrame(() => linkInputEl?.focus());
    }
    function savePanelLink() {
        if (activeId) onSaveLink?.(activeId, linkInputVal);
        linkExpanded = false;
    }

    // ── Style values ────────────────────────────────────────────────
    function refreshValues() {
        if (!element || !selectedRule) { currentFill = currentStroke = currentStrokeWidth = currentDasharray = currentFontFamily = ""; return; }
        currentFill        = getRuleValue(element, selectedRule, "fill");
        currentStroke      = getRuleValue(element, selectedRule, "stroke");
        currentStrokeWidth = getRuleValue(element, selectedRule, "stroke-width");
        currentDasharray   = getRuleValue(element, selectedRule, "stroke-dasharray");
        currentFontFamily  = getRuleValue(element, selectedRule, "font-family");
    }

    function apply(prop: string, value: string) {
        if (!element || !selectedRule) return;
        setRuleValue(element, selectedRule, prop, value);
        _propCache.clear();
        refreshValues();
        onStyleChanged(element, selectedRule, prop, value);
    }

    /** Setting a stroke color has no visible effect if the stroke width resolves to 0 —
     * force a 1px width in that case so the new color shows up instantly. */
    function applyStroke(color: string) {
        const needsWidth = !currentStrokeWidth && !parseFloat(computedVal("stroke-width"));
        apply("stroke", color);
        if (needsWidth) apply("stroke-width", "1px");
    }

    // ── Computed / cascade values ────────────────────────────────────
    function computedVal(prop: string): string {
        if (!element) return "";
        try {
            const cs = window.getComputedStyle(element as Element);
            switch (prop) {
                case "fill":             return cs.fill          ?? "";
                case "stroke":           return cs.stroke        ?? "";
                case "stroke-width":     return cs.strokeWidth   ?? "";
                case "stroke-dasharray": { const v = cs.strokeDasharray; return !v || v === "none" ? "" : v.replace(/px/g, "").trim(); }
                case "font-family":      return cs.fontFamily    ?? "";
            }
        } catch { /* cross-origin */ }
        return "";
    }

    function inheritedColor(prop: string): string {
        const raw = computedVal(prop);
        if (!raw || raw === "none") return "";
        return raw.startsWith("rgb") ? rgbToHex(raw) : raw;
    }

    function inheritedWidth(): string { const v = computedVal("stroke-width"); const n = parseFloat(v); return isNaN(n) ? "" : `${n}px`; }
    function inheritedDash(): string  { return computedVal("stroke-dasharray"); }

    // ── Helpers ─────────────────────────────────────────────────────
    function normalizeDash(v: string) { return (!v || v === "none" || v === "0") ? "" : v.trim(); }
    function currentDashPreset()      { return DASH_PRESETS.find((p) => p.value === normalizeDash(currentDasharray)) ?? null; }
    function currentWidthDisplay()    { if (!currentStrokeWidth) return "—"; const n = parseFloat(currentStrokeWidth); return isNaN(n) ? currentStrokeWidth : `${n}px`; }
    function currentWidthNum()        { return parseFloat(currentStrokeWidth) || 1; }
    /** Normalise any CSS color value to uppercase hex for display (#RRGGBB or #RRGGBBAA). */
    function displayColor(v: string): string {
        if (!v || v === "none") return v;
        const s = resolveColorToHex(v); // named colours → "#rrggbb"
        if (/^rgb\s*\(/.test(s)) return (rgbToHex(s) || v).toUpperCase(); // rgb() → #RRGGBB
        const { hex, alpha } = parseColorValue(s);                         // rgba() / #hex
        if (!hex) return v;
        if (alpha >= 100) return ("#" + hex).toUpperCase();
        const a = Math.round(alpha * 255 / 100).toString(16).padStart(2, "0").toUpperCase();
        return ("#" + hex + a).toUpperCase();
    }

    function cleanFontName(v: string) { return v.trim().replace(/^['"]|['"]$/g, "").trim(); }
    function applyFont(name: string)  { apply("font-family", name.includes(" ") ? `'${name}'` : name); }
    function closeDropdowns()         { widthOpen = dashOpen = fontOpen = false; }

    function getElementInfo() {
        if (!element) return "";
        const tag = element.tagName.toLowerCase();
        const cls = Array.from(element.classList).filter((c) => !c.startsWith("_") && c !== "hovered").slice(0, 2).join(".");
        return `${tag}${cls ? "." + cls : ""}${element.id ? "#" + element.id : ""}`;
    }

    function getRuleLabel(rule: StyleRule) {
        const raw = rule === "inline" ? "inline" : (rule as CSSStyleRule).selectorText;
        if (getCssRuleName && element) return getCssRuleName(raw, element);
        return rule === "inline" ? "This element" : raw;
    }

    // ── Effects ─────────────────────────────────────────────────────
    $effect(() => { selectedRule; element; refreshValues(); _propCache.clear(); });
    $effect(() => {
        if (element) { matchedRules = getMatchedCSSRules(element, cssRuleFilter); selectedRuleIndex = 0; scheduleRingUpdate(); }
        else { matchedRules = []; ringVisible = false; clearHighlight(); }
    });
    $effect(() => { if (suppressRing) ringVisible = false; else if (element) scheduleRingUpdate(); });

    function scheduleRingUpdate() { cancelAnimationFrame(ringRaf); ringRaf = requestAnimationFrame(updateRing); }
    function updateRing() {
        if (!element || suppressRing) { ringVisible = false; return; }
        const rect = element.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) { ringVisible = false; return; }
        const pad = 5;
        ringStyle = `left:${rect.left-pad}px;top:${rect.top-pad}px;width:${rect.width+pad*2}px;height:${rect.height+pad*2}px`;
        ringVisible = true;
    }

    // ── Icon tooltips ────────────────────────────────────────────────
    let panelEl: HTMLElement | null = $state(null);
    let widthDropEl: HTMLDivElement | null = $state(null);
    let dashDropEl:  HTMLDivElement | null = $state(null);
    let fontDropEl:  HTMLDivElement | null = $state(null);
    let tipText = $state(""); let tipX = $state(0); let tipY = $state(0); let tipVisible = $state(false);
    function showTip(e: MouseEvent, text: string) { tipText = text; tipX = e.clientX; tipY = e.clientY; tipVisible = true; }
    function hideTip() { tipVisible = false; }

    onMount(() => {
        function handleDocMousedown(e: MouseEvent) {
            const t = e.target as Node;
            if (widthOpen && !widthDropEl?.contains(t)) widthOpen = false;
            if (dashOpen  && !dashDropEl?.contains(t))  dashOpen  = false;
            if (fontOpen  && !fontDropEl?.contains(t))  fontOpen  = false;
            if (!element || panelEl?.contains(t)) return;
            if (document.getElementById("static-svg-map")?.contains(t)) return;
            if (!document.getElementById("map-area")?.contains(t)) return;
            element = null; ringVisible = false;
        }
        document.addEventListener("mousedown", handleDocMousedown);
        return () => document.removeEventListener("mousedown", handleDocMousedown);
    });

    // ── Rule hover highlight ─────────────────────────────────────────
    // A fixed <div> overlay is placed over the SVG viewport (outside the SVG DOM).
    // Lit elements are punched through via clip-path so they appear at full brightness.
    // This causes zero SVG DOM mutations → no SVG repaint for the dim effect.
    let _overlayEl: HTMLDivElement | null = null;
    let _propCache = new Map<string, PropAffectResult | null>();

    const HL_NS = "http://www.w3.org/2000/svg";
    const HL_CLIP_ID = "sp-hl-clip";

    function clearHighlight() {
        _overlayEl?.remove(); _overlayEl = null;
        document.getElementById(HL_CLIP_ID)?.remove();
    }

    function addToMask(mask: Element, el: Element, sr: DOMRect): void {
        if (el instanceof SVGPathElement) {
            const d = el.getAttribute("d"), ctm = el.getScreenCTM();
            if (d && ctm) {
                const p = document.createElementNS(HL_NS, "path");
                p.setAttribute("d", d);
                p.setAttribute("fill", "black");
                p.setAttribute("transform", `matrix(${ctm.a},${ctm.b},${ctm.c},${ctm.d},${ctm.e - sr.left},${ctm.f - sr.top})`);
                mask.appendChild(p);
                return;
            }
        } else if (el instanceof SVGGElement) {
            for (const child of el.querySelectorAll("path"))
                addToMask(mask, child, sr);
            return;
        }
        // Fallback: bounding rect
        const r = el.getBoundingClientRect();
        const rect = document.createElementNS(HL_NS, "rect");
        rect.setAttribute("x", String(r.left - sr.left));
        rect.setAttribute("y", String(r.top - sr.top));
        rect.setAttribute("width", String(r.width));
        rect.setAttribute("height", String(r.height));
        rect.setAttribute("fill", "black");
        mask.appendChild(rect);
    }

    function showOverlay(svgEl: Element, litEls: Element[]): void {
        const sr = svgEl.getBoundingClientRect();
        _overlayEl = document.createElement("div");
        _overlayEl.style.cssText = `position:fixed;left:${sr.left}px;top:${sr.top}px;width:${sr.width}px;height:${sr.height}px;background:rgba(255,255,255,0.88);pointer-events:none;z-index:9000`;
        if (litEls.length > 0) {
            // SVG <mask>: white = overlay visible (dims map), black = overlay hidden (lit element shows through)
            const mask = document.createElementNS(HL_NS, "mask");
            mask.id = HL_CLIP_ID;
            const bg = document.createElementNS(HL_NS, "rect");
            bg.setAttribute("x", "0"); bg.setAttribute("y", "0");
            bg.setAttribute("width", String(sr.width)); bg.setAttribute("height", String(sr.height));
            bg.setAttribute("fill", "white");
            mask.appendChild(bg);
            for (const el of litEls) addToMask(mask, el, sr);
            let defs = svgEl.querySelector("defs");
            if (!defs) { defs = document.createElementNS(HL_NS, "defs"); svgEl.insertBefore(defs, svgEl.firstChild); }
            defs.appendChild(mask);
            _overlayEl.style.mask = `url(#${HL_CLIP_ID})`;
        }
        document.body.appendChild(_overlayEl);
    }

    function highlightRule(rule: StyleRule) {
        clearHighlight();
        if (!element) return;
        if (rule === "inline") return;
        const svgEl = document.getElementById("static-svg-map");
        if (!svgEl) return;
        let lits: Element[];
        {
            const sel = (rule as CSSStyleRule).selectorText
                .replace(/\.hovered/g, "").replace(/:hover\b/g, "").trim();
            try { lits = Array.from(svgEl.querySelectorAll(sel)); } catch { return; }
        }
        if (!lits.length) return;
        showOverlay(svgEl, lits);
    }

    function highlightProp(prop: string) {
        clearHighlight();
        if (!element || !selectedRule) return;
        if (selectedRule === "inline") return;
        const svgEl = document.getElementById("static-svg-map");
        if (!svgEl) return;
        const cached = _propCache.get(prop);
        const result = cached !== undefined ? cached : getElementsAffectedByProp(selectedRule as CSSStyleRule, prop, { scope: svgEl });
        if (cached === undefined) _propCache.set(prop, result);
        if (!result || result.will.length === result.total) { highlightRule(selectedRule); return; }
        showOverlay(svgEl, result.will); // empty will → overlay with no holes (nothing changes)
    }

    export function open(el: Element) { element = el; isAlreadyOnTop = isOnTop ? isOnTop(el) : false; closeDropdowns(); }
    export function close() { clearHighlight(); element = null; isAlreadyOnTop = false; ringVisible = false; closeDropdowns(); }
    export function notifyBroughtToFront() { if (element) isAlreadyOnTop = isOnTop ? isOnTop(element) : false; }
    export function isOpen() { return element !== null; }
    export function getElement() { return element; }
</script>

<!-- ── Snippets ──────────────────────────────────────────────────── -->

<!-- Reusable SVG line preview (width + dash style dropdowns) -->
{#snippet linePrev(w: number, dash: string)}
<svg class="sp-preview" viewBox="0 0 52 14" width="52" height="14" aria-hidden="true">
    <line x1="2" y1="7" x2="50" y2="7" stroke="#506784" stroke-width={w}
        stroke-dasharray={dash || "none"} stroke-linecap="round"/>
</svg>
{/snippet}

<!-- Reset (×) button — shown only when property has an explicit value -->
{#snippet resetBtn(prop: string, currentVal: string)}
    {#if currentVal}
        <button type="button" class="btn btn-sm btn-link text-muted text-decoration-none p-0 lh-1"
            onclick={() => apply(prop, "")}>×</button>
    {/if}
{/snippet}

<!-- Cascade indicator for color fields (dashed swatch + italic hex) -->
{#snippet cascadeColor(prop: string)}
    {@const ic = inheritedColor(prop)}
    <span class="flex-grow-1"></span>
    <span class="sp-cascade" use:bsTooltip={TOOLTIP_CASCADE}>
        {#if ic}<span class="sp-inherited-swatch" style="background:{ic}"></span>{/if}
        <em class="font-monospace text-muted" style="font-size:10px">{ic || "—"}</em>
    </span>
{/snippet}

<!-- Cascade indicator for text fields (italic value) -->
{#snippet cascadeText(value: string)}
    <span class="flex-grow-1"></span>
    <em class="text-muted me-1" style="font-size:10px" use:bsTooltip={TOOLTIP_CASCADE}>{value || "—"}</em>
{/snippet}

<!-- Full color property row (fill / stroke) -->
{#snippet colorField(prop: string, currentVal: string, icon: string, tipLabel: string, openPicker: (el: HTMLElement) => void)}
{@const barColor = inheritedColor(prop)}
<div class="d-flex align-items-center px-3 border-bottom gap-2 sp-field-row" class:sp-inherited-row={!currentVal} style="min-height:38px"
    onmouseenter={() => highlightProp(prop)} onmouseleave={clearHighlight}>
    <button type="button" class="sp-icon sp-icon-btn sp-color-icon-btn"
        onclick={(e) => openPicker(e.currentTarget as HTMLElement)}
        onmouseenter={(e) => showTip(e, tipLabel)} onmouseleave={hideTip}>
        {@html icon}
        <span class="sp-color-bar" class:sp-color-bar-none={!barColor}
            style={barColor ? `background:${barColor}` : ''}></span>
    </button>
    <div class="d-flex align-items-center flex-grow-1 gap-2 overflow-hidden">
        {#if currentVal}
            <span class="font-monospace text-secondary text-truncate flex-grow-1" style="font-size:11px">{displayColor(currentVal)}</span>
        {:else}
            {@render cascadeColor(prop)}
        {/if}
    </div>
    {@render resetBtn(prop, currentVal)}
</div>
{/snippet}

<!-- ── Hidden color pickers for fill / stroke (triggered from icon buttons) ── -->
{#if element}
<div style="position:absolute;width:0;height:0;overflow:hidden">
    <StyleColorPicker bind:this={fillPicker}   value={currentFill}   onChange={(c) => apply("fill", c)} />
    <StyleColorPicker bind:this={strokePicker} value={currentStroke} onChange={applyStroke} />
</div>
{/if}

<!-- ── Marching-ants ring ─────────────────────────────────────────── -->
{#if ringVisible}
    <div class="style-ring" style={ringStyle}></div>
{/if}

<!-- ── Panel ─────────────────────────────────────────────────────── -->
<aside class="style-panel d-flex flex-column border-start" bind:this={panelEl}>

    <!-- Header: panel name always visible; element id subtitle when open -->
    <div class="border-bottom flex-shrink-0 bg-white">
        <div class="d-flex align-items-center justify-content-between px-3" style="min-height:32px">
            <span class="sp-panel-title">Properties</span>
            {#if element}
                <button type="button" class="btn-close flex-shrink-0" onclick={close} aria-label="Close" style="font-size:0.6rem"></button>
            {/if}
        </div>
        {#if element}
            <div class="px-3 pb-2" style="margin-top:-2px">
                <span class="font-monospace text-secondary text-truncate d-block" style="font-size:11px">{getElementInfo()}</span>
            </div>
        {/if}
    </div>

    {#if element}
        <!-- Single scrollable body -->
        <div class="flex-grow-1 overflow-y-auto">

            <!-- Edit path — outside dimmed wrapper so "Exit editing" stays clickable -->
            {#if entityType === "path"}
            <div class="px-3 py-2 border-bottom">
                {#if isEditingPath}
                <div class="d-flex flex-column gap-1">
                    <span class="text-secondary" style="font-size:10px">Ctrl+click path to add point · Ctrl+click node to delete</span>
                    <button type="button" class="btn btn-sm btn-primary w-100"
                        onclick={() => onExitEditPath?.()}>Exit editing</button>
                </div>
                {:else}
                <button type="button" class="btn btn-sm btn-outline-secondary w-100"
                    onclick={() => onEditPath?.()}>Edit path</button>
                {/if}
            </div>
            {/if}

            <!-- Dimmable: interactions + style + delete -->
            <div class:sp-dimmed={isEditingPath}>

                <!-- ── INTERACTIONS ──────────────────────────────── -->
                {#if activeId}
                <div class="sp-section-head">Interactions</div>
                <div class="d-flex align-items-center px-3 border-bottom gap-2" style="min-height:34px">
                    <button type="button" class="sp-icon sp-icon-btn" style="color:{resolvedLink ? '#506784' : undefined}" onclick={toggleLink}>{@html IC.link}</button>
                    {#if linkExpanded}
                        <input bind:this={linkInputEl} type="text" class="form-control form-control-sm flex-grow-1"
                            placeholder="https://..."
                            bind:value={linkInputVal}
                            onkeydown={(e) => { if (e.key === 'Enter') savePanelLink(); if (e.key === 'Escape') { linkExpanded = false; } }} />
                        <button type="button" class="btn btn-sm btn-primary lh-1 flex-shrink-0" style="padding:3px 8px" onclick={savePanelLink}>✓</button>
                        <button type="button" class="btn btn-sm btn-link text-muted p-0 lh-1 text-decoration-none flex-shrink-0" onclick={() => linkExpanded = false}>×</button>
                    {:else if resolvedLink}
                        <span class="font-monospace flex-grow-1 text-truncate" style="font-size:10px;color:#506784">{resolvedLink}</span>
                        <button type="button" class="sp-act-btn" onclick={toggleLink}>Edit</button>
                        <button type="button" class="sp-act-btn text-danger" onclick={() => activeId && onSaveLink?.(activeId, '')}>×</button>
                    {:else}
                        <span class="flex-grow-1 text-secondary" style="font-size:11px">Link</span>
                        <button type="button" class="sp-act-btn" onclick={toggleLink}>Add</button>
                    {/if}
                </div>
                <div class="d-flex align-items-center px-3 border-bottom gap-2" style="min-height:34px">
                    <button type="button" class="sp-icon sp-icon-btn" style="color:{resolvedAnnotations?.tooltip ? '#506784' : undefined}" onclick={() => activeId && onAddTooltip?.(activeId)}>{@html IC.tooltip}</button>
                    <span class="flex-grow-1 text-secondary" style="font-size:11px">Tooltip</span>
                    {#if resolvedAnnotations?.tooltip}
                        <button type="button" class="sp-act-btn" onclick={() => activeId && onAddTooltip?.(activeId)}>Edit</button>
                        <button type="button" class="sp-act-btn text-danger" onclick={() => activeId && onRemoveTooltip?.(activeId)}>×</button>
                    {:else}
                        <button type="button" class="sp-act-btn" onclick={() => activeId && onAddTooltip?.(activeId)}>Add</button>
                    {/if}
                </div>
                <div class="d-flex align-items-center px-3 border-bottom gap-2" style="min-height:34px">
                    <button type="button" class="sp-icon sp-icon-btn" style="color:{resolvedAnnotations?.popover ? '#506784' : undefined}" onclick={() => activeId && onAddPopover?.(activeId)}>{@html IC.popover}</button>
                    <span class="flex-grow-1 text-secondary" style="font-size:11px">Popover</span>
                    {#if resolvedAnnotations?.popover}
                        <button type="button" class="sp-act-btn" onclick={() => activeId && onAddPopover?.(activeId)}>Edit</button>
                        <button type="button" class="sp-act-btn text-danger" onclick={() => activeId && onRemovePopover?.(activeId)}>×</button>
                    {:else}
                        <button type="button" class="sp-act-btn" onclick={() => activeId && onAddPopover?.(activeId)}>Add</button>
                    {/if}
                </div>
                {/if}

                <!-- ── POSITION (shapes/labels: lat/lng) ─────────────── -->
                {#if resolvedShapePos}
                <div class="sp-section-head">Position</div>
                <div class="d-flex align-items-center px-3 border-bottom gap-2" style="min-height:34px">
                    <span class="flex-grow-1 text-secondary" style="font-size:11px">Latitude</span>
                    <input type="number" class="form-control form-control-sm sp-no-spinner" style="width:64px"
                        step="any" min="-90" max="90"
                        value={roundCoord(resolvedShapePos.lat)}
                        onchange={(e) => {
                            const input = e.target as HTMLInputElement;
                            const v = parseFloat(input.value);
                            if (Number.isFinite(v) && resolvedShapePos) onChangeShapePosition?.(v, resolvedShapePos.lng);
                            const fresh = activeId ? getShapePosition?.(activeId) : null;
                            if (fresh) input.value = String(roundCoord(fresh.lat));
                        }} />
                </div>
                <div class="d-flex align-items-center px-3 border-bottom gap-2" style="min-height:34px">
                    <span class="flex-grow-1 text-secondary" style="font-size:11px">Longitude</span>
                    <input type="number" class="form-control form-control-sm sp-no-spinner" style="width:64px"
                        step="any" min="-180" max="180"
                        value={roundCoord(resolvedShapePos.lng)}
                        onchange={(e) => {
                            const input = e.target as HTMLInputElement;
                            const v = parseFloat(input.value);
                            if (Number.isFinite(v) && resolvedShapePos) onChangeShapePosition?.(resolvedShapePos.lat, v);
                            const fresh = activeId ? getShapePosition?.(activeId) : null;
                            if (fresh) input.value = String(roundCoord(fresh.lng));
                        }} />
                </div>
                {/if}

                <!-- ── PATH IMAGE ──────────────────────────────────── -->
                {#if entityType === "path"}
                <div class="sp-section-head">Image</div>
                <!-- Import / filename row -->
                <div class="d-flex align-items-center px-3 border-bottom gap-2" style="min-height:38px">
                    {#if resolvedPathImage}
                        <span class="flex-grow-1 text-truncate" style="font-size:11px;color:#506784">{resolvedPathImage.name}</span>
                        <button type="button" class="sp-act-btn" onclick={() => pathImageInputEl?.click()}>Change</button>
                        <button type="button" class="sp-act-btn text-danger" onclick={() => onDeletePathImage?.()}>×</button>
                    {:else}
                        <span class="flex-grow-1 text-secondary" style="font-size:11px">Image along path</span>
                        <button type="button" class="sp-act-btn" onclick={() => pathImageInputEl?.click()}>Import</button>
                    {/if}
                    <input bind:this={pathImageInputEl} type="file" accept=".png,.jpg,.svg" style="display:none"
                        onchange={(e) => {
                            const file = (e.target as HTMLInputElement).files?.[0];
                            if (file) onImportPathImage?.(file);
                            (e.target as HTMLInputElement).value = "";
                        }} />
                </div>
                {#if resolvedPathImage}
                <div class="d-flex align-items-center px-3 border-bottom gap-2" style="min-height:34px">
                    <span class="flex-grow-1 text-secondary" style="font-size:11px">Duration (s)</span>
                    <input type="number" class="form-control form-control-sm" style="width:64px"
                        value={resolvedPathImage.duration ?? 10}
                        onchange={(e) => onChangePathImageDuration?.(parseInt((e.target as HTMLInputElement).value))} />
                </div>
                <div class="d-flex align-items-center px-3 border-bottom gap-2" style="min-height:34px">
                    <span class="flex-grow-1 text-secondary" style="font-size:11px">Width</span>
                    <input type="number" class="form-control form-control-sm" style="width:64px"
                        value={resolvedPathImage.width ?? 20}
                        onchange={(e) => onChangePathImageWidth?.(parseInt((e.target as HTMLInputElement).value))} />
                </div>
                <div class="d-flex align-items-center px-3 border-bottom gap-2" style="min-height:34px">
                    <span class="flex-grow-1 text-secondary" style="font-size:11px">Height</span>
                    <input type="number" class="form-control form-control-sm" style="width:64px"
                        value={resolvedPathImage.height ?? 10}
                        onchange={(e) => onChangePathImageHeight?.(parseInt((e.target as HTMLInputElement).value))} />
                </div>
                <div class="d-flex align-items-center px-3 border-bottom gap-2" style="min-height:34px">
                    <span class="flex-grow-1 text-secondary" style="font-size:11px">Rotate with curve</span>
                    <input type="checkbox" class="form-check-input"
                        checked={resolvedPathImage.imageRotate !== false}
                        onchange={(e) => onTogglePathImageRotate?.((e.target as HTMLInputElement).checked)} />
                </div>
                {/if}
                {/if}

                <!-- ── PATH MARKER ──────────────────────────────────── -->
                {#if entityType === "path"}
                <div class="sp-section-head">Marker</div>
                <div class="d-flex align-items-center flex-wrap gap-2 px-3 py-2 border-bottom">
                    <button type="button" class="sp-marker-btn" class:active={!resolvedPathMarker}
                        title="None" onclick={() => onChangePathMarker?.("delete")}>
                        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8">
                            <line x1="5" y1="19" x2="19" y2="5"/>
                        </svg>
                    </button>
                    {#each Object.entries(markers) as [markerName, markerDef] (markerName)}
                        <button type="button" class="sp-marker-btn" class:active={resolvedPathMarker === markerName}
                            title={markerName} onclick={() => onChangePathMarker?.(markerName)}>
                            <svg width="16" height="16" viewBox={`0 0 ${markerDef.width} ${markerDef.height}`} fill="currentColor">
                                <path d={markerDef.d} />
                            </svg>
                        </button>
                    {/each}
                </div>
                {/if}

                <!-- ── STYLE ──────────────────────────────────────── -->
                <div class="sp-section-head">Style</div>

                <!-- Rule tabs -->
                {#if matchedRules.length > 1}
                    <div class="d-flex border-bottom">
                        {#each matchedRules as rule, i}
                            <button type="button" class="sp-rule-tab" class:active={i === selectedRuleIndex}
                                onmouseenter={() => highlightRule(rule)} onmouseleave={clearHighlight}
                                onclick={() => { selectedRuleIndex = i; closeDropdowns(); }}>
                                {getRuleLabel(rule)}
                            </button>
                        {/each}
                    </div>
                {:else if matchedRules.length === 1 && matchedRules[0] !== "inline"}
                    <div class="px-3 py-1 border-bottom text-secondary fst-italic" style="font-size:11px"
                        onmouseenter={() => highlightRule(matchedRules[0])} onmouseleave={clearHighlight}>
                        {getRuleLabel(matchedRules[0])}
                    </div>
                {/if}

                <!-- Font family (text elements only) -->
                {#if isTextElement}
                <div class="d-flex align-items-center px-3 border-bottom gap-2 sp-field-row" style="min-height:38px"
                    onmouseenter={() => highlightProp("font-family")} onmouseleave={clearHighlight}>
                    <span class="sp-icon" onmouseenter={(e) => showTip(e, 'Font family')} onmouseleave={hideTip}>{@html IC.font}</span>
                    <div class="dropdown flex-grow-1" bind:this={fontDropEl}>
                        <button type="button" class="btn btn-sm btn-outline-secondary w-100 d-flex align-items-center gap-1 text-start"
                            style="font-family:{currentFontFamily || 'inherit'}"
                            onclick={() => { fontOpen = !fontOpen; widthOpen = dashOpen = false; }}>
                            <span class="flex-grow-1" style="font-size:12px">{cleanFontName(currentFontFamily) || "—"}</span>
                            <span class="text-muted" style="font-size:10px">▾</span>
                        </button>
                        {#if fontOpen}
                            <ul class="dropdown-menu show w-100 overflow-y-auto py-1" style="max-height:280px">
                                <li><button type="button" class="dropdown-item small fw-medium text-teal"
                                    onclick={() => { fontOpen = false; onOpenFontPicker?.(); }}>More fonts…</button></li>
                                <li><hr class="dropdown-divider my-1"></li>
                                {#each allFonts as font}
                                    <li><button type="button" class="dropdown-item small"
                                        class:active={cleanFontName(currentFontFamily) === font}
                                        style="font-family:'{font}'"
                                        onclick={() => { applyFont(font); fontOpen = false; }}>{font}</button></li>
                                {/each}
                            </ul>
                        {/if}
                    </div>
                    {@render resetBtn("font-family", currentFontFamily)}
                </div>
                {/if}

                <!-- Fill -->
                {@render colorField("fill", currentFill, IC.fill, "Fill", (el) => fillPicker?.open(el))}

                <!-- Stroke -->
                {@render colorField("stroke", currentStroke, IC.stroke, "Stroke color", (el) => strokePicker?.open(el))}

                <!-- Stroke width -->
                <div class="d-flex align-items-center px-3 border-bottom gap-2 sp-field-row" class:sp-inherited-row={!currentStrokeWidth} style="min-height:38px"
                    onmouseenter={() => highlightProp("stroke-width")} onmouseleave={clearHighlight}>
                    <span class="sp-icon" onmouseenter={(e) => showTip(e, 'Stroke width')} onmouseleave={hideTip}>{@html IC.width}</span>
                    <div class="dropdown flex-grow-1" bind:this={widthDropEl}>
                        <button type="button" class="btn btn-sm btn-outline-secondary w-100 d-flex align-items-center gap-1"
                            onclick={() => { widthOpen = !widthOpen; dashOpen = false; }}>
                            {@render linePrev(currentWidthNum(), "none")}
                            {#if currentStrokeWidth}
                                <span class="flex-grow-1 text-start" style="font-size:11px">{currentWidthDisplay()}</span>
                            {:else}
                                {@render cascadeText(inheritedWidth())}
                            {/if}
                            <span class="text-muted" style="font-size:10px">▾</span>
                        </button>
                        {#if widthOpen}
                            <ul class="dropdown-menu show w-100 overflow-y-auto py-1" style="max-height:240px">
                                {#each STROKE_WIDTHS as w}
                                    <li><button type="button" class="dropdown-item d-flex align-items-center gap-2 small"
                                        class:active={parseFloat(currentStrokeWidth) === parseFloat(w)}
                                        onclick={() => { apply("stroke-width", w + "px"); widthOpen = false; }}>
                                        {@render linePrev(parseFloat(w), "none")}
                                        <span>{w}px</span>
                                    </button></li>
                                {/each}
                            </ul>
                        {/if}
                    </div>
                    {@render resetBtn("stroke-width", currentStrokeWidth)}
                </div>

                <!-- Dash style -->
                <div class="d-flex align-items-center px-3 border-bottom gap-2 sp-field-row" class:sp-inherited-row={!currentDasharray || !normalizeDash(currentDasharray)} style="min-height:38px"
                    onmouseenter={() => highlightProp("stroke-dasharray")} onmouseleave={clearHighlight}>
                    <span class="sp-icon" onmouseenter={(e) => showTip(e, 'Dash style')} onmouseleave={hideTip}>{@html IC.dash}</span>
                    <div class="dropdown flex-grow-1" bind:this={dashDropEl}>
                        <button type="button" class="btn btn-sm btn-outline-secondary w-100 d-flex align-items-center gap-1"
                            onclick={() => { dashOpen = !dashOpen; widthOpen = false; }}>
                            {@render linePrev(2, normalizeDash(currentDasharray))}
                            {#if currentDasharray && normalizeDash(currentDasharray)}
                                <span class="flex-grow-1 text-start" style="font-size:11px">{currentDashPreset()?.label ?? "—"}</span>
                            {:else}
                                {@render cascadeText(inheritedDash())}
                            {/if}
                            <span class="text-muted" style="font-size:10px">▾</span>
                        </button>
                        {#if dashOpen}
                            <ul class="dropdown-menu show w-100 py-1">
                                {#each DASH_PRESETS as preset}
                                    <li><button type="button" class="dropdown-item d-flex align-items-center gap-2 small"
                                        class:active={normalizeDash(currentDasharray) === preset.value}
                                        onclick={() => { apply("stroke-dasharray", preset.value); dashOpen = false; }}>
                                        {@render linePrev(2, preset.value)}
                                        <span>{preset.label}</span>
                                    </button></li>
                                {/each}
                            </ul>
                        {/if}
                    </div>
                    {@render resetBtn("stroke-dasharray", normalizeDash(currentDasharray))}
                </div>

                <!-- Bring to front — for macro regions (country / adm) -->
                {#if isMacroRegion && onBringToFront && !isEditingPath}
                <div class="px-3 pt-3 pb-3">
                    <span use:bsTooltip={isAlreadyOnTop ? "Already on top" : "Move this region above its neighbours so its borders are fully visible on top"} style="display:block">
                        <button
                            type="button"
                            class="btn btn-sm btn-outline-secondary w-100"
                            disabled={isAlreadyOnTop}
                            onclick={() => onBringToFront?.()}
                        >Bring to front</button>
                    </span>
                </div>
                {/if}

                <!-- Delete — right after style controls, only for user entities -->
                {#if entityType && !isEditingPath}
                <div class="px-3 pt-3 pb-3">
                    <button type="button" class="btn btn-sm w-100 sp-delete-btn" onclick={() => onDelete?.()}>Delete</button>
                </div>
                {/if}

            </div><!-- end dimmable -->
        </div><!-- end scroll body -->

    {:else}
        <div class="flex-grow-1 d-flex flex-column align-items-center justify-content-center text-secondary gap-3 p-4" style="font-size:12px;text-align:center;line-height:1.5">
            <svg viewBox="0 0 32 32" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.5">
                <rect x="4" y="4" width="24" height="24" rx="3"/>
                <line x1="10" y1="16" x2="22" y2="16"/>
                <line x1="16" y1="10" x2="16" y2="22"/>
            </svg>
            <span>Click any element<br>to edit its properties</span>
        </div>
    {/if}

</aside>

{#if tipVisible}
    <div class="sp-tip" style="left:{tipX + 12}px;top:{tipY - 28}px">{tipText}</div>
{/if}

<style>
    .style-ring {
        position: fixed; pointer-events: none; z-index: 9997; border-radius: 3px;
        outline: 2px dashed #506784; outline-offset: 1px;
    }

    .style-panel { width: 248px; }

    .sp-rule-tab {
        padding: 5px 12px; border: none; border-bottom: 2px solid transparent;
        background: none; font-size: 11px; color: #8da5be; cursor: pointer;
        margin-bottom: -1px; white-space: nowrap;
    }
    .sp-rule-tab:hover { color: #506784; }
    .sp-rule-tab.active { color: #506784; font-weight: 600; border-bottom-color: #506784; }

    .sp-icon {
        width: 24px; flex-shrink: 0;
        display: flex; align-items: center; justify-content: center;
        color: #8da5be; cursor: default;
    }
    .sp-icon:hover { color: #506784; }
    .sp-icon-btn {
        background: none; border: none; padding: 0; cursor: pointer;
    }
    .sp-color-icon-btn {
        flex-direction: column; gap: 2px; align-items: center; height: auto;
    }
    .sp-color-bar {
        width: 20px; height: 3px; border-radius: 1.5px;
        border: 1px solid rgba(0, 0, 0, 0.12); flex-shrink: 0;
    }
    .sp-color-bar-none {
        background: repeating-linear-gradient(
            -45deg, #f0f0f0, #f0f0f0 2px, white 2px, white 4px
        ) !important;
    }

    .sp-preview { display: block; flex-shrink: 0; }

    .sp-inherited-row { background: #f8f9fa; }

    .sp-cascade { display: flex; align-items: center; gap: 4px; flex-shrink: 0; }
    .sp-inherited-swatch {
        width: 13px; height: 13px; border-radius: 2px;
        border: 1.5px dashed #adb5bd; flex-shrink: 0;
    }

    .sp-tip {
        position: fixed; pointer-events: none; z-index: 99999;
        background: #2c3e52; color: white;
        font-size: 10px; font-family: system-ui, sans-serif;
        padding: 3px 7px; border-radius: 4px; white-space: nowrap;
    }

    .sp-act-btn {
        background: none; border: none; padding: 0; cursor: pointer;
        font-size: 11px; color: #8da5be; text-decoration: none; flex-shrink: 0;
    }
    .sp-act-btn:hover { color: #506784; }
    .sp-act-btn.text-danger { color: #dc3545 !important; }
    .sp-act-btn.text-danger:hover { color: #a71d2a !important; }

    .sp-marker-btn {
        display: flex; align-items: center; justify-content: center;
        width: 26px; height: 26px; padding: 0;
        background: white; border: 1px solid #dde5ee; border-radius: 4px;
        color: #506784; cursor: pointer;
    }
    .sp-marker-btn:hover { border-color: #9ab0ca; }
    .sp-marker-btn.active { border-color: #4a7fc1; background: #e8f0fb; color: #1e4d8c; }

    .sp-delete-btn {
        color: #dc3545; border: 1px solid #f5c6cb; background: transparent;
    }
    .sp-delete-btn:hover { background: #fff5f5; border-color: #dc3545; }

    .sp-dimmed { opacity: 0.45; pointer-events: none; }

    .sp-no-spinner::-webkit-outer-spin-button,
    .sp-no-spinner::-webkit-inner-spin-button {
        -webkit-appearance: none;
        margin: 0;
    }
    .sp-no-spinner {
        -moz-appearance: textfield;
        appearance: textfield;
    }

    .sp-panel-title {
        font-size: 11px; font-weight: 600; letter-spacing: .05em;
        text-transform: uppercase; color: #506784;
    }

    .sp-section-head {
        padding: 6px 12px 5px;
        font-size: 10px; font-weight: 600; letter-spacing: .05em;
        text-transform: uppercase; color: #7a96b0;
        background: #f2f5f8;
        border-top: 1px solid #e2e8ef;
        border-bottom: 1px solid #e2e8ef;
    }
</style>
