<script>
    import { tapHold } from '../util/common';

    export let value;
    export let title;
    export let min = 0;
    export let max = 10;
    export let step = 1;
    export let onChange = (newVal) => {};
    export let id = 'rangeinputid'; 
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

<div class="row">
    <label for={id} class="d-flex col-4 col-form-label align-items-center"> {title}
        <div class="d-inline-flex flex-column align-items-center arrows">
            <svg use:tapHold on:hold={increment} role="button" on:click={increment} height="24" viewBox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg">
                <path d="m3 19h18c.372 0 .713-.207.886-.536s.148-.727-.063-1.033l-9-13c-.373-.539-1.271-.539-1.645 0l-9 13c-.212.306-.236.704-.063 1.033.172.329.513.536.885.536z" />
            </svg>
            <svg use:tapHold on:hold={decrement} role="button" on:click={decrement} height="24" viewBox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg">
                <path d="m11.178 19.569c.186.27.494.431.822.431s.636-.161.822-.431l9-13c.212-.306.236-.704.063-1.033-.172-.329-.513-.536-.885-.536h-18c-.372 0-.713.207-.886.536s-.148.727.064 1.033z" />
            </svg>
        </div> 
    </label>
    
    {#if helpText}
        <span class="help-tooltip fs-6" data-bs-toggle="tooltip" data-bs-title={helpText}>?</span>
    {/if}
    <div class="d-flex align-items-center col">
        <input
            type="range"
            class="form-range"
            id={id}
            bind:value={value}
            min={min}
            max={max}
            step={step}
            on:change={(e) => onChange(e.target.value)}
        />
        <span
            class="range-label text-center text-primary mx-1 text-opacity-75 fs-6"
        >
            {value}
        </span>
    </div>
</div>

<style>
    .arrows {
        height: 25px;
        fill: #5c5f62;
    }
</style>