<script>
    import "bootstrap/js/dist/collapse";
    import { createEventDispatcher } from 'svelte';

    import ColorPicker from './ColorPicker';
    import { camelCaseToSentence } from "../util/common";
    export let sections;
    export let paramDefs;
    export let level = 0;
    let pickers = {};

    const dispatch = createEventDispatcher();

	function propChanged(prop, value) {
        const payload = { prop, value };
		dispatch('change', payload);
	}

    $: padding = level === 0 ? 0 : 4;
</script>

<div class="accordion" style="padding:{padding}px 0 0  {padding}px;">
    {#each Object.entries(sections) as [key, value], i}
        {@const isObject = typeof value === "object"}
        <div class="accordion-item" class:noborder={!isObject}>
            {#if isObject}
                <h2 class="accordion-header">
                    <button
                        class="accordion-button"
                        type="button"
                        data-bs-toggle="collapse"
                        data-bs-target={`#panel-${key}-collapse`}
                    >
                        {camelCaseToSentence(key)}
                    </button>
                </h2>
                <div
                    id={`panel-${key}-collapse`}
                    class="accordion-collapse collapse"
                    class:show={level === 0 && i === 0}
                >
                    <div class="accordion-body" style="border-left: solid {2 * level}px var(--bs-accordion-active-bg);">
                        <svelte:self on:change sections={sections[key]} {paramDefs} level={level + 1} />
                    </div>
                </div>
            {:else if key in paramDefs}
                {#if paramDefs[key].type == "range"}
                    <div class="row">
                        <label for={`form-${key}`} class="col-4 col-form-label">
                            {camelCaseToSentence(key)}
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
                <div class="form-check">
                    <input
                        type="checkbox"
                        class="form-check-input"
                        id={`form-${key}`}
                        bind:checked={sections[key]}
                        on:change={(e) => propChanged(key, e.target.checked)}
                    />
                    <label for={`form-${key}`} class="form-check-label">
                        {camelCaseToSentence(key)}
                    </label>
                </div>
            {:else if key.toLowerCase().includes('color')}
                <div class="row">
                    <label for={`form-${key}`} class="col-form-label col-4">
                        {camelCaseToSentence(key)}
                    </label>
                    <div class="d-flex align-items-center col">
                        <div class="color-preview border border-primary rounded-1" on:click={(e) => {pickers[key].open();}} style="background-color: {sections[key]};"></div>
                        <input
                            type="text"
                            class="ms-2 form-control"
                            id={`form-${key}`}
                            bind:value={sections[key]}
                        />
                    </div>
                    <ColorPicker bind:this={pickers[key]}
                        value={sections[key]}
                        onChange={color => {sections[key] = color; propChanged(key, color);}}
                    /> 
                </div>
            {:else}
                <div>
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

<style scoped >
    .color-preview {
        width: 2rem;
        height: 2rem;
    }
    /* .accordion-body {
        padding-bottom: 1rem;
    } */
</style>