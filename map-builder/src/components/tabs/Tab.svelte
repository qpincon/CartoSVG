<script>
	import { getContext } from 'svelte';
	import { TABS } from './Tabs.svelte';
    import { createEventDispatcher } from 'svelte';

	export const tab = {};
    export let tabTitle;
    export let changeOnClick = true;
	const { registerTab, selectTab, selectedTab } = getContext(TABS);

	registerTab(tab);

	const dispatch = createEventDispatcher();
    function changeTab() {
        if ($selectedTab === tab) return;
		dispatch('change', {
            tab: tabTitle
		});
        if (changeOnClick) selectTab(tab);
    }

</script>


<li role="button" class="nav-item" on:click="{changeTab}">
    <a class:active="{$selectedTab === tab}" class="nav-link">
        {#if tabTitle} { tabTitle } {/if}
        <slot></slot>
    </a>
</li>