<script lang="ts">
  import logo from "../assets/img/logo_brand.webp";
  import githubLogo from "../assets/img/github.svg?raw";
  export let activeTitle: string = "index.html";
</script>

<div id="navbar">
  <a href="app.html" class="logo">
    <img src={logo} alt="Logo" height="50" width="140" />
  </a>
  {#if activeTitle === "index.html"}
    <a role="button" href="about.html">About </a>
  {/if}
  <slot></slot>
</div>
<a
  class="p-2 github"
  target="_blank"
  style="width:60px; height:auto; fill:#aaa;"
  href="https://github.com/qpincon/CartoSVG">{@html githubLogo}</a
>

<style lang="scss">
  .logo {
    padding: 5px;
  }
  #navbar {
    display: flex;
    width: 100%;
    background-color: #ebf0f8;
    border-bottom: 1px solid #c8d4e3;
    flex-basis: 50px;
    display: flex;
    flex-direction: row-reverse;
    align-items: center;
    > a {
      text-decoration: none;
      font-size: 14px;
      color: black;
      margin-right: 10px;
      font-weight: bold;
    }
  }
  .github {
    position: absolute;
    bottom: 0;
    right: 0;
  }
  :global(.github > svg) {
    fill: #5f5f5f;
    transition: fill 0.3s;
    max-width: 3rem;
  }
  :global(.github:hover > svg) {
    fill: black;
  }
</style>
