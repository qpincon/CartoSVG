
<script>
    import { createEventDispatcher } from "svelte";

    import RangeInput from "./RangeInput.svelte";
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
    };
    export let categorical = false;

    // dispatch event on each change
    function sendChange(e) {
        dispatch("change", {});
    }
</script>

<form on:change={sendChange}>
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
    {#if definition.direction === 'h' && categorical}
        <RangeInput
            title="Max legend width"
            bind:value={definition.maxWidth}
            min="50"
            max="500"
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
    <div class="row g-3 align-items-center">
        <div class="col-auto">
            <label for="legendTitle" class="col-form-label">Legend title</label>
        </div>
        <div class="col-auto">
            <input
                type="text"
                id="legendTitle"
                class="form-control"
                bind:value={definition.title}
            />
        </div>
    </div>
</form>
