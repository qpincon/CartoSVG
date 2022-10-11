<script>
	import { getContext } from 'svelte';
	import { TABS } from './Tabs.svelte';
    import { createEventDispatcher } from 'svelte';
    let tabBtn;

	export const tab = {};
    export let tabTitle;
    export let changeOnClick = true;
	const { registerTab, selectTab, selectedTab } = getContext(TABS);

	registerTab(tab);

	const dispatch = createEventDispatcher();
    function changeTab(e) {
        if (e.target !== tabBtn) return;
        if ($selectedTab === tab) return;
		dispatch('change', {
            tab: tabTitle
		});
        if (changeOnClick) selectTab(tab);
    }

</script>


<li role="button" class="nav-item d-flex align-items-center">
    <a bind:this={tabBtn} class:active="{$selectedTab === tab}" class="nav-link" on:click={changeTab}>
        {#if tabTitle} { tabTitle } {/if}
        <slot></slot>
    </a>
    
</li>