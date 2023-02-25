<script>
import SlimSelect from 'slim-select';

import { onMount, onDestroy } from 'svelte';

export let value;
export let options = {};
export let multiple = false;
export let onChange = () => {};
let selectElem;
let ssElem;

export function setData(data) {
    ssElem.setData(data);
}
function setValue(val) {
    onChange(val, value)
    value = val;
}

function _onChange(info) {
    if (Array.isArray(info)) setValue(info.map(el => el.value));
    else setValue(info.value);
}

onMount( () => {
    init(options);
});

onDestroy( () => {
    ssElem.destroy();
});

async function init(opts) {
    if (!selectElem) return;
    if (ssElem) ssElem.destroy();
    if (Array.isArray(opts)) {
        opts = {data: opts.map(opt => { return {text: opt} })};
    }
    if (opts.onChange) {
        const tmpOnChange = opts.onChange;
        opts.onChange = (info) => {
            _onChange(info);
            tmpOnChange(info);
        }
    }
    else opts.onChange = _onChange;

    ssElem = new SlimSelect({
        select: selectElem,
        ...opts
    });
    setValue(ssElem.selected());
}
</script>

<select bind:this={selectElem} {multiple}> </select>