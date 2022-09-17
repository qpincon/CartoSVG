<script>
    import Picker from 'vanilla-picker';
    
    import { onMount, onDestroy } from 'svelte';
    
    export let value = "#AAAAAAFF";
    export let options = {};
    export let onChange = () => {};
    let self;
    let pickerElem;
    
    $: if (pickerElem) {
        pickerElem.setColor(value);
    }

    export function setColor(hexString) {
        pickerElem.setColor(hexString);
    }
    
    export function open() {
        pickerElem.show();
        pickerElem.openHandler();
    }
    function setValue(val) {
        if (val === value) return;
        onChange(val, value)
        value = val;
    }
    
    function _onChange(color) {
        setValue(color.hex);
    }
    
    onMount( () => {
        init(options);
    });
    
    onDestroy( () => {
        pickerElem.destroy();
    });
    
    function init(opts) {
        if (!self) return;
        if (pickerElem) pickerElem.destroy();
        opts.onChange = _onChange;
        pickerElem = new Picker({
            parent: self,
            color: value,
            ...opts
        });
    }
</script>
    
<div bind:this={self} ></div>