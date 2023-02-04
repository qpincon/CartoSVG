<script>
    import Icon from "./Icon.svelte";
    import ColorPicker from "./ColorPicker.svelte";
    import addIcon from "../assets/img/add.svg?inline";
    import { debounce } from 'lodash-es';

    export let customCategoricalPalette = [];
    export let onChange = () => {};

    $:_onChange = debounce(onChange, 500);
    let colorPickers = [];

    let hoveringColor = false;
    let dragStartIndex = null;
    function dropColor(event, target) {
        event.dataTransfer.dropEffect = "move";
        const newList = customCategoricalPalette;

        if (dragStartIndex < target) {
            newList.splice(target + 1, 0, newList[dragStartIndex]);
            newList.splice(dragStartIndex, 1);
        } else {
            newList.splice(target, 0, newList[dragStartIndex]);
            newList.splice(dragStartIndex + 1, 1);
        }
        customCategoricalPalette = newList;
        hoveringColor = null;
        onChange();
    }

    function dragStartColor(event, i) {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.dropEffect = "move";
        dragStartIndex = i;
    }

</script>

<span> Tip: it is possible to re-order dragging and dropping the colors.</span>
<div class="custom-palette-menu d-flex flex-wrap">
    {#each customCategoricalPalette as color, i}
        <div
            class="position-relative d-flex flex-column justify-content-center p-4 m-2 color-container border rounded-3"
            role="button"
            draggable="true"
            on:dragstart={(event) => dragStartColor(event, i)}
            on:drop|preventDefault={(event) => dropColor(event, i)}
            ondragover="return false"
            class:is-hovered-color={hoveringColor === i}
            on:dragenter={() => (hoveringColor = i)}
        >
            <span
                class="close-btn"
                on:click={() => {
                    customCategoricalPalette.splice(i, 1);
                    customCategoricalPalette = customCategoricalPalette;
                    _onChange();
                }}>✕</span
            >
            <div
                class="border border border-primary rounded-1 color-preview"
                style={`background-color: ${color};`}
                on:click={(e) => {
                    colorPickers[i].open();
                }}
            >
                <ColorPicker
                    bind:this={colorPickers[i]}
                    value={color}
                    onChange={(c) => {
                        customCategoricalPalette[i] = c;
                        _onChange();
                    }}
                />
            </div>
            <span> {color} </span>
        </div>
    {/each}
    <div
        class="add-color d-flex align-items-center"
        role="button"
        on:click={() => {
            customCategoricalPalette.push("#aaaaaa");
            customCategoricalPalette = customCategoricalPalette;
            _onChange();
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
