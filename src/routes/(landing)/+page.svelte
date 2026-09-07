<script lang="ts">
  import { onMount } from "svelte";
  import ShowcaseSlot from "./ShowcaseSlot.svelte";
  import ValueCard from "./ValueCard.svelte";

  const ICONS = {
    paste: `<path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2"/>`,
    sparkle: `<path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z"/><path d="M19 13l.75 2.25L22 16l-2.25.75L19 19l-.75-2.25L16 16l2.25-.75L19 13z"/>`,
    compress: `<path d="M13 10V3L4 14h7v7l9-11h-7z"/>`,
    data: `<path d="M21 15V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10"/><path d="M3 15h18"/><path d="M7 19l3-3 2 2 4-4 3 3"/>`,
  };

  const microMaps = [
    {
      id: "naarden",
      title: "Naarden, Netherlands",
      description:
        "A perfectly preserved star-shaped fortress from the 1600s — its geometry is so precise it looks drawn with a compass. \nTry clicking the cathedral!",
      highlights: ["Positron palette", "Link on building"],
      animated: true,
      src: "/showcase/micro/naarden.svg",
      aspectRatio: "1 / 1",
      gradient:
        "linear-gradient(135deg, #2d4a35 0%, #3d6645 50%, #4a7a52 100%)",
    },
    {
      id: "manhattan",
      title: "Lower Manhattan, 3D",
      description:
        "The densest skyline on Earth, rendered with 3D building extrusion.",
      highlights: ["Obsidian palette", "3D buildings"],
      src: "/showcase/micro/manhattan.svg",
      aspectRatio: "1 / 1",
      gradient:
        "linear-gradient(135deg, #0a1525 0%, #152035 50%, #1e2d4a 100%)",
    },
    {
      id: "bern",
      title: "Bern Old Town, Switzerland",
      description:
        "A medieval city wrapped in a tight river loop — the Aare curves 270° around it.\nClick on the cathedral to have information about it in a popover - created in the editor.",
      highlights: ["Warm palette", "Popover", "Image along curve"],
      animated: true,
      src: "/showcase/micro/bern.svg",
      aspectRatio: "1 / 1",
      gradient:
        "linear-gradient(135deg, #1a2a3a 0%, #2a3d55 50%, #3a5070 100%)",
    },
    {
      id: "sagrada",
      title: "Sagrada Família, Barcelona",
      description:
        "Gaudí's basilica sits at the heart of Eixample's perfect octagonal city grid.\nClick on the label or the basilica to have more info.",
      highlights: ["Gatsby palette", "Popover", "3D buildings"],
      src: "/showcase/micro/sagrada.svg",
      aspectRatio: "1 / 1",
      gradient:
        "linear-gradient(135deg, #3a2a1a 0%, #5a4a2a 50%, #7a6a3a 100%)",
    },
    {
      id: "macau",
      title: "Macau Peninsula",
      description:
        "Asia's Las Vegas, squeezed onto a tiny peninsula — casino towers next to Portuguese colonial streets.",
      highlights: ["Playful palette", "Custom labels", "Custom markers"],
      animated: true,
      src: "/showcase/micro/macau.svg",
      aspectRatio: "1 / 1",
      gradient:
        "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
    },
    {
      id: "central-park",
      title: "Central Park, New York",
      description:
        "840 acres of parkland carved out of Manhattan's grid — the sharp edge where the city meets nature.\nHover the park buildings to show the mapello built-in tooltip.",
      highlights: ["Poster palette", "Tooltip", "Custom labels"],
      src: "/showcase/micro/central-park.svg",
      aspectRatio: "1 / 1",
      gradient:
        "linear-gradient(135deg, #1a2e1a 0%, #2a4a2a 50%, #3a5c3a 100%)",
    },
  ];

  const macroMaps = [
    {
      id: "italia",
      title: "Italy — Cities & Regions",
      description:
        "A stylized map of the Italian peninsula with labeled cities — Roma, Milano, Venezia, Napoli and more. Clean typography and a warm earthy palette.",
      highlights: ["City labels", "Land glow", "Image along curve"],
      animated: true,
      src: "/showcase/macro/italia.svg",
      aspectRatio: "600 / 660",
      gradient:
        "linear-gradient(160deg, #f3efec 0%, #e8dfc8 50%, #d4c8a8 100%)",
    },
    {
      id: "we-work",
      title: "Where We Work",
      description:
        "A world map with markers showing a company's offices around the world.",
      highlights: ["Categorical choropleth", "Custom markers and labels"],
      src: "/showcase/macro/we-work.svg",
      aspectRatio: "710 / 520",
      gradient:
        "linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 50%, #3a2a1a 100%)",
    },
    {
      id: "greece-trip",
      title: "Greece — Travel Map",
      description:
        "A parchment-styled map of a trip across Greece, with curved routes linking each stop. Click a city pin for a popover with trip notes.",
      highlights: ["Parchment palette", "Curved routes", "City popovers"],
      animated: true,
      src: "/showcase/macro/greece-trip.svg",
      aspectRatio: "668 / 720",
      gradient:
        "linear-gradient(160deg, #f0e4c8 0%, #c9b795 50%, #8c3a1e 100%)",
    },
     {
      id: "midnight",
      title: "Norway — Hours of Daylight",
      description:
        "A midnight-toned choropleth of Norway's regions, shaded by hours of daylight on the winter solstice. Click a city pin for a popover with more detail.",
      highlights: ["Choropleth", "City popovers", "Midnight palette"],
      animated: true,
      src: "/showcase/macro/midnight.svg",
      aspectRatio: "668 / 763",
      gradient:
        "radial-gradient(ellipse at 50% 40%, #16283d 0%, #0a1626 50%, #050d18 100%)",
    },
    {
      id: "japan",
      title: "Japan — Population by Prefecture",
      description:
        "A tilted globe framing Japan, with each prefecture shaded by how crowded it is. Click Tokyo for a rich popover. A high-speed rail route arrow connects the three main cities.",
      highlights: ["Tilted globe", "Click popovers", "Route annotation"],
      animated: true,
      src: "/showcase/macro/japan.svg",
      aspectRatio: "430 / 620",
      gradient:
        "radial-gradient(ellipse at 50% 40%, #e8f0f8 0%, #b8cfe0 50%, #8aacc0 100%)",
    },
    {
      id: "ukraine",
      title: "Ukraine — Population by Region",
      description: "Population across Ukraine's regions.",
      highlights: ["Continuous choropleth", "Graticule"],
      animated: true,
      src: "/showcase/macro/ukraine.svg",
      aspectRatio: "1 / 1",
      gradient:
        "linear-gradient(135deg, #1a2535 0%, #1e3a5a 50%, #1a3050 100%)",
    },

    {
      id: "france",
      title: "French Wine Regions",
      description:
        "Each French region colored by its dominant wine style. Click the cities for more information in popovers.",
      highlights: ["Mercator", "Categorical choropleth", "Hover tooltips"],
      animated: true,
      src: "/showcase/macro/france.svg",
      aspectRatio: "650 / 590",
      gradient:
        "linear-gradient(160deg, #f5f0e8 0%, #d4c4a0 50%, #c9b28a 100%)",
    },
    {
      id: "usa",
      title: "US Political Map",
      description:
        "A clean choropleth of voting patterns by county, using a red-to-blue gradient.",
      highlights: ["Categorical choropleth", "Custom palette"],
      animated: true,
      src: "/showcase/macro/usa.svg",
      aspectRatio: "650 / 380",
      gradient:
        "linear-gradient(135deg, #1a1a3a 0%, #2a2a5a 50%, #1a2a6a 100%)",
    },
    
  ];

  const AUTOPLAY_MS = 5000;
  const ANIMATED_BONUS_MS = 5000;

  let activeMicro = $state(0);
  let activeMacro = $state(0);
  let microKey = $state(0);
  let macroKey = $state(0);
  let microUserControlled = $state(false);
  let macroUserControlled = $state(false);
  let reducedMotion = $state(false);
  let openFaq = $state<number | null>(null);

  let microTimer: ReturnType<typeof setTimeout> | undefined;
  let macroTimer: ReturnType<typeof setTimeout> | undefined;

  function microDuration() {
    return AUTOPLAY_MS + (microMaps[activeMicro].animated ? ANIMATED_BONUS_MS : 0);
  }
  function macroDuration() {
    return AUTOPLAY_MS + (macroMaps[activeMacro].animated ? ANIMATED_BONUS_MS : 0);
  }

  const faqs = [
    {
      q: "Do I need an account to start?",
      a: "No. You can open the editor and design maps immediately — no sign-up required. You only need an account to export more than 3 maps.",
    },
    {
      q: "What counts as an \"exported map\"?",
      a: "Each time you download a finished SVG file, that uses one export credit.",
    },
    {
      q: "Will my maps keep working if I cancel my subscription?",
      a: "Yes, forever. Every SVG file you export is completely self-contained — it contains no link back to Mapello. Your maps will work the same way in 10 years as they do today.",
    },
    {
      q: "Can I paste the map directly into my website?",
      a: "Yes. Inline SVG in HTML is supported by every modern browser. Just open the exported file, copy its contents, and paste it into your page. Tooltips, popovers, and links will all work — no JavaScript library needed.",
    },
    {
      q: "What file format is needed for the data coloring feature?",
      a: "A standard spreadsheet file (CSV, Excel). One column should contain the country or region names; the other columns can hold any data you want to display or color by.",
    },
    {
      q: "Can I use custom fonts in my map?",
      a: "Yes. Chose any font file in the app and it becomes available for labels. On export, you can choose to embed the font as base64 inside the SVG, convert text to vector paths, or leave it as-is.",
    },
  ];

  function advanceMicro() {
    activeMicro = (activeMicro + 1) % microMaps.length;
    microKey++;
  }
  function advanceMacro() {
    activeMacro = (activeMacro + 1) % macroMaps.length;
    macroKey++;
  }

  function scheduleMicro() {
    microTimer = setTimeout(() => {
      advanceMicro();
      if (!reducedMotion && !microUserControlled) scheduleMicro();
      else microTimer = undefined;
    }, microDuration());
  }
  function startMicro() {
    if (reducedMotion || microUserControlled || microTimer) return;
    scheduleMicro();
  }
  function stopMicro() {
    clearTimeout(microTimer);
    microTimer = undefined;
  }
  function scheduleMacro() {
    macroTimer = setTimeout(() => {
      advanceMacro();
      if (!reducedMotion && !macroUserControlled) scheduleMacro();
      else macroTimer = undefined;
    }, macroDuration());
  }
  function startMacro() {
    if (reducedMotion || macroUserControlled || macroTimer) return;
    scheduleMacro();
  }
  function stopMacro() {
    clearTimeout(macroTimer);
    macroTimer = undefined;
  }

  function selectMicro(i: number) {
    microUserControlled = true;
    stopMicro();
    if (i === activeMicro) return;
    activeMicro = i;
    microKey++;
  }
  function selectMacro(i: number) {
    macroUserControlled = true;
    stopMacro();
    if (i === activeMacro) return;
    activeMacro = i;
    macroKey++;
  }

  onMount(() => {
    reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

    const els = document.querySelectorAll<HTMLElement>(".lp-reveal");
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting)
            (e.target as HTMLElement).classList.add("visible");
        }),
      { threshold: 0.1 },
    );
    els.forEach((el) => io.observe(el));

    const theaterEls = document.querySelectorAll<HTMLElement>(".theater");
    const [microTheaterEl, macroTheaterEl] = theaterEls;

    const autoplayIo = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          const el = e.target as HTMLElement;
          if (el === microTheaterEl) {
            if (e.isIntersecting) startMicro();
            else stopMicro();
          } else if (el === macroTheaterEl) {
            if (e.isIntersecting) startMacro();
            else stopMacro();
          }
        }),
      { threshold: 0.3 },
    );
    theaterEls.forEach((el) => autoplayIo.observe(el));

    return () => {
      io.disconnect();
      autoplayIo.disconnect();
      stopMicro();
      stopMacro();
    };
  });
</script>

<svelte:head>
  <title>Mapello — Design gorgeous interactive SVG maps</title>
  <meta
    name="description"
    content="Design beautiful, interactive maps and export them as a single file you can drop into any website — no coding required."
  />
  <link rel="canonical" href="https://mapello.net/" />

  <meta property="og:title" content="Mapello — SVG Map Designer" />
  <meta
    property="og:description"
    content="Design beautiful maps and embed them anywhere with a simple copy-paste."
  />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="https://mapello.net/" />
  <meta property="og:image" content="https://mapello.net/og-cover.png" />

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="Mapello — SVG Map Designer" />
  <meta
    name="twitter:description"
    content="Design beautiful maps and embed them anywhere with a simple copy-paste."
  />
  <meta name="twitter:image" content="https://mapello.net/og-cover.png" />

  {@html `<script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "Mapello",
    url: "https://mapello.net",
    description: "Design beautiful, interactive maps and export them as a single file you can drop into any website — no coding required.",
    applicationCategory: "DesignApplication",
    operatingSystem: "Web",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  })}</script>`}

  <link rel="preconnect" href="https://fonts.bunny.net" />
  <link
    href="https://fonts.bunny.net/css?family=inter:400,500,600,700,800&display=swap"
    rel="stylesheet"
  />
  <link
    href="https://fonts.bunny.net/css?family=cormorant-garamond:400,400i,600,600i&display=swap"
    rel="stylesheet"
  />
</svelte:head>

<!-- ═══════════════════════════════════════ HERO ═══════════════════════════════════════ -->
<section class="hero">
  <!-- horizontal graticule — connects the two side strips -->
  <svg class="hero-graticule" viewBox="0 0 1000 340" preserveAspectRatio="none" fill="none" aria-hidden="true">
    <line x1="0" y1="50" x2="1000" y2="50" stroke="white" stroke-width="0.3" stroke-opacity="0.05" />
    <line x1="0" y1="115" x2="1000" y2="115" stroke="white" stroke-width="0.3" stroke-opacity="0.05" />
    <line x1="0" y1="180" x2="1000" y2="180" stroke="#c9943a" stroke-width="0.5" stroke-opacity="0.12" />
    <line x1="0" y1="245" x2="1000" y2="245" stroke="white" stroke-width="0.3" stroke-opacity="0.05" />
    <line x1="0" y1="310" x2="1000" y2="310" stroke="white" stroke-width="0.3" stroke-opacity="0.05" />
  </svg>

  <!-- corner brackets (chart frame corners aligned with strip extents) -->
  <svg class="hero-corner hero-corner-tl" viewBox="0 0 40 40" fill="none" aria-hidden="true">
    <path d="M 0,16 L 0,0 L 16,0" stroke="white" stroke-opacity="0.22" stroke-width="1" />
    <text x="22" y="11" fill="#c9943a" fill-opacity="0.45" font-family="'Cormorant Garamond', serif" font-size="8" letter-spacing="1.5">N</text>
    <path d="M 22,17 L 22,28 M 19,20 L 22,17 L 25,20" stroke="#c9943a" stroke-opacity="0.40" stroke-width="0.7" fill="none" />
  </svg>
  <svg class="hero-corner hero-corner-tr" viewBox="0 0 40 40" fill="none" aria-hidden="true">
    <path d="M 24,0 L 40,0 L 40,16" stroke="white" stroke-opacity="0.22" stroke-width="1" />
  </svg>
  <svg class="hero-corner hero-corner-bl" viewBox="0 0 40 40" fill="none" aria-hidden="true">
    <path d="M 0,24 L 0,40 L 16,40" stroke="white" stroke-opacity="0.22" stroke-width="1" />
  </svg>
  <svg class="hero-corner hero-corner-br" viewBox="0 0 40 40" fill="none" aria-hidden="true">
    <path d="M 24,40 L 40,40 L 40,24" stroke="white" stroke-opacity="0.22" stroke-width="1" />
  </svg>

  <!-- top-center fold ornament -->
  <svg class="hero-fold hero-fold-top" viewBox="0 0 140 12" fill="none" aria-hidden="true">
    <line x1="0" y1="6" x2="55" y2="6" stroke="white" stroke-width="0.5" stroke-opacity="0.22" />
    <polygon points="63,2 66,6 63,10 60,6" fill="white" fill-opacity="0.22" />
    <polygon points="77,2 80,6 77,10 74,6" fill="white" fill-opacity="0.22" />
    <line x1="85" y1="6" x2="140" y2="6" stroke="white" stroke-width="0.5" stroke-opacity="0.22" />
  </svg>

  <!-- bottom-center fold ornament -->
  <svg class="hero-fold hero-fold-bottom" viewBox="0 0 140 12" fill="none" aria-hidden="true">
    <line x1="0" y1="6" x2="55" y2="6" stroke="white" stroke-width="0.5" stroke-opacity="0.22" />
    <polygon points="63,2 66,6 63,10 60,6" fill="white" fill-opacity="0.22" />
    <polygon points="77,2 80,6 77,10 74,6" fill="white" fill-opacity="0.22" />
    <line x1="85" y1="6" x2="140" y2="6" stroke="white" stroke-width="0.5" stroke-opacity="0.22" />
  </svg>

  <!-- left latitude scale -->
  <svg class="hero-side hero-side-left" viewBox="0 0 72 340" fill="none" aria-hidden="true">
    <line x1="62" y1="20" x2="62" y2="320" stroke="white" stroke-width="0.5" stroke-opacity="0.22" />
    <polygon points="62,12.5 64.5,16 62,19.5 59.5,16" fill="white" fill-opacity="0.20" />
    <polygon points="62,320.5 64.5,324 62,327.5 59.5,324" fill="white" fill-opacity="0.20" />
    <line x1="52" y1="50" x2="62" y2="50" stroke="white" stroke-width="0.6" stroke-opacity="0.25" />
    <text x="48" y="53" text-anchor="end" fill="white" fill-opacity="0.26" font-family="'Cormorant Garamond', serif" font-size="8.5" letter-spacing="1.2">55°N</text>
    <line x1="52" y1="115" x2="62" y2="115" stroke="white" stroke-width="0.6" stroke-opacity="0.25" />
    <text x="48" y="118" text-anchor="end" fill="white" fill-opacity="0.26" font-family="'Cormorant Garamond', serif" font-size="8.5" letter-spacing="1.2">52°N</text>
    <line x1="48" y1="180" x2="62" y2="180" stroke="#c9943a" stroke-width="0.8" stroke-opacity="0.44" />
    <text x="44" y="183" text-anchor="end" fill="#c9943a" fill-opacity="0.52" font-family="'Cormorant Garamond', serif" font-size="8.5" letter-spacing="1.2">48°N</text>
    <line x1="52" y1="245" x2="62" y2="245" stroke="white" stroke-width="0.6" stroke-opacity="0.25" />
    <text x="48" y="248" text-anchor="end" fill="white" fill-opacity="0.26" font-family="'Cormorant Garamond', serif" font-size="8.5" letter-spacing="1.2">45°N</text>
    <line x1="52" y1="310" x2="62" y2="310" stroke="white" stroke-width="0.6" stroke-opacity="0.25" />
    <text x="48" y="313" text-anchor="end" fill="white" fill-opacity="0.26" font-family="'Cormorant Garamond', serif" font-size="8.5" letter-spacing="1.2">41°N</text>
  </svg>

  <!-- right latitude scale -->
  <svg class="hero-side hero-side-right" viewBox="0 0 72 340" fill="none" aria-hidden="true">
    <line x1="10" y1="20" x2="10" y2="320" stroke="white" stroke-width="0.5" stroke-opacity="0.22" />
    <polygon points="10,12.5 12.5,16 10,19.5 7.5,16" fill="white" fill-opacity="0.20" />
    <polygon points="10,320.5 12.5,324 10,327.5 7.5,324" fill="white" fill-opacity="0.20" />
    <line x1="10" y1="50" x2="20" y2="50" stroke="white" stroke-width="0.6" stroke-opacity="0.25" />
    <text x="24" y="53" fill="white" fill-opacity="0.26" font-family="'Cormorant Garamond', serif" font-size="8.5" letter-spacing="1.2">55°N</text>
    <line x1="10" y1="115" x2="20" y2="115" stroke="white" stroke-width="0.6" stroke-opacity="0.25" />
    <text x="24" y="118" fill="white" fill-opacity="0.26" font-family="'Cormorant Garamond', serif" font-size="8.5" letter-spacing="1.2">52°N</text>
    <line x1="10" y1="180" x2="24" y2="180" stroke="#c9943a" stroke-width="0.8" stroke-opacity="0.44" />
    <text x="28" y="183" fill="#c9943a" fill-opacity="0.52" font-family="'Cormorant Garamond', serif" font-size="8.5" letter-spacing="1.2">48°N</text>
    <line x1="10" y1="245" x2="20" y2="245" stroke="white" stroke-width="0.6" stroke-opacity="0.25" />
    <text x="24" y="248" fill="white" fill-opacity="0.26" font-family="'Cormorant Garamond', serif" font-size="8.5" letter-spacing="1.2">45°N</text>
    <line x1="10" y1="310" x2="20" y2="310" stroke="white" stroke-width="0.6" stroke-opacity="0.25" />
    <text x="24" y="313" fill="white" fill-opacity="0.26" font-family="'Cormorant Garamond', serif" font-size="8.5" letter-spacing="1.2">41°N</text>
  </svg>

  <svg
    class="hero-instrument"
    viewBox="0 0 600 600"
    fill="none"
    aria-hidden="true"
  >
    <defs>
      <clipPath id="hero-sweep-clip"
        ><circle cx="300" cy="300" r="262" /></clipPath
      >
      <line id="itick" x1="0" y1="-241" x2="0" y2="-250" />
      <line id="itick-card" x1="0" y1="-235" x2="0" y2="-258" />
      <line id="itick-mid" x1="0" y1="-238" x2="0" y2="-255" />
      <line id="itick-fine" x1="0" y1="-247" x2="0" y2="-250" />
      <radialGradient id="hero-teal-glow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#2a7d6e" stop-opacity="0.14" />
        <stop offset="100%" stop-color="#2a7d6e" stop-opacity="0" />
      </radialGradient>
      <radialGradient id="hero-gold-core" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#c9943a" stop-opacity="0.08" />
        <stop offset="100%" stop-color="#c9943a" stop-opacity="0" />
      </radialGradient>
      <radialGradient
        id="hero-sweep-fill"
        cx="300"
        cy="300"
        r="262"
        gradientUnits="userSpaceOnUse"
      >
        <stop offset="0%" stop-color="#c9943a" stop-opacity="0" />
        <stop offset="55%" stop-color="#2a7d6e" stop-opacity="0.06" />
        <stop offset="100%" stop-color="#c9943a" stop-opacity="0.18" />
      </radialGradient>
    </defs>

    <!-- background halos -->
    <circle cx="300" cy="300" r="295" fill="url(#hero-teal-glow)" />
    <circle cx="300" cy="300" r="158" fill="url(#hero-gold-core)" />

    <!-- anchor rings -->
    <circle
      cx="300"
      cy="300"
      r="290"
      stroke="white"
      stroke-width="0.4"
      stroke-opacity="0.12"
    />

    <!-- outer dashed ring — counter-rotates slowly -->
    <g class="anim-rotate-ccw">
      <circle
        cx="300"
        cy="300"
        r="262"
        stroke="white"
        stroke-width="0.8"
        stroke-opacity="0.30"
        stroke-dasharray="18 6 4 6"
      />
    </g>

    <!-- second dashed ring — rotates CW -->
    <g class="anim-rotate-cw">
      <circle
        cx="300"
        cy="300"
        r="244"
        stroke="white"
        stroke-width="0.45"
        stroke-opacity="0.14"
        stroke-dasharray="3 10"
      />
    </g>

    <!-- 36 fine ticks (every 10°) -->
    <g
      transform="translate(300,300)"
      stroke="white"
      stroke-width="0.5"
      stroke-opacity="0.20"
    >
      <use href="#itick-fine" transform="rotate(0)" /><use
        href="#itick-fine"
        transform="rotate(10)"
      />
      <use href="#itick-fine" transform="rotate(20)" /><use
        href="#itick-fine"
        transform="rotate(30)"
      />
      <use href="#itick-fine" transform="rotate(40)" /><use
        href="#itick-fine"
        transform="rotate(50)"
      />
      <use href="#itick-fine" transform="rotate(60)" /><use
        href="#itick-fine"
        transform="rotate(70)"
      />
      <use href="#itick-fine" transform="rotate(80)" /><use
        href="#itick-fine"
        transform="rotate(90)"
      />
      <use href="#itick-fine" transform="rotate(100)" /><use
        href="#itick-fine"
        transform="rotate(110)"
      />
      <use href="#itick-fine" transform="rotate(120)" /><use
        href="#itick-fine"
        transform="rotate(130)"
      />
      <use href="#itick-fine" transform="rotate(140)" /><use
        href="#itick-fine"
        transform="rotate(150)"
      />
      <use href="#itick-fine" transform="rotate(160)" /><use
        href="#itick-fine"
        transform="rotate(170)"
      />
      <use href="#itick-fine" transform="rotate(180)" /><use
        href="#itick-fine"
        transform="rotate(190)"
      />
      <use href="#itick-fine" transform="rotate(200)" /><use
        href="#itick-fine"
        transform="rotate(210)"
      />
      <use href="#itick-fine" transform="rotate(220)" /><use
        href="#itick-fine"
        transform="rotate(230)"
      />
      <use href="#itick-fine" transform="rotate(240)" /><use
        href="#itick-fine"
        transform="rotate(250)"
      />
      <use href="#itick-fine" transform="rotate(260)" /><use
        href="#itick-fine"
        transform="rotate(270)"
      />
      <use href="#itick-fine" transform="rotate(280)" /><use
        href="#itick-fine"
        transform="rotate(290)"
      />
      <use href="#itick-fine" transform="rotate(300)" /><use
        href="#itick-fine"
        transform="rotate(310)"
      />
      <use href="#itick-fine" transform="rotate(320)" /><use
        href="#itick-fine"
        transform="rotate(330)"
      />
      <use href="#itick-fine" transform="rotate(340)" /><use
        href="#itick-fine"
        transform="rotate(350)"
      />
    </g>

    <!-- 24 chronometer ticks (every 15°) -->
    <g
      transform="translate(300,300)"
      stroke="white"
      stroke-width="0.65"
      stroke-opacity="0.28"
    >
      <use href="#itick" transform="rotate(0)" />
      <use href="#itick" transform="rotate(15)" />
      <use href="#itick" transform="rotate(30)" />
      <use href="#itick" transform="rotate(45)" />
      <use href="#itick" transform="rotate(60)" />
      <use href="#itick" transform="rotate(75)" />
      <use href="#itick" transform="rotate(90)" />
      <use href="#itick" transform="rotate(105)" />
      <use href="#itick" transform="rotate(120)" />
      <use href="#itick" transform="rotate(135)" />
      <use href="#itick" transform="rotate(150)" />
      <use href="#itick" transform="rotate(165)" />
      <use href="#itick" transform="rotate(180)" />
      <use href="#itick" transform="rotate(195)" />
      <use href="#itick" transform="rotate(210)" />
      <use href="#itick" transform="rotate(225)" />
      <use href="#itick" transform="rotate(240)" />
      <use href="#itick" transform="rotate(255)" />
      <use href="#itick" transform="rotate(270)" />
      <use href="#itick" transform="rotate(285)" />
      <use href="#itick" transform="rotate(300)" />
      <use href="#itick" transform="rotate(315)" />
      <use href="#itick" transform="rotate(330)" />
      <use href="#itick" transform="rotate(345)" />
    </g>

    <!-- intercardinal ticks: NE/SE/SW/NW -->
    <g
      transform="translate(300,300)"
      stroke="#c9943a"
      stroke-width="0.9"
      stroke-opacity="0.38"
    >
      <use href="#itick-mid" transform="rotate(45)" />
      <use href="#itick-mid" transform="rotate(135)" />
      <use href="#itick-mid" transform="rotate(225)" />
      <use href="#itick-mid" transform="rotate(315)" />
    </g>

    <!-- cardinal major ticks: N/E/S/W -->
    <g
      transform="translate(300,300)"
      stroke="#c9943a"
      stroke-width="1.3"
      stroke-opacity="0.65"
    >
      <use href="#itick-card" transform="rotate(0)" />
      <use href="#itick-card" transform="rotate(90)" />
      <use href="#itick-card" transform="rotate(180)" />
      <use href="#itick-card" transform="rotate(270)" />
    </g>

    <!-- intermediate ring — slow CCW -->
    <g class="anim-rotate-ccw" style="animation-duration: 180s">
      <circle
        cx="300"
        cy="300"
        r="222"
        stroke="white"
        stroke-width="0.5"
        stroke-opacity="0.14"
        stroke-dasharray="6 20 2 20"
      />
    </g>

    <!-- inner gear ring — rotates CW -->
    <g class="anim-rotate-cw">
      <circle
        cx="300"
        cy="300"
        r="170"
        stroke="white"
        stroke-width="1"
        stroke-opacity="0.34"
        stroke-dasharray="14 5"
      />
    </g>

    <!-- compass axes: N gold, E/S/W white -->
    <line
      x1="300"
      y1="300"
      x2="300"
      y2="90"
      stroke="#c9943a"
      stroke-width="1.0"
      stroke-opacity="0.55"
    />
    <line
      x1="300"
      y1="300"
      x2="510"
      y2="300"
      stroke="white"
      stroke-width="0.7"
      stroke-opacity="0.30"
    />
    <line
      x1="300"
      y1="300"
      x2="300"
      y2="510"
      stroke="white"
      stroke-width="0.7"
      stroke-opacity="0.30"
    />
    <line
      x1="300"
      y1="300"
      x2="90"
      y2="300"
      stroke="white"
      stroke-width="0.7"
      stroke-opacity="0.30"
    />

    <!-- compass rose diamond petals -->
    <!-- N petal (gold, prominent) -->
    <path
      d="M 300,300 L 292,248 300,190 308,248 Z"
      fill="#c9943a"
      fill-opacity="0.60"
    />
    <!-- S petal -->
    <path
      d="M 300,300 L 308,352 300,410 292,352 Z"
      fill="white"
      fill-opacity="0.15"
    />
    <!-- E petal -->
    <path
      d="M 300,300 L 352,292 410,300 352,308 Z"
      fill="white"
      fill-opacity="0.15"
    />
    <!-- W petal -->
    <path
      d="M 300,300 L 248,308 190,300 248,292 Z"
      fill="white"
      fill-opacity="0.15"
    />

    <!-- compass labels -->
    <text
      x="300"
      y="70"
      text-anchor="middle"
      fill="#c9943a"
      fill-opacity="0.84"
      font-family="'Cormorant Garamond', serif"
      font-size="13"
      letter-spacing="1">N</text
    >
    <text
      x="524"
      y="305"
      text-anchor="start"
      dominant-baseline="middle"
      fill="white"
      fill-opacity="0.42"
      font-family="'Cormorant Garamond', serif"
      font-size="12"
      letter-spacing="1">E</text
    >
    <text
      x="300"
      y="536"
      text-anchor="middle"
      fill="white"
      fill-opacity="0.42"
      font-family="'Cormorant Garamond', serif"
      font-size="12"
      letter-spacing="1">S</text
    >
    <text
      x="76"
      y="305"
      text-anchor="end"
      dominant-baseline="middle"
      fill="white"
      fill-opacity="0.42"
      font-family="'Cormorant Garamond', serif"
      font-size="12"
      letter-spacing="1">W</text
    >

    <!-- central reticle rings -->
    <circle
      cx="300"
      cy="300"
      r="62"
      stroke="white"
      stroke-width="0.4"
      stroke-opacity="0.15"
      fill="none"
    />
    <circle
      cx="300"
      cy="300"
      r="32"
      stroke="#c9943a"
      stroke-width="0.5"
      stroke-opacity="0.24"
      fill="none"
    />

    <!-- sweep arm (rotating sector) — radar scan effect -->
    <g clip-path="url(#hero-sweep-clip)">
      <g class="anim-sweep">
        <path
          d="M 300,300 L 300,38 A 262,262 0 0,1 431,73 Z"
          fill="url(#hero-sweep-fill)"
          fill-opacity="0.5"
        />
        <line
          x1="300"
          y1="300"
          x2="431"
          y2="73"
          stroke="#c9943a"
          stroke-width="0.8"
          stroke-opacity="0.40"
        />
      </g>
    </g>

    <!-- central focal point: pulsing halo + solid dot -->
    <circle
      class="anim-pulse"
      cx="300"
      cy="300"
      r="5"
      fill="none"
      stroke="#c9943a"
      stroke-width="1.2"
      stroke-opacity="0.45"
    />
    <circle cx="300" cy="300" r="3.5" fill="#c9943a" fill-opacity="0.88" />

    <!-- outer crosshair ticks at SVG edges -->
    <g stroke="#c9943a" stroke-width="1.5" stroke-opacity="0.55">
      <line x1="300" y1="4" x2="300" y2="20" />
      <line x1="300" y1="580" x2="300" y2="596" />
      <line x1="4" y1="300" x2="20" y2="300" />
      <line x1="580" y1="300" x2="596" y2="300" />
    </g>
    <!-- secondary bracket marks at crosshair edges -->
    <g stroke="white" stroke-width="0.8" stroke-opacity="0.22">
      <line x1="286" y1="9" x2="286" y2="16" /><line
        x1="314"
        y1="9"
        x2="314"
        y2="16"
      />
      <line x1="286" y1="584" x2="286" y2="591" /><line
        x1="314"
        y1="584"
        x2="314"
        y2="591"
      />
      <line x1="9" y1="286" x2="16" y2="286" /><line
        x1="9"
        y1="314"
        x2="16"
        y2="314"
      />
      <line x1="584" y1="286" x2="591" y2="286" /><line
        x1="584"
        y1="314"
        x2="591"
        y2="314"
      />
    </g>

    <!-- coordinate annotations -->
    <text
      x="420"
      y="126"
      text-anchor="middle"
      fill="#c9943a"
      fill-opacity="0.62"
      font-family="'Cormorant Garamond', serif"
      font-size="9.5"
      letter-spacing="1.5">48°52′N</text
    >
    <text
      x="180"
      y="484"
      text-anchor="middle"
      fill="#c9943a"
      fill-opacity="0.62"
      font-family="'Cormorant Garamond', serif"
      font-size="9.5"
      letter-spacing="1.5">2°21′E</text
    >
  </svg>

  <div class="l-container hero-inner">
    <div class="hero-text">
      <h1 class="hero-headline lp-reveal">
        Maps you'll<br /><em>be proud to share.</em>
      </h1>
      <p class="hero-sub lp-reveal">
        Design a beautiful, interactive map in the browser. Export one
        self-contained <abbr class="svg-abbr" title="SVG (Scalable Vector Graphics) is a standard image format supported by all modern browsers and design tools. Unlike a PNG or JPG, it stays perfectly sharp at any size and can be interactive.">SVG</abbr> and paste it anywhere — your site, your slides, your
        favorite CMS. No code, no plugins, no upkeep.
      </p>
      <div class="hero-actions lp-reveal">
        <a href="/app" class="btn-primary btn-large">Start designing</a>
        <a href="#showcase" class="btn-text-link">See examples</a>
      </div>
      <div class="hero-trust lp-reveal">
        <span>Free to start</span>
        <span class="trust-dot">·</span>
        <span>No account needed</span>
        <span class="trust-dot">·</span>
        <span>Exports work forever</span>
      </div>
    </div>
  </div>
</section>

<!-- ════════════════════════════════ MANIFESTO ════════════════════════════════ -->
<section class="manifesto">
  <div class="l-container">
    <div class="manifesto-header lp-reveal">
      <span class="section-tag">Our principles</span>
      <h2>
        Maps should be beautiful.<br /><em>And they should just work.</em>
      </h2>
    </div>
    <div class="manifesto-body">
      <div class="lp-reveal">
        <ValueCard
          number="01"
          title="One file, works everywhere"
          description="Your map exports as a single self-contained file. Paste it into your website, blog, or presentation — it just works. No plugins, no accounts, no dependencies."
        />
      </div>
      <div class="lp-reveal">
        <ValueCard
          number="02"
          title="Looks great out of the box"
          description="Thoughtful defaults, curated color palettes, and subtle effects mean your map looks polished before you've changed a single setting."
        />
      </div>
      <div class="lp-reveal">
        <ValueCard
          number="03"
          title="Any projection, any scale"
          description="Frame a continent as a globe, zoom into a single neighborhood, or tilt the view for depth. Every map style — from street level to world overview — in a few clicks."
        />
      </div>
      <div class="lp-reveal">
        <ValueCard
          number="04"
          title="Your spreadsheet becomes a map"
          description="Drop in a spreadsheet and Mapello colors your map automatically — by country, by region, by any column you choose. Add a legend in one click. No code required."
        />
      </div>
      <div class="lp-reveal">
        <ValueCard
          number="05"
          title="Annotate, link, and explain"
          description="Draw arrows, add labels in any font, attach a popup that opens on click. Every annotation — freehand, text, shape — exports with the map, interactive and self-contained."
        />
      </div>
      <div class="lp-reveal">
        <ValueCard
          number="06"
          title="No lock-in. Ever."
          description="There is no Mapello inside your exported file — just SVG. Cancel your account tomorrow and every map you've ever exported keeps working, unchanged, forever."
        />
      </div>
    </div>
  </div>
</section>

<!-- ════════════════════════════ MICRO SHOWCASE ══════════════════════════════════════ -->
<section id="showcase" class="showcase showcase-dark">
  <div class="l-container">
    <div class="section-header lp-reveal">
      <span class="section-tag">City maps</span>
      <h2>Street-level maps that stop the scroll</h2>
      <p>
        Zoom into any city or neighborhood. Customize colors, highlight
        buildings, add 3D, and export a map that looks like it came from a
        design studio.
      </p>
    </div>

    <div
      class="theater lp-reveal"
      onmouseenter={stopMicro}
      onmouseleave={startMicro}
      onfocusin={stopMicro}
      onfocusout={startMicro}
    >
      <div class="theater-stage">
        <div class="theater-display">
          {#key microKey}
            <div class="theater-map fade-in">
              <ShowcaseSlot
                title={microMaps[activeMicro].title}
                description=""
                src={microMaps[activeMicro].src}
                aspectRatio={microMaps[activeMicro].aspectRatio}
                placeholderGradient={microMaps[activeMicro].gradient}
              />
            </div>
          {/key}
        </div>
        <div class="theater-info">
          {#key microKey}
            <div class="fade-in">
              <h3 class="theater-title">{microMaps[activeMicro].title}</h3>
              <p class="theater-desc">{microMaps[activeMicro].description}</p>
              <div class="theater-techniques">
                {#each microMaps[activeMicro].highlights as h}
                  <span class="technique-badge">{h}</span>
                {/each}
              </div>
            </div>
          {/key}
        </div>
      </div>
      <div class="theater-tabbar">
        <span class="tabbar-hint">Explore {microMaps.length} examples</span>
        <div class="theater-tabs" role="tablist">
          {#each microMaps as map, i}
            <button
              class="theater-tab"
              class:active={activeMicro === i}
              role="tab"
              aria-selected={activeMicro === i}
              onclick={() => selectMicro(i)}
            >
              <span class="tab-index">{String(i + 1).padStart(2, "0")}</span>
              <span class="tab-label">{map.title}</span>
              {#if activeMicro === i && !microUserControlled && !reducedMotion}
                {#key microKey}
                  <span
                    class="tab-progress"
                    style="animation-duration:{microDuration()}ms"
                  ></span>
                {/key}
              {/if}
            </button>
          {/each}
        </div>
      </div>
    </div>
  </div>
</section>

<!-- ═══════════════════════════════ MACRO SHOWCASE ════════════════════════════════════ -->
<section class="showcase showcase-light">
  <div class="l-container">
    <div class="section-header lp-reveal">
      <span class="section-tag">World maps</span>
      <h2>Turn your data into a map in minutes</h2>
      <p>
        Country-by-country comparisons, election maps, trade flows, demographics
        — if you have a spreadsheet, Mapello can color a world map from it.
      </p>
    </div>

    <div
      class="theater lp-reveal"
      onmouseenter={stopMacro}
      onmouseleave={startMacro}
      onfocusin={stopMacro}
      onfocusout={startMacro}
    >
      <div class="theater-stage">
        <div class="theater-display">
          {#key macroKey}
            <div class="theater-map fade-in">
              <ShowcaseSlot
                title={macroMaps[activeMacro].title}
                description=""
                src={macroMaps[activeMacro].src}
                aspectRatio={macroMaps[activeMacro].aspectRatio}
                placeholderGradient={macroMaps[activeMacro].gradient}
              />
            </div>
          {/key}
        </div>
        <div class="theater-info">
          {#key macroKey}
            <div class="fade-in">
              <h3 class="theater-title">{macroMaps[activeMacro].title}</h3>
              <p class="theater-desc">{macroMaps[activeMacro].description}</p>
              <div class="theater-techniques">
                {#each macroMaps[activeMacro].highlights as h}
                  <span class="technique-badge">{h}</span>
                {/each}
              </div>
            </div>
          {/key}
        </div>
      </div>
      <div class="theater-tabbar">
        <span class="tabbar-hint">Explore {macroMaps.length} examples</span>
        <div class="theater-tabs" role="tablist">
          {#each macroMaps as map, i}
            <button
              class="theater-tab"
              class:active={activeMacro === i}
              role="tab"
              aria-selected={activeMacro === i}
              onclick={() => selectMacro(i)}
            >
              <span class="tab-index">{String(i + 1).padStart(2, "0")}</span>
              <span class="tab-label">{map.title}</span>
              {#if activeMacro === i && !macroUserControlled && !reducedMotion}
                {#key macroKey}
                  <span
                    class="tab-progress"
                    style="animation-duration:{macroDuration()}ms"
                  ></span>
                {/key}
              {/if}
            </button>
          {/each}
        </div>
      </div>
    </div>
  </div>
</section>

<!-- ════════════════════════════════ COMPARISON ══════════════════════════════════════ -->
<section class="comparison" id="compare">
  <div class="l-container">
    <div class="section-header lp-reveal">
      <span class="section-tag">How it compares</span>
      <h2>Where Mapello stands apart</h2>
      <p>
        Other tools make you choose between ease and quality — or tie your maps
        to their servers forever. Mapello doesn't.
      </p>
    </div>

    <!-- ── Macro ── -->
    <div class="comparison-block lp-reveal">
      <h3 class="comparison-group-title">Country, region &amp; world maps</h3>
      <div class="compare-table-wrap">
        <table class="compare-table">
          <thead>
            <tr>
              <th class="compare-col-feature"></th>
              <th class="compare-col-us">Mapello</th>
              <th
                >Hosted chart tools<br /><span class="col-sub"
                  >Datawrapper, Flourish…</span
                ></th
              >
              <th
                >Code libraries<br /><span class="col-sub"
                  >D3, Leaflet, Highcharts…</span
                ></th
              >
              <th
                >Static generators<br /><span class="col-sub"
                  >Mapchart, QGIS export…</span
                ></th
              >
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="compare-feature">Single self-contained SVG export</td>
              <td class="compare-col-us"
                ><svg class="ci-check" viewBox="0 0 16 16" fill="none"
                  ><polyline
                    points="2.5 8.5 6.5 12.5 13.5 4"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  /></svg
                ></td
              >
              <td
                title="Only on Datawrapper's Custom/Enterprise plans (from $599/mo), and meant for touch-ups in Illustrator — not for pasting straight into a page."
                ><svg class="ci-dash" viewBox="0 0 16 16" fill="none"
                  ><line
                    x1="3.5"
                    y1="8"
                    x2="12.5"
                    y2="8"
                    stroke-width="2"
                    stroke-linecap="round"
                  /></svg
                ></td
              >
              <td
                ><svg class="ci-dash" viewBox="0 0 16 16" fill="none"
                  ><line
                    x1="3.5"
                    y1="8"
                    x2="12.5"
                    y2="8"
                    stroke-width="2"
                    stroke-linecap="round"
                  /></svg
                ></td
              >
              <td
                ><svg class="ci-cross" viewBox="0 0 16 16" fill="none"
                  ><line
                    x1="3.5"
                    y1="3.5"
                    x2="12.5"
                    y2="12.5"
                    stroke-width="1.8"
                    stroke-linecap="round"
                  /><line
                    x1="12.5"
                    y1="3.5"
                    x2="3.5"
                    y2="12.5"
                    stroke-width="1.8"
                    stroke-linecap="round"
                  /></svg
                ></td
              >
            </tr>
            <tr>
              <td class="compare-feature"
                >Works forever, no server dependency</td
              >
              <td class="compare-col-us"
                ><svg class="ci-check" viewBox="0 0 16 16" fill="none"
                  ><polyline
                    points="2.5 8.5 6.5 12.5 13.5 4"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  /></svg
                ></td
              >
              <td
                title="The default embed depends on Datawrapper's servers forever. A standalone offline file only exists behind the $599/mo Custom plan, and drops the live interactivity."
                ><svg class="ci-dash" viewBox="0 0 16 16" fill="none"
                  ><line
                    x1="3.5"
                    y1="8"
                    x2="12.5"
                    y2="8"
                    stroke-width="2"
                    stroke-linecap="round"
                  /></svg
                ></td
              >
              <td
                ><svg
                  class="ci-check ci-check-muted"
                  viewBox="0 0 16 16"
                  fill="none"
                  ><polyline
                    points="2.5 8.5 6.5 12.5 13.5 4"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  /></svg
                ></td
              >
              <td
                ><svg
                  class="ci-check ci-check-muted"
                  viewBox="0 0 16 16"
                  fill="none"
                  ><polyline
                    points="2.5 8.5 6.5 12.5 13.5 4"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  /></svg
                ></td
              >
            </tr>
            <tr>
              <td class="compare-feature"
                >Interactive after export (tooltips, popovers)</td
              >
              <td class="compare-col-us"
                ><svg class="ci-check" viewBox="0 0 16 16" fill="none"
                  ><polyline
                    points="2.5 8.5 6.5 12.5 13.5 4"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  /></svg
                ></td
              >
              <td
                ><svg
                  class="ci-check ci-check-muted"
                  viewBox="0 0 16 16"
                  fill="none"
                  ><polyline
                    points="2.5 8.5 6.5 12.5 13.5 4"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  /></svg
                ></td
              >
              <td
                ><svg class="ci-dash" viewBox="0 0 16 16" fill="none"
                  ><line
                    x1="3.5"
                    y1="8"
                    x2="12.5"
                    y2="8"
                    stroke-width="2"
                    stroke-linecap="round"
                  /></svg
                ></td
              >
              <td
                ><svg class="ci-cross" viewBox="0 0 16 16" fill="none"
                  ><line
                    x1="3.5"
                    y1="3.5"
                    x2="12.5"
                    y2="12.5"
                    stroke-width="1.8"
                    stroke-linecap="round"
                  /><line
                    x1="12.5"
                    y1="3.5"
                    x2="3.5"
                    y2="12.5"
                    stroke-width="1.8"
                    stroke-linecap="round"
                  /></svg
                ></td
              >
            </tr>
            <tr>
              <td class="compare-feature">No code required</td>
              <td class="compare-col-us"
                ><svg class="ci-check" viewBox="0 0 16 16" fill="none"
                  ><polyline
                    points="2.5 8.5 6.5 12.5 13.5 4"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  /></svg
                ></td
              >
              <td
                ><svg
                  class="ci-check ci-check-muted"
                  viewBox="0 0 16 16"
                  fill="none"
                  ><polyline
                    points="2.5 8.5 6.5 12.5 13.5 4"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  /></svg
                ></td
              >
              <td
                ><svg class="ci-cross" viewBox="0 0 16 16" fill="none"
                  ><line
                    x1="3.5"
                    y1="3.5"
                    x2="12.5"
                    y2="12.5"
                    stroke-width="1.8"
                    stroke-linecap="round"
                  /><line
                    x1="12.5"
                    y1="3.5"
                    x2="3.5"
                    y2="12.5"
                    stroke-width="1.8"
                    stroke-linecap="round"
                  /></svg
                ></td
              >
              <td
                ><svg
                  class="ci-check ci-check-muted"
                  viewBox="0 0 16 16"
                  fill="none"
                  ><polyline
                    points="2.5 8.5 6.5 12.5 13.5 4"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  /></svg
                ></td
              >
            </tr>
            <tr>
              <td class="compare-feature">Data-bound coloring from a spreadsheet</td>
              <td class="compare-col-us"
                ><svg class="ci-check" viewBox="0 0 16 16" fill="none"
                  ><polyline
                    points="2.5 8.5 6.5 12.5 13.5 4"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  /></svg
                ></td
              >
              <td
                ><svg
                  class="ci-check ci-check-muted"
                  viewBox="0 0 16 16"
                  fill="none"
                  ><polyline
                    points="2.5 8.5 6.5 12.5 13.5 4"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  /></svg
                ></td
              >
              <td
                ><svg class="ci-dash" viewBox="0 0 16 16" fill="none"
                  ><line
                    x1="3.5"
                    y1="8"
                    x2="12.5"
                    y2="8"
                    stroke-width="2"
                    stroke-linecap="round"
                  /></svg
                ></td
              >
              <td
                ><svg class="ci-cross" viewBox="0 0 16 16" fill="none"
                  ><line
                    x1="3.5"
                    y1="3.5"
                    x2="12.5"
                    y2="12.5"
                    stroke-width="1.8"
                    stroke-linecap="round"
                  /><line
                    x1="12.5"
                    y1="3.5"
                    x2="3.5"
                    y2="12.5"
                    stroke-width="1.8"
                    stroke-linecap="round"
                  /></svg
                ></td
              >
            </tr>
            <tr>
              <td class="compare-feature"
                >Rich annotations (labels, freehand, shapes)</td
              >
              <td class="compare-col-us"
                ><svg class="ci-check" viewBox="0 0 16 16" fill="none"
                  ><polyline
                    points="2.5 8.5 6.5 12.5 13.5 4"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  /></svg
                ></td
              >
              <td
                ><svg class="ci-dash" viewBox="0 0 16 16" fill="none"
                  ><line
                    x1="3.5"
                    y1="8"
                    x2="12.5"
                    y2="8"
                    stroke-width="2"
                    stroke-linecap="round"
                  /></svg
                ></td
              >
              <td
                ><svg class="ci-dash" viewBox="0 0 16 16" fill="none"
                  ><line
                    x1="3.5"
                    y1="8"
                    x2="12.5"
                    y2="8"
                    stroke-width="2"
                    stroke-linecap="round"
                  /></svg
                ></td
              >
              <td
                ><svg class="ci-cross" viewBox="0 0 16 16" fill="none"
                  ><line
                    x1="3.5"
                    y1="3.5"
                    x2="12.5"
                    y2="12.5"
                    stroke-width="1.8"
                    stroke-linecap="round"
                  /><line
                    x1="12.5"
                    y1="3.5"
                    x2="3.5"
                    y2="12.5"
                    stroke-width="1.8"
                    stroke-linecap="round"
                  /></svg
                ></td
              >
            </tr>
            <tr>
              <td class="compare-feature">Free to start, no watermark</td>
              <td class="compare-col-us"
                ><svg class="ci-check" viewBox="0 0 16 16" fill="none"
                  ><polyline
                    points="2.5 8.5 6.5 12.5 13.5 4"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  /></svg
                ></td
              >
              <td
                ><svg class="ci-dash" viewBox="0 0 16 16" fill="none"
                  ><line
                    x1="3.5"
                    y1="8"
                    x2="12.5"
                    y2="8"
                    stroke-width="2"
                    stroke-linecap="round"
                  /></svg
                ></td
              >
              <td
                ><svg
                  class="ci-check ci-check-muted"
                  viewBox="0 0 16 16"
                  fill="none"
                  ><polyline
                    points="2.5 8.5 6.5 12.5 13.5 4"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  /></svg
                ></td
              >
              <td
                ><svg
                  class="ci-check ci-check-muted"
                  viewBox="0 0 16 16"
                  fill="none"
                  ><polyline
                    points="2.5 8.5 6.5 12.5 13.5 4"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  /></svg
                ></td
              >
            </tr>
            <tr>
              <td class="compare-feature"
                >Export highly optimized for small file size</td
              >
              <td class="compare-col-us"
                ><svg class="ci-check" viewBox="0 0 16 16" fill="none"
                  ><polyline
                    points="2.5 8.5 6.5 12.5 13.5 4"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  /></svg
                ></td
              >
              <td
                title="Built for editing in Illustrator, not for the web — Datawrapper's own docs warn that detailed locator map exports get heavy enough (300KB+) to slow down graphics software."
                ><svg class="ci-cross" viewBox="0 0 16 16" fill="none"
                  ><line
                    x1="3.5"
                    y1="3.5"
                    x2="12.5"
                    y2="12.5"
                    stroke-width="1.8"
                    stroke-linecap="round"
                  /><line
                    x1="12.5"
                    y1="3.5"
                    x2="3.5"
                    y2="12.5"
                    stroke-width="1.8"
                    stroke-linecap="round"
                  /></svg
                ></td
              >
              <td
                ><svg class="ci-dash" viewBox="0 0 16 16" fill="none"
                  ><line
                    x1="3.5"
                    y1="8"
                    x2="12.5"
                    y2="8"
                    stroke-width="2"
                    stroke-linecap="round"
                  /></svg
                ></td
              >
              <td
                ><svg class="ci-cross" viewBox="0 0 16 16" fill="none"
                  ><line
                    x1="3.5"
                    y1="3.5"
                    x2="12.5"
                    y2="12.5"
                    stroke-width="1.8"
                    stroke-linecap="round"
                  /><line
                    x1="12.5"
                    y1="3.5"
                    x2="3.5"
                    y2="12.5"
                    stroke-width="1.8"
                    stroke-linecap="round"
                  /></svg
                ></td
              >
            </tr>
            <tr>
              <td class="compare-feature"
                >Interactive 3D globe (tilt, rotate, altitude)</td
              >
              <td class="compare-col-us"
                ><svg class="ci-check" viewBox="0 0 16 16" fill="none"
                  ><polyline
                    points="2.5 8.5 6.5 12.5 13.5 4"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  /></svg
                ></td
              >
              <td
                title="Datawrapper only offers a small static globe as an inset thumbnail, not as an interactive main projection."
                ><svg class="ci-cross" viewBox="0 0 16 16" fill="none"
                  ><line
                    x1="3.5"
                    y1="3.5"
                    x2="12.5"
                    y2="12.5"
                    stroke-width="1.8"
                    stroke-linecap="round"
                  /><line
                    x1="12.5"
                    y1="3.5"
                    x2="3.5"
                    y2="12.5"
                    stroke-width="1.8"
                    stroke-linecap="round"
                  /></svg
                ></td
              >
              <td
                ><svg class="ci-dash" viewBox="0 0 16 16" fill="none"
                  ><line
                    x1="3.5"
                    y1="8"
                    x2="12.5"
                    y2="8"
                    stroke-width="2"
                    stroke-linecap="round"
                  /></svg
                ></td
              >
              <td
                ><svg class="ci-cross" viewBox="0 0 16 16" fill="none"
                  ><line
                    x1="3.5"
                    y1="3.5"
                    x2="12.5"
                    y2="12.5"
                    stroke-width="1.8"
                    stroke-linecap="round"
                  /><line
                    x1="12.5"
                    y1="3.5"
                    x2="3.5"
                    y2="12.5"
                    stroke-width="1.8"
                    stroke-linecap="round"
                  /></svg
                ></td
              >
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- ── Micro ── -->
    <div class="comparison-block lp-reveal">
      <h3 class="comparison-group-title">City &amp; street-level maps</h3>
      <div class="compare-table-wrap">
        <table class="compare-table">
          <thead>
            <tr>
              <th class="compare-col-feature"></th>
              <th class="compare-col-us">Mapello</th>
              <th
                >Map platforms<br /><span class="col-sub"
                  >Mapbox Studio, Felt…</span
                ></th
              >
              <th
                >Code libraries<br /><span class="col-sub"
                  >Prettymaps (Python)…</span
                ></th
              >
              <th
                >Embed widgets<br /><span class="col-sub">Google My Maps…</span
                ></th
              >
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="compare-feature">Single self-contained SVG export</td>
              <td class="compare-col-us"
                ><svg class="ci-check" viewBox="0 0 16 16" fill="none"
                  ><polyline
                    points="2.5 8.5 6.5 12.5 13.5 4"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  /></svg
                ></td
              >
              <td
                ><svg class="ci-cross" viewBox="0 0 16 16" fill="none"
                  ><line
                    x1="3.5"
                    y1="3.5"
                    x2="12.5"
                    y2="12.5"
                    stroke-width="1.8"
                    stroke-linecap="round"
                  /><line
                    x1="12.5"
                    y1="3.5"
                    x2="3.5"
                    y2="12.5"
                    stroke-width="1.8"
                    stroke-linecap="round"
                  /></svg
                ></td
              >
              <td
                ><svg class="ci-dash" viewBox="0 0 16 16" fill="none"
                  ><line
                    x1="3.5"
                    y1="8"
                    x2="12.5"
                    y2="8"
                    stroke-width="2"
                    stroke-linecap="round"
                  /></svg
                ></td
              >
              <td
                ><svg class="ci-cross" viewBox="0 0 16 16" fill="none"
                  ><line
                    x1="3.5"
                    y1="3.5"
                    x2="12.5"
                    y2="12.5"
                    stroke-width="1.8"
                    stroke-linecap="round"
                  /><line
                    x1="12.5"
                    y1="3.5"
                    x2="3.5"
                    y2="12.5"
                    stroke-width="1.8"
                    stroke-linecap="round"
                  /></svg
                ></td
              >
            </tr>
            <tr>
              <td class="compare-feature"
                >Works forever, no server dependency</td
              >
              <td class="compare-col-us"
                ><svg class="ci-check" viewBox="0 0 16 16" fill="none"
                  ><polyline
                    points="2.5 8.5 6.5 12.5 13.5 4"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  /></svg
                ></td
              >
              <td
                ><svg class="ci-cross" viewBox="0 0 16 16" fill="none"
                  ><line
                    x1="3.5"
                    y1="3.5"
                    x2="12.5"
                    y2="12.5"
                    stroke-width="1.8"
                    stroke-linecap="round"
                  /><line
                    x1="12.5"
                    y1="3.5"
                    x2="3.5"
                    y2="12.5"
                    stroke-width="1.8"
                    stroke-linecap="round"
                  /></svg
                ></td
              >
              <td
                ><svg
                  class="ci-check ci-check-muted"
                  viewBox="0 0 16 16"
                  fill="none"
                  ><polyline
                    points="2.5 8.5 6.5 12.5 13.5 4"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  /></svg
                ></td
              >
              <td
                ><svg class="ci-cross" viewBox="0 0 16 16" fill="none"
                  ><line
                    x1="3.5"
                    y1="3.5"
                    x2="12.5"
                    y2="12.5"
                    stroke-width="1.8"
                    stroke-linecap="round"
                  /><line
                    x1="12.5"
                    y1="3.5"
                    x2="3.5"
                    y2="12.5"
                    stroke-width="1.8"
                    stroke-linecap="round"
                  /></svg
                ></td
              >
            </tr>
            <tr>
              <td class="compare-feature"
                >Interactive after export (tooltips, popovers)</td
              >
              <td class="compare-col-us"
                ><svg class="ci-check" viewBox="0 0 16 16" fill="none"
                  ><polyline
                    points="2.5 8.5 6.5 12.5 13.5 4"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  /></svg
                ></td
              >
              <td
                ><svg
                  class="ci-check ci-check-muted"
                  viewBox="0 0 16 16"
                  fill="none"
                  ><polyline
                    points="2.5 8.5 6.5 12.5 13.5 4"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  /></svg
                ></td
              >
              <td
                ><svg class="ci-cross" viewBox="0 0 16 16" fill="none"
                  ><line
                    x1="3.5"
                    y1="3.5"
                    x2="12.5"
                    y2="12.5"
                    stroke-width="1.8"
                    stroke-linecap="round"
                  /><line
                    x1="12.5"
                    y1="3.5"
                    x2="3.5"
                    y2="12.5"
                    stroke-width="1.8"
                    stroke-linecap="round"
                  /></svg
                ></td
              >
              <td
                ><svg class="ci-dash" viewBox="0 0 16 16" fill="none"
                  ><line
                    x1="3.5"
                    y1="8"
                    x2="12.5"
                    y2="8"
                    stroke-width="2"
                    stroke-linecap="round"
                  /></svg
                ></td
              >
            </tr>
            <tr>
              <td class="compare-feature">No install, in-browser editing</td>
              <td class="compare-col-us"
                ><svg class="ci-check" viewBox="0 0 16 16" fill="none"
                  ><polyline
                    points="2.5 8.5 6.5 12.5 13.5 4"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  /></svg
                ></td
              >
              <td
                ><svg
                  class="ci-check ci-check-muted"
                  viewBox="0 0 16 16"
                  fill="none"
                  ><polyline
                    points="2.5 8.5 6.5 12.5 13.5 4"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  /></svg
                ></td
              >
              <td
                ><svg class="ci-cross" viewBox="0 0 16 16" fill="none"
                  ><line
                    x1="3.5"
                    y1="3.5"
                    x2="12.5"
                    y2="12.5"
                    stroke-width="1.8"
                    stroke-linecap="round"
                  /><line
                    x1="12.5"
                    y1="3.5"
                    x2="3.5"
                    y2="12.5"
                    stroke-width="1.8"
                    stroke-linecap="round"
                  /></svg
                ></td
              >
              <td
                ><svg
                  class="ci-check ci-check-muted"
                  viewBox="0 0 16 16"
                  fill="none"
                  ><polyline
                    points="2.5 8.5 6.5 12.5 13.5 4"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  /></svg
                ></td
              >
            </tr>
            <tr>
              <td class="compare-feature">Stylized, fully customizable look</td>
              <td class="compare-col-us"
                ><svg class="ci-check" viewBox="0 0 16 16" fill="none"
                  ><polyline
                    points="2.5 8.5 6.5 12.5 13.5 4"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  /></svg
                ></td
              >
              <td
                ><svg
                  class="ci-check ci-check-muted"
                  viewBox="0 0 16 16"
                  fill="none"
                  ><polyline
                    points="2.5 8.5 6.5 12.5 13.5 4"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  /></svg
                ></td
              >
              <td
                ><svg
                  class="ci-check ci-check-muted"
                  viewBox="0 0 16 16"
                  fill="none"
                  ><polyline
                    points="2.5 8.5 6.5 12.5 13.5 4"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  /></svg
                ></td
              >
              <td
                ><svg class="ci-cross" viewBox="0 0 16 16" fill="none"
                  ><line
                    x1="3.5"
                    y1="3.5"
                    x2="12.5"
                    y2="12.5"
                    stroke-width="1.8"
                    stroke-linecap="round"
                  /><line
                    x1="12.5"
                    y1="3.5"
                    x2="3.5"
                    y2="12.5"
                    stroke-width="1.8"
                    stroke-linecap="round"
                  /></svg
                ></td
              >
            </tr>
            <tr>
              <td class="compare-feature">3D building extrusion</td>
              <td class="compare-col-us"
                ><svg class="ci-check" viewBox="0 0 16 16" fill="none"
                  ><polyline
                    points="2.5 8.5 6.5 12.5 13.5 4"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  /></svg
                ></td
              >
              <td
                ><svg
                  class="ci-check ci-check-muted"
                  viewBox="0 0 16 16"
                  fill="none"
                  ><polyline
                    points="2.5 8.5 6.5 12.5 13.5 4"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  /></svg
                ></td
              >
              <td
                ><svg class="ci-cross" viewBox="0 0 16 16" fill="none"
                  ><line
                    x1="3.5"
                    y1="3.5"
                    x2="12.5"
                    y2="12.5"
                    stroke-width="1.8"
                    stroke-linecap="round"
                  /><line
                    x1="12.5"
                    y1="3.5"
                    x2="3.5"
                    y2="12.5"
                    stroke-width="1.8"
                    stroke-linecap="round"
                  /></svg
                ></td
              >
              <td
                ><svg class="ci-cross" viewBox="0 0 16 16" fill="none"
                  ><line
                    x1="3.5"
                    y1="3.5"
                    x2="12.5"
                    y2="12.5"
                    stroke-width="1.8"
                    stroke-linecap="round"
                  /><line
                    x1="12.5"
                    y1="3.5"
                    x2="3.5"
                    y2="12.5"
                    stroke-width="1.8"
                    stroke-linecap="round"
                  /></svg
                ></td
              >
            </tr>
            <tr>
              <td class="compare-feature">Free to start, no watermark</td>
              <td class="compare-col-us"
                ><svg class="ci-check" viewBox="0 0 16 16" fill="none"
                  ><polyline
                    points="2.5 8.5 6.5 12.5 13.5 4"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  /></svg
                ></td
              >
              <td
                ><svg class="ci-dash" viewBox="0 0 16 16" fill="none"
                  ><line
                    x1="3.5"
                    y1="8"
                    x2="12.5"
                    y2="8"
                    stroke-width="2"
                    stroke-linecap="round"
                  /></svg
                ></td
              >
              <td
                ><svg
                  class="ci-check ci-check-muted"
                  viewBox="0 0 16 16"
                  fill="none"
                  ><polyline
                    points="2.5 8.5 6.5 12.5 13.5 4"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  /></svg
                ></td
              >
              <td
                ><svg
                  class="ci-check ci-check-muted"
                  viewBox="0 0 16 16"
                  fill="none"
                  ><polyline
                    points="2.5 8.5 6.5 12.5 13.5 4"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  /></svg
                ></td
              >
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="compare-legend lp-reveal">
      <span
        ><svg class="ci-check" viewBox="0 0 16 16" fill="none"
          ><polyline
            points="2.5 8.5 6.5 12.5 13.5 4"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          /></svg
        > Fully supported</span
      >
      <span
        ><svg class="ci-dash" viewBox="0 0 16 16" fill="none"
          ><line
            x1="3.5"
            y1="8"
            x2="12.5"
            y2="8"
            stroke-width="2"
            stroke-linecap="round"
          /></svg
        > Partial / depends</span
      >
      <span
        ><svg class="ci-cross" viewBox="0 0 16 16" fill="none"
          ><line
            x1="3.5"
            y1="3.5"
            x2="12.5"
            y2="12.5"
            stroke-width="1.8"
            stroke-linecap="round"
          /><line
            x1="12.5"
            y1="3.5"
            x2="3.5"
            y2="12.5"
            stroke-width="1.8"
            stroke-linecap="round"
          /></svg
        > Not supported</span
      >
    </div>
  </div>
</section>

<!-- ══════════════════════════════════ STATS STRIP ═══════════════════════════════════ -->
<section class="stats">
  <div class="l-container">
    <div class="stats-grid lp-reveal">
      <div class="stat">
        <span class="stat-value">0</span>
        <span class="stat-label">external dependencies in your export</span>
      </div>
      <div class="stat-divider"></div>
      <div class="stat">
        <span class="stat-value">&lt; 100 KB</span>
        <span class="stat-label">typical map, complete and ready</span>
      </div>
      <div class="stat-divider"></div>
      <div class="stat">
        <span class="stat-value">&#x221e;</span>
        <span class="stat-label">years it works · no servers needed</span>
      </div>
    </div>
  </div>
</section>

<!-- ═══════════════════════════════════ PRICING ══════════════════════════════════════ -->
<section class="pricing" id="pricing">
  <div class="l-container">
    <div class="section-header lp-reveal">
      <span class="section-tag">Pricing</span>
      <h2>Start free. Pay when you're ready.</h2>
      <p>
        Design as much as you want for free. Export your first 3 maps with no
        account needed. Upgrade when your project grows.
      </p>
    </div>

    <div class="pricing-grid lp-reveal">
      <!-- Free -->
      <div class="pricing-card pricing-free">
        <div class="pricing-card-head">
          <h3>Free</h3>
          <div class="pricing-amount">
            <span class="pricing-currency">$</span><span class="pricing-value"
              >0</span
            >
          </div>
          <span class="pricing-period">no credit card needed</span>
        </div>
        <ul class="pricing-features">
          <li>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"><polyline points="20 6 9 17 4 12" /></svg
            >Full editor — every feature
          </li>
          <li>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"><polyline points="20 6 9 17 4 12" /></svg
            >3 exported maps per month
          </li>
          <li>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"><polyline points="20 6 9 17 4 12" /></svg
            >Saves in your browser
          </li>
        </ul>
        <a href="/app" class="btn-outline">Get started free</a>
      </div>

      <!-- Pro Monthly -->
      <div class="pricing-card pricing-pro">
        <div class="pricing-popular">Most popular</div>
        <div class="pricing-card-head">
          <h3>Pro</h3>
          <div class="pricing-amount">
            <span class="pricing-currency">$</span><span class="pricing-value"
              >15</span
            >
          </div>
          <span class="pricing-period">per month</span>
        </div>
        <ul class="pricing-features">
          <li>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"><polyline points="20 6 9 17 4 12" /></svg
            >Everything in Free
          </li>
          <li>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"><polyline points="20 6 9 17 4 12" /></svg
            ><span><strong>Unlimited</strong> exported maps</span>
          </li>
          <li>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"><polyline points="20 6 9 17 4 12" /></svg
            ><span><strong>Unlimited</strong> saved projects</span>
          </li>
          <li>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"><polyline points="20 6 9 17 4 12" /></svg
            >Priority support
          </li>
        </ul>
        <a href="/app" class="btn-primary btn-wide">Get started</a>
      </div>

      <!-- Annual -->
      <div class="pricing-card pricing-annual">
        <div class="pricing-card-head">
          <h3>Pro — Annual</h3>
          <div class="pricing-amount">
            <span class="pricing-currency">$</span><span class="pricing-value"
              >150</span
            >
          </div>
          <span class="pricing-period">per year</span>
        </div>
        <div class="pricing-save">Save $30 — 2 months free</div>
        <ul class="pricing-features">
          <li>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"><polyline points="20 6 9 17 4 12" /></svg
            >Everything in Pro
          </li>
          <li>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"><polyline points="20 6 9 17 4 12" /></svg
            >One payment per year
          </li>
        </ul>
        <a href="/app" class="btn-outline">Choose annual</a>
      </div>
    </div>
  </div>
</section>

<!-- ══════════════════════════════════════ FAQ ════════════════════════════════════════ -->
<section class="faq" id="faq">
  <div class="l-container">
    <div class="section-header lp-reveal">
      <span class="section-tag">FAQ</span>
      <h2>Common questions</h2>
    </div>
    <div class="faq-list">
      {#each faqs as faq, i}
        <div class="faq-item lp-reveal">
          <button
            class="faq-question"
            class:open={openFaq === i}
            onclick={() => openFaq = openFaq === i ? null : i}
            aria-expanded={openFaq === i}
          >
            <span>{faq.q}</span>
            <svg class="faq-chevron" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <polyline points="3 6 8 11 13 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
          {#if openFaq === i}
            <div class="faq-answer">{@html faq.a}</div>
          {/if}
        </div>
      {/each}
    </div>
  </div>
</section>

<!-- ════════════════════════════════ FINAL CTA ═══════════════════════════════════════ -->
<section class="cta">
  <div class="cta-compass" aria-hidden="true">
    <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle
        cx="100"
        cy="100"
        r="94"
        stroke="currentColor"
        stroke-width="0.8"
        stroke-opacity="0.6"
      />
      <circle
        cx="100"
        cy="100"
        r="72"
        stroke="currentColor"
        stroke-width="0.5"
        stroke-opacity="0.35"
      />
      <circle
        cx="100"
        cy="100"
        r="50"
        stroke="currentColor"
        stroke-width="0.4"
        stroke-opacity="0.2"
      />
      <line
        x1="100"
        y1="6"
        x2="100"
        y2="28"
        stroke="currentColor"
        stroke-width="1.2"
      />
      <line
        x1="100"
        y1="172"
        x2="100"
        y2="194"
        stroke="currentColor"
        stroke-width="1.2"
      />
      <line
        x1="6"
        y1="100"
        x2="28"
        y2="100"
        stroke="currentColor"
        stroke-width="1.2"
      />
      <line
        x1="172"
        y1="100"
        x2="194"
        y2="100"
        stroke="currentColor"
        stroke-width="1.2"
      />
      <line
        x1="33"
        y1="33"
        x2="167"
        y2="167"
        stroke="currentColor"
        stroke-width="0.5"
        stroke-dasharray="3 5"
        stroke-opacity="0.45"
      />
      <line
        x1="167"
        y1="33"
        x2="33"
        y2="167"
        stroke="currentColor"
        stroke-width="0.5"
        stroke-dasharray="3 5"
        stroke-opacity="0.45"
      />
      <polygon points="100,8 105,42 100,36 95,42" fill="currentColor" />
      <polygon
        points="100,192 105,158 100,164 95,158"
        fill="currentColor"
        fill-opacity="0.45"
      />
      <polygon
        points="192,100 158,105 164,100 158,95"
        fill="currentColor"
        fill-opacity="0.45"
      />
      <polygon
        points="8,100 42,105 36,100 42,95"
        fill="currentColor"
        fill-opacity="0.45"
      />
      <circle cx="100" cy="100" r="4" fill="currentColor" />
      <circle cx="100" cy="100" r="2" fill="currentColor" fill-opacity="0.5" />
      <g stroke="currentColor" stroke-width="1" stroke-opacity="0.4">
        <line x1="166" y1="34" x2="161" y2="39" />
        <line x1="34" y1="34" x2="39" y2="39" />
        <line x1="166" y1="166" x2="161" y2="161" />
        <line x1="34" y1="166" x2="39" y2="161" />
      </g>
    </svg>
  </div>
  <div class="l-container">
    <div class="cta-inner lp-reveal">
      <span class="section-tag">Get started</span>
      <h2>Your first 3 maps are on us.</h2>
      <p>Open the editor and begin.<br /><em>No account needed.</em></p>
      <a href="/app" class="btn-primary btn-large">Start designing</a>
      <span class="cta-note">Free · Exports work forever</span>
    </div>
  </div>
</section>

<!-- ═══════════════════════════════════ FOOTER ═══════════════════════════════════════ -->
<footer>
  <div class="l-container footer-inner">
    <div class="footer-brand-col">
      <img
        src="/logo_wordmark_transparent.png"
        alt="Mapello"
        class="footer-logo-img"
        height="36"
      />
      <span class="footer-tagline">Maps you'll be proud to share.</span>
    </div>
    <div class="footer-links-col">
      <span class="footer-col-title">Product</span>
      <a href="/app">Editor</a>
      <a href="#showcase">Examples</a>
      <a href="#pricing">Pricing</a>
      <a href="#faq">FAQ</a>
    </div>
    <div class="footer-links-col">
      <span class="footer-col-title">Company</span>
      <a href="/about">About</a>
      <a href="/privacy">Privacy</a>
      <a href="/terms">Terms</a>
      <a href="/contact">Contact</a>
    </div>
  </div>
  <div class="l-container footer-bottom">
    <span>&copy; 2026 Mapello. Made with care.</span>
    <a
      href="https://github.com/qpincon/mapello"
      class="footer-github"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Mapello on GitHub"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
      </svg>
      <span>View on GitHub</span>
    </a>
  </div>
</footer>

<style>
  abbr.svg-abbr {
    text-decoration: underline dotted currentColor;
    text-underline-offset: 3px;
    cursor: help;
  }

  /* ── Scroll animation ── */
  :global(.lp-reveal) {
    animation: scrollReveal 0.65s ease both;
    animation-play-state: paused;
  }
  :global(.lp-reveal.visible) {
    animation-play-state: running;
  }
  @keyframes scrollReveal {
    from {
      opacity: 0;
      transform: translateY(24px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  .fade-in {
    animation: fadeSlideIn 0.4s ease both;
  }
  @keyframes fadeSlideIn {
    from {
      opacity: 0;
      transform: translateY(8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  /* ── Shared section layout ── */
  section {
    position: relative;
    overflow: hidden;
  }

  .section-header {
    text-align: center;
    max-width: 620px;
    margin: 0 auto 3.5rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.85rem;
  }
  .section-header h2 {
    font-family: var(--font-serif);
    font-size: clamp(1.7rem, 3.2vw, 2.4rem);
    font-weight: 600;
    line-height: 1.2;
    letter-spacing: 0.01em;
  }
  .section-header p {
    font-size: 1rem;
    line-height: 1.72;
  }

  /* ── Section tag (gold across all sections) ── */
  .section-tag {
    display: inline-block;
    font-size: 0.68rem;
    font-weight: 700;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    color: var(--color-gold);
    background: var(--color-gold-soft);
    border: 1px solid var(--color-gold-border);
    padding: 0.28rem 0.85rem;
    border-radius: var(--radius-pill);
    width: fit-content;
  }

  /* ── Buttons ── */
  .btn-primary {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0.82rem 2rem;
    background: var(--color-gold);
    color: var(--color-ink);
    font-weight: 600;
    font-size: 0.9rem;
    letter-spacing: 0.01em;
    border-radius: 4px;
    transition:
      background var(--transition),
      transform var(--transition),
      box-shadow var(--transition);
  }
  .btn-primary:hover {
    background: var(--color-gold-hover);
    transform: translateY(-2px);
    box-shadow: 0 8px 28px rgba(201, 148, 58, 0.38);
  }
  .btn-large {
    padding: 1rem 2.5rem;
    font-size: 0.95rem;
  }
  .btn-wide {
    width: 100%;
  }
  .btn-text-link {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.8rem;
    font-weight: 500;
    letter-spacing: 0.02em;
    color: rgba(255, 255, 255, 0.36);
    transition: color var(--transition);
  }
  .btn-text-link::after {
    content: "→";
    transition: transform var(--transition);
  }
  .btn-text-link:hover {
    color: rgba(255, 255, 255, 0.65);
  }
  .btn-text-link:hover::after {
    transform: translateX(3px);
  }
  .btn-outline {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    padding: 0.75rem 1.5rem;
    color: var(--color-parchment-text);
    font-weight: 600;
    font-size: 0.9rem;
    border-radius: var(--radius-pill);
    border: 1.5px solid rgba(160, 120, 60, 0.25);
    transition:
      border-color var(--transition),
      background var(--transition);
  }
  .btn-outline:hover {
    border-color: var(--color-gold);
    background: var(--color-gold-soft);
  }

  /* ── Hero ── */
  .hero {
    background-color: var(--color-ink);
    background-image:
      radial-gradient(circle, rgba(255, 255, 255, 0.055) 1px, transparent 1px),
      radial-gradient(
        circle at 50% 50%,
        rgba(201, 148, 58, 0.055) 0%,
        transparent 44%
      ),
      radial-gradient(
        ellipse at 96% 4%,
        rgba(42, 125, 110, 0.12) 0%,
        transparent 50%
      ),
      radial-gradient(
        ellipse at 4% 96%,
        rgba(201, 148, 58, 0.07) 0%,
        transparent 50%
      );
    background-size:
      30px 30px,
      100% 100%,
      100% 100%,
      100% 100%;
    padding: calc(9rem + 64px) 0 12rem;
    display: flex;
    align-items: center;
  }
  .hero-side {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    width: 72px;
    height: 340px;
    pointer-events: none;
  }
  .hero-side-left {
    left: max(1.2rem, 3.5vw);
  }
  .hero-side-right {
    right: max(1.2rem, 3.5vw);
  }
  @media (max-width: 860px) {
    .hero-side {
      display: none;
    }
  }
  .hero-graticule {
    position: absolute;
    top: 50%;
    left: 0;
    width: 100%;
    height: 340px;
    transform: translateY(-50%);
    pointer-events: none;
  }
  .hero-corner {
    position: absolute;
    width: 40px;
    height: 40px;
    pointer-events: none;
  }
  .hero-corner-tl {
    top: calc(50% - 175px);
    left: max(1.2rem, 3.5vw);
  }
  .hero-corner-tr {
    top: calc(50% - 175px);
    right: max(1.2rem, 3.5vw);
  }
  .hero-corner-bl {
    top: calc(50% + 135px);
    left: max(1.2rem, 3.5vw);
  }
  .hero-corner-br {
    top: calc(50% + 135px);
    right: max(1.2rem, 3.5vw);
  }
  .hero-fold {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    width: 140px;
    height: 12px;
    pointer-events: none;
  }
  .hero-fold-top {
    top: 7rem;
  }
  .hero-fold-bottom {
    bottom: 6rem;
  }
  @media (max-width: 640px) {
    .hero-corner,
    .hero-fold {
      display: none;
    }
  }
  .hero-instrument {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: min(88vw, 640px);
    opacity: 0.58;
    pointer-events: none;
    filter: drop-shadow(0 0 24px rgba(201, 148, 58, 0.18))
      drop-shadow(0 0 56px rgba(42, 125, 110, 0.1));
  }
  .anim-rotate-cw,
  .anim-rotate-ccw,
  .anim-pulse {
    transform-box: fill-box;
    transform-origin: center;
  }
  .anim-rotate-cw {
    animation: instrument-rotate-cw 80s linear infinite;
  }
  .anim-rotate-ccw {
    animation: instrument-rotate-ccw 120s linear infinite;
  }
  .anim-pulse {
    animation: instrument-pulse 2.6s ease-in-out infinite;
  }
  .anim-sweep {
    transform-box: view-box;
    transform-origin: 300px 300px;
    animation: instrument-rotate-cw 22s linear infinite;
  }
  @keyframes instrument-rotate-cw {
    to {
      transform: rotate(360deg);
    }
  }
  @keyframes instrument-rotate-ccw {
    to {
      transform: rotate(-360deg);
    }
  }
  @keyframes instrument-pulse {
    0%,
    100% {
      transform: scale(1);
      opacity: 0.42;
    }
    50% {
      transform: scale(3.2);
      opacity: 0;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .anim-rotate-cw,
    .anim-rotate-ccw,
    .anim-pulse,
    .anim-sweep {
      animation: none;
    }
  }
  .hero-inner {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    position: relative;
  }
  .hero-text {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.65rem;
    max-width: 720px;
  }
  .hero-headline {
    font-family: var(--font-serif);
    font-size: clamp(3rem, 5.5vw, 5.5rem);
    font-weight: 400;
    line-height: 1.05;
    letter-spacing: -0.01em;
    color: rgba(255, 255, 255, 0.85);
  }
  .hero-headline em {
    font-style: italic;
    font-weight: 600;
    color: #fff;
    text-decoration: underline;
    text-decoration-color: rgba(201, 148, 58, 0.45);
    text-underline-offset: 5px;
    text-decoration-thickness: 1px;
  }
  .hero-sub {
    font-size: 1.12rem;
    color: rgba(255, 255, 255, 0.58);
    line-height: 1.72;
    max-width: 560px;
  }
  .hero-actions {
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
  }
  .hero-trust {
    display: flex;
    align-items: center;
    gap: 0.7rem;
    font-size: 0.74rem;
    color: rgba(255, 255, 255, 0.24);
    font-weight: 500;
    letter-spacing: 0.01em;
  }
  .trust-dot {
    opacity: 0.5;
  }

  /* ── Manifesto ── */
  .manifesto {
    background-color: var(--color-parchment);
    background-image:
      repeating-radial-gradient(
        circle at 22% 32%,
        transparent 0,
        transparent 100px,
        rgba(160, 120, 60, 0.065) 101px,
        transparent 102px
      ),
      repeating-radial-gradient(
        circle at 78% 68%,
        transparent 0,
        transparent 130px,
        rgba(160, 120, 60, 0.045) 131px,
        transparent 132px
      );
    padding: 4.5rem 0 3.5rem;
  }
  .manifesto-header {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    margin-bottom: 0;
    max-width: 640px;
  }
  .manifesto-header h2 {
    font-family: var(--font-serif);
    font-size: clamp(1.8rem, 3.5vw, 2.6rem);
    font-weight: 600;
    line-height: 1.2;
    color: var(--color-parchment-text);
    letter-spacing: 0.01em;
  }
  .manifesto-header h2 em {
    font-style: italic;
    color: var(--color-parchment-muted);
  }
  .manifesto-body {
    display: grid;
    grid-template-columns: 1fr 1fr;
    column-gap: 4rem;
  }

  /* ── Showcase ── */
  .showcase {
    padding: 5.5rem 0;
  }
  .showcase :global(.l-container) {
    max-width: 1440px;
    padding: 0 2rem;
  }

  .showcase-dark {
    background-color: var(--color-ink-mid);
    background-image: radial-gradient(
      circle,
      rgba(255, 255, 255, 0.048) 1px,
      transparent 1px
    );
    background-size: 30px 30px;
  }
  .showcase-dark .section-header h2 {
    color: var(--color-text-on-dark);
  }
  .showcase-dark .section-header p {
    color: var(--color-text-on-dark-muted);
  }

  .showcase-light {
    background-color: var(--color-parchment);
    background-image:
      repeating-radial-gradient(
        circle at 30% 55%,
        transparent 0,
        transparent 120px,
        rgba(160, 120, 60, 0.05) 121px,
        transparent 122px
      ),
      repeating-radial-gradient(
        circle at 70% 20%,
        transparent 0,
        transparent 90px,
        rgba(160, 120, 60, 0.04) 91px,
        transparent 92px
      );
  }
  .showcase-light .section-header h2 {
    color: var(--color-parchment-text);
  }
  .showcase-light .section-header p {
    color: var(--color-parchment-muted);
  }

  /* Theater */
  .theater-stage {
    display: grid;
    grid-template-columns: 3fr 2fr;
    gap: 3rem;
    align-items: center;
    margin-bottom: 2rem;
  }
  .theater-display {
    overflow: hidden;
  }
  .theater-display :global(.slot-wrapper) {
    gap: 0;
  }
  .theater-display :global(.slot-caption) {
    display: none;
  }
  .theater-display :global(.slot-frame) {
    border-radius: 0;
  }
  .theater-display :global(svg) {
    overflow: visible;
  }

  .theater-info {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  .theater-title {
    font-family: var(--font-serif);
    font-size: 1.65rem;
    font-weight: 600;
    line-height: 1.2;
    letter-spacing: 0.01em;
  }
  .showcase-dark .theater-title {
    color: var(--color-text-on-dark);
  }
  .showcase-light .theater-title {
    color: var(--color-parchment-text);
  }

  .theater-desc {
    font-size: 0.95rem;
    line-height: 1.75;
    white-space: pre-line;
  }
  .showcase-dark .theater-desc {
    color: var(--color-text-on-dark-muted);
  }
  .showcase-light .theater-desc {
    color: var(--color-parchment-muted);
  }

  .theater-techniques {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-top: 0.5rem;
  }
  .technique-badge {
    font-size: 0.7rem;
    font-weight: 600;
    letter-spacing: 0.06em;
    padding: 0.28rem 0.7rem;
    border-radius: var(--radius-pill);
    background: transparent;
  }
  .showcase-dark .technique-badge {
    color: rgba(255, 255, 255, 0.42);
    border: 1px solid rgba(255, 255, 255, 0.14);
  }
  .showcase-light .technique-badge {
    color: var(--color-parchment-muted);
    border: 1px solid var(--color-gold-border);
  }

  .theater-tabbar {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.65rem;
    max-width: 100%;
    margin: 0 auto;
    padding: 0.9rem 1.1rem;
    border-radius: var(--radius-md);
  }
  .showcase-dark .theater-tabbar {
    border: 1px solid rgba(255, 255, 255, 0.12);
    background: rgba(255, 255, 255, 0.02);
  }
  .showcase-light .theater-tabbar {
    border: 1px solid var(--color-gold-border);
    background: rgba(201, 148, 58, 0.035);
  }

  .tabbar-hint {
    font-size: 0.7rem;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .showcase-dark .tabbar-hint {
    color: var(--color-text-on-dark-muted);
  }
  .showcase-light .tabbar-hint {
    color: var(--color-parchment-muted);
  }

  .theater-tabs {
    display: flex;
    gap: 0.4rem;
    flex-wrap: wrap;
    justify-content: center;
    max-width: 100%;
  }
  .theater-tab {
    position: relative;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.55rem 1rem;
    border-radius: var(--radius-sm);
    font-size: 0.82rem;
    font-weight: 500;
    transition:
      background var(--transition),
      color var(--transition),
      border-color var(--transition);
    border: 1px solid transparent;
    cursor: pointer;
    background: none;
    overflow: hidden;
  }
  .showcase-dark .theater-tab {
    color: rgba(226, 232, 240, 0.72);
  }
  .showcase-dark .theater-tab:hover {
    background: rgba(255, 255, 255, 0.055);
  }
  .showcase-dark .theater-tab.active {
    background: rgba(201, 148, 58, 0.1);
    color: var(--color-gold);
    border-color: var(--color-gold-border);
  }
  .showcase-light .theater-tab {
    color: var(--color-parchment-text);
    opacity: 0.75;
  }
  .showcase-light .theater-tab:hover {
    background: rgba(160, 120, 60, 0.07);
  }
  .showcase-light .theater-tab.active {
    background: rgba(201, 148, 58, 0.1);
    color: var(--color-gold);
    border-color: var(--color-gold-border);
    opacity: 1;
  }

  .tab-index {
    font-size: 0.68rem;
    font-weight: 700;
    opacity: 0.55;
    letter-spacing: 0.05em;
    font-variant-numeric: tabular-nums;
  }
  .theater-tab.active .tab-index {
    opacity: 1;
    color: var(--color-gold);
  }
  .tab-label {
    white-space: nowrap;
  }

  .tab-progress {
    position: absolute;
    left: 0;
    bottom: 0;
    height: 2px;
    width: 0;
    background: var(--color-gold);
    animation: progressFill linear forwards;
  }
  @keyframes progressFill {
    from {
      width: 0;
    }
    to {
      width: 100%;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .tab-progress {
      display: none;
    }
  }

  /* ── Comparison ── */
  .comparison {
    background-color: #111;
    background-image:
      radial-gradient(circle, rgba(255, 255, 255, 0.038) 1px, transparent 1px),
      radial-gradient(
        ellipse at 90% 8%,
        rgba(201, 148, 58, 0.07) 0%,
        transparent 50%
      );
    background-size:
      30px 30px,
      100% 100%;
    padding: 5.5rem 0;
  }
  .comparison .section-header h2 {
    color: var(--color-text-on-dark);
  }
  .comparison .section-header p {
    color: var(--color-text-on-dark-muted);
  }
  .comparison-block {
    margin-bottom: 3.5rem;
  }
  .comparison-group-title {
    font-size: 0.7rem;
    font-weight: 600;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.3);
    margin-bottom: 1rem;
  }
  .compare-table-wrap {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    border-radius: var(--radius-md);
    border: 1px solid rgba(255, 255, 255, 0.07);
  }
  .compare-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.88rem;
    min-width: 560px;
  }
  .compare-table thead tr {
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }
  .compare-table thead th {
    padding: 0.9rem 1.1rem;
    font-size: 0.72rem;
    font-weight: 600;
    letter-spacing: 0.06em;
    color: rgba(255, 255, 255, 0.4);
    text-align: center;
    vertical-align: bottom;
    line-height: 1.4;
  }
  .compare-table thead th.compare-col-feature {
    text-align: left;
    width: 34%;
  }
  .col-sub {
    display: block;
    font-size: 0.65rem;
    font-weight: 400;
    letter-spacing: 0.03em;
    color: rgba(255, 255, 255, 0.2);
    margin-top: 0.25rem;
    text-transform: none;
  }
  .compare-table tbody tr {
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  }
  .compare-table tbody tr:last-child {
    border-bottom: none;
  }
  .compare-table tbody td {
    padding: 0.8rem 1.1rem;
    text-align: center;
    vertical-align: middle;
    color: rgba(255, 255, 255, 0.5);
  }
  .compare-table tbody td.compare-feature {
    text-align: left;
    color: rgba(255, 255, 255, 0.72);
    font-weight: 500;
    font-size: 0.85rem;
  }
  .compare-table th.compare-col-us,
  .compare-table td.compare-col-us {
    background: rgba(201, 148, 58, 0.09);
    color: var(--color-gold);
    font-weight: 600;
  }
  .compare-table thead th.compare-col-us {
    color: #d4a050;
    letter-spacing: 0.08em;
  }
  .ci-check,
  .ci-cross,
  .ci-dash {
    width: 18px;
    height: 18px;
    display: inline-block;
    vertical-align: middle;
  }
  .ci-check {
    stroke: var(--color-gold);
  }
  .ci-check.ci-check-muted {
    stroke: rgba(255, 255, 255, 0.38);
  }
  .ci-cross {
    stroke: rgba(255, 255, 255, 0.2);
  }
  .ci-dash {
    stroke: rgba(255, 255, 255, 0.32);
  }
  .compare-legend {
    display: flex;
    align-items: center;
    gap: 1.75rem;
    flex-wrap: wrap;
    font-size: 0.75rem;
    color: rgba(255, 255, 255, 0.28);
    margin-top: 1.5rem;
    padding-left: 0.25rem;
  }
  .compare-legend span {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
  }
  .compare-legend .ci-check {
    stroke: rgba(255, 255, 255, 0.38);
  }

  /* ── Stats ── */
  .stats {
    background-color: var(--color-ink);
    background-image:
      repeating-radial-gradient(
        circle at 30% 50%,
        transparent 0,
        transparent 80px,
        rgba(201, 148, 58, 0.055) 81px,
        transparent 82px
      ),
      repeating-radial-gradient(
        circle at 70% 50%,
        transparent 0,
        transparent 110px,
        rgba(201, 148, 58, 0.04) 111px,
        transparent 112px
      );
    padding: 5rem 0;
    border-top: 1px solid rgba(201, 148, 58, 0.1);
    border-bottom: 1px solid rgba(201, 148, 58, 0.1);
  }
  .stats-grid {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4rem;
  }
  .stat {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.6rem;
    text-align: center;
  }
  .stat-value {
    font-family: var(--font-serif);
    font-size: clamp(3.5rem, 6vw, 5.5rem);
    font-weight: 400;
    color: var(--color-gold);
    line-height: 1;
    letter-spacing: -0.02em;
  }
  .stat-label {
    font-size: 0.8rem;
    color: rgba(255, 255, 255, 0.35);
    font-weight: 400;
    max-width: 160px;
    line-height: 1.55;
  }
  .stat-divider {
    width: 1px;
    height: 4rem;
    background: rgba(201, 148, 58, 0.22);
    flex-shrink: 0;
  }

  /* ── Pricing ── */
  .pricing {
    background-color: var(--color-parchment-light);
    background-image: repeating-radial-gradient(
      circle at 60% 40%,
      transparent 0,
      transparent 140px,
      rgba(160, 120, 60, 0.04) 141px,
      transparent 142px
    );
    padding: 6rem 0;
  }
  .pricing .section-header h2 {
    color: var(--color-parchment-text);
  }
  .pricing .section-header p {
    color: var(--color-parchment-muted);
  }
  .pricing-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1.5rem;
    max-width: 960px;
    margin: 0 auto;
  }
  .pricing-card {
    display: flex;
    flex-direction: column;
    padding: 2rem 1.75rem;
    border-radius: var(--radius-lg);
    border: 1.5px solid rgba(160, 120, 60, 0.2);
    background: var(--color-white);
    position: relative;
  }
  .pricing-pro {
    border-color: var(--color-gold);
    box-shadow:
      0 0 0 1px var(--color-gold),
      var(--shadow-md);
  }
  .pricing-popular {
    position: absolute;
    top: -0.7rem;
    left: 50%;
    transform: translateX(-50%);
    font-size: 0.68rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--color-ink);
    background: var(--color-gold);
    padding: 0.25rem 0.9rem;
    border-radius: var(--radius-pill);
    white-space: nowrap;
  }
  .pricing-card-head {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    margin-bottom: 1.5rem;
    padding-bottom: 1.5rem;
    border-bottom: 1px solid rgba(160, 120, 60, 0.15);
  }
  .pricing-card-head h3 {
    font-size: 0.9rem;
    font-weight: 700;
    color: var(--color-parchment-muted);
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
  .pricing-amount {
    display: flex;
    align-items: baseline;
    gap: 0.05rem;
  }
  .pricing-currency {
    font-size: 1.1rem;
    font-weight: 500;
    color: var(--color-parchment-muted);
    align-self: flex-start;
    margin-top: 0.55rem;
  }
  .pricing-value {
    font-family: var(--font-serif);
    font-size: 4rem;
    font-weight: 600;
    letter-spacing: -0.02em;
    color: var(--color-parchment-text);
    line-height: 1;
  }
  .pricing-pro .pricing-value {
    color: var(--color-gold);
  }
  .pricing-period {
    font-size: 0.8rem;
    color: var(--color-parchment-muted);
    font-weight: 400;
  }
  .pricing-save {
    font-size: 0.76rem;
    font-weight: 600;
    color: var(--color-gold);
    background: var(--color-gold-soft);
    border: 1px solid var(--color-gold-border);
    padding: 0.3rem 0.7rem;
    border-radius: var(--radius-pill);
    width: fit-content;
    margin-bottom: 0.75rem;
  }
  .pricing-features {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 0.65rem;
    margin-bottom: 1.5rem;
    flex-grow: 1;
  }
  .pricing-features li {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    font-size: 0.875rem;
    color: var(--color-parchment-muted);
    line-height: 1.4;
  }
  .pricing-features svg {
    width: 1rem;
    height: 1rem;
    color: var(--color-gold);
    flex-shrink: 0;
  }

  /* ── CTA ── */
  .cta {
    background-color: var(--color-ink);
    background-image:
      radial-gradient(
        ellipse at 12% 50%,
        rgba(201, 148, 58, 0.09) 0%,
        transparent 55%
      ),
      radial-gradient(circle, rgba(255, 255, 255, 0.05) 1px, transparent 1px);
    background-size:
      100% 100%,
      30px 30px;
    padding: 7rem 0 6rem;
  }
  .cta-compass {
    position: absolute;
    right: 5%;
    top: 50%;
    transform: translateY(-50%);
    width: min(420px, 36vw);
    color: var(--color-gold);
    opacity: 0.07;
    pointer-events: none;
  }
  .cta-inner {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 1.5rem;
    max-width: 560px;
  }
  .cta-inner h2 {
    font-family: var(--font-serif);
    font-size: clamp(2rem, 4vw, 3.2rem);
    font-weight: 600;
    color: var(--color-text-on-dark);
    line-height: 1.15;
    letter-spacing: 0.01em;
  }
  .cta-inner p {
    font-size: 1.05rem;
    color: var(--color-text-on-dark-muted);
    line-height: 1.7;
    margin-top: -0.25rem;
  }
  .cta-inner p em {
    font-style: italic;
    color: rgba(255, 255, 255, 0.5);
  }
  .cta-note {
    font-size: 0.76rem;
    color: rgba(255, 255, 255, 0.25);
    letter-spacing: 0.05em;
    font-weight: 500;
    margin-top: -0.5rem;
  }

  /* ── Footer ── */
  footer {
    background: #040810;
    border-top: 1px solid rgba(201, 148, 58, 0.12);
    padding: 4rem 0 2rem;
  }
  .footer-inner {
    display: grid;
    grid-template-columns: 1.6fr 1fr 1fr;
    gap: 3rem;
    margin-bottom: 2.5rem;
    padding-bottom: 2.5rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  }
  .footer-brand-col {
    align-items: baseline;
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }
  .footer-logo-img {
    height: 36px;
    width: auto;
    display: block;
    filter: brightness(0) invert(1);
    opacity: 0.85;
  }
  .footer-tagline {
    font-size: 0.85rem;
    color: rgba(255, 255, 255, 0.38);
    line-height: 1.6;
  }
  .footer-links-col {
    display: flex;
    flex-direction: column;
    gap: 0.7rem;
  }
  .footer-col-title {
    font-size: 0.63rem;
    font-weight: 700;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.22);
    margin-bottom: 0.3rem;
  }
  .footer-links-col a {
    font-size: 0.875rem;
    color: rgba(255, 255, 255, 0.42);
    transition: color var(--transition);
  }
  .footer-links-col a:hover {
    color: rgba(255, 255, 255, 0.78);
  }
  .footer-bottom {
    font-size: 0.76rem;
    color: rgba(255, 255, 255, 0.18);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }
  .footer-github {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    color: rgba(255, 255, 255, 0.35);
    text-decoration: none;
    transition: color 0.2s ease;
  }
  .footer-github svg {
    width: 14px;
    height: 14px;
    fill: currentColor;
    flex-shrink: 0;
  }
  .footer-github:hover { color: var(--color-gold); }

  /* ── Responsive ── */
  @media (max-width: 1024px) {
    .theater-stage {
      grid-template-columns: 1fr;
      gap: 2rem;
    }
    .theater-info {
      text-align: center;
      align-items: center;
    }
    .theater-techniques {
      justify-content: center;
    }
  }
  @media (max-width: 900px) {
    .hero {
      padding: 6rem 0 5rem;
    }
    .manifesto-body {
      grid-template-columns: 1fr;
      column-gap: 0;
    }
  }
  @media (max-width: 768px) {
    .stats-grid {
      flex-direction: column;
      gap: 2.5rem;
    }
    .stat-divider {
      width: 3rem;
      height: 1px;
    }
    .pricing-grid {
      grid-template-columns: 1fr;
      max-width: 400px;
      margin: 0 auto;
    }
    .theater-tabbar {
      max-width: 100%;
      padding: 0.75rem 0.6rem;
    }
    .theater-tabs {
      gap: 0.3rem;
      flex-wrap: nowrap;
      justify-content: flex-start;
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
      scrollbar-width: none;
      padding-bottom: 2px;
    }
    .theater-tabs::-webkit-scrollbar {
      display: none;
    }
    .theater-tab {
      flex: 0 0 auto;
    }
    .tab-index {
      opacity: 1;
      font-size: 0.8rem;
    }
    .footer-inner {
      grid-template-columns: 1fr 1fr;
      gap: 2rem;
    }
    .footer-brand-col {
      grid-column: 1 / -1;
    }
    .cta-compass {
      display: none;
    }
  }
  @media (max-width: 640px) {
    .hero-headline {
      font-size: 2.6rem;
    }
    .hero-actions {
      justify-content: flex-start;
    }
    .footer-inner {
      grid-template-columns: 1fr;
    }
    .manifesto-header h2 {
      font-size: 1.6rem;
    }
  }
  @media (max-width: 720px) {
    .comparison {
      padding: 4rem 0;
    }
    .compare-table {
      font-size: 0.82rem;
    }
    .compare-table thead th,
    .compare-table tbody td {
      padding: 0.7rem 0.8rem;
    }
  }

  /* ── FAQ ── */
  .faq {
    padding: 6rem 0;
    background: var(--color-surface, #fff);
  }
  .faq-list {
    max-width: 720px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 0;
  }
  .faq-item {
    border-bottom: 1px solid var(--color-border, #e5e7eb);
  }
  .faq-item:first-child {
    border-top: 1px solid var(--color-border, #e5e7eb);
  }
  .faq-question {
    width: 100%;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
    padding: 1.25rem 0;
    background: none;
    border: none;
    cursor: pointer;
    text-align: left;
    font-size: 1rem;
    font-weight: 600;
    color: inherit;
    line-height: 1.4;
  }
  .faq-question:hover {
    opacity: 0.75;
  }
  .faq-chevron {
    width: 18px;
    height: 18px;
    flex-shrink: 0;
    transition: transform 0.2s ease;
  }
  .faq-question.open .faq-chevron {
    transform: rotate(180deg);
  }
  .faq-answer {
    padding: 0 0 1.25rem;
    font-size: 0.95rem;
    line-height: 1.7;
    color: var(--color-text-muted, #6b7280);
    max-width: 640px;
  }
</style>
