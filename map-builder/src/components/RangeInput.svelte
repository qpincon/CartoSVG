<script>
    import { tapHold } from "../util/common";

    export let value;
    export let title;
    export let min = 0;
    export let max = 10;
    export let step = 1;
    export let onChange = (newVal) => {};
    export let id = "rangeinputid";
    export let helpText;

    const increment = () => {
        if (value === null) value = step;
        else if (value === max) return;
        else value += step;
        onChange(value);
    };

    const decrement = () => {
        if (value === null) value = min;
        else if (value === min) return;
        else value -= step;
        onChange(value);
    };
</script>

<div class="row w-100">
    <label for={id} class="d-flex col-4 col-form-label align-items-center">
        {title}
    </label>

    {#if helpText}
        <span
            class="help-tooltip fs-6"
            data-bs-toggle="tooltip"
            data-bs-title={helpText}>?</span
        >
    {/if}
    <div class="p-0 d-flex align-items-center col">
        <input
            type="range"
            class="form-range"
            {id}
            bind:value
            {min}
            {max}
            {step}
            on:change={(e) => onChange(e.target.value)}
        />
        <div class="d-flex">
            <span
                class="range-label text-center d-flex text-primary mx-1 text-opacity-75 fs-6"
            >
                {value}
            </span>
            <div
                class="ms-2 d-inline-flex flex-column align-items-center justify-content-center arrows"
            >
                <svg
                    use:tapHold
                    on:hold={increment}
                    role="button"
                    on:click={increment}
                    height="10"
                    viewBox="0 0 20 15"
                    width="10"
                    xmlns="http://www.w3.org/2000/svg"
                >
                    <path
                        d="m1 15h18c.4 0 .7-.2.9-.5s.1-.7-.1-1l-9-13c-.4-.5-1.3-.5-1.6 0l-9 13c-.2.3-.2.7-.1 1 .2.3.5.5.9.5z"
                    />
                </svg>
                <svg
                    use:tapHold
                    on:hold={decrement}
                    role="button"
                    on:click={decrement}
                    height="10"
                    viewBox="0 0 20 15"
                    width="10"
                    xmlns="http://www.w3.org/2000/svg"
                >
                    <path
                        d="m9.2 14.6c.2.3.5.4.8.4s.6-.2.8-.4l9-13c.2-.3.2-.7.1-1-.2-.3-.5-.5-.9-.5h-18c-.4 0-.7.2-.9.5s-.1.7.1 1z"
                    />
                </svg>
            </div>
        </div>
    </div>
</div>

<style>
    .arrows {
        fill: #5c5f62;
    }
</style>
