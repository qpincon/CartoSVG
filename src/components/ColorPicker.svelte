<script lang="ts">
    import Picker, { type Options, type Color as ColorInternal } from "vanilla-picker";

    import { onMount, onDestroy } from "svelte";
    import type { Color } from "src/types";

    interface ExtendedPicker extends Picker {
        __originalOpenHandler?: () => void;
        openHandler: () => void;
    }

    export let value: Color = "#AAAAAAFF";
    export let options: Options = {};
    export let onChange: (newColor: Color, oldColor?: Color) => void = () => {};
    let self: HTMLElement;
    let pickerElem: ExtendedPicker;

    $: if (pickerElem || value.length) {
        if (isHexColor(value)) pickerElem.setColor(value, true);
    }

    export function setColor(hexString: Color): void {
        if (!isHexColor(hexString)) return;
        pickerElem.setColor(hexString, true);
    }

    export function open(): void {
        pickerElem.show();
        pickerElem.openHandler();
    }

    function isHexColor(hex: Color): boolean {
        return typeof hex === "string" && (hex.length === 8 || hex.length === 6) && !isNaN(Number("0x" + hex));
    }

    function setValue(val: Color): void {
        if (val === value) return;
        onChange(val, value);
        value = val;
    }

    function _onChange(color: ColorInternal): void {
        setValue(color.hex as Color);
    }

    onMount(() => {
        _init(options);
    });

    onDestroy(() => {
        if (pickerElem) {
            pickerElem.destroy();
        }
    });

    export function init(): void {
        _init(options);
    }

    function _onOpen(): void {
        // Handler for when picker opens
    }

    function _init(opts: Options): void {
        if (!self) return;
        if (pickerElem) pickerElem.destroy();
        opts.onChange = _onChange;
        pickerElem = new Picker({
            parent: self,
            color: value,
            ...opts,
        }) as ExtendedPicker;
        pickerElem.__originalOpenHandler = pickerElem.openHandler;
        pickerElem.openHandler = function () {
            _onOpen();
            this.__originalOpenHandler?.();
        };
    }
</script>

<div bind:this={self} style="position: absolute;"></div>
