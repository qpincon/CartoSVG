<script lang="ts">
    import * as shapes from '../svg/shapeDefs';
    import { shapeViewBoxes } from '../svg/shapeDefs';
    import type { ShapeName } from '../types';

    interface Props {
        activeTool: null | 'curve' | 'freehand' | 'point' | 'label';
        curveMode: 'pen' | 'freehand';
        onDrawCurve: () => void;
        onPickCurveMode: (mode: 'pen' | 'freehand') => void;
        onDrawFreehand: () => void;
        onPickShape: (shapeName: ShapeName) => void;
        onCustomImage: () => void;
        onAddLabel: () => void;
        onCancelPlacement: () => void;
    }
    let { activeTool, curveMode, onDrawCurve, onPickCurveMode, onDrawFreehand, onPickShape, onCustomImage, onAddLabel, onCancelPlacement }: Props = $props();

    let shapePickerOpen = $state(false);
    let curveMenuOpen = $state(false);
    let curveMenuTop = $state(0);
    let curveMenuLeft = $state(0);
    let pickerTop = $state(0);
    let pickerLeft = $state(0);

    function openShapePicker(e: MouseEvent) {
        e.stopPropagation();
        if (activeTool === 'point') {
            onCancelPlacement();
            return;
        }
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        pickerTop = rect.bottom + 4;
        pickerLeft = rect.left;
        curveMenuOpen = false;
        shapePickerOpen = !shapePickerOpen;
    }

    function onLabelButtonClick(): void {
        if (activeTool === 'label') {
            onCancelPlacement();
            return;
        }
        onAddLabel();
    }

    function pickShape(name: ShapeName) {
        shapePickerOpen = false;
        onPickShape(name);
    }

    function pickCustomImage() {
        shapePickerOpen = false;
        onCustomImage();
    }

    function closeShapePicker() {
        shapePickerOpen = false;
        curveMenuOpen = false;
    }

    function openCurveMenu(e: MouseEvent) {
        e.stopPropagation();
        const rect = (e.currentTarget as HTMLElement).parentElement!.getBoundingClientRect();
        curveMenuTop = rect.bottom + 4;
        curveMenuLeft = rect.left;
        shapePickerOpen = false;
        curveMenuOpen = !curveMenuOpen;
    }

    function pickCurveMode(mode: 'pen' | 'freehand') {
        curveMenuOpen = false;
        onPickCurveMode(mode);
    }
</script>

<svelte:document onclick={closeShapePicker} />

<div class="tool-strip" id="tool-strip">
    <div class="split-btn">
        <button
            class="tool-btn split-main"
            class:active={activeTool === 'curve'}
            onclick={onDrawCurve}
            title={curveMode === 'pen'
                ? "Draw a curve point by point. Click to place a point, drag to curve, Enter to finish."
                : "Draw a smooth curve. Click and drag on the map."}
        >
            {#if curveMode === 'pen'}
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M7 1 L11 6 L7 13 L3 6 Z M7 8 L7 13"/>
                    <circle cx="7" cy="6.5" r="1" fill="currentColor"/>
                </svg>
                Pen
            {:else}
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">
                    <path d="M1 12 C3 4, 7 1, 13 3"/>
                </svg>
                Curve
            {/if}
        </button>
        <button
            class="tool-btn split-chevron"
            class:active={activeTool === 'curve'}
            onclick={openCurveMenu}
            title="Choose how to draw curves"
            aria-label="Choose how to draw curves"
        >
            <svg class="chevron" class:open={curveMenuOpen} width="8" height="8" viewBox="0 0 10 10" fill="currentColor">
                <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
        </button>
    </div>

    <!-- Freehand tool hidden for now (niche use case); restore this button to re-enable.
    <button
        class="tool-btn"
        class:active={activeTool === 'freehand'}
        onclick={onDrawFreehand}
        title="Draw freehand. Click and drag to paint a stroke."
    >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
            <path d="M1 10 Q3 2 6 6 Q9 10 12 3"/>
        </svg>
        Freehand
    </button>
    -->

    <button
        class="tool-btn"
        class:active={activeTool === 'point'}
        onclick={openShapePicker}
        title="Add a point/icon. Pick a shape then click the map to place it."
    >
        <svg width="14" height="14" viewBox="-9 -22 18 23" fill="currentColor">
            {@html shapes.location}
        </svg>
        Point
        <svg class="chevron" class:open={shapePickerOpen} width="8" height="8" viewBox="0 0 10 10" fill="currentColor">
            <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
    </button>

    <button
        class="tool-btn"
        class:active={activeTool === 'label'}
        onclick={onLabelButtonClick}
        title="Add a text label. Click the map to place it."
    >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
            <text x="1" y="12" font-size="12" font-family="sans-serif" font-weight="700">T</text>
        </svg>
        Label
    </button>
</div>

{#if curveMenuOpen}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
        class="curve-menu"
        style="top: {curveMenuTop}px; left: {curveMenuLeft}px;"
        onclick={(e) => e.stopPropagation()}
        onkeydown={() => {}}
        role="menu"
    >
        <button class="shape-option" class:selected={curveMode === 'pen'} onclick={() => pickCurveMode('pen')}>
            <strong>Pen</strong> — click to place points, drag to curve
        </button>
        <button class="shape-option" class:selected={curveMode === 'freehand'} onclick={() => pickCurveMode('freehand')}>
            <strong>Freehand</strong> — click and drag to draw a stroke
        </button>
    </div>
{/if}

{#if shapePickerOpen}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
        class="shape-picker"
        style="top: {pickerTop}px; left: {pickerLeft}px;"
        onclick={(e) => e.stopPropagation()}
        onkeydown={() => {}}
        role="menu"
    >
        {#each Object.entries(shapes).filter(([k]) => k in shapeViewBoxes) as [shapeName, shapeSvg] (shapeName)}
            <button class="shape-option" onclick={() => pickShape(shapeName as ShapeName)}>
                <svg width="20" height="20" viewBox={shapeViewBoxes[shapeName]} fill="currentColor">
                    {@html shapeSvg}
                </svg>
                {shapeName}
            </button>
        {/each}
        <button class="shape-option custom-image-option" onclick={pickCustomImage}>
            Custom image…
        </button>
    </div>
{/if}

<style lang="scss">
.tool-strip {
    display: flex;
    align-items: center;
    gap: 4px;
}

.tool-btn {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 4px 10px;
    background: white;
    border: 1px solid #c8d4e3;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 500;
    color: #506784;
    cursor: pointer;
    white-space: nowrap;
    transition: box-shadow 0.12s, border-color 0.12s, background 0.12s, color 0.12s;

    svg {
        flex-shrink: 0;
    }

    &:hover {
        border-color: #9ab0ca;
        box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
        color: #2a3d5c;
    }

    &.active {
        background: #e8f0fb;
        border-color: #4a7fc1;
        color: #1e4d8c;
        box-shadow: inset 0 1px 3px rgba(74, 127, 193, 0.18);
    }
}

.split-btn {
    display: inline-flex;

    .split-main {
        border-top-right-radius: 0;
        border-bottom-right-radius: 0;
    }
    .split-chevron {
        padding: 4px 6px;
        border-left: none;
        border-top-left-radius: 0;
        border-bottom-left-radius: 0;
    }
}

.curve-menu {
    position: fixed;
    z-index: 1100;
    background: white;
    border: 1px solid #c8d4e3;
    border-radius: 8px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
    padding: 6px;
    display: flex;
    flex-direction: column;
    gap: 2px;

    .shape-option.selected {
        background: #e8f0fb;
        border-color: #4a7fc1;
    }
}

.chevron {
    opacity: 0.5;
    transition: transform 0.12s;
    &.open { transform: rotate(180deg); }
}

.shape-picker {
    position: fixed;
    z-index: 1100;
    background: white;
    border: 1px solid #c8d4e3;
    border-radius: 8px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
    padding: 6px;
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 2px;
    min-width: 220px;
}

.shape-option {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 5px 8px;
    background: none;
    border: 1px solid transparent;
    border-radius: 5px;
    font-size: 12px;
    color: #3d5166;
    cursor: pointer;
    white-space: nowrap;
    transition: background 0.1s, border-color 0.1s;

    &:hover {
        background: #eef3fa;
        border-color: #c0d0e4;
    }
}

.custom-image-option {
    grid-column: 1 / -1;
    border-top: 1px solid #e8eef6;
    margin-top: 2px;
    padding-top: 7px;
}
</style>
