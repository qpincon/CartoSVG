<script>
    import Icon from "./Icon.svelte";
    import mapIcon from "../assets/img/map.svg?inline";
    import htmlIcon from "../assets/img/html.svg?inline";
    // import italiaProject from '../assets/examples/italia.svgscape';

    const italiaPath = '../assets/examples/italia.svgscape';
    const exampleProjects = require.context('../assets/examples/', false, /\..*svgscape$/, 'lazy');
    const exampleMap = exampleProjects.keys().reduce((acc, file) => {
        const name = file.match(/[-a-zA-Z-_]+/)[0]; // remove extension
        acc[name] = file;
        return acc;
    }, {});
    console.log(exampleMap)
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
        <li class="dropdown-item">
            <span> La Bella Italia</span>
            <a title="Project" class="" href="#" on:click={() => loadExample('italia')}><Icon svg={mapIcon} /></a>
            <a title="Exported example" class="" target="_blank" href="italia.html"><Icon svg={htmlIcon} /></a>
        </li>
    </ul>
</div>

<style>
    a { color: inherit !important; }
</style>