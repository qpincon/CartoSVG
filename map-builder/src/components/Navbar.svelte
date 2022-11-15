<script>
    import logo from '../assets/img/logo_transparent.webp'
</script>

<nav class="navbar bg-light">
    <div class="container-fluid">
      <a class="mx-4 navbar-brand fs-2" href="#">
        <img src={logo} alt="Logo" width="64" height="64" class="d-inline-block align-text-center">
        SVGScape
      </a>
      <slot></slot>
    </div>
  </nav>