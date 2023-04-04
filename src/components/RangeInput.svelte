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

    function countDecimals(val) {
        if(Math.floor(val.valueOf()) === val.valueOf()) return 0;
        return val.toString().split(".")[1].length || 0; 
    }

    $:nbDecimals = countDecimals(step);
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

<div class="row align-items-center w-100">
    <label for={id} class="d-flex col-4 col-form-label align-items-center">
        {title}
        {#if helpText}
            <span
                class="help-tooltip fs-6"
                data-bs-toggle="tooltip"
                data-bs-title={helpText}>?</span
            >
        {/if}
    </label>

    <div class="p-0 d-flex align-items-center col">
        <input
            type="range"
            class="form-range"
            {id}
            bind:value
            {min}
            {max}
            {step}
            on:change={(e) => onChange(parseFloat(e.target.value))}
        />
        <div class="d-flex align-items-center">
            <span
                class="text-center d-flex text-primary mx-1 text-opacity-75 fs-6"
            >
                {value.toFixed(nbDecimals)}
            </span>
            <div class="arrows">
                <div class="numeric-input">
                    <svg
                        width="10"
                        height="10"
                        fill="currentColor"
                        viewBox="3 3 18 18"
                        use:tapHold
                        on:hold={increment}
                        on:click={increment}
                        ><path d="M7,15L12,10L17,15H7Z" /></svg
                    >
                </div>
                <div class="numeric-input">
                    <svg
                        width="10"
                        height="10"
                        fill="currentColor"
                        viewBox="3 3 18 18"
                        use:tapHold
                        on:hold={decrement}
                        on:click={decrement}
                        ><path d="M7,10L12,15L17,10H7Z" /></svg
                    >
                </div>
            </div>
        </div>
    </div>
</div>

<style lang="scss" scoped>
    * {
        box-sizing: content-box !important;
    }
    .arrows {
        display: inline-block;
        max-height: 25px;
        margin-left: 6px;
        margin-right: 12px;
        vertical-align: middle;
        box-sizing: border-box;
    }
    .numeric-input {
        cursor: pointer;
        background-color: #f3f6fa;
        border: 1px solid #c8d4e3;
        border-radius: 1px;
        line-height: 6px;
        text-align: center;
        max-height: 10px;
        & > svg {
            fill: #506784 !important;
        }
        &:first-child {
            margin-bottom: 2px;
        }
    }
</style>
