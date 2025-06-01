<script lang="ts">
    import Icon from "./Icon.svelte";
    import htmlIcon from "../assets/img/html.svg?raw";
    import examplesDesc from "../../examples.json";
    import { createEventDispatcher } from "svelte";
    import { extractFileName } from "../util/common";

    const exampleProjects = import.meta.glob("../examples/*.cartosvg", {
        import: "default",
        query: "?raw",
    }) as Record<string, () => Promise<string>>;
    Object.keys(exampleProjects).forEach((fileName) => {
        const name = extractFileName(fileName); // remove extension
        exampleProjects[name] = exampleProjects[fileName];
        delete exampleProjects[fileName];
    });

    const dispatch = createEventDispatcher();

    async function loadExample(project: string) {
        const jsonProject = JSON.parse(await exampleProjects[project]());
        dispatch("example", {
            projectParams: jsonProject,
        });
    }
</script>

<div class="mx-4 dropdown">
    <button
        class="btn btn-outline-secondary dropdown-toggle"
        type="button"
        data-bs-toggle="dropdown"
        aria-expanded="false"
    >
        Examples
    </button>
    <ul class="dropdown-menu">
        {#each Object.entries(examplesDesc) as [exampleTitle, exampleDesc]}
            <li class="d-flex">
                <a
                    class="dropdown-item text-decoration-none"
                    title="Project"
                    href="#"
                    on:click={() => loadExample(exampleTitle)}
                >
                    {exampleDesc.title}
                </a>
                <a class="dropdown-item html-btm" title="Exported example" target="_blank" href="{exampleTitle}.html"
                    ><Icon svg={htmlIcon} /></a
                >
            </li>
        {/each}
    </ul>
</div>

<style>
    a {
        color: inherit !important;
    }
    .html-btm {
        width: 3rem;
    }
</style>
