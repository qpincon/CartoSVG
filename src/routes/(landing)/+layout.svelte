<script>
  import 'src/assets/landing.css';
  import SiteNav from './SiteNav.svelte';
  let { children } = $props();
</script>

<div class="landing-page">
  <SiteNav />
  {@render children()}
</div>
