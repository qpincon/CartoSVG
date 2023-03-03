<script>
  import Navbar from "../components/Navbar.svelte";
</script>

<Navbar />
<div class="content">
  <h1>Population of Ukraine</h1>
  <p>
    This is an example built with <a
      target="_blank"
      href="https://svgscape.xyz"
    >
      SVGscape</a
    >. It features a demonstration of the choropleth capabilities of SVGScape based on numerical data. <br/>
    The file export SVG weights ~100Ko.
  </p>
</div>

<style>
  h1 {
    margin-top: 0;
  }
  :global(svg) {
    max-width: 500px;
    margin: auto;
  }
</style>
