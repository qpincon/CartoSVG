<script>
    import Picker from 'vanilla-picker';
    
    import { onMount, onDestroy } from 'svelte';
    
    export let value = "#AAAAAAFF";
    export let options = {};
    export let onChange = () => {};
    let self;
    let pickerElem;
    
    $: if (pickerElem || value.length) {
        if(isHexColor(value)) pickerElem.setColor(value);
    }

    export function setColor(hexString) {
        if (!isHexColor(hexString)) return;
        pickerElem.setColor(hexString);
    }
    
    export function open() {
        pickerElem.show();
        pickerElem.openHandler();
    }

    function isHexColor (hex) {
        return typeof hex === 'string'
            && (hex.length === 8 || hex.length === 6)
            && !isNaN(Number('0x' + hex))
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
        _init(options);
    });
    
    onDestroy( () => {
        pickerElem.destroy();
    });

    export function init() {
        _init(options);
    }
    function _onOpen() {
        // const container = document.getElementById('main-panel');
        // const containerBounds = container.getBoundingClientRect();
        // const bounds = self.getBoundingClientRect();
        setTimeout(() => {
            console.log(self.scrollWidth, self.clientWidth);
            const overflow = self.scrollWidth - self.clientWidth;
            const isOverflowing = self.clientWidth < self.scrollWidth;
            console.log(overflow, isOverflowing);
            const isOverflowingX = self.scrollWidth != Math.max(self.offsetWidth, self.clientWidth);
            console.log('isOverflowingX', isOverflowingX);

        }, 100);
    }

    function _init(opts) {
        if (!self) return;
        if (pickerElem) pickerElem.destroy();
        opts.onChange = _onChange;
        opts.onOpen = (x) => {console.log(x, 'coucou')},
        pickerElem = new Picker({
            parent: self,
            color: value,
            ...opts
        });
        pickerElem.__originalOpenHandler = pickerElem.openHandler;
        pickerElem.openHandler = function(e) {
            _onOpen();
            this.__originalOpenHandler();
        };
    }
</script>
    
<div bind:this={self} ></div>