<script lang="ts">
  import { onMount } from 'svelte';

  let overHero = $state(true);
  let mounted = $state(false);

  onMount(() => {
    mounted = true;

    const hero = document.querySelector('.hero');
    if (!hero) {
      overHero = false;
      return;
    }

    const io = new IntersectionObserver(
      ([entry]) => { overHero = entry.isIntersecting; },
      { threshold: 0.05 }
    );
    io.observe(hero);
    return () => io.disconnect();
  });
</script>

<nav
  class="site-nav"
  class:over-hero={overHero}
  class:scrolled={!overHero}
  class:mounted
  aria-label="Primary"
>
  <div class="nav-inner">
    <!-- Brand -->
    <a href="/" class="nav-brand" aria-label="Mapello home">
      <img
        src="/logo_wordmark_transparent.png"
        alt="Mapello"
        class="nav-logo"
        height="36"
      />
    </a>

    <!-- Center links -->
    <div class="nav-links" role="list">
      <a href="/#showcase" class="nav-link" role="listitem">Showcase</a>
      <a href="/#compare" class="nav-link" role="listitem">Compare</a>
      <a href="/#pricing" class="nav-link" role="listitem">Pricing</a>
    </div>

    <!-- GitHub -->
    <a
      href="https://github.com/qpincon/mapello"
      class="nav-github"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Mapello on GitHub"
    >
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
        <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
      </svg>
    </a>

    <!-- CTA -->
    <a href="/app" class="nav-cta">Start designing</a>
  </div>
</nav>

<style>
  .site-nav {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 50;
    height: 64px;

    /* Default (over hero) */
    background: rgba(6, 13, 22, 0.5);
    border-bottom: 1px solid rgba(255, 255, 255, 0.07);
    backdrop-filter: blur(16px) saturate(140%);
    -webkit-backdrop-filter: blur(16px) saturate(140%);

    /* Start invisible for mount animation */
    opacity: 0;
    transform: translateY(-100%);
    transition:
      background 0.35s ease,
      border-color 0.35s ease,
      opacity 0.55s cubic-bezier(0.22, 1, 0.36, 1),
      transform 0.55s cubic-bezier(0.22, 1, 0.36, 1);
  }

  .site-nav.mounted {
    opacity: 1;
    transform: translateY(0);
    transition-delay: 0.1s;
  }

  .site-nav.scrolled {
    background: rgba(245, 238, 220, 0.94);
    border-bottom: 1px solid rgba(201, 148, 58, 0.22);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
  }

  .nav-inner {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 1.5rem;
    height: 100%;
    display: flex;
    align-items: center;
    gap: 2rem;
  }

  /* Brand */
  .nav-brand {
    display: flex;
    align-items: center;
    text-decoration: none;
    flex-shrink: 0;
    transition: opacity 0.2s ease;
  }
  .nav-brand:hover { opacity: 0.8; }

  .nav-logo {
    height: 36px;
    width: auto;
    display: block;
    /* Dark nav (over hero): invert to white */
    filter: brightness(0) invert(1);
    transition: filter 0.35s ease;
  }
  .scrolled .nav-logo {
    /* Parchment nav: restore original navy colors */
    filter: none;
  }

  /* Center links */
  .nav-links {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    flex: 1;
    justify-content: center;
  }

  .nav-link {
    position: relative;
    display: inline-block;
    padding: 0.4rem 0.7rem;
    font-size: 0.75rem;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.45);
    text-decoration: none;
    transition: color 0.2s ease;
  }
  .nav-link::after {
    content: '';
    position: absolute;
    bottom: 0.1rem;
    left: 0.7rem;
    right: 0.7rem;
    height: 1px;
    background: var(--color-gold);
    transform: scaleX(0);
    transform-origin: left;
    transition: transform 0.22s cubic-bezier(0.4, 0, 0.2, 1);
  }
  .nav-link:hover { color: rgba(255, 255, 255, 0.82); }
  .nav-link:hover::after { transform: scaleX(1); }

  .scrolled .nav-link { color: rgba(30, 41, 59, 0.55); }
  .scrolled .nav-link:hover { color: #0f172a; }

  /* GitHub icon */
  .nav-github {
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 4px;
    color: rgba(255, 255, 255, 0.55);
    transition: color 0.2s ease;
  }
  .nav-github svg {
    width: 18px;
    height: 18px;
    fill: currentColor;
    display: block;
  }
  .nav-github:hover { color: rgba(255, 255, 255, 0.95); }
  .scrolled .nav-github { color: rgba(30, 41, 59, 0.55); }
  .scrolled .nav-github:hover { color: #0f172a; }

  /* Focus ring */
  .nav-link:focus-visible,
  .nav-brand:focus-visible,
  .nav-github:focus-visible,
  .nav-cta:focus-visible {
    outline: 2px solid var(--color-gold);
    outline-offset: 4px;
    border-radius: 2px;
  }

  /* CTA */
  .nav-cta {
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    padding: 0.5rem 1.15rem;
    background: var(--color-gold);
    color: #060d16;
    font-weight: 600;
    font-size: 0.8rem;
    letter-spacing: 0.01em;
    border-radius: 4px;
    text-decoration: none;
    transition:
      background 0.2s ease,
      transform 0.2s ease,
      box-shadow 0.2s ease;
  }
  .nav-cta::after {
    content: ' →';
    margin-left: 0.3rem;
    transition: transform 0.2s ease;
    display: inline-block;
  }
  .nav-cta:hover {
    background: var(--color-gold-hover);
    transform: translateY(-1px);
    box-shadow: 0 4px 16px rgba(201, 148, 58, 0.35);
  }
  .nav-cta:hover::after { transform: translateX(3px); }

  /* Mobile: hide center links below 680px */
  @media (max-width: 680px) {
    .nav-links { display: none; }
    .nav-inner { gap: 1rem; }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .site-nav {
      opacity: 1;
      transform: translateY(0);
      transition: background 0.35s ease, border-color 0.35s ease;
    }
    .site-nav.mounted { transition-delay: 0s; }
    .nav-link::after { transition: none; }
    .nav-cta { transition: background 0.2s ease; }
    .nav-logo { transition: none; }
  }
</style>
