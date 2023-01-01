<script>
    import Icon from "./Icon.svelte";
    import htmlIcon from "../assets/img/html.svg?inline";
    import examplesDesc from '../../examples.json';

    const exampleProjects = require.context('../examples/', false, /\..*svgscape$/, 'lazy');
    const exampleMap = exampleProjects.keys().reduce((acc, file) => {
        const name = file.match(/[-a-zA-Z-_]+/)[0]; // remove extension
        acc[name] = file;
        return acc;
    }, {});
    
    import { createEventDispatcher } from 'svelte';

	const dispatch = createEventDispatcher();

    async function loadExample(project) {
        const jsonProject = await exampleProjects(exampleMap[project]);
		dispatch('example', {
			projectParams: jsonProject
		});
	}
</script>

<div class="ms-4 dropdown">
    <button
        class="btn btn-secondary dropdown-toggle"
        type="button"
        data-bs-toggle="dropdown"
        aria-expanded="false"
    >
        Examples
    </button>
    <ul class="dropdown-menu">
        {#each Object.entries(examplesDesc) as [exampleTitle, exampleDesc]}
            <li class="d-flex">
                <a class="dropdown-item text-decoration-none" title="Project" href="#" on:click={() => loadExample(exampleTitle)}> {exampleDesc.title} </a>
                <a class="dropdown-item html-btm" title="Exported example"  target="_blank" href="{exampleTitle}.html"><Icon svg={htmlIcon} /></a>
            </li>
        {/each}
    </ul>
</div>

<style>
    a { color: inherit !important; }
    .html-btm {
        width: 3rem;
    }
</style>