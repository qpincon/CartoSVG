<script lang="ts">
    import type { Options } from "vanilla-picker";
    import ColorPicker from "./ColorPicker.svelte";
    import type { Color } from "src/types";

    let colorPicker: ColorPicker;
    let changedManually: boolean = false;
    export let value: Color = "#fff";
    export let title: string = "";
    export let id: string = "colorpickerid";
    export let onChange: (newCol: Color) => void = (newCol: Color) => {};
    export let additionalClasses: string = "";
    export let labelAbove: boolean = false;

    $: _onChange = (color: Color): void => {
        onChange(color);
        changedManually = true;
    };
    export let popup: Options["popup"] = "left";

    $: if (value) {
        if (!changedManually && colorPicker) {
            setTimeout(() => {
                if (colorPicker) colorPicker.init();
            }, 0);
        }
        changedManually = false;
    }
</script>

<div class="{labelAbove ? 'd-flex flex-column justify-content-center' : 'row'} input-type {additionalClasses}">
    <label for={id} class="col-form-label col-4 {labelAbove ? 'p-0' : ''}">
        {title}
    </label>
    <div class="d-flex align-items-center col">
        <div
            class="color-preview border border-primary rounded-1"
            on:click={(e: MouseEvent) => {
                colorPicker.open();
            }}
            style="background-color: {value};"
        >
            <ColorPicker
                bind:this={colorPicker}
                {value}
                onChange={(color: Color) => {
                    value = color;
                    _onChange(color);
                }}
                options={{ popup }}
            />
        </div>
        <input
            type="text"
            class="ms-2 form-control"
            {id}
            bind:value
            on:change={(e: Event) => onChange((e.target as HTMLInputElement).value as Color)}
        />
    </div>
</div>

<style>
    input {
        max-width: 8rem;
    }
</style>
