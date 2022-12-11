<script>
    export let value;
    export let title;
    export let min = 0;
    export let max = 10;
    export let step = 1;
    export let onChange = (newVal) => {};
</script>

<div class="row">
    <label for="significantDigits" class="col-4 col-form-label"> {title} </label>
    <div class="d-flex align-items-center col">
        <input
            type="range"
            class="form-range"
            id="significantDigits"
            bind:value={value}
            min={min}
            max={max}
            step={step}
            on:change={onChange}
        />
        <span
            class="range-label text-center text-primary mx-1 text-opacity-75 fs-6"
        >
            {value}
        </span>
    </div>
</div>