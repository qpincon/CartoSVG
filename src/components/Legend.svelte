<script>
    import { createEventDispatcher } from "svelte";

    import RangeInput from "./RangeInput.svelte";
    import ColorPickerPreview from "./ColorPickerPreview.svelte";
    const dispatch = createEventDispatcher();

    export let definition = {
        x: 0,
        y: 0,
        lineWidth: 100,
        rectWidth: 30,
        rectHeight: 30,
        significantDigits: 3,
        maxWidth: 200,
        direction: "v",
        title: "Hello",
        labelOnLeft: false,
        noData: {
            active: false,
            manual: false,
            text: "N/A",
            color: "#AAAAAA",
        },
    };
    export let categorical = false;

    // dispatch event on each change
    function sendChange(e) {
        const id = e.target.getAttribute("id");
        if (id === "vhSwitchV") {
            definition.rectHeight = definition.rectWidth = 30;
        } else if (id === "vhSwitchH" && !categorical) {
            definition.rectHeight = 20;
            definition.rectWidth = 70;
        }
        dispatch("change", {});
    }
</script>

<form on:change={sendChange} class="m-2">
    <div class="d-flex align-items-center">
        <div class="btn-group" role="group">
            <input
                type="radio"
                class="btn-check"
                name="vhSwitchGroup"
                id="vhSwitchH"
                bind:group={definition.direction}
                value="h"
                autocomplete="off"
            />
            <label class="btn btn-outline-primary" for="vhSwitchH">Horizontal</label
            >
            <input
                type="radio"
                class="btn-check"
                name="vhSwitchGroup"
                id="vhSwitchV"
                autocomplete="off"
                bind:group={definition.direction}
                value="v"
            />
            <label class="btn btn-outline-primary" for="vhSwitchV">Vertical</label>
        </div>
        {#if categorical || definition.direction === 'v'}
            <div class="mx-2 form-check">
                <input
                    type="checkbox" class="form-check-input" id='labelOnLeft'
                    bind:checked={definition.labelOnLeft}
                />
                <label for='labelOnLeft' class="form-check-label"> Label on left </label>
            </div>
        {/if}
    </div>
    {#if definition.direction === "h" && categorical}
        <RangeInput
            title="Max legend width"
            bind:value={definition.maxWidth}
            min="50"
            max="800"
            step="10"
        />
    {/if}
    {#if !categorical}
        <RangeInput
            title="Significant digits"
            bind:value={definition.significantDigits}
        />
    {/if}
    <RangeInput
        title="Legend color width"
        bind:value={definition.rectWidth}
        min="10"
        max="100"
    />
    <RangeInput
        title="Legend color height"
        bind:value={definition.rectHeight}
        min="10"
        max="100"
    />
    <div class="mx-2 form-check form-switch">
        <input
            type="checkbox" role="switch" class="form-check-input" id='noDataActive'
            bind:checked={definition.noData.active}
            on:change={() => definition.noData.manual = true}
        />
        <label for='noDataActive' class="form-check-label"> No data in legend </label>
    </div>
    {#if definition.noData.active}
        <div class="d-flex">
            <ColorPickerPreview
                id="nodatapicker"
                popup="top"
                title="No data color"
                value={definition.noData.color}
                onChange={(col) => {
                    definition.noData.color = col;
                    dispatch("change", {});
                }}
            />
            <div class="form-floating ms-3">
                <input
                    type="text"
                    class="form-control"
                    id="nodatatext"
                    placeholder="N/A"
                    bind:value={definition.noData.text}
                />
                <label for="nodatatext">No data text</label>
            </div>
        </div>
    {/if}
</form>
