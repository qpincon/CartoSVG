<script lang="ts">
    import { onMount, tick } from "svelte";
    import type { GlobalState } from "./types";
    import { select, pointer } from "d3-selection";
    import { drag } from "d3-drag";
    import { zoom } from "d3-zoom";
    import PropertiesPanel from "./components/PropertiesPanel.svelte";
    import {  debounce, clamp } from "lodash-es";
    import { drawCustomPaths, parseAndUnprojectPath } from "./svg/paths";
    import PathEditor from "./svg/pathEditor";
    import Geocoding from "./components/Geocoding.svelte";
    import { initTooltips, sleep } from "./util/common";
    import { processUploadedImage } from "./util/imageProcess";
    import { log } from "./util/log";
    import {
        createSvgAnchor,
        postClipSimple,
    } from "./svg/svg";
    import { drawShapes } from "./svg/shape";
    import iso3Data from "./assets/data/iso3_filtered.json";
    import { freeHandDrawPath, cancelFreeHandDrawPath } from "./svg/freeHandPath";
    import Modal from "./components/Modal.svelte";
    import LabelEditor from "./components/LabelEditor.svelte";
    import FontPicker from "./components/FontPicker.svelte";
    import Navbar from "./components/Navbar.svelte";
    import macroImg from "./assets/img/macro.png";
    import microImg from "./assets/img/micro.png";
    import Icon from "./components/Icon.svelte";
    import { exportStyleSheet, getUsedInlineFonts, fontsToCss, applyStyles } from "./util/dom";
    import { getState, saveState, registerServerSync } from "./util/save";
    import { defaultGlowParams, defaultAnnotationStyle } from "./stateDefaults";
    import { undo, redo, setRestoring, clearHistory } from "./util/history";
    import { type ExportOptions } from "./svg/export";
    import ExportModal from "./components/ExportModal.svelte";
    import PostExportInfoModal from "./components/PostExportInfoModal.svelte";
    import InstructionsModal from "./components/InstructionsModal.svelte";
    import { maybeStartTour, startTour } from "./util/tour";
    import AuthModal from "./components/AuthModal.svelte";
    import UpgradeModal from "./components/UpgradeModal.svelte";
    import FeedbackModal from "./components/FeedbackModal.svelte";
    import ProjectDropdown from "./components/ProjectDropdown.svelte";
  import { FREE_PROJECT_LIMIT, PRO_PROJECT_LIMIT } from "$lib/billing-constants";
    import { signOut } from "$lib/auth-client";
    import { page } from "$app/state";
    import { invalidateAll } from "$app/navigation";
    import { track } from "./util/analytics";
    import { drawFreeHandShapes, FreehandDrawer } from "./svg/freeHandDraw";
    import type {
        SvgSelection,
        ProvidedFont,
        ParsedPath,
        ContextMenuInfo,
        PathDefImage,
        MarkerName,
        ShapeName,
        Mode,
    } from "./types";
    import QuillEditor from "./components/QuillEditor.svelte";
    import { addElementAnnotationListener } from "./tooltip";
    import { showElementPopover, hidePopover, getActivePopoverId, setupPopoverCursors } from "./popover";
    import { Dropdown } from "bootstrap";
    import { applyInlineStyles, changeProjection, handleChangeProp } from "./macro/drawing";
    import { updateLayerSimplification } from "./macro/geometry-data";
    import MacroSidebar from "./macro/components/MacroSidebar.svelte";
    import ResizeHandles from "./components/ResizeHandles.svelte";
    import { appState, commonState, macroState, microState } from "./state.svelte";
    import { icons } from "./shared/icons";
    import { defaultState } from "./stateDefaults";
    import { exportMacro } from "./macro/export";
    import MicroSidebar from "./micro/components/MicroSidebar.svelte";
    import SettingsStrip from "./components/SettingsStrip.svelte";
    import ToolStrip from "./components/ToolStrip.svelte";
    import { exportMicro } from "./micro/drawing";
    import { replaceCssSheetContent, updateSvgPatterns } from "./micro/change";
    import {
        selectionState,
        identifyClickedEntity,
        identifyClickedPath,
        toggleSelection,
        clearSelection,
        isSelectionActive,
        copySelected,
        pasteFromClipboard,
        deleteSelected,
        refreshOverlay,
        getOverlay,
        moveSelectedByKeyboard,
        type SelectedEntity,
    } from "./selection.svelte";

    let openContextMenuInfo: ContextMenuInfo;

    let macroSidebar: MacroSidebar | null = $state(null);
    let microSidebar: MicroSidebar | null = $state(null);
    let labelEditor: LabelEditor | null = $state(null);
    let fontPicker: FontPicker | null = $state(null);
    let svg: SvgSelection = $state(select("#map-container") as unknown as SvgSelection);
    let isDrawing = $state(false);

    let cssFonts = $derived(fontsToCss(commonState.providedFonts));

    // ==== End state =====

    // ==== Toolbar / placement state ====
    type ActiveTool = null | 'curve' | 'freehand' | 'point' | 'label';
    type PendingPlacement = null | { kind: 'shape'; shapeName: ShapeName } | { kind: 'label' };
    let activeTool = $state<ActiveTool>(null);
    let pendingPlacement = $state<PendingPlacement>(null);
    let placementSvgNode: SVGSVGElement | null = null;
    let isDraggingImage = $state(false);
    // ==== End toolbar state ====

    let commonCss: string | undefined = $state(undefined);
    // Whether the floating label-entry textarea (bound to #label-entry) is open.
    let addingLabel = $state(false);

    // Annotation editor state — uses the same QuillEditor with containerStyle as macro tooltips.
    // Content is the inner HTML, containerStyle is the outer <div>'s CSS properties.
    // On save, both are merged into a single `<div style="...">content</div>` string.
    let annotationEditorOpen = $state(false);
    let annotationEditingElemId = $state<string | null>(null);
    let annotationEditingType = $state<"tooltip" | "popover">("tooltip");
    let annotationEditorContent = $state("");
    let annotationContainerStyle = $state<Record<string, string>>({});
    // Default text formatting (color, size, font-family) seeded from the last-used font when starting
    // brand-new (empty) content — undefined when editing existing content, whose text keeps its own formatting.
    let annotationDefaultTextFormat = $state<Record<string, string> | undefined>(undefined);
    let annotationQuillEditor: ReturnType<typeof QuillEditor> | null = $state(null);
    let annotationEditorKeyHandler: ((e: KeyboardEvent) => void) | null = null;

    let drawingTooltip: HTMLDivElement | null = $state(null);
    let textInput: HTMLTextAreaElement | null = $state(null);
    let customImageInput: HTMLInputElement | null = $state(null);
    let typedText = $state("");
    let propertiesPanel: PropertiesPanel | null = $state(null);
    let contextualMenu: (HTMLDivElement & { opened?: boolean }) | null = $state(null);
    let showExportConfirm = $state(false);
    let showPostExportInfo = $state(false);
    const POST_EXPORT_INFO_HIDDEN_KEY = "mapello-hide-post-export-info";
    const MICRO_HINT_DISMISSED_KEY = "mapello-micro-hint-dismissed";
    let microHintDismissed = $state(localStorage.getItem(MICRO_HINT_DISMISSED_KEY) === "1");
    const showMicroHint = $derived(
        commonState.currentMode === "macro" &&
        !microHintDismissed &&
        macroState.inlinePropsMacro.altitude <= appState.altMin + 5
    );
    let showInstructionsModal = $state(false);
    let showFeedbackModal = $state(false);
    let showAuthModal = $state(false);
    let authAfterCallback: (() => void) | undefined = $state(undefined);
    let showUpgradeModal = $state(false);
    const ACTIVE_PROJECT_KEY = "map-builder-active-project";
    const _storedProject = (() => {
        try {
            return JSON.parse(localStorage.getItem(ACTIVE_PROJECT_KEY) ?? "null");
        } catch {
            return null;
        }
    })();
    let currentProjectName = $state(_storedProject?.name ?? "Project 1");
    let activeProjectId = $state<number | null>(typeof _storedProject?.id === "number" ? _storedProject.id : null);
    const currentUser = $derived(page.data.user ?? null);
    const isSuperUser = $derived(page.data.isSuperUser ?? false);

    $effect(() => {
        if (activeProjectId) {
            localStorage.setItem(ACTIVE_PROJECT_KEY, JSON.stringify({ id: activeProjectId, name: currentProjectName }));
        } else {
            localStorage.removeItem(ACTIVE_PROJECT_KEY);
        }
    });

    let editingPath = $state(false);
    let currentPathEditor: PathEditor | null = $state(null);
    let panelEntityDuringEdit = $state<SelectedEntity | null>(null);
    let isDrawingFreeHand = $state(false);
    let isDrawingPath = $state(false);
    let isCursorInsideMap = $state(false);
    let isActivelyDrawingPath = $state(false);

    // ── Style panel entity context ───────────────────────────────────
    const panelSelectedEntity = $derived(
        selectionState.selected.length === 1 ? selectionState.selected[0] : null
    );
    const panelEntity = $derived(editingPath ? panelEntityDuringEdit : panelSelectedEntity);
    function getPanelAnnotations(id: string) {
        return commonState.elementAnnotations?.[id] ?? null;
    }
    function getPanelLink(id: string) {
        return commonState.elementLinks?.[id] ?? null;
    }

    let zoomFunc: d3.ZoomBehavior<any, any> | null = $state(null);
    let dragFunc: d3.DragBehavior<any, any, any> | null = $state(null);
    let serverSyncError = $state("");

    let showProjectLoginModal = $state(false);
    let loginProjects = $state<{ id: number; name: string; updatedAt: number }[]>([]);
    let loadingLoginProjectId = $state<number | null>(null);
    let saveDraftName = $state("Project 1");

    let _checkingProjects = false;

    async function handleLoginProjectCheck() {
        if (_checkingProjects) return;
        _checkingProjects = true;
        try {
            const res = await fetch("/api/projects");
            if (!res.ok) return;
            const projects: { id: string; name: string; updatedAt: number }[] = await res.json();
            if (projects.length === 0) {
                const createRes = await fetch("/api/projects", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name: "Project 1", project_json: getProjectJson() }),
                });
                if (!createRes.ok) return;
                const created = await createRes.json();
                activeProjectId = created.id;
                currentProjectName = created.name;
            } else {
                loginProjects = projects;
                saveDraftName = "Project 1";
                showProjectLoginModal = true;
            }
        } catch {
            /* silent */
        } finally {
            _checkingProjects = false;
        }
    }

    async function handleSaveDraft() {
        if (!saveDraftName.trim()) return;
        try {
            const res = await fetch("/api/projects", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: saveDraftName.trim(), project_json: getProjectJson() }),
            });
            if (!res.ok) return;
            const created = await res.json();
            activeProjectId = created.id;
            currentProjectName = created.name;
            showProjectLoginModal = false;
        } catch {
            /* silent */
        }
    }

    async function handleSelectLoginProject(id: number) {
        loadingLoginProjectId = id;
        try {
            const res = await fetch(`/api/projects/${id}`);
            if (!res.ok) return;
            const project = await res.json();
            const state: GlobalState = JSON.parse(project.projectJson);
            await applyState(state);
            if (commonState.currentMode === "macro") macroSidebar!.applyStateAndDraw();
            activeProjectId = id;
            currentProjectName = project.name;
            showProjectLoginModal = false;
        } catch {
            /* silent */
        } finally {
            loadingLoginProjectId = null;
        }
    }

    async function handleLoginModalClosed() {
        showProjectLoginModal = false;
        if (!activeProjectId) await handleSaveDraft();
    }

    // Tracks the last user id we ran the login-project check for. `currentUser` gets a brand
    // new object on every invalidateAll() (e.g. the one ExportModal fires after every export to
    // refresh the export quota), even when it's still the same logged-in user — without this
    // guard, that reference change alone was mistaken for a fresh login and re-ran the check,
    // which could re-open the "Welcome back" project picker right after an export finished.
    // Seeded from whoever is already logged in when the app boots, so a session that was already
    // active on load is never mistaken for a fresh login — only a later null → id transition
    // (an actual sign-in during this run) should open the project picker.
    let lastCheckedUserId: string | null = currentUser?.id ?? null;

    $effect(() => {
        const uid = currentUser?.id ?? null;
        if (uid && uid !== lastCheckedUserId) {
            lastCheckedUserId = uid;
            if (!activeProjectId) handleLoginProjectCheck();
        } else if (!uid) {
            lastCheckedUserId = null;
            if (activeProjectId) {
                // Logged out (or switched account) — drop the stale project reference so
                // auto-save doesn't try to PUT to a project we no longer have access to.
                activeProjectId = null;
                currentProjectName = "Project 1";
            }
        }
    });

    onMount(async () => {
        log("App onmount");
        registerServerSync({
            getProjectId: () => activeProjectId,
            getProjectJson,
            isLoggedIn: () => !!currentUser,
            onError: (msg) => {
                serverSyncError = msg;
            },
        });
        /** Init bootstrap dropdowns */
        Array.from(document.querySelectorAll(".dropdown-toggle")).forEach((dropdownToggleEl) => {
            new Dropdown(dropdownToggleEl);
        });

        document.body.append(contextualMenu!);
        contextualMenu!.style.display = "none";
        contextualMenu!.style.position = "absolute";
        contextualMenu!.opened = false;
        restoreStateFromSave();
        attachListeners();
        // maplibreMap.showTileBoundaries = true;
        window.addEventListener("keydown", (e) => {
            if (e.code === "Escape") {
                if (contextualMenu?.opened) {
                    closeMenu();
                    return;
                }
                if (propertiesPanel?.isOpen()) {
                    propertiesPanel.close();
                    return;
                }
                if (isSelectionActive()) {
                    clearSelection();
                    return;
                }
                if (pendingPlacement) {
                    cancelPlacement();
                    return;
                }
                stopDrawFreeHand();
                cancelDrawPath();
            } else if (e.code === "Enter") {
                stopDrawFreeHand();
            } else if ((e.ctrlKey || e.metaKey) && e.code === "KeyC") {
                if (isSelectionActive()) {
                    const target = e.target as HTMLElement;
                    if (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable) return;
                    e.preventDefault();
                    copySelected();
                }
            } else if ((e.ctrlKey || e.metaKey) && e.code === "KeyV") {
                if (selectionState.clipboard) {
                    const target = e.target as HTMLElement;
                    if (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable) return;
                    e.preventDefault();
                    pasteFromClipboard(() => redrawEntities());
                }
            } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
                const target = e.target as HTMLElement;
                if (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable) return;
                e.preventDefault();
                if (currentPathEditor) {
                    // Path-editing undo/redo takes priority over the global history while a path is being edited.
                    if (e.shiftKey) {
                        currentPathEditor.redo();
                    } else {
                        currentPathEditor.undo();
                    }
                } else if (e.shiftKey) {
                    performRedo();
                } else {
                    performUndo();
                }
            } else if (e.code === "Delete" || e.code === "Backspace") {
                if (isSelectionActive()) {
                    const target = e.target as HTMLElement;
                    if (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable) return;
                    e.preventDefault();
                    deleteSelected(() => redrawEntities());
                }
            } else if (
                e.code === "ArrowUp" || e.code === "ArrowDown" ||
                e.code === "ArrowLeft" || e.code === "ArrowRight"
            ) {
                if (isSelectionActive()) {
                    const target = e.target as HTMLElement;
                    if (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable) return;
                    e.preventDefault();
                    const step = e.shiftKey ? 10 : 1;
                    const dx = e.code === "ArrowLeft" ? -step : e.code === "ArrowRight" ? step : 0;
                    const dy = e.code === "ArrowUp" ? -step : e.code === "ArrowDown" ? step : 0;
                    moveSelectedByKeyboard(dx, dy);
                }
            }
        });
        setTimeout(() => maybeStartTour({ loggedIn: !!currentUser }), 600);

        // Show the drop overlay as soon as a file is dragged anywhere on the page.
        document.addEventListener('dragenter', (e: DragEvent) => {
            if (e.dataTransfer?.types.includes('Files')) isDraggingImage = true;
        });
        document.addEventListener('dragleave', (e: DragEvent) => {
            // relatedTarget is null when the drag leaves the browser window entirely.
            if (!e.relatedTarget) isDraggingImage = false;
        });
        // Capture phase so this always runs before a nested drop handler (e.g. the Quill editor's
        // image drop handler) can stop the event from bubbling back up to document.
        document.addEventListener('drop', () => { isDraggingImage = false; }, true);
    });

    function attachListeners(): void {
        const container = select("#map-container");
        dragFunc = drag()
            .filter((e) => commonState.currentMode === "macro" && !e.button) // Remove ctrlKey
            .on("drag", (e) => {
                if (commonState.currentMode === "macro") macroSidebar!.onDrag(e);
            })
            .on("start", () => {
                if (addingLabel) validateLabel();
                propertiesPanel?.close();
                closeMenu();
            });

        zoomFunc = zoom()
            .filter((e) => commonState.currentMode === "macro" && !e.button)
            .wheelDelta((event) => -event.deltaY * (event.deltaMode === 1 ? 0.05 : event.deltaMode ? 1 : 0.002))
            .on("zoom", (e) => {
                if (commonState.currentMode === "macro") macroSidebar!.onZoom(e);
            })
            .on("start", () => {
                propertiesPanel?.close();
                closeMenu();
            });
        container.call(dragFunc);
        container.call(zoomFunc);
    }

    async function switchMode(newMode: Mode, redrawAfter=true): Promise<void> {
        // if (commonState.currentMode === newMode) return;
        propertiesPanel?.close();
        track('mode_switch', { to: newMode });
        commonState.currentMode = newMode;
        select("#map-container").html("");
        await tick();
        const mapLibreContainer = select("#maplibre-map");
        if (commonState.currentMode === "micro") {
            mapLibreContainer.style("display", "block");
            if (redrawAfter) draw();
        } else {
            mapLibreContainer.style("display", "none");
            macroSidebar!.applyStateAndDraw();
        }
        setTimeout(() => initTooltips(), 0);
    }

    function detachListeners(): void {
        const container = select("#map-container");
        container.on(".drag", null);
        container.on(".zoom", null);
    }

    const freeHandDrawer = new FreehandDrawer();
    async function draw(simplified = false) {
        if (isDrawing) return;
        isDrawing = true;
        hidePopover();
        clearSelection();
        log("draw", simplified);
        const container = select("#map-container");
        container.html("");
        svg = container.select("svg") as unknown as SvgSelection;
        if (svg.empty())
            svg = container
                .append("svg")
                .attr("xmlns", "http://www.w3.org/2000/svg")
                .attr("xmlns:xlink", "http://www.w3.org/1999/xlink")
                .attr("id", "static-svg-map") as unknown as SvgSelection;

        svg.append("defs");
        svg.on("click", onSvgClick);
        svg.on("mousedown", onSvgMouseDown);
        svg.node()?.addEventListener(
            "wheel",
            (e: WheelEvent) => {
                if (commonState.currentMode !== "micro" || isDrawingFreeHand || isDrawingPath || editingPath) return;
                const canvas = document.querySelector("#maplibre-map canvas") as HTMLCanvasElement | null;
                if (!canvas) return;
                e.preventDefault();
                canvas.dispatchEvent(
                    new WheelEvent("wheel", {
                        bubbles: true,
                        cancelable: true,
                        clientX: e.clientX,
                        clientY: e.clientY,
                        deltaX: e.deltaX,
                        deltaY: e.deltaY,
                        deltaZ: e.deltaZ,
                        deltaMode: e.deltaMode,
                        ctrlKey: e.ctrlKey,
                        shiftKey: e.shiftKey,
                        altKey: e.altKey,
                        metaKey: e.metaKey,
                    }),
                );
            },
            { passive: false },
        );

        if (commonState.currentMode === "macro") {
            await macroSidebar!.drawMacroTotal(simplified);
        } else if (commonState.currentMode === "micro") {
            await microSidebar?.drawMicroTotal();
        }

        svg.append("g").attr("id", "points-labels");
        svg.append("g").attr("id", "paths");
        drawAndSetupShapes();
        drawCustomPaths(
            commonState.providedPaths,
            svg,
            appState.projection!,
            commonState.inlineStyles,
            commonState.elementLinks ?? {},
        );
        drawFreeHandShapes(svg, commonState.providedFreeHand, commonState.elementLinks ?? {});
        if (!simplified) {
            applyStyles(commonState.inlineStyles);
            applyGenericLinks();
            if (commonState.elementAnnotations) {
                setupPopoverCursors(svg.node() as SVGSVGElement, commonState.elementAnnotations);
            }
            saveState();
        }
        if (!simplified && commonState.currentMode !== "macro") {
            setTimeout(() => {
                addElementAnnotationListener(svg.node() as SVGSVGElement, commonState.elementAnnotations ?? {});
            }, 600);
        }
        if (!simplified) {
            setTimeout(() => postClipSimple(), 100);
        }
        isDrawing = false;
    }

    function onSvgResize(w: number, h: number) {
        if (commonState.currentMode === "macro") {
            macroState.macroParams.General.width = w;
            macroState.macroParams.General.height = h;
            handleChangeProp(
                new CustomEvent("change", { detail: { prop: "width", value: w } }),
            );
        } else {
            microState.microParams.General.width = w;
            microState.microParams.General.height = h;
        }
        draw();
    }

    async function applyState(state: GlobalState): Promise<void> {
        clearHistory();
        setRestoring(true);
        macroSidebar?.resetTabSelection();
        try {
            Object.assign(commonState, state.stateCommon);
            // Migration: states saved before per-layer glow used zonesFilter (string) + macroParams.firstGlow/secondGlow
            if (state.stateMacro && !state.stateMacro.zonesGlow && (state.stateMacro as any).zonesFilter) {
                const oldFilter: Record<string, string> = (state.stateMacro as any).zonesFilter;
                const oldParams: Record<string, any> = (state.stateMacro as any).macroParams ?? {};
                state.stateMacro.zonesGlow = Object.fromEntries(
                    Object.entries(oldFilter).map(([layer, presetName]) => [
                        layer,
                        { ...defaultGlowParams, ...(oldParams[presetName] ?? {}) },
                    ])
                );
            }
            // Migration: states saved before the glow enabled/disabled toggle default to enabled
            if (state.stateMacro?.zonesGlow) {
                for (const glow of Object.values(state.stateMacro.zonesGlow) as any[]) {
                    if (glow.enabled === undefined) glow.enabled = true;
                }
            }
            Object.assign(macroState, state.stateMacro.macroParams ? state.stateMacro : defaultState.stateMacro);
            if (!macroState.baseCss) macroState.baseCss = defaultState.stateMacro.baseCss;
            Object.assign(microState, state.stateMicro.microParams ? state.stateMicro : defaultState.stateMicro);
            await tick();
            await switchMode(state.stateCommon.currentMode, false);
            if (state.stateCommon.currentMode === "micro") {
                microSidebar?.applyLayerStyles();
                microSidebar?.applyMapPosition();
            }
            changeProjection();
            await updateLayerSimplification();
            draw();
            saveState();
        } finally {
            setRestoring(false);
            // Record initial drawing state as baseline for undo
            saveState();
        }
    }

    function restoreStateFromSave() {
        const savedState = getState();
        // console.log("baseCss", savedState?.stateMacro.baseCss);
        applyState(savedState ?? defaultState);
    }

    function loadProject(e: Event): void {
        // @ts-expect-error
        const file = e.target.files[0];
        const reader = new FileReader();
        reader.addEventListener("load", async () => {
            try {
                const providedState: GlobalState = JSON.parse(reader.result as string);
                await applyState(providedState);
            } catch (e) {
                console.error("Unable to parse provided file. Should be valid JSON.");
            }
        });
        reader.readAsText(file);
    }

    // Handles left-click on the SVG map. Opens style panel for clicked element,
    // handles link/popover/selection as secondary concerns.
    // Note: for selectable entities (shapes/paths/freehand), onSvgMouseDown runs first and
    // calls stopPropagation, so this handler only fires for non-selectable map elements.
    function onSvgClick(e: MouseEvent): void {
        if (e.ctrlKey && commonState.currentMode === 'micro') {
            microSidebar?.queryFeaturesAt(e);
            return;
        }
        if ((e.target as Element).closest("a")) e.preventDefault();
        if (contextualMenu?.opened) {
            closeMenu();
            return;
        }
        if (editingPath || isDrawingFreeHand || isDrawingPath) return;

        // Walk up from clicked element to find the nearest element with an id,
        // then check if it has a popover annotation
        let clickedId: string | null = null;
        let el: Element | null = e.target as Element;
        const svgRoot = document.getElementById("static-svg-map");
        while (el && el !== svgRoot) {
            const id = el.getAttribute("id");
            if (id) {
                clickedId = id;
                break;
            }
            el = el.parentElement;
        }
        if (clickedId && commonState.elementAnnotations?.[clickedId]?.popover) {
            showElementPopover(clickedId, svg.node() as SVGSVGElement, commonState.elementAnnotations ?? {});
            const annotTarget = e.target as Element;
            if (annotTarget.id !== "micro-background") propertiesPanel?.open(annotTarget);
            return;
        }

        let entity = identifyClickedEntity(e.target as Element);
        if (!entity) entity = identifyClickedPath(e);
        if (entity) {
            // Labels are handled by mousedown (edit mode), not click (selection)
            if (entity.type === "shape" && commonState.providedShapes[entity.index]?.text !== undefined) return;
            toggleSelection(entity, e.shiftKey);
        } else {
            if (getActivePopoverId()) hidePopover();
            clearSelection();
            // Open style panel for the clicked element (skip SVG root and micro background)
            let target = e.target as Element;
            // For 3D buildings, redirect from individual wall/roof paths to the building <g>
            target = target.closest("#buildings > g") ?? target;
            // Decorative <use>/<image> elements (e.g. animated path images, glow duplicates)
            // are not selectable entities.
            const targetTag = target.tagName?.toLowerCase();
            if (targetTag === "use" || targetTag === "image") return;
            if (target.id !== "static-svg-map" && target.id !== "micro-background") {
                propertiesPanel?.open(target);
            }
        }
    }

    // Intercepts mousedown on selectable entities before D3's drag handler.
    // For labels: disambiguates click (enter edit) vs drag (move).
    // For non-labels: immediately selects + starts overlay drag.
    // Calls stopPropagation so onSvgClick won't also fire for selectable entities.
    function onSvgMouseDown(e: MouseEvent): void {
        // if (commonState.currentMode !== "macro") return;
        if (e.button !== 0) return;
        if (isDrawingFreeHand || isDrawingPath || editingPath) return;
        const entity = identifyClickedEntity(e.target as Element) ?? identifyClickedPath(e);
        if (!entity) {
            if (commonState.currentMode === "micro" && !isDrawingFreeHand && !isDrawingPath && !editingPath) {
                const canvas = document.querySelector("#maplibre-map canvas") as HTMLCanvasElement | null;
                if (!canvas) return;
                canvas.dispatchEvent(
                    new MouseEvent("mousedown", {
                        bubbles: true,
                        cancelable: true,
                        clientX: e.clientX,
                        clientY: e.clientY,
                        button: e.button,
                        buttons: e.buttons || 1,
                        ctrlKey: e.ctrlKey,
                        shiftKey: e.shiftKey,
                        altKey: e.altKey,
                        metaKey: e.metaKey,
                    }),
                );
                function onDragEnd(ev: MouseEvent) {
                    document.removeEventListener("mouseup", onDragEnd);
                    canvas!.dispatchEvent(
                        new MouseEvent("mouseup", {
                            bubbles: true,
                            cancelable: true,
                            clientX: ev.clientX,
                            clientY: ev.clientY,
                            button: ev.button,
                            buttons: ev.buttons,
                            ctrlKey: ev.ctrlKey,
                            shiftKey: ev.shiftKey,
                            altKey: ev.altKey,
                            metaKey: ev.metaKey,
                        }),
                    );
                }
                document.addEventListener("mouseup", onDragEnd);
            }
            return;
        }
        e.stopPropagation();
        // Labels: disambiguate click vs drag
        if (entity.type === "shape" && commonState.providedShapes[entity.index]?.text !== undefined) {
            const savedEvent = e;
            const savedEntity = entity;
            let moved = false;
            function onMove(ev: MouseEvent) {
                const dx = ev.clientX - savedEvent.clientX;
                const dy = ev.clientY - savedEvent.clientY;
                if (Math.sqrt(dx * dx + dy * dy) > 5) {
                    moved = true;
                    document.removeEventListener("mousemove", onMove);
                    document.removeEventListener("mouseup", onUp);
                    toggleSelection(savedEntity, savedEvent.shiftKey);
                    getOverlay()?.beginDrag(savedEvent);
                    setupLabelOverlayCallbacks(savedEntity.id, savedEntity.index);
                    const draggedText = document.getElementById(savedEntity.id);
                    if (draggedText) propertiesPanel?.open(draggedText);
                }
            }
            function onUp() {
                document.removeEventListener("mousemove", onMove);
                document.removeEventListener("mouseup", onUp);
                if (!moved) {
                    toggleSelection(savedEntity, savedEvent.shiftKey);
                    setupLabelOverlayCallbacks(savedEntity.id, savedEntity.index);
                    const svgText = document.getElementById(savedEntity.id) as SVGTextElement | null;
                    if (svgText) {
                        labelEditor?.enter(savedEntity.id, savedEntity.index, svgText);
                        propertiesPanel?.open(svgText);
                    }
                    if (commonState.elementAnnotations?.[savedEntity.id]?.popover) {
                        showElementPopover(
                            savedEntity.id,
                            svg.node() as SVGSVGElement,
                            commonState.elementAnnotations ?? {},
                        );
                    }
                }
            }
            document.addEventListener("mousemove", onMove);
            document.addEventListener("mouseup", onUp);
            return;
        }
        // Non-labels: select and begin drag tracking.
        // Since stopPropagation prevents onSvgClick from firing, popover display and
        // style panel are handled here via the overlay's onSimpleClick callback.
        toggleSelection(entity, e.shiftKey);
        const eid = entity.id;
        const entityEl = document.getElementById(eid);
        if (entityEl) propertiesPanel?.open(entityEl);
        if (commonState.elementAnnotations?.[entity.id]?.popover) {
            getOverlay()?.setCallbacks({
                onSimpleClick: () => {
                    showElementPopover(eid, svg.node() as SVGSVGElement, commonState.elementAnnotations ?? {});
                },
            });
        }
        getOverlay()?.beginDrag(e);
    }

    let selectedPathIndex = $state<number>(0);

    function startPathEditing(pathElem: SVGPathElement, pathIndex: number): void {
        panelEntityDuringEdit = panelSelectedEntity ?? { type: "path", index: pathIndex, id: `path-${pathIndex}` };
        clearSelection();
        detachListeners();
        editingPath = true;
        selectedPathIndex = pathIndex;
        currentPathEditor = new PathEditor(pathElem, svg.node() as SVGSVGElement, (editedPathElem) => {
            currentPathEditor = null;
            panelEntityDuringEdit = null;
            if (!editedPathElem) {
                commonState.providedPaths.splice(selectedPathIndex, 1);
                propertiesPanel?.close();
            } else {
                const parsed = parseAndUnprojectPath(editedPathElem, appState.projection!);
                commonState.providedPaths[selectedPathIndex].d = parsed;
            }
            attachListeners();
            editingPath = false;
            saveState();
        });
    }

    function handlePanelEditPath(): void {
        const entity = panelSelectedEntity;
        if (!entity || entity.type !== "path") return;
        const pathElem = document.getElementById(entity.id) as unknown as SVGPathElement | null;
        if (!pathElem) return;
        startPathEditing(pathElem, entity.index);
    }

    function handlePanelExitEditPath(): void {
        currentPathEditor?.finish();
    }

    function getPanelPathImage(_id: string) {
        const entity = panelSelectedEntity;
        if (!entity || entity.type !== "path") return null;
        const pathDef = commonState.providedPaths[entity.index];
        if (!pathDef?.image) return null;
        return {
            name: pathDef.image.name,
            duration: pathDef.duration,
            width: pathDef.width,
            height: pathDef.height,
            imageRotate: pathDef.imageRotate,
        };
    }

    async function handlePanelImportPathImage(file: File): Promise<void> {
        const entity = panelSelectedEntity;
        if (!entity || entity.type !== "path") return;
        await setPathImageFromFile(file, entity.index);
    }

    function handlePanelDeletePathImage(): void {
        const entity = panelSelectedEntity;
        if (!entity || entity.type !== "path") return;
        const idx = entity.index;
        delete commonState.providedPaths[idx].image;
        commonState.providedPaths[idx] = commonState.providedPaths[idx];
        drawShapesAndSave();
    }

    function handlePanelChangePathImageDuration(v: number): void {
        const entity = panelSelectedEntity;
        if (!entity || entity.type !== "path") return;
        commonState.providedPaths[entity.index].duration = v;
        drawShapesAndSave();
    }

    function handlePanelChangePathImageWidth(v: number): void {
        const entity = panelSelectedEntity;
        if (!entity || entity.type !== "path") return;
        commonState.providedPaths[entity.index].width = v;
        drawShapesAndSave();
    }

    function handlePanelChangePathImageHeight(v: number): void {
        const entity = panelSelectedEntity;
        if (!entity || entity.type !== "path") return;
        commonState.providedPaths[entity.index].height = v;
        drawShapesAndSave();
    }

    function handlePanelTogglePathImageRotate(v: boolean): void {
        const entity = panelSelectedEntity;
        if (!entity || entity.type !== "path") return;
        commonState.providedPaths[entity.index].imageRotate = v;
        drawShapesAndSave();
    }

    function getPanelPathMarker(_id: string): MarkerName | null {
        const entity = panelSelectedEntity;
        if (!entity || entity.type !== "path") return null;
        return commonState.providedPaths[entity.index]?.marker ?? null;
    }

    function handlePanelChangePathMarker(markerName: MarkerName | "delete"): void {
        const entity = panelSelectedEntity;
        if (!entity || entity.type !== "path") return;
        if (markerName === "delete") delete commonState.providedPaths[entity.index].marker;
        else commonState.providedPaths[entity.index].marker = markerName;
        drawShapesAndSave();
    }

    function getPanelShapePosition(_id: string): { lat: number; lng: number } | null {
        const entity = panelSelectedEntity;
        if (!entity || entity.type !== "shape") return null;
        const shapeDef = commonState.providedShapes[entity.index];
        if (!shapeDef) return null;
        return { lng: shapeDef.pos[0], lat: shapeDef.pos[1] };
    }

    function handlePanelChangeShapePosition(lat: number, lng: number): void {
        const entity = panelSelectedEntity;
        if (!entity || entity.type !== "shape") return;
        const shapeDef = commonState.providedShapes[entity.index];
        if (!shapeDef) return;
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
        const clampedLat = clamp(lat, -90, 90);
        const clampedLng = clamp(lng, -180, 180);
        commonState.providedShapes[entity.index] = { ...shapeDef, pos: [clampedLng, clampedLat] };
        drawAndSetupShapes(); // rebuilds #points-labels from scratch
        // DOM nodes were recreated — re-point the overlay, the panel, and label callbacks
        refreshOverlay();
        const el = document.getElementById(shapeDef.id);
        if (el) propertiesPanel?.open(el);
        if (shapeDef.text !== undefined) setupLabelOverlayCallbacks(shapeDef.id, entity.index);
        saveState();
    }

    function handlePanelDelete(): void {
        deleteSelected(() => redrawEntities());
        propertiesPanel?.close();
    }

    function handlePanelBringToFront(): void {
        const el = propertiesPanel?.getElement();
        if (!el?.id) return;
        // Clear bringtofront from all siblings in the same parent group
        if (el.parentNode) {
            for (const sibling of Array.from(el.parentNode.children)) {
                const sid = sibling.getAttribute("id");
                if (sid && sid !== el.id && commonState.inlineStyles[sid]) {
                    delete commonState.inlineStyles[sid]["bringtofront"];
                }
            }
        }
        el.parentNode?.appendChild(el);
        if (!commonState.inlineStyles[el.id]) commonState.inlineStyles[el.id] = {};
        commonState.inlineStyles[el.id]["bringtofront"] = "true";
        propertiesPanel?.notifyBroughtToFront();
        saveState();
    }

    function handlePanelSaveLink(id: string, url: string): void {
        if (!commonState.elementLinks) commonState.elementLinks = {};
        if (url.trim()) {
            commonState.elementLinks[id] = url.trim();
        } else {
            delete commonState.elementLinks[id];
        }
        drawAndSetupShapes();
        drawCustomPaths(commonState.providedPaths, svg, appState.projection!, commonState.inlineStyles, commonState.elementLinks);
        drawFreeHandShapes(svg, commonState.providedFreeHand, commonState.elementLinks);
        applyInlineStyles();
        applyGenericLinks();
        saveState();
    }

    function handlePanelAddTooltip(id: string): void {
        beginAddAnnotation(id, "tooltip");
    }

    function handlePanelRemoveTooltip(id: string): void {
        removeAnnotation(id, "tooltip");
    }

    function handlePanelAddPopover(id: string): void {
        beginAddAnnotation(id, "popover");
    }

    function handlePanelRemovePopover(id: string): void {
        removeAnnotation(id, "popover");
    }

    async function setPathImageFromFile(file: File, pathIndex: number): Promise<void> {
        let content: string;
        try {
            content = await processUploadedImage(file);
        } catch (err) {
            alert((err as Error).message);
            return;
        }
        const newImage: PathDefImage = { name: file.name, content };
        commonState.providedPaths[pathIndex].image = newImage;
        if (!commonState.providedPaths[pathIndex].duration) {
            commonState.providedPaths[pathIndex].duration = 10;
            commonState.providedPaths[pathIndex].width = 20;
            commonState.providedPaths[pathIndex].height = 10;
        }
        drawShapesAndSave();
    }

    const saveDebounced = debounce(saveState, 200);

    function drawShapesAndSave(): void {
        drawCustomPaths(
            commonState.providedPaths,
            svg,
            appState.projection!,
            commonState.inlineStyles,
            commonState.elementLinks ?? {},
        );
        applyInlineStyles();
        refreshOverlay(); // drawCustomPaths recreates all <path> DOM nodes; re-point any active overlay at the fresh one
        saveState();
    }

    /** Re-render all user entities (shapes, paths, freehand) after a selection operation */
    function redrawEntities(): void {
        drawAndSetupShapes();
        drawCustomPaths(
            commonState.providedPaths,
            svg,
            appState.projection!,
            commonState.inlineStyles,
            commonState.elementLinks ?? {},
        );
        drawFreeHandShapes(svg, commonState.providedFreeHand, commonState.elementLinks ?? {});
        applyStyles(commonState.inlineStyles);
    }

    function restoreStyleState(parsed: Record<string, any>): void {
        if (parsed.baseCss !== undefined && commonState.currentMode === "macro") {
            macroState.baseCss = parsed.baseCss;
            const styleElem = document.getElementById("style-sheet-macro");
            if (!styleElem) return;
            styleElem.innerHTML = macroState.baseCss;
        }
        if (parsed.microLayerDefinitions !== undefined && commonState.currentMode === "micro") {
            microState.microLayerDefinitions = parsed.microLayerDefinitions;
            const svgNode = document.getElementById("static-svg-map") as unknown as SVGSVGElement;
            updateSvgPatterns(svgNode, microState.microLayerDefinitions);
            replaceCssSheetContent(microState.microLayerDefinitions);
        }
    }

    function performUndo(): void {
        const snapshot = undo();
        if (!snapshot) return;
        setRestoring(true);
        try {
            const parsed = JSON.parse(snapshot);
            Object.assign(commonState, parsed);
            commonState.elementLinks = parsed.elementLinks ?? {};
            commonState.elementAnnotations = parsed.elementAnnotations ?? {};
            restoreStyleState(parsed);
            redrawEntities();
            refreshOverlay();
            saveState();
        } finally {
            setRestoring(false);
        }
    }

    function performRedo(): void {
        const snapshot = redo();
        if (!snapshot) return;
        setRestoring(true);
        try {
            const parsed = JSON.parse(snapshot);
            Object.assign(commonState, parsed);
            commonState.elementLinks = parsed.elementLinks ?? {};
            commonState.elementAnnotations = parsed.elementAnnotations ?? {};
            restoreStyleState(parsed);
            redrawEntities();
            refreshOverlay();
            saveState();
        } finally {
            setRestoring(false);
        }
    }

    function handleFontSelected(font: ProvidedFont): void {
        commonState.providedFonts.push(font);
        for (const shape of commonState.providedShapes) {
            if (shape.text !== undefined && !shape.fontManual) {
                if (shape.id in commonState.inlineStyles) {
                    commonState.inlineStyles[shape.id]["font-family"] = font.name;
                } else {
                    commonState.inlineStyles[shape.id] = { "font-family": font.name };
                }
            }
        }
        commonState.lastUsedLabelProps["font-family"] = font.name;
        const prevElId = propertiesPanel?.getElement()?.id;
        drawAndSetupShapes();
        applyStyles(commonState.inlineStyles);
        saveState();
        // drawAndSetupShapes recreates DOM elements; re-open the panel on the new node
        if (prevElId) {
            requestAnimationFrame(() => {
                const newEl = document.getElementById(prevElId);
                if (newEl) propertiesPanel?.open(newEl);
            });
        }
    }

    // ==== Toolbar handlers ====

    // Each drawing/placement tool arms its own map listeners independently, so switching
    // tools mid-action must explicitly cancel whichever one is currently active first —
    // otherwise the previous tool's listeners stay live and both fire on the next map click.
    function cancelActiveTool(): void {
        if (isDrawingPath) cancelDrawPath();
        if (isDrawingFreeHand) stopDrawFreeHand();
        if (pendingPlacement) cancelPlacement();
    }

    function toolDrawCurve(): void {
        cancelActiveTool();
        activeTool = 'curve';
        addPath();
    }

    function toolDrawFreehand(): void {
        if (isDrawingFreeHand) {
            stopDrawFreeHand();
            return;
        }
        cancelActiveTool();
        activeTool = 'freehand';
        drawFreeHand();
    }

    function teardownPlacement(): void {
        if (placementSvgNode) {
            placementSvgNode.removeEventListener('click', onPlacementClick, true);
            placementSvgNode.removeEventListener('mousedown', onPlacementMouseDown, true);
            placementSvgNode = null;
        }
        window.removeEventListener('keydown', onPlacementEscape);
        attachListeners();
    }

    function cancelPlacement(): void {
        teardownPlacement();
        pendingPlacement = null;
        activeTool = null;
    }

    function onPlacementEscape(e: KeyboardEvent): void {
        if (e.key === 'Escape') {
            cancelPlacement();
        }
    }

    function onPlacementMouseDown(e: MouseEvent): void {
        if (e.button !== 0) return;
        e.stopPropagation();
        e.preventDefault();
        const position = appState.projection!.invert!(pointer(e))!;
        const captured = pendingPlacement;
        teardownPlacement();
        pendingPlacement = null;
        activeTool = null;
        if (captured?.kind !== 'shape') return;
        const { id, index } = placeShape(captured.shapeName, position);
        toggleSelection({ type: 'shape', index, id }, false);
        getOverlay()?.beginCreationResize(e, () => {
            const el = document.getElementById(id);
            if (el) propertiesPanel?.open(el);
        });
    }

    function onPlacementClick(e: MouseEvent): void {
        e.stopPropagation();
        e.preventDefault();
        const position = appState.projection!.invert!(pointer(e))!;
        const captured = pendingPlacement;
        teardownPlacement();
        pendingPlacement = null;
        if (captured?.kind === 'label') {
            // showMenu positions the hidden #label-entry textarea at the click point and sets openContextMenuInfo
            showMenu(e);
            addLabel();
            // activeTool will be cleared in validateLabel / closeMenu
        }
    }

    function getViewportCenterPosition(): [number, number] {
        const svgNode = svg.node() as SVGSVGElement;
        const w = svgNode.width.baseVal.value;
        const h = svgNode.height.baseVal.value;
        return appState.projection!.invert!([w / 2, h / 2])!;
    }

    function armPlacement(p: NonNullable<PendingPlacement>): void {
        cancelActiveTool();
        closeMenu();
        clearSelection();
        detachListeners();
        pendingPlacement = p;
        activeTool = p.kind === 'shape' ? 'point' : 'label';
        placementSvgNode = svg.node() as SVGSVGElement;
        if (p.kind === 'shape') {
            placementSvgNode.addEventListener('mousedown', onPlacementMouseDown, true);
        } else {
            placementSvgNode.addEventListener('click', onPlacementClick, true);
        }
        window.addEventListener('keydown', onPlacementEscape);
    }

    function onToolPickShape(shapeName: ShapeName): void {
        armPlacement({ kind: 'shape', shapeName });
    }

    function onToolCustomImage(): void {
        if (!svg?.node() || !appState.projection?.invert) return;
        cancelActiveTool();
        openContextMenuInfo = {
            event: new MouseEvent('click'),
            position: getViewportCenterPosition(),
            target: svg.node() as unknown as SVGPathElement,
        };
        startImportCustomImageShape();
    }

    function onToolAddLabel(): void {
        armPlacement({ kind: 'label' });
    }

    async function onMapDrop(e: DragEvent): Promise<void> {
        isDraggingImage = false;
        e.preventDefault();
        const file = e.dataTransfer?.files[0];
        if (!file) return;
        const isImage = file.type.startsWith('image/') || file.name.endsWith('.svg');
        if (!isImage) return;
        if (!svg?.node() || !appState.projection?.invert) return;
        let content: string;
        try {
            content = await processUploadedImage(file);
        } catch (err) {
            alert((err as Error).message);
            return;
        }
        const position = getViewportCenterPosition();
        const shapeId = `custom-image-${commonState.shapeCount++}`;
        const newIndex = commonState.providedShapes.length;
        commonState.providedShapes.push({
            id: shapeId,
            pos: position,
            scale: 1,
            customImage: { name: file.name, content, width: 30, height: 40 },
        });
        drawAndSetupShapes();
        requestAnimationFrame(() => toggleSelection({ type: 'shape', index: newIndex, id: shapeId }, false));
        saveState();
    }

    // ==== End toolbar handlers ====

    function addPath(): void {
        track('element_add', { type: 'path' });
        closeMenu();
        clearSelection();
        detachListeners();
        isDrawingPath = true;
        isCursorInsideMap = true; // Assume cursor is inside since menu was just clicked
        document.addEventListener("mousemove", updateDrawingTooltip);
        document.addEventListener("mousedown", onPathDrawMouseDown);
        document.addEventListener("mouseup", onPathDrawMouseUp);
        addMapCursorListeners();
        freeHandDrawPath(svg.node() as SVGSVGElement, (finishedElem) => {
            log("finishedElem", finishedElem);
            const d = finishedElem.getAttribute("d");
            if (!d) return;
            cleanupPathDrawListeners();
            removeMapCursorListeners();
            attachListeners();
            const pathIndex = commonState.providedPaths.length;
            const id = `path-${pathIndex}`;
            finishedElem.setAttribute("id", id);
            commonState.providedPaths.push({ d: parseAndUnprojectPath(d, appState.projection!) });
            toggleSelection({ type: 'path', index: pathIndex, id }, false);
            propertiesPanel?.open(finishedElem);
            saveDebounced();
            setTimeout(() => {
                isDrawingPath = false;
                isActivelyDrawingPath = false;
                activeTool = null;
            }, 0);
        });
    }

    function onPathDrawMouseDown(): void {
        isActivelyDrawingPath = true;
    }

    function onPathDrawMouseUp(): void {
        isActivelyDrawingPath = false;
    }

    function cleanupPathDrawListeners(): void {
        document.removeEventListener("mousemove", updateDrawingTooltip);
        document.removeEventListener("mousedown", onPathDrawMouseDown);
        document.removeEventListener("mouseup", onPathDrawMouseUp);
    }

    function cancelDrawPath(): void {
        if (!isDrawingPath) return;
        cancelFreeHandDrawPath();
        cleanupPathDrawListeners();
        removeMapCursorListeners();
        attachListeners();
        isDrawingPath = false;
        isActivelyDrawingPath = false;
        activeTool = null;
    }

    function onMapMouseEnter(): void {
        isCursorInsideMap = true;
    }

    function onMapMouseLeave(): void {
        isCursorInsideMap = false;
    }

    function addMapCursorListeners(): void {
        const mapContent = document.getElementById("map-content");
        if (mapContent) {
            mapContent.addEventListener("mouseenter", onMapMouseEnter);
            mapContent.addEventListener("mouseleave", onMapMouseLeave);
        }
    }

    function removeMapCursorListeners(): void {
        const mapContent = document.getElementById("map-content");
        if (mapContent) {
            mapContent.removeEventListener("mouseenter", onMapMouseEnter);
            mapContent.removeEventListener("mouseleave", onMapMouseLeave);
        }
        isCursorInsideMap = false;
    }

    function updateDrawingTooltip(e: MouseEvent): void {
        if (!drawingTooltip) return;
        drawingTooltip.style.left = e.clientX + 15 + "px";
        drawingTooltip.style.top = e.clientY + 15 + "px";
    }

    function drawFreeHand(): void {
        track('element_add', { type: 'freehand' });
        isDrawingFreeHand = true;
        isCursorInsideMap = true; // Assume cursor is inside since menu was just clicked
        closeMenu();
        clearSelection();
        detachListeners();
        document.addEventListener("mousemove", updateDrawingTooltip);
        freeHandDrawer.start(svg.node() as SVGSVGElement);
        addMapCursorListeners();
    }

    function stopDrawFreeHand(): void {
        if (!isDrawingFreeHand) return;
        document.removeEventListener("mousemove", updateDrawingTooltip);
        removeMapCursorListeners();
        attachListeners();
        isDrawingFreeHand = false;
        activeTool = null;
        const newGroup = freeHandDrawer.stop();
        const paths = newGroup.querySelectorAll("path");
        if (!paths.length) return;

        const unprojected: ParsedPath[] = [];
        paths.forEach((pathElem) => {
            const d = pathElem.getAttribute("d");
            if (!d) return;
            const parsed = parseAndUnprojectPath(d, appState.projection!);
            unprojected.push(parsed);
            log(parsed);
        });
        if (!unprojected.length) return;
        const freehandIndex = commonState.providedFreeHand.length;
        commonState.providedFreeHand.push(unprojected);
        // Remove the drawer's temporary group before re-rendering
        newGroup.remove();
        drawFreeHandShapes(svg, commonState.providedFreeHand, commonState.elementLinks ?? {});
        const freehandId = `freehand-${freehandIndex}`;
        toggleSelection({ type: 'freehand', index: freehandIndex, id: freehandId }, false);
        const el = document.getElementById(freehandId);
        if (el) propertiesPanel?.open(el);
        saveState();
    }

    function applyGenericLinks(): void {
        if (!commonState.elementLinks) return;
        const svgElem = document.getElementById("static-svg-map");
        if (!svgElem) return;

        for (const [elemId, url] of Object.entries(commonState.elementLinks)) {
            const el = svgElem.querySelector(`#${CSS.escape(elemId)}`);
            if (!el) continue;
            if (el.parentElement?.tagName.toLowerCase() === "a") {
                // Already wrapped — just ensure href is current
                (el.parentElement as unknown as SVGAElement).setAttributeNS(
                    "http://www.w3.org/1999/xlink",
                    "xlink:href",
                    url,
                );
                continue;
            }
            const a = createSvgAnchor(url);
            el.parentNode!.insertBefore(a, el);
            a.appendChild(el);
        }
    }

    function closeMenu(): void {
        contextualMenu!.style.display = "none";
        contextualMenu!.opened = false;
        addingLabel = false;
    }

    // Opens the annotation editor modal. Parses existing stored HTML (format: `<div style="...">content</div>`)
    // into separate content + containerStyle for the QuillEditor.
    function beginAddAnnotation(elemId: string, type: "tooltip" | "popover"): void {
        track('element_add', { type: `annotation_${type}` });
        annotationEditingElemId = elemId;
        annotationEditingType = type;
        const existing = commonState.elementAnnotations?.[elemId];
        const existingHtml = type === "tooltip" ? existing?.tooltip : existing?.popover;
        if (existingHtml) {
            const tmp = new DOMParser().parseFromString(existingHtml, "text/html").body
                .firstElementChild as HTMLElement | null;
            annotationEditorContent = tmp?.innerHTML ?? existingHtml;
            // Parse existing inline styles into containerStyle dict
            const style: Record<string, string> = {};
            if (tmp?.style) {
                for (let i = 0; i < tmp.style.length; i++) {
                    const prop = tmp.style[i];
                    style[prop] = tmp.style.getPropertyValue(prop);
                }
            }
            annotationContainerStyle =
                Object.keys(style).length > 0
                    ? style
                    : { ...(commonState.lastUsedAnnotationStyle?.[type] ?? defaultAnnotationStyle) };
            // Existing content already carries its own per-character formatting — don't override it.
            annotationDefaultTextFormat = undefined;
        } else {
            annotationEditorContent = "";
            annotationContainerStyle = { ...(commonState.lastUsedAnnotationStyle?.[type] ?? defaultAnnotationStyle) };
            annotationDefaultTextFormat = commonState.lastUsedAnnotationFont?.[type];
        }
        annotationEditorOpen = true;
        closeMenu();
    }

    function initAnnotationEditor(): void {
        annotationQuillEditor?.focus();
        annotationEditorKeyHandler = (e: KeyboardEvent) => {
            if (e.key === "Enter" && e.ctrlKey) {
                e.preventDefault();
                saveAnnotation();
                annotationEditorOpen = false;
            }
        };
        document.addEventListener("keydown", annotationEditorKeyHandler);
    }

    // Merges QuillEditor content + containerStyle back into a single styled HTML string for storage.
    function saveAnnotation(): void {
        if (!annotationEditingElemId) return;
        if (!commonState.elementAnnotations) commonState.elementAnnotations = {};
        const styleStr = Object.entries(annotationContainerStyle)
            .map(([prop, val]) => `${prop}: ${val}`)
            .join("; ");
        const innerHtml = annotationEditorContent;
        const html = `<div style="${styleStr}">${innerHtml}</div>`;
        const entry = commonState.elementAnnotations[annotationEditingElemId] ?? {};
        if (annotationEditingType === "tooltip") {
            entry.tooltip = html;
        } else {
            entry.popover = html;
            // Apply cursor:pointer immediately without needing a full redraw
            const svgEl = svg.node() as SVGSVGElement | null;
            const el = svgEl?.getElementById(annotationEditingElemId);
            if (el) (el as SVGElement).style.cursor = "pointer";
        }
        commonState.elementAnnotations[annotationEditingElemId] = entry;
        if (!commonState.lastUsedAnnotationStyle) commonState.lastUsedAnnotationStyle = {};
        commonState.lastUsedAnnotationStyle[annotationEditingType] = { ...annotationContainerStyle };
        const textFormat = annotationQuillEditor?.getLastTextFormat();
        if (textFormat && Object.keys(textFormat).length > 0) {
            if (!commonState.lastUsedAnnotationFont) commonState.lastUsedAnnotationFont = {};
            commonState.lastUsedAnnotationFont[annotationEditingType] = textFormat;
        }
        saveState();
    }

    // Removes a tooltip or popover annotation. Cleans up the element entry if both are gone.
    function removeAnnotation(elemId: string, type: "tooltip" | "popover"): void {
        const entry = commonState.elementAnnotations?.[elemId];
        if (!entry) return;
        delete entry[type];
        if (!entry.tooltip && !entry.popover) {
            delete commonState.elementAnnotations![elemId];
        }
        if (type === "popover") {
            hidePopover();
            const el = document.getElementById(elemId);
            if (el) (el as HTMLElement).style.cursor = "";
        }
        saveState();
    }

    async function addLabel(): Promise<void> {
        track('element_add', { type: 'label' });
        addingLabel = true;
        await tick();
        textInput!.focus();
        textInput!.addEventListener("keydown", (event: KeyboardEvent) => {
            if (event.key === "Enter" && !event.shiftKey) {
                validateLabel();
            }
        });
    }

    function validateLabel(): void {
        let created: { id: string; index: number } | null = null;
        if (typedText.length) {
            const labelId = `label-${commonState.shapeCount++}`;
            const labelIndex = commonState.providedShapes.length;
            commonState.providedShapes.push({
                pos: openContextMenuInfo.position,
                scale: 1,
                id: labelId,
                text: typedText,
            });
            commonState.inlineStyles[labelId] = { ...commonState.lastUsedLabelProps };
            typedText = "";
            created = { id: labelId, index: labelIndex };
        }
        activeTool = null;
        drawAndSetupShapes();
        closeMenu();
        if (created) {
            toggleSelection({ type: 'shape', index: created.index, id: created.id }, false);
            const el = document.getElementById(created.id);
            if (el) propertiesPanel?.open(el);
        }
    }

    function setupLabelOverlayCallbacks(labelId: string, labelIndex: number): void {
        getOverlay()?.setCallbacks({
            onDragConfirmed: () => labelEditor?.exit(),
            onSimpleClick: () => {
                if (labelEditor?.isEditing()) {
                    labelEditor.exit();
                    return;
                }
                const svgText = document.getElementById(labelId) as SVGTextElement | null;
                if (svgText) labelEditor?.enter(labelId, labelIndex, svgText);
                if (commonState.elementAnnotations?.[labelId]?.popover) {
                    showElementPopover(labelId, svg.node() as SVGSVGElement, commonState.elementAnnotations ?? {});
                }
            },
        });
    }

    function onLabelCommit(entityIndex: number, newText: string): void {
        commonState.providedShapes[entityIndex].text = newText;
        drawAndSetupShapes();
        refreshOverlay(); // re-point overlay to the newly created DOM element
        const shape = commonState.providedShapes[entityIndex];
        if (shape) setupLabelOverlayCallbacks(shape.id, entityIndex);
        saveState();
    }

    function onLabelCancel(): void {
        // Nothing to do; LabelEditor.exit() already restored SVG text visibility
    }

    function drawAndSetupShapes(): void {
        const container = document.getElementById("points-labels");
        if (!container) return;
        select(container).attr("clip-path", "url(#clipMapBorder)");
        drawShapes(commonState.providedShapes, container, appState.projection!, commonState.elementLinks ?? {});
        applyInlineStyles();
    }

    function showMenu(e: MouseEvent, target: EventTarget | null = null): void {
        openContextMenuInfo = {
            event: e,
            position: appState.projection!.invert!(pointer(e))!,
            target: (target ? target : e.target) as SVGPathElement,
        };
        contextualMenu!.opened = true;
        contextualMenu!.style.display = "block";
        contextualMenu!.style.left = e.pageX + "px";
        contextualMenu!.style.top = e.pageY + "px";
    }

    function placeShape(shapeName: ShapeName, position: [number, number]): { id: string; index: number } {
        track('element_add', { type: 'shape' });
        const shapeId = `${shapeName}-${commonState.shapeCount++}`;
        const lastPoint = [...commonState.providedShapes]
            .reverse()
            .find((s) => s.name !== undefined || s.customImage !== undefined);
        const newIndex = commonState.providedShapes.length;
        commonState.providedShapes.push({
            name: shapeName,
            pos: position,
            scale: 1,
            id: shapeId,
        });
        if (lastPoint && commonState.inlineStyles[lastPoint.id]) {
            commonState.inlineStyles[shapeId] = { ...commonState.inlineStyles[lastPoint.id] };
        }
        drawAndSetupShapes();
        return { id: shapeId, index: newIndex };
    }

    function startImportCustomImageShape(): void {
        closeMenu();
        customImageInput!.click();
    }

    async function onCustomImageShapeSelected(e: Event): Promise<void> {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) return;
        let content: string;
        try {
            content = await processUploadedImage(file);
        } catch (err) {
            alert((err as Error).message);
            return;
        }
        const shapeId = `custom-image-${commonState.shapeCount++}`;
        const newIndex = commonState.providedShapes.length;
        commonState.providedShapes.push({
            id: shapeId,
            pos: openContextMenuInfo.position,
            scale: 1,
            customImage: {
                name: file.name,
                content,
                width: 30,
                height: 40,
            },
        });
        drawAndSetupShapes();
        closeMenu();
        requestAnimationFrame(() => toggleSelection({ type: 'shape', index: newIndex, id: shapeId }, false));
        saveState();
    }

    async function validateExport(options: ExportOptions): Promise<void> {
        track('export_complete', { mode: commonState.currentMode });
        const exportOptions = { ...options, skipAttribution: isSuperUser, hideBrand: isSuperUser || !!page.data.subscription };
        if (commonState.currentMode === "macro") {
            const totalCss = macroSidebar!.computeCss();
            await exportMacro(
                svg,
                macroState,
                commonState.providedFonts,
                true,
                totalCss,
                exportOptions,
                commonState.elementAnnotations,
            );
        } else {
            const microCss = exportStyleSheet("#micro .line")!;
            await exportMicro(
                svg,
                microState,
                commonState.providedFonts,
                microCss,
                exportOptions,
                true,
                commonState.elementAnnotations,
            );
        }
        showExportConfirm = false;
        if (localStorage.getItem(POST_EXPORT_INFO_HIDDEN_KEY) !== "1") {
            showPostExportInfo = true;
        }
    }

    let inlineFontUsed = $state(false);
    function openExportModal() {
        track('export_open', { mode: commonState.currentMode });
        const usedFonts = getUsedInlineFonts(svg.node()!);
        const usedProvidedFonts = commonState.providedFonts.filter((font) => usedFonts.has(font.name));
        inlineFontUsed = usedProvidedFonts.length > 0;
        showExportConfirm = true;
    }

    function onExportSvgClicked() {
        track('export_clicked', { mode: commonState.currentMode });
        hidePopover();
        closeMenu();
        stopDrawFreeHand();
        cancelDrawPath();
        propertiesPanel?.close();

        if (currentUser) {
            openExportModal();
        } else {
            authAfterCallback = openExportModal;
            showAuthModal = true;
        }
    }

    function getProjectJson(): string {
        const baseCss = exportStyleSheet("#outline");
        if (baseCss) macroState.baseCss = baseCss;
        return JSON.stringify({ stateCommon: commonState, stateMacro: macroState, stateMicro: microState });
    }
</script>

<svelte:head>
    {@html `<${""}style> ${commonCss} </${""}style>`}
    {@html `<${""}style> ${cssFonts} .test {} </${""}style>`}
</svelte:head>

<LabelEditor
    bind:this={labelEditor}
    onCommit={onLabelCommit}
    onCancel={onLabelCancel}
    onStyleEdit={(id, _x, _y) => {
        const el = document.getElementById(id);
        if (el) propertiesPanel?.open(el);
    }}
/>

<!-- Floating label-entry textarea, positioned at the click point by showMenu(). -->
<div id="label-entry" class="border rounded" bind:this={contextualMenu} class:hidden={!contextualMenu?.opened || !addingLabel}>
    <textarea bind:this={textInput} bind:value={typedText}> </textarea>
</div>

<Modal
    bind:open={annotationEditorOpen}
    modalWidth="55%"
    onOpened={initAnnotationEditor}
    onClosed={() => {
        annotationEditorOpen = false;
        annotationEditingElemId = null;
        if (annotationEditorKeyHandler) {
            document.removeEventListener("keydown", annotationEditorKeyHandler);
            annotationEditorKeyHandler = null;
        }
    }}
>
    {#snippet header()}
        <div>
            {annotationEditingType === "tooltip" ? "Tooltip" : "Popover"} for <code>{annotationEditingElemId}</code>
        </div>
    {/snippet}
    {#snippet content()}
        <div>
            <QuillEditor
                bind:this={annotationQuillEditor}
                bind:value={annotationEditorContent}
                bind:containerStyle={annotationContainerStyle}
                defaultTextFormat={annotationDefaultTextFormat}
                placeholder=""
                fonts={commonState.providedFonts.map((f) => f.name)}
            />
        </div>
    {/snippet}
    {#snippet footer()}
        <div>
            <button
                class="btn btn-primary btn-sm"
                onclick={() => {
                    saveAnnotation();
                    annotationEditorOpen = false;
                }}>Save</button
            >
        </div>
    {/snippet}
</Modal>

{#if (isDrawingPath && !isActivelyDrawingPath) && isCursorInsideMap}
    <div id="drawing-tooltip" bind:this={drawingTooltip} class="drawing-tooltip">
        Left-click and hold to draw a curve
    </div>
{:else if isDrawingFreeHand && isCursorInsideMap}
    <div id="drawing-tooltip" bind:this={drawingTooltip} class="drawing-tooltip">
        Click and drag to draw. Press Escape or Enter to finish.
    </div>
{/if}

<div class="d-flex align-items-start h-100">
    <aside id="params" class="h-100" inert={editingPath || undefined} onmousedown={() => clearSelection()}>
        <div id="main-panel" class="d-flex flex-column align-items-center pt-4 h-100">
            <div class="mode-selection" role="group">
                <input
                    type="radio"
                    class="btn-check"
                    name="mainModeSwitch"
                    id="switchMacro"
                    onchange={(e) => switchMode(e.currentTarget.value as Mode)}
                    value="macro"
                    autocomplete="off"
                />
                <label class="mode-btn" for="switchMacro" class:active={commonState.currentMode === "macro"}>
                    <img src={macroImg} width="22" height="22" />
                    Macro
                </label>

                <input
                    type="radio"
                    class="btn-check"
                    name="mainModeSwitch"
                    id="switchMicro"
                    autocomplete="off"
                    onchange={(e) => switchMode(e.currentTarget.value as Mode)}
                    value="micro"
                />
                <label class="mode-btn" for="switchMicro" class:active={commonState.currentMode === "micro"}>
                    Detailed
                    <img src={microImg} width="22" height="22" />
                </label>
            </div>
            <div id="main-menu" class="mt-4">
                {#if commonState.currentMode === "macro"}
                    <MacroSidebar bind:this={macroSidebar} {draw} {svg} openPropertiesPanel={(el) => propertiesPanel?.open(el)}></MacroSidebar>
                {:else}
                    <MicroSidebar
                        bind:this={microSidebar}
                        {draw}
                        {svg}
                        onMapMoveStart={() => {
                            propertiesPanel?.close();
                            closeMenu();
                            stopDrawFreeHand();
                        }}
                    ></MicroSidebar>
                {/if}
            </div>
        </div>
    </aside>
    <div class="w-auto d-flex flex-grow-1 flex-column h-100" style="position: relative;">
        <Navbar>
            {#snippet children()}
            <div class="d-flex align-items-center justify-content-between w-100 px-3" inert={editingPath || undefined}>
                <!-- LEFT: drawing tools + map settings -->
                <div class="d-flex align-items-center gap-2">
                    <SettingsStrip {draw} />
                    <ToolStrip
                        {activeTool}
                        onDrawCurve={toolDrawCurve}
                        onDrawFreehand={toolDrawFreehand}
                        onPickShape={onToolPickShape}
                        onCustomImage={onToolCustomImage}
                        onAddLabel={onToolAddLabel}
                        onCancelPlacement={cancelPlacement}
                    />
                </div>
                <!-- RIGHT: tools + user -->
                <div class="d-flex align-items-center gap-2">
                    {#if currentUser}
                        <ProjectDropdown
                            bind:currentProjectName
                            bind:currentProjectId={activeProjectId}
                            {getProjectJson}
                            applyState={async (state) => {
                                await applyState(state);
                                if (commonState.currentMode === "macro") macroSidebar!.applyStateAndDraw();
                            }}
                            onSaveError={(msg) => {
                                serverSyncError = msg;
                            }}
                            isPro={!!page.data.subscription}
                            projectLimit={page.data.subscription ? PRO_PROJECT_LIMIT : FREE_PROJECT_LIMIT}
                            onUpgrade={() => (showUpgradeModal = true)}
                        />
                    {/if}
                    <FontPicker
                        bind:this={fontPicker}
                        onFontSelected={handleFontSelected}
                        existingFontNames={commonState.providedFonts.map((f) => f.name)}
                        hidden={true}
                    />
                    <button id="export-btn" class="navbar-btn navbar-btn-cta" type="button" onclick={onExportSvgClicked}>
                        <Icon fillColor="none" svg={icons["download"]} /> Export
                    </button>
                    {#if currentUser}
                        <div class="dropdown">
                            <button
                                class="navbar-btn navbar-avatar dropdown-toggle"
                                type="button"
                                data-bs-toggle="dropdown"
                                aria-expanded="false"
                                title={currentUser.email}
                            >
                                {(currentUser.name ?? currentUser.email)[0].toUpperCase()}
                            </button>
                            <ul class="dropdown-menu dropdown-menu-end">
                                <li><span class="dropdown-item-text user-email-header">{currentUser.email}</span></li>
                                <li><hr class="dropdown-divider" /></li>
                                {#if page.data.subscription}
                                    <li><span class="dropdown-item-text"><span class="nav-pro-badge">Pro</span></span></li>
                                {:else}
                                    <li><span class="dropdown-item-text nav-exports-left">{page.data.exportsRemaining ?? 0} free export{page.data.exportsRemaining === 1 ? "" : "s"} remaining this month</span></li>
                                    <li>
                                        <button class="dropdown-item" type="button" onclick={() => (showUpgradeModal = true)}>
                                            Upgrade to Pro
                                        </button>
                                    </li>
                                {/if}
                                <li><hr class="dropdown-divider" /></li>
                                <li><a class="dropdown-item" href="/account" target="_blank">Account</a></li>
                                <li>
                                    <button
                                        class="dropdown-item"
                                        type="button"
                                        onclick={async () => {
                                            await signOut();
                                            await invalidateAll();
                                            activeProjectId = null;
                                            currentProjectName = "Project 1";
                                        }}
                                    >
                                        Sign out
                                    </button>
                                </li>
                            </ul>
                        </div>
                    {:else}
                        <button
                            id="sign-in-btn"
                            class="navbar-btn"
                            type="button"
                            onclick={() => {
                                authAfterCallback = undefined;
                                showAuthModal = true;
                            }}
                        >
                            Sign in
                        </button>
                    {/if}
                </div>
            </div>
            {/snippet}
            {#snippet bottomLeft()}
            <div class="bottom-buttons">
                <button
                    id="instructions-btn"
                    class="instructions-btn"
                    type="button"
                    title="Instructions"
                    aria-label="Instructions"
                    onclick={() => (showInstructionsModal = true)}
                >
                    {@html icons["help"]}
                    <span class="btn-label">Help</span>
                </button>
                {#if currentUser}
                    <button
                        id="feedback-btn"
                        class="instructions-btn"
                        type="button"
                        title="Send feedback"
                        aria-label="Send feedback"
                        onclick={() => (showFeedbackModal = true)}
                    >
                        {@html icons["feedback"]}
                        <span class="btn-label">Feedback</span>
                    </button>
                {/if}
            </div>
            {/snippet}
        </Navbar>
        <div class="d-flex flex-grow-1" style="min-height:0;overflow:hidden;">
        <div id="map-area" class="d-flex flex-column justify-content-start align-items-center flex-grow-1 position-relative" style="overflow:hidden;min-width:0;padding-top:clamp(2rem, 6vh, 5rem);"
            onmousedown={(e) => { if (e.target === e.currentTarget) clearSelection(); }}>
            {#if serverSyncError}
                <div
                    class="alert alert-warning mb-0 py-1 px-3 small"
                    role="alert"
                    style="position: absolute; top: 0; left: 50%; transform: translateX(-50%); z-index: 1050; border-radius: 0 0 0.375rem 0.375rem;"
                >
                    {serverSyncError}
                </div>
            {/if}
            <div
                id="map-content"
                class:placing={!!pendingPlacement}
                style="position: relative;"
                ondragover={(e) => { if (e.dataTransfer?.types.includes('Files')) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; } }}
                ondrop={onMapDrop}
            >
                <div id="map-container" class="col mx-4"></div>
                <div id="maplibre-map"></div>
                <ResizeHandles onResize={onSvgResize} />
                {#if isDraggingImage}
                    <div class="drop-overlay">
                        <div class="drop-label">
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                                <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
                            </svg>
                            Drop image to add to map
                        </div>
                    </div>
                {/if}
            </div>
            {#if commonState.currentMode === "micro"}
                <div class="micro-top mt-3 mx-auto d-flex align-items-center justify-content-between">
                    <Geocoding onPlaceSelected={(res) => microSidebar!.onPlaceSelected(res)}></Geocoding>
                </div>
            {/if}
            {#if showMicroHint}
                <div class="micro-hint-banner">
                    <span>Want a detailed town view? Switch to <strong>Detailed mode</strong></span>
                    <div class="micro-hint-actions">
                        <button class="micro-hint-btn micro-hint-btn-primary" onclick={() => switchMode("micro")}>
                            Go to Detailed
                        </button>
                        <button class="micro-hint-btn micro-hint-btn-dismiss" onclick={() => {
                            microHintDismissed = true;
                            localStorage.setItem(MICRO_HINT_DISMISSED_KEY, "1");
                        }}>
                            Dismiss
                        </button>
                    </div>
                </div>
            {/if}
            {#if commonState.currentMode === "micro"}
                <div class="ms-auto me-4 mt-2">
                    Map data:
                    <a href="https://protomaps.com/" target="_blank">Protomaps</a>
                    <a href="https://www.openstreetmap.org/copyright" target="_blank"
                        >&copy; OpenStreetMap contributors</a
                    >
                </div>
            {/if}
        </div>
        <PropertiesPanel
        bind:this={propertiesPanel}
        suppressRing={editingPath || selectionState.selected.length > 0}
        availableFonts={commonState.providedFonts.map((f) => f.name)}
        onOpenFontPicker={() => fontPicker?.openPicker()}
        entityType={panelEntity?.type ?? null}
        entityId={panelEntity?.id ?? null}
        isEditingPath={editingPath}
        onEditPath={handlePanelEditPath}
        onExitEditPath={handlePanelExitEditPath}
        onDelete={handlePanelDelete}
        getPathImage={getPanelPathImage}
        onImportPathImage={handlePanelImportPathImage}
        onDeletePathImage={handlePanelDeletePathImage}
        onChangePathImageDuration={handlePanelChangePathImageDuration}
        onChangePathImageWidth={handlePanelChangePathImageWidth}
        onChangePathImageHeight={handlePanelChangePathImageHeight}
        onTogglePathImageRotate={handlePanelTogglePathImageRotate}
        getPathMarker={getPanelPathMarker}
        onChangePathMarker={handlePanelChangePathMarker}
        getShapePosition={getPanelShapePosition}
        onChangeShapePosition={handlePanelChangeShapePosition}
        onSaveLink={handlePanelSaveLink}
        onAddTooltip={handlePanelAddTooltip}
        onRemoveTooltip={handlePanelRemoveTooltip}
        onAddPopover={handlePanelAddPopover}
        onRemovePopover={handlePanelRemovePopover}
        getAnnotations={getPanelAnnotations}
        getLink={getPanelLink}
        onBringToFront={handlePanelBringToFront}
        isOnTop={(el) => !!el.id && commonState.inlineStyles[el.id]?.['bringtofront'] === 'true'}
        cssRuleFilter={(el, cssSelector) => {
            if (el.closest("foreignObject")) return false;
            if (el.closest(".tooltip-preview") && cssSelector !== "inline") return false;
            if (el.id === "micro-background" && cssSelector === "inline") return false;
            if (cssSelector.includes("#freehand-drawings > g")) return false;
            if (cssSelector.includes("#static-svg-map")) return false;
            if (cssSelector.includes("ssc-")) return false;
            // Micro layer styles are managed by MicroSidebar — hide from style panel
            if (cssSelector.includes("#micro ")) return false;
            if (cssSelector.includes("#buildings .")) return false;
            return true;
        }}
        getCssRuleName={(ruleName, _el) => {
            if (ruleName.includes("#paths") && ruleName.includes("path")) return "All curves";
            if (ruleName.includes(".text")) return "All texts";
            if (ruleName.includes(".shape")) return "All shapes";
            if (ruleName.includes("#freehand-drawings") && ruleName.includes(".freehand")) return "All drawings";
            const isHover = ruleName.includes(":hover") || ruleName.includes(".hovered");
            let finalStr = "";
            if (ruleName.includes(".adm")) finalStr = "Region";
            else if (ruleName.includes(".country")) finalStr = "Countries";
            if (finalStr.length) return isHover ? `${finalStr} hover` : finalStr;
            if (ruleName === "inline") return "This element";
            return ruleName;
        }}
        onStyleChanged={(target, eventType, cssProp, value) => {
            if (commonState.currentMode === "macro") {
                macroSidebar!.onStyleChanged(target as HTMLElement, eventType, cssProp, value);
            } else if (commonState.currentMode === "micro") {
                microSidebar!.onStyleChanged(target as HTMLElement, eventType, cssProp, value);
            }
            requestAnimationFrame(() => refreshOverlay());
        }}
    />
        </div><!-- end below-navbar row -->
    </div><!-- end right column -->
</div><!-- end outer flex -->
<input
    type="file"
    bind:this={customImageInput}
    accept=".png,.jpg,.svg"
    style="display:none"
    onchange={onCustomImageShapeSelected}
/>
<!-- <Modal open={showModal} onClosed={() => onModalClose()}>
    <DataTable slot="content" data={zonesData?.[currentMacroLayerTab]?.["data"]}></DataTable>
</Modal> -->

<ExportModal
    bind:open={showExportConfirm}
    mode={commonState.currentMode}
    svgNode={svg}
    {inlineFontUsed}
    computeMacroCss={() => macroSidebar!.computeCss()}
    onExport={validateExport}
    onClosed={() => (showExportConfirm = false)}
    onUpgrade={() => { showExportConfirm = false; showUpgradeModal = true; }}
    exportsRemaining={page.data.exportsRemaining ?? null}
    hideBrand={isSuperUser || !!page.data.subscription}
/>

<PostExportInfoModal bind:open={showPostExportInfo} onClosed={() => (showPostExportInfo = false)} />
<InstructionsModal
    bind:open={showInstructionsModal}
    onClosed={() => (showInstructionsModal = false)}
    onStartTour={() => {
        showInstructionsModal = false;
        setTimeout(() => startTour({ force: true, loggedIn: !!currentUser }), 300);
    }}
/>
<AuthModal bind:open={showAuthModal} afterAuth={authAfterCallback} />
<UpgradeModal open={showUpgradeModal} onClosed={() => (showUpgradeModal = false)} />
<FeedbackModal bind:open={showFeedbackModal} projectId={activeProjectId} projectName={currentProjectName} />

<Modal
    open={showProjectLoginModal}
    ignoreBackdrop={true}
    keyboard={false}
    onClosed={handleLoginModalClosed}
    modalWidth="480px"
>
    {#snippet header()}<div><h5 class="modal-title">Welcome back</h5></div>{/snippet}
    {#snippet content()}
    <div>
        <div class="mb-4">
            <p class="fw-semibold mb-2">Save your current work</p>
            <div class="d-flex gap-2">
                <input
                    class="form-control form-control-sm"
                    type="text"
                    bind:value={saveDraftName}
                    placeholder="Project name…"
                    onkeydown={(e) => {
                        if (e.key === "Enter") handleSaveDraft();
                    }}
                />
                <button
                    class="btn btn-sm btn-primary text-nowrap"
                    type="button"
                    onclick={handleSaveDraft}
                    disabled={!saveDraftName.trim()}>Save</button
                >
            </div>
        </div>
        <div class="text-muted small text-center mb-3">
            — or open an existing project (current work will be discarded) —
        </div>
        <div class="d-flex flex-column gap-1">
            {#each loginProjects as project (project.id)}
                <button
                    class="btn btn-outline-secondary text-start"
                    type="button"
                    disabled={loadingLoginProjectId !== null}
                    onclick={() => handleSelectLoginProject(project.id)}
                >
                    {#if loadingLoginProjectId === project.id}
                        <span class="spinner-border spinner-border-sm me-2"></span>
                    {/if}
                    {project.name}
                    <span class="text-muted small ms-2">{new Date(project.updatedAt).toLocaleDateString()}</span>
                </button>
            {/each}
        </div>
    </div>
    {/snippet}
</Modal>

<style lang="scss" scoped>
    #params {
        flex: 1 1 400px;
        min-width: 400px;
        max-width: 550px;
        background-color: #ebf0f8;
        border-right: 1px solid #c8d4e3;
        overflow-x: hidden;
        overflow-y: auto;
    }

    #main-panel > .mode-selection {
        display: inline-flex;
        margin-bottom: 20px;
        background: #dce6f5;
        border-radius: 100px;
        padding: 3px;
        gap: 2px;

        .mode-btn {
            padding: 6px 18px;
            border: none;
            border-radius: 100px;
            font-size: 14px;
            font-weight: 500;
            color: #506784;
            background: transparent;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 7px;
            transition:
                background 0.18s ease,
                color 0.18s ease,
                box-shadow 0.18s ease;

            img {
                border-radius: 3px;
                opacity: 0.6;
                transition: opacity 0.18s;
            }

            &.active {
                background: white;
                color: #2a3d5c;
                box-shadow: 0 1px 4px rgba(0, 0, 0, 0.14);
                img {
                    opacity: 1;
                }
            }
        }
    }

    #map-container {
        margin: 0 auto;
        flex: 0 0 auto;
        position: relative;
        z-index: 1;
    }

    #map-content.placing,
    #map-content.placing :global(svg) {
        cursor: crosshair;
    }

    .drop-overlay {
        position: absolute;
        inset: 0;
        z-index: 200;
        background: rgba(74, 127, 193, 0.1);
        border: 2px dashed #4a7fc1;
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        pointer-events: none;
    }

    .drop-label {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 10px;
        padding: 20px 32px;
        background: rgba(255, 255, 255, 0.9);
        border: 1.5px dashed #4a7fc1;
        border-radius: 10px;
        color: #2a5fa8;
        font-size: 14px;
        font-weight: 500;
    }

    .micro-hint-banner {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 12px;
        margin-top: 8px;
        padding: 8px 16px;
        background: #f0f6ff;
        border: 1px solid #c2d9f8;
        border-radius: 8px;
        font-size: 13px;
        color: #2a5fa8;
    }

    .micro-hint-actions {
        display: flex;
        gap: 6px;
    }

    .micro-hint-btn {
        border: none;
        border-radius: 5px;
        padding: 4px 10px;
        font-size: 12px;
        cursor: pointer;
        font-weight: 500;
    }

    .micro-hint-btn-primary {
        background: #2a5fa8;
        color: white;
        &:hover { background: #1e4a8a; }
    }

    .micro-hint-btn-dismiss {
        background: transparent;
        color: #6b7280;
        border: 1px solid #d1d5db;
        &:hover { background: #f3f4f6; }
    }

    .drawing-tooltip {
        position: fixed;
        background: rgba(0, 0, 0, 0.75);
        color: white;
        padding: 6px 10px;
        border-radius: 4px;
        font-size: 12px;
        pointer-events: none;
        z-index: 9999;
        white-space: nowrap;
    }


    :global(.bottom-buttons) {
        position: absolute;
        bottom: 0;
        left: 0.75rem;
        display: flex;
        flex-direction: row;
        border: 1px solid #d0d8e4;
        border-bottom: none;
        border-radius: 8px 8px 0 0;
        background: #f4f7fb;
        overflow: hidden;
        z-index: 10;
    }
    :global(.instructions-btn) {
        background: none;
        border: none;
        border-right: 1px solid #d0d8e4;
        cursor: pointer;
        padding: 0.35rem 0.75rem;
        height: auto;
        display: flex;
        align-items: center;
        gap: 0.35rem;
        color: #5f5f5f;
        transition: background 0.2s, color 0.2s;
    }
    :global(.instructions-btn:last-child) {
        border-right: none;
    }
    :global(.instructions-btn > svg) {
        fill: #5f5f5f;
        max-width: 1rem;
        flex-shrink: 0;
        transition: fill 0.2s;
    }
    :global(.instructions-btn:hover) {
        background: #e8eef6;
        color: #1a1a1a;
    }
    :global(.instructions-btn:hover > svg) {
        fill: #1a1a1a;
    }
    :global(.btn-label) {
        font-size: 0.72rem;
        font-weight: 500;
        white-space: nowrap;
    }
</style>
