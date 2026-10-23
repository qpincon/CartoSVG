<script lang="ts">
    import { clamp } from "lodash-es";
    import { tick } from "svelte";
    import { tapHold } from "../util/common";
    import { log } from "../util/log";

    interface Props {
        value: number;
        title: string;
        min: number;
        max: number;
        step?: number;
        onChange?: (newVal: number) => void;
        id: string;
        helpText?: string | null;
        labelAbove?: boolean;
    }

    let { value = $bindable(), title, min, max, step = 1, onChange, id, helpText, labelAbove }: Props = $props();

    let slider: HTMLElement | undefined = $state();
    /** This is to enable onchange event propagation when the increment / decrement counters are clicked
     * (for when RangeInput is used in a <form> that globally listens for "onchange" )*/
    const changeEvent = new Event("change", {
        bubbles: true,
        cancelable: true,
        composed: true,
    });

    function countDecimals(val: number): number {
        if (Math.floor(val.valueOf()) === val.valueOf()) return 0;
        return val.toString().split(".")[1]?.length || 0;
    }

    let nbDecimals: number = $derived(countDecimals(step));

    const increment = (e?: MouseEvent): void => {
        if (e) e.stopPropagation();
        const beforeValue = value;
        if (value === null) value = step;
        else if (value === max) return;
        else value += step;
        value = clamp(value, min, max);
        if (value === beforeValue) return;
        if (onChange) onChange!(value);
        slider?.dispatchEvent(changeEvent);
    };

    const decrement = (e?: MouseEvent): void => {
        if (e) e.stopPropagation();
        const beforeValue = value;
        if (value === null) value = min;
        else if (value === min) return;
        else value -= step;
        value = clamp(value, min, max);
        if (value === beforeValue) return;
        if (onChange) onChange!(value);
        slider?.dispatchEvent(changeEvent);
    };

    let editing = $state(false);
    let editInput: HTMLInputElement | undefined = $state();
    let editText = $state("");

    const startEdit = async (): Promise<void> => {
        editText = value?.toFixed(nbDecimals) ?? "0";
        editing = true;
        await tick();
        editInput?.focus();
        editInput?.select();
    };

    const applyValue = (newVal: number): void => {
        if (newVal === value) return;
        value = newVal;
        if (onChange) onChange!(value);
        slider?.dispatchEvent(changeEvent);
    };

    const commitEdit = (): void => {
        if (!editing) return;
        editing = false;
        const parsed = parseFloat(editText.replace(",", "."));
        if (isNaN(parsed)) return;
        applyValue(clamp(parsed, min, max));
    };

    /** Arrow up / down while editing: move the typed value by one step and apply it right away. */
    const stepEdit = (direction: 1 | -1): void => {
        const parsed = parseFloat(editText.replace(",", "."));
        const base = isNaN(parsed) ? (value ?? min) : parsed;
        const newVal = clamp(parseFloat((base + direction * step).toFixed(nbDecimals)), min, max);
        editText = newVal.toFixed(nbDecimals);
        applyValue(newVal);
        tick().then(() => editInput?.select());
    };

    const cancelEdit = (): void => {
        editing = false;
    };
</script>

<div
    bind:this={slider}
    class="{labelAbove ? 'd-flex flex-column justify-content-center' : 'row align-items-center'}  w-100"
>
    <label for={id} class="text-nowrap d-flex col-4 col-form-label align-items-center {labelAbove ? 'p-0' : ''}">
        <span> {title}</span>
        {#if helpText}
            <span class="help-tooltip fs-6" data-bs-toggle="tooltip" data-bs-title={helpText}>?</span>
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
            onchange={(e) => {
                log("slider change", e);
                if (e.target && e.target instanceof HTMLInputElement) {
                    if (onChange) onChange!(parseFloat(e.target.value));
                }
            }}
        />
        <div class="d-flex align-items-center">
            {#if editing}
                <input
                    bind:this={editInput}
                    type="text"
                    inputmode="decimal"
                    class="value-edit text-center text-primary mx-1 text-opacity-75 fs-6"
                    style:width="{Math.max(editText.length, 1)}ch"
                    bind:value={editText}
                    onkeydown={(e) => {
                        if (e.key === "Enter") {
                            e.preventDefault();
                            commitEdit();
                        } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
                            e.preventDefault();
                            stepEdit(e.key === "ArrowUp" ? 1 : -1);
                        } else if (e.key === "Escape") {
                            e.stopPropagation();
                            cancelEdit();
                        }
                    }}
                    onblur={commitEdit}
                    onchange={(e) => e.stopPropagation()}
                />
            {:else}
                <span
                    class="value-display text-center d-flex text-primary mx-1 text-opacity-75 fs-6"
                    role="button"
                    tabindex="0"
                    title="Click to edit"
                    onclick={startEdit}
                    onkeydown={(e) => e.key === "Enter" && startEdit()}
                >
                    {value?.toFixed(nbDecimals) ?? "0"}
                </span>
            {/if}
            <div class="arrows">
                <div class="numeric-input">
                    <svg
                        width="10"
                        height="10"
                        fill="currentColor"
                        viewBox="3 3 18 18"
                        use:tapHold={increment}
                        onclick={increment}><path d="M7,15L12,10L17,15H7Z" /></svg
                    >
                </div>
                <div class="numeric-input">
                    <svg
                        width="10"
                        height="10"
                        fill="currentColor"
                        viewBox="3 3 18 18"
                        use:tapHold={decrement}
                        onclick={decrement}><path d="M7,10L12,15L17,10H7Z" /></svg
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
    .value-display {
        cursor: text;
        border-bottom: 1px dashed transparent;
        &:hover {
            border-bottom-color: currentColor;
        }
    }
    .value-edit {
        font-family: inherit;
        line-height: inherit;
        padding: 0;
        margin-top: 0;
        margin-bottom: 0;
        border: 0;
        border-bottom: 1px solid currentColor;
        border-radius: 0;
        background: transparent;
        outline: none;
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
