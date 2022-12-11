<script>
    import Navbar from "../Navbar.svelte";
    import italiaSvg from '../../assets/examples/italia.svg?inline';
</script>

<style>
    h1 {
        margin-top: 0;
    }
    :global(.content > svg) {
        max-width: 700px;
        margin: auto;
    }
</style>
<Navbar/>
<div class="content">
    <h1> La Bella Italia </h1>
    <p>
        This is an example built with <a target="_blank" href="https://svgscape.xyz"> SVGscape</a>. It is a copy of <a
            target="_blank" href="https://kartograph.org/showcase/italia/"> Kartograph's La Bella Italia.</a><br />
        The labels are set in the Aquiline font, created by Manfred Klein.
    </p>
    {@html italiaSvg}
</div>