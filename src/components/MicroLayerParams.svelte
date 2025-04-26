<script>

    import ColorPickerPreview from "./ColorPickerPreview.svelte";
    import RangeInput from "./RangeInput.svelte";
    import { camelCaseToSentence, initTooltips } from "../util/common";

    export let layerDefinitions = {};
    export let onUpdate = () => {};
    export let onPaletteChange = () => {};
    export let availablePalettes = {};

    $: layers = Object.entries(layerDefinitions).filter(([layerId, _]) => layerId !== "borderParams");
    let selectedPalette;
    function updated(layer, key, value) {
        console.log(layer, key, value);
        onUpdate(layer, key, value);
        if (key[0] === "active") {
            layerDefinitions[layer].menuOpened = layerDefinitions[layer].active;
        }
        if (key[1] === "active") {
            layerDefinitions[layer].pattern.menuOpened =
                layerDefinitions[layer].pattern.active;
        }
        initTooltips();
    }

    function paletteChanged(paletteId) {
        onPaletteChange(paletteId);
    }

    function collapseLayer(layer) {
        layerDefinitions[layer].menuOpened =
            !layerDefinitions[layer].menuOpened;
        layerDefinitions = layerDefinitions;
        setTimeout(() => initTooltips(), 0);
    }

    function collapseLayerPattern(layer) {
        layerDefinitions[layer].pattern.menuOpened =
            !layerDefinitions[layer].pattern.menuOpened;
        layerDefinitions = layerDefinitions;
        setTimeout(() => initTooltips(), 0);
    }
</script>

<div class="py-2 mb-4 pe-2 border border-primary rounded-1">
    <div class="row my-3 mx-1">
        <label class="col-4 col-form-label" for="palette-select">
            Preset palette</label
        >
        <select
            id="palette-select"
            class="form-select form-select-sm me-4 col"
            bind:value={selectedPalette}
            on:change={(e) => paletteChanged(e.target.value)}
        >
            <option hidden selected>Chose a preset palette</option>
            {#each Object.keys(availablePalettes) as paletteId}
                <option value={paletteId}> {camelCaseToSentence(paletteId)} </option>
            {/each}
        </select>
    </div>

    {#each layers as [title, def], i (title)}
        <div class="d-flex align-items-center">
            <div class="mx-2 form-check form-switch">
                <input
                    type="checkbox"
                    role="switch"
                    class="form-check-input"
                    disabled={def.disabled}
                    id={title}
                    bind:checked={def.active}
                    on:change={() => updated(title, ["active"], def.active)}
                />
                <label for={title} class="form-check-label">
                    {camelCaseToSentence(title)}
                </label>
            </div>
            {#if def.active}
                <div
                    class="toggle"
                    class:opened={def.menuOpened === true}
                    on:click={() => collapseLayer(title)}
                ></div>
            {/if}
        </div>

        {#if def.menuOpened}
            <div class="layer-params ps-2 ms-4 border-start border-1">
                <div class="wrap-params d-flex flex-wrap">
                    {#if def.fill != null}
                        <ColorPickerPreview
                            labelAbove={true}
                            additionalClasses="mx-2 mb-1"
                            id={`${title}-def-fill`}
                            popup="right"
                            title="Fill"
                            value={def.fill}
                            onChange={(col) => {
                                def.fill = col;
                                updated(title, ["fill"], col);
                            }}
                        />
                    {/if}
                    {#if def.fills != null}
                        {#each def.fills as fill, fillIndex}
                            <ColorPickerPreview
                                labelAbove={true}
                                additionalClasses="mx-2 mb-1"
                                id={`${title}-def-fill-${fillIndex}`}
                                popup="right"
                                title={`Fill ${fillIndex}`}
                                value={fill}
                                onChange={(col) => {
                                    def.fills[fillIndex] = col;
                                    updated(title, ["fills", 0], col);
                                }}
                            />
                        {/each}
                    {/if}
                    {#if def.stroke != null}
                        <ColorPickerPreview
                            labelAbove={true}
                            additionalClasses="mx-2 mb-1"
                            id={`${title}-def-stroke`}
                            popup="right"
                            title="Stroke"
                            value={def.stroke}
                            onChange={(col) => {
                                def.stroke = col;
                                updated(title, ["stroke"], col);
                            }}
                        />
                    {/if}
                </div>

                <!-- SVG PATTERN -->
                {#if def.pattern}
                    <div class="d-flex align-items-center">
                        <div class="mx-2 form-check form-switch">
                            <input
                                type="checkbox"
                                role="switch"
                                class="form-check-input"
                                id={`input-${def.pattern.id}`}
                                bind:checked={def.pattern.active}
                                on:change={() =>
                                    updated(
                                        title,
                                        ["pattern", "active"],
                                        def.pattern.active,
                                    )}
                            />
                            <label
                                for={`input-${def.pattern.id}`}
                                class="form-check-label"
                            >
                                Pattern
                            </label>
                        </div>
                        {#if def.pattern.active}
                            <div
                                class="toggle"
                                class:opened={def.pattern.menuOpened === true}
                                on:click={() => collapseLayerPattern(title)}
                            ></div>
                        {/if}
                    </div>
                    {#if def.pattern.menuOpened}
                        <div
                            class="wrap-params ps-2 ms-4 border-start border-1 d-flex flex-wrap"
                        >
                            <div class="mx-2">
                                <label for={`${def.pattern.id}-hatch`}>
                                    <a
                                        href="https://matplotlib.org/stable/gallery/shapes_and_collections/hatch_style_reference.html"
                                        target="_blank">Pattern</a
                                    >
                                    <span
                                        class="help-tooltip fs-6"
                                        data-bs-toggle="tooltip"
                                        data-bs-title="One or multiple of \ / | + - * x  . o O, and more!"
                                        >?</span
                                    ></label
                                >
                                <input
                                    type="text"
                                    class="form-control"
                                    id={`${def.pattern.id}-hatch`}
                                    bind:value={def.pattern.hatch}
                                    on:input={(e) => {
                                        let val = e.target.value;
                                        def.pattern.hatch = val;
                                        updated(
                                            title,
                                            ["pattern", "hatch"],
                                            val,
                                        );
                                    }}
                                />
                            </div>
                            <ColorPickerPreview
                                labelAbove={true}
                                additionalClasses="mx-2 mb-1"
                                id={`${def.pattern.id}-color`}
                                popup="right"
                                title="Color"
                                value={def.pattern.color}
                                onChange={(col) => {
                                    def.pattern.color = col;
                                    updated(title, ["pattern", "color"], col);
                                }}
                            />
                            <RangeInput
                                labelAbove={true}
                                title="Weight"
                                id={`${def.pattern.id}-strokeWidth`}
                                bind:value={def.pattern.strokeWidth}
                                min="0.2"
                                max="5"
                                step="0.2"
                                onChange={(val) => {
                                    def.pattern.strokeWidth = val;
                                    updated(
                                        title,
                                        ["pattern", "strokeWidth"],
                                        val,
                                    );
                                }}
                            />
                            <RangeInput
                                labelAbove={true}
                                title="Scale"
                                helpText="Controls the density of the pattern"
                                id={`${def.pattern.id}-scale`}
                                bind:value={def.pattern.scale}
                                min="0.1"
                                max="3"
                                step="0.1"
                                onChange={(val) => {
                                    def.pattern.scale = val;
                                    updated(title, ["pattern", "scale"], val);
                                }}
                            />
                        </div>
                    {/if}
                {/if}
            </div>
        {/if}
    {/each}
</div>

<style lang="scss">
    .toggle {
        width: 1rem;
        height: 1rem;
        cursor: pointer;
        background-image: url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='%32dee2e6'><path fill-rule='evenodd' d='M1.646 4.646a.5.5 0 0 1 .708 0L8 10.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708z'/></svg>");
        &.opened {
            transform: rotate(180deg);
        }
    }

    :global(.wrap-params > div) {
        flex: 1 0 9rem;
    }
</style>
