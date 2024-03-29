<script>
    import Navbar from "./Navbar.svelte";
</script>

<Navbar activeTitle="about.html" />

<div class="content">
    <h1>About</h1>
    <h2>Purpose</h2>
    <section>
        I wanted to have an easy way to create a lightweight beautiful
        interactive SVG maps. Traditionnaly, with <a
            href="https://github.com/neocarto/bertin"
        >
            bertin.js
        </a>
        or <a href="https://datamaps.github.io/">datamaps</a>, we must:
        <ul>
            <li>
                Embed the JS library to plot the map (datamaps for instance)
            </li>
            <li>Embed d3 as well</li>
            <li>Download the geometries at runtime</li>
        </ul>
        That seems like a lot of unnecessary work. Moreover, those libraries are
        great but require some skills as a developer.<br />
        This tool is my attempt to make the creation of such maps easier (and with
        much more customization available). The main drawback is at it is fully static
        at the moment (an option would be to create an API later on).<br />
        Please refer to the
        <a href="https://github.com/qpincon/CartoSVG"> GitHub repository </a>
        for contributions / requests, or shoot me an email at
        <a href="mailto:pincon.quentin@gmail.com">pincon.quentin@gmail.com</a>.
    </section>

    <h2 class="mt-2">Credits</h2>
    <section>
        Administrative boundaries courtesy of <a
            href="https://www.geoboundaries.org">geoBoundaries</a
        >, (CGAZ, heavily simplified, automaticaly updated on every release).<br
        />
        Thanks to the
        <a href="https://observablehq.com/@jjhembd/tilting-the-satellite">
            Tilting the sattelite observable
        </a>
        for the sophisticated math. <br />
        Also, thanks to:
        <ul>
            <li>
                <a href="https://github.com/d3/d3">d3</a> and
                <a href="https://github.com/sveltejs/svelte"> Svelte </a> for DOM
                and SVG manipulation
            </li>
            <li>
                <a href="https://github.com/svg/svgo">SVGO</a> for SVG
                optimization and
                <a href="https://github.com/shrhdk/text-to-svg"> TextToSVG </a> to
                transform text with imported fonts to path
            </li>
            <li>
                <a href="https://github.com/topojson/topojson-client"
                    >TopoJSON</a
                >
                and
                <a href="https://github.com/mbloch/mapshaper">MapShaper</a> for geometry
                manipulation
            </li>
            <li>
                <a href="https://github.com/shrhdk/text-to-svg">text-to-svg</a>
                and
                <a href="https://github.com/opentypejs/opentype.js">
                    opentypes.js
                </a> for conversion of fonts to paths
            </li>
            <li>
                <a href="https://kartograph.org/showcase/italia/">
                    Kartograph Italia showcase
                </a> for inspiration
            </li>
        </ul>
        <a href="https://github.com/qpincon/inline-style-editor"
            >inline-style-editor
        </a> is also used (made by me).
    </section>

    <h3 class="mt-2">Note on performance</h3>
    <section>
        The glow filters use SVG filter primitives. Such filters are generally
        qui resource intensive, but some efforts went into making them more
        performant. The first draw can take some time, buf afterwards it should
        be quite responsive.
    </section>

    <h3 class="mt-2">Licence ?</h3>
    <span>MIT</span>
</div>

<style lang="scss">

:global(html) {
    font-family: Open Sans,--apple-default,sans-serif;
    font-size: 14px;
}

:global(html, body) {
    height: 100%;
    margin: 0px; padding: 0px;
}

.content {
    max-width: 80%;
    padding: 1em;
    margin: auto;
    line-height: 1.75;
}

</style>