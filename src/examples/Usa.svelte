<script>
    import Navbar from "../components/Navbar.svelte";
</script>

<Navbar />
<div class="content">
    <h1>USA electoral data</h1>
    <p>
        This is an example built with <a
            target="_blank"
            href="https://cartosvg.com"
        >
            CartoSVG</a
        >. It is a copy of a
        <a target="_blank" href="https://datamaps.github.io/">
            datamaps example.</a
        ><br />
        It features how the custom palette can be applied on categorical data to do a choropleth map. <br/>
        The exported file weights ~50Ko.
    </p>
</div>

<style>
    h1 {
        margin-top: 0;
    }
    :global(svg) {
        max-width: 700px;
        margin: auto;
    }
</style>
