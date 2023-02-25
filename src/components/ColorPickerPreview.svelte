<script>
    import ColorPicker from "./ColorPicker.svelte";

    let colorPicker;
    let changedManually = false;
    export let value = null;
    export let title = '';
    export let id = 'colorpickerid'; 
    export let onChange = (newCol) => {};
    $: _onChange = (color) => {
        onChange(color)
        changedManually = true;
    };
    export let popup = 'left';

    $: if(value) {
        if (!changedManually && colorPicker) setTimeout(() => {colorPicker.init();}, 0);
        changedManually = false;
    }
</script>

<div class="row input-type">
    <label for={id} class="col-form-label col-4">
        { title }
    </label>
    <div class="d-flex align-items-center col">
        <div
            class="color-preview border border-primary rounded-1"
            on:click={(e) => {
                colorPicker.open();
            }}
            style="background-color: {value};"
        >
            <ColorPicker
                bind:this={colorPicker}
                {value}
                onChange={(color) => {
                    value = color;
                    _onChange(color, false);
                }}
                options={{popup}}
            />
        </div>
        <input
            type="text"
            class="ms-2 form-control"
            id={id}
            bind:value
            on:change={(e) => onChange(e.target.value)}
        />
    </div>
</div>
