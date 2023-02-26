<script>
	export let condition = false;
</script>

{#if condition}
  <li class="nav-item dropdown">
    <a class="nav-link dropdown-toggle" data-bs-toggle="dropdown" href="#" role="button" aria-expanded="false">Added</a>
    <ul class="dropdown-menu">
      <slot />
    </ul>
  </li>
{:else}
  <slot />
{/if}