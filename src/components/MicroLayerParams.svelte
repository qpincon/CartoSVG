<script>
    import { toLower, upperFirst } from "lodash-es";

    import ColorPickerPreview from "./ColorPickerPreview.svelte";
    import RangeInput from "./RangeInput.svelte";
    import { onMount } from "svelte";

    export let layerDefinitions = {};
    export let onUpdate = () => {};

    function updated(layer, key, value) {
        onUpdate(layer, key, value);
        if (key === 'active') {
            layerDefinitions[layer].menuOpened = layerDefinitions[layer].active;
        }
    }

    function readable(txt) {
        return upperFirst(toLower(txt));
    }

    function collapseLayer(layer) {
        layerDefinitions[layer].menuOpened =
            !layerDefinitions[layer].menuOpened;
        layerDefinitions = layerDefinitions;
    }

    onMount(() => {
        console.log(layerDefinitions);
    });
</script>

<h2 class="text-center">Layers</h2>
<div class="py-2 pe-2 border border-primary rounded-1">
    {#each Object.entries(layerDefinitions) as [title, def], i (title)}
        <div class="d-flex align-items-center">
            <div class="mx-2 form-check form-switch">
                <input
                    type="checkbox"
                    role="switch"
                    class="form-check-input"
                    disabled={def.disabled}
                    id={title}
                    bind:checked={def.active}
                    on:change={() => updated(title, 'active', def.active)}
                />
                <label for={title} class="form-check-label">
                    {readable(title)}
                </label>
            </div>
            <div
                class="toggle-layer"
                class:opened={def.menuOpened === true}
                on:click={() => collapseLayer(title)}
            ></div>
        </div>

        {#if def.menuOpened}
            <div class="layer-params d-flex flex-wrap ps-2 ms-4 border-start border-1">
                {#if def.fill != null}
                    <ColorPickerPreview
                        labelAbove={true}
                        additionalClasses="mx-2 mb-2"
                        id={`${title}-def-fill`}
                        popup="right"
                        title="Fill"
                        value={def.fill}
                        onChange={(col) => {
                            def.fill = col;
                            updated(title, "fill", col);
                        }}
                    />
                {/if}
                {#if def.fills != null}
                        {#each def.fills as fill, fillIndex}
                            <ColorPickerPreview
                                labelAbove={true}
                                additionalClasses="mx-2 mb-2"
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
                        additionalClasses="mx-2 mb-2"
                        id={`${title}-def-stroke`}
                        popup="right"
                        title="Stroke"
                        value={def.stroke}
                        onChange={(col) => {
                            def.stroke = col;
                            updated(title, "stroke", col);
                        }}
                    />
                {/if}
            </div>
        {/if}
    {/each}
</div>

<style lang="scss">
    .toggle-layer {
        width: 1rem;
        height: 1rem;
        cursor: pointer;
        background-image: url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='%32dee2e6'><path fill-rule='evenodd' d='M1.646 4.646a.5.5 0 0 1 .708 0L8 10.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708z'/></svg>");
        &.opened {
            transform: rotate(180deg);
        }
    }

    :global(.layer-params > div) {
        flex: 1 0 9rem;
    }
</style>
