<script>
    import Navbar from "../components/Navbar.svelte";
</script>

<Navbar />
<div class="content">
    <h1>USA electoral data</h1>
    <p>
        This is an example built with <a
            target="_blank"
            href="https://svgscape.xyz"
        >
            SVGscape</a
        >. It is a copy of a
        <a target="_blank" href="https://datamaps.github.io/">
            datamaps example.</a
        ><br />
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
