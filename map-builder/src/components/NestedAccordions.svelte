<script>
    import "bootstrap/js/dist/collapse";
    import { createEventDispatcher } from 'svelte';

    import ColorPicker from './ColorPicker';
    let pickers = {};
    import ColorPickerPreview from "./ColorPickerPreview.svelte";
    import { camelCaseToSentence } from "../util/common";
    export let sections;
    export let paramDefs;
    export let level = 0;
    export let helpParams = {};

    const dispatch = createEventDispatcher();

	function propChanged(prop, value) {
        const payload = { prop, value };
		dispatch('change', payload);
	}

    $: padding = level === 0 ? 0 : 4;
</script>

<div class="accordion" style="padding:{padding}px 0 0  {padding}px;">
    {#each Object.entries(sections) as [key, value], i (key)}
        {@const isObject = typeof value === "object"}
        <div class="accordion-item" class:noborder={!isObject}>
            {#if isObject}
                <h2 class="accordion-header">
                    <button
                        class="accordion-button fs-4"
                        type="button"
                        data-bs-toggle="collapse"
                        data-bs-target={`#panel-${key}-collapse`}
                    >
                        <span> {camelCaseToSentence(key)} </span>
                        {#if key in helpParams}
                            <span class="help-tooltip fs-6 float-end" data-bs-toggle="tooltip" data-bs-title={helpParams[key]}>?</span>
                        {/if}
                    </button>
                </h2>
                <div
                    id={`panel-${key}-collapse`}
                    class="accordion-collapse collapse"
                    class:show={level === 0 && i < 3}
                >
                    <div class="accordion-body" style="border-left: solid {2 * level}px var(--bs-accordion-active-bg);">
                        <svelte:self on:change sections={sections[key]} {paramDefs} {helpParams} level={level + 1} />
                    </div>
                </div>
            {:else if key in paramDefs}
                {#if paramDefs[key].type == "range"}
                    <div class="row">
                        <label for={`form-${key}`} class="col-4 col-form-label">
                            {camelCaseToSentence(key)}
                            {#if key in helpParams}
                                <span class="help-tooltip fs-6" data-bs-toggle="tooltip" data-bs-title={helpParams[key]}>?</span>
                            {/if}
                        </label>
                        <div class="d-flex align-items-center col">
                            <input
                                type="range"
                                class="form-range"
                                id={`form-${key}`}
                                bind:value={sections[key]}
                                on:change={(e) => propChanged(key, parseFloat(e.target.value))}
                                min={paramDefs[key].min}
                                max={paramDefs[key].max}
                                step={paramDefs[key].step || 1}
                            />
                            <span
                                class="range-label text-center text-primary mx-1 text-opacity-75 fs-6"
                            >
                                {sections[key]}
                            </span>
                        </div>
                    </div>
                {:else if paramDefs[key].type == "select"}
                    <select class="form-select" on:change={(e) => propChanged(key, e.target.value)}>
                        {#each paramDefs[key].choices as opt}
                            <option value={opt}> {opt} </option>
                        {/each}
                    </select>
                {/if}
            {:else if typeof sections[key] === "boolean"}
                <div class="input-type form-check">
                    <input
                        type="checkbox"
                        class="form-check-input"
                        id={`form-${key}`}
                        bind:checked={sections[key]}
                        on:change={(e) => propChanged(key, e.target.checked)}
                    />
                    <label for={`form-${key}`} class="form-check-label">
                        {camelCaseToSentence(key)}
                        {#if key in helpParams}
                            <span class="help-tooltip fs-6 float-end" data-bs-toggle="tooltip" data-bs-title={helpParams[key]}>?</span>
                        {/if}
                    </label>
                </div>
            {:else if key.toLowerCase().includes('color')}
            <ColorPickerPreview id={`form-${key}`} popup="right" title={camelCaseToSentence(key)} value={sections[key]} onChange={(col) => {sections[key] = col; propChanged(key, col); sections=sections;}}> </ColorPickerPreview>
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
                        on:change={(e) => propChanged(key, parseFloat(e.target.value))}
                    />
                </div>
            {/if}
        </div>
    {/each}
</div>