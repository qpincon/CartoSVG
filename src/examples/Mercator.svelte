<script>
  import Navbar from "../components/Navbar.svelte";
</script>

<style>
  h1 {
      margin-top: 0;
  }
  :global(svg) {
      max-width: 700px;
      margin: auto;
  }
</style>
<Navbar/>
<div class="content">
  <h1> La Bella Italia </h1>
  <p>
      This is an example built with <a target="_blank" href="https://svgscape.xyz"> SVGscape</a>. It features a simple map using the Mercator projection.
  </p>
</div>
