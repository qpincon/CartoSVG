<script>
  import Navbar from "../components/Navbar.svelte";
</script>

<Navbar />
<div class="content">
  <h1>Mercator world map</h1>
  <p>
    This is an example built with <a
      target="_blank"
      href="https://svgscape.xyz"
    >
      SVGscape</a
    >. It features a simple map using the Mercator projection, and a customized tooltip (of questionnable taste). <br />
    The exported SVG file weights 225Ko. It's a bit heavy because of the resolution
    of geometry, and we display here the whole world.
  </p>
</div>

<style>
  h1 {
    margin-top: 0;
  }
  :global(svg) {
    max-width: 800px;
    margin: auto;
  }
</style>
