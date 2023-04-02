<script>
    import "bootstrap/js/dist/collapse";
    import { createEventDispatcher } from "svelte";

    import ColorPickerPreview from "./ColorPickerPreview.svelte";
    import RangeInput from "./RangeInput.svelte";
    import { camelCaseToSentence } from "../util/common";
    export let sections;
    export let paramDefs;
    export let level = 0;
    export let helpParams = {};
    export let otherParams = {};

    const dispatch = createEventDispatcher();

    function propChanged(prop, value) {
        const payload = { prop, value };
        dispatch("change", payload);
    }

    function getLabel(key) {
        const displayedKey = otherParams[key]?.rename || key;
        return camelCaseToSentence(displayedKey);
    }

    $: padding = level === 0 ? 0 : 4;
</script>

<div class="accordion" style="padding:{padding}px 0 0  {padding}px;">
    {#each Object.entries(sections) as [key, value], i (key)}
        {@const isObject = typeof value === "object"}
        <div class="accordion-item" class:noborder={!isObject}>
            {#if isObject}
                <h3 class="accordion-header">
                    <button
                        class="accordion-button fs-5"
                        type="button"
                        data-bs-toggle="collapse"
                        data-bs-target={`#panel-${key}-collapse`}
                    >
                        <span> {camelCaseToSentence(key)} </span>
                        {#if key in helpParams}
                            <span
                                class="help-tooltip fs-6 float-end"
                                data-bs-toggle="tooltip"
                                data-bs-title={helpParams[key]}>?</span>
                        {/if}
                    </button>
                </h3>
                <div
                    id={`panel-${key}-collapse`}
                    class="accordion-collapse collapse"
                    class:show={level === 0 && i < 3}
                >
                    <div
                        class="accordion-body"
                        style="border-left: solid {2 *
                            level}px var(--bs-accordion-active-bg);"
                    >
                        <svelte:self
                            on:change
                            sections={sections[key]}
                            {paramDefs}
                            {helpParams}
                            {otherParams}
                            level={level + 1}
                        />
                    </div>
                </div>
            {:else if otherParams[key]?.disabled !== true}
                {#if key in paramDefs}
                    {#if paramDefs[key].type == "range"}
                        <RangeInput
                            title={getLabel(key)}
                            helpText={helpParams[key]}
                            id={`form-${key}`}
                            value={sections[key]}
                            min={paramDefs[key].min}
                            max={paramDefs[key].max}
                            step={paramDefs[key].step || 1}
                            onChange={(val) => {
                                sections[key] = val;
                                propChanged(key, val);
                                sections = sections;
                            }}
                        />
                        {:else if paramDefs[key].type == "select"}
                        <div class="row">
                            <label class="col-4 col-form-label" for={`form-${key}`}>{getLabel(key)}</label>
                            <select
                                id={`form-${key}`}
                                class="form-select form-select-sm me-4 col"
                                bind:value={sections[key]}
                                on:change={(e) =>
                                    propChanged(key, e.target.value)}
                            >
                                {#each paramDefs[key].choices as opt}
                                    <option value={opt}> { camelCaseToSentence(opt) } </option>
                                {/each}
                            </select>
                        </div>
                    {/if}
                {:else if typeof sections[key] === "boolean"}
                    <div class="input-type form-check form-switch">
                        <input
                            type="checkbox"
                            role="switch"
                            class="form-check-input"
                            id={`form-${key}`}
                            bind:checked={sections[key]}
                            on:change={(e) =>
                                propChanged(key, e.target.checked)}
                        />
                        <label for={`form-${key}`} class="form-check-label">
                            {camelCaseToSentence(key)}
                            {#if key in helpParams}
                                <span
                                    class="help-tooltip fs-6 float-end"
                                    data-bs-toggle="tooltip"
                                    data-bs-title={helpParams[key]}>?</span
                                >
                            {/if}
                        </label>
                    </div>
                {:else if key.toLowerCase().includes("color")}
                    <ColorPickerPreview
                        id={`form-${key}`}
                        popup="right"
                        title={camelCaseToSentence(key)}
                        value={sections[key]}
                        onChange={(col) => {
                            sections[key] = col;
                            propChanged(key, col);
                            sections = sections;
                        }}
                    />
                {:else}
                    <div class="input-type">
                        <label for={`form-${key}`} class="form-label">
                            {camelCaseToSentence(key)}
                        </label>
                        <input
                            type="number"
                            class="form-control"
                            id={`form-${key}`}
                            bind:value={sections[key]}
                            on:change={(e) =>
                                propChanged(key, parseFloat(e.target.value))}
                        />
                    </div>
                {/if}
            {/if}
        </div>
    {/each}
</div>
