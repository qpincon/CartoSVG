<script>
    import logo from '../assets/img/logo_transparent_text.webp';
    import githubLogo from '../assets/img/github.svg?inline';
    export let activeTitle = 'index.html'
</script>

<nav class="navbar navbar-expand-lg bg-light">
    <div class="container-fluid w-100">
      <a class="mx-4 navbar-brand fs-2" href="/">
        <img src={logo} alt="Logo" width="215" height="64" class="d-inline-block align-text-center">
      </a>
      <div class="navbar-collapse" >
        <ul class="navbar-nav me-auto">
          <li class="nav-item" >
            <a class="nav-link" class:active={activeTitle === 'index.html'} role="button" href="index.html"> <strong> Design </strong> </a>
          </li>
          
          <li class="nav-item" >
            <a class="nav-link" class:active={activeTitle === 'about.html'}  role="button" href="about.html">About </a>
          </li>
        </ul>
        <a class="p-2 github" target="_blank" style="width:50px; height:auto; fill:#aaa;" href="https://github.com/qpincon/SVGscape">{@html githubLogo}</a>
      </div>
      <slot></slot>
    </div>
  </nav>