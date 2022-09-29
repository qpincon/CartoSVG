<script>
	import { getContext } from 'svelte';
	import { TABS } from './Tabs.svelte';
    import { createEventDispatcher } from 'svelte';

	export const tab = {};
    export let tabTitle;
	const { registerTab, selectTab, selectedTab } = getContext(TABS);

	registerTab(tab);

	const dispatch = createEventDispatcher();
    function changeTab() {
        if ($selectedTab === tab) return;
		dispatch('change', {
            tab: tabTitle
		});
        selectTab(tab);
    }

</script>


<li class="nav-item" on:click="{changeTab}">
    <a class:active="{$selectedTab === tab}" class="nav-link">
        {  tabTitle }
    </a>
</li>