<script>
    import Navbar from "../components/Navbar.svelte";
</script>

<Navbar />
<div class="content">
    <h1>La Bella Italia</h1>
    <p>
        This is an example built with <a
            target="_blank"
            href="https://svgscape.xyz"
        >
            SVGscape</a
        >. It is a copy of
        <a target="_blank" href="https://kartograph.org/showcase/italia/">
            Kartograph's La Bella Italia.</a
        >
        (Unfortunately down since end 2022.
        <a
            href="https://web.archive.org/web/20221128124038/https://kartograph.org/showcase/italia/"
        >
            Here is an archived version)
        </a><br />
        The exported SVG that you see weights ~160Ko. The labels have been exported to <code>path</code> elements. <br/>
        This map features:
        <ul> 
            <li> The use of custom glow effects and coutours </li>
            <li> The option to convert heavy fonts to path elements </li>
            <li> The use of hand-drawn paths, which can be styled, and on which we can animate an image </li>
        </ul>
        The labels are set in the Aquiline font, created by Manfred Klein.
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
