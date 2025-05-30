<script lang="ts">
    import Icon from "./Icon.svelte";
    import ColorPicker from "./ColorPicker.svelte";
    import addIcon from "../assets/img/add.svg?raw";
    import { debounce } from "lodash-es";
    import type { Color } from "src/types";

    export let customCategoricalPalette: string[] = [];
    export let onChange: (force?: boolean) => void = () => {};
    export let mapping: Record<string, Set<string>> = {};

    function _onChange(force?: boolean): void {
        onChange(force);
    }

    $: _onChangeDebounced = debounce(_onChange, 300);
    let colorPickers: ColorPicker[] = [];

    let hoveringColor: number | null = null;
    let dragStartIndex: number | null = null;

    function dropColor(event: DragEvent, target: number): void {
        event.dataTransfer!.dropEffect = "move";
        const newList = [...customCategoricalPalette];

        if (dragStartIndex !== null) {
            if (dragStartIndex < target) {
                newList.splice(target + 1, 0, newList[dragStartIndex]);
                newList.splice(dragStartIndex, 1);
            } else {
                newList.splice(target, 0, newList[dragStartIndex]);
                newList.splice(dragStartIndex + 1, 1);
            }
            customCategoricalPalette = newList;
            hoveringColor = null;
            _onChange(true);
        }
    }

    function dragStartColor(event: DragEvent, i: number): void {
        event.dataTransfer!.effectAllowed = "move";
        event.dataTransfer!.dropEffect = "move";
        dragStartIndex = i;
    }

    function findMatchedValues(color: string): string | null {
        if (!(color in mapping)) return null;
        return [...mapping[color]].join(", ");
    }

    function getColors(x: Record<string, Set<string>>, y: string[]): string[] {
        return customCategoricalPalette;
    }
</script>

<span> Tip: it is possible to re-order dragging and dropping the colors.</span>
<div class="custom-palette-menu d-flex flex-wrap">
    {#each getColors(mapping, customCategoricalPalette) as color, i}
        <div
            class="position-relative d-flex flex-column justify-content-center p-4 m-2 color-container border rounded-3"
            role="button"
            draggable="true"
            on:dragstart={(event) => dragStartColor(event, i)}
            on:drop|preventDefault={(event) => dropColor(event, i)}
            on:dragover={() => false}
            class:is-hovered-color={hoveringColor === i}
            on:dragenter={() => (hoveringColor = i)}
        >
            <span
                class="close-btn"
                on:click={() => {
                    customCategoricalPalette.splice(i, 1);
                    customCategoricalPalette = customCategoricalPalette;
                    _onChangeDebounced(true);
                }}>✕</span
            >
            <div
                class="border border border-primary rounded-1 color-preview"
                style={`background-color: ${color};`}
                on:click={(e: MouseEvent) => {
                    colorPickers[i].open();
                }}
            >
                <ColorPicker
                    bind:this={colorPickers[i]}
                    value={color as Color}
                    onChange={(c: string) => {
                        customCategoricalPalette[i] = c;
                        _onChangeDebounced();
                    }}
                />
            </div>
            <span> {color} </span>
            <span> {findMatchedValues(color) ?? ""}</span>
        </div>
    {/each}
    <div
        class="add-color d-flex align-items-center"
        role="button"
        on:click={() => {
            customCategoricalPalette.push("#aaaaaa");
            customCategoricalPalette = customCategoricalPalette;
            _onChangeDebounced(true);
        }}
    >
        <Icon width="3rem" height="3rem" fillColor="none" svg={addIcon} />
    </div>
</div>

<style>
    .color-preview {
        width: 5rem;
        height: 5rem;
    }
    .add-color {
        height: 10rem;
    }
    .custom-palette-menu {
        height: max-content;
        padding-bottom: 300px;
    }
    .color-container {
        height: max-content;
    }
    .is-hovered-color {
        background-color: #d8d8d8;
    }
    .close-btn {
        position: absolute;
        top: 3px;
        right: 5px;
        color: #808080;
    }
</style>
