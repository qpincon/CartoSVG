<script>
    import logo from '../assets/img/logo_transparent_text.webp';
    import Modal from './Modal.svelte';
    import About from './About.svelte';
    import Instructions from './Instructions.svelte';
    import Icon from './Icon.svelte';

    import githubLogo from '../assets/img/github.svg?inline';
    let modalToShow = null;
</script>

<nav class="navbar navbar-expand-lg bg-light">
    <div class="container-fluid w-100">
      <a class="mx-4 navbar-brand fs-2" href="#">
        <img src={logo} alt="Logo" width="215" height="64" class="d-inline-block align-text-center">
      </a>
      <div class="navbar-collapse" >
        <ul class="navbar-nav me-auto">
          <li class="nav-item">
            <a class="nav-link" role="button" on:click={() => modalToShow = 'instructions'}>Instructions</a>
          </li>
          <li class="nav-item" >
            <a class="nav-link" role="button" on:click={() => modalToShow = 'about'}>About </a>
          </li>
        </ul>
        <a class="p-2 github" target="_blank" style="width:50px; height:auto; fill:#aaa;" href="https://github.com/qpincon/SVGscape">{@html githubLogo}</a>
      </div>
      <slot></slot>
    </div>
  </nav>

<Modal open={modalToShow !== null} onClosed={() => modalToShow = null}>
  <div slot="content">
    {#if modalToShow === 'instructions'}<Instructions></Instructions>
    {:else } <About></About>
    {/if}
  </div>
</Modal>

<style>
  .github {
    width: 40px;
    height: auto;
  }
  :global(.github > svg) {
    fill: #5f5f5f;
    transition: fill 0.3s;
  }
  :global(.github:hover > svg) {
    fill: black;
  }
</style>