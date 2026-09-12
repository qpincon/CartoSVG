<svelte:head>
  <title>Contact — Mapello</title>
  <meta name="description" content="Get in touch with the Mapello team." />
  <link rel="canonical" href="https://mapello.net/contact" />
  <meta property="og:title" content="Contact — Mapello" />
  <meta property="og:description" content="Get in touch with the Mapello team." />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="https://mapello.net/contact" />
  <meta name="twitter:card" content="summary" />
  <meta name="twitter:title" content="Contact — Mapello" />
  <meta name="twitter:description" content="Get in touch with the Mapello team." />
  <link rel="preconnect" href="https://fonts.bunny.net" />
  <link href="https://fonts.bunny.net/css?family=inter:400,500,600,700&display=swap" rel="stylesheet" />
  <link href="https://fonts.bunny.net/css?family=cormorant-garamond:400,400i,600,600i&display=swap" rel="stylesheet" />
</svelte:head>

<main class="prose-page">
  <div class="prose-container">
    <div class="prose-header">
      <span class="prose-tag">Contact</span>
      <h1>Get in touch</h1>
      <p class="prose-lead">We're a small team. We read every message and reply personally.</p>
    </div>

    <div class="contact-cards">
      <a href="mailto:hello@mapello.net" class="contact-card">
        <div class="contact-card-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <rect x="2" y="4" width="20" height="16" rx="2"/>
            <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
          </svg>
        </div>
        <div>
          <strong>Email</strong>
          <span>hello@mapello.net</span>
          <span class="contact-card-note">General questions, press &amp; partnerships</span>
        </div>
      </a>

      <a href="https://github.com/qpincon/mapello/issues" target="_blank" rel="noopener noreferrer" class="contact-card">
        <div class="contact-card-icon">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
          </svg>
        </div>
        <div>
          <strong>GitHub Issues</strong>
          <span>github.com/qpincon/mapello</span>
          <span class="contact-card-note">Bug reports &amp; feature requests</span>
        </div>
      </a>
    </div>

    <div class="prose-body">
      <h2>Response times</h2>
      <p>
        We aim to respond to emails within 2 business days. GitHub issues are monitored regularly and typically get a response within a few days.
      </p>

      <h2>Privacy concerns</h2>
      <p>
        For data deletion requests or privacy questions, email <a href="mailto:privacy@mapello.net">privacy@mapello.net</a>.
      </p>
    </div>
  </div>
</main>

<style>
  .prose-page {
    min-height: 100vh;
    background: #f5eedc;
    padding: 7rem 1.5rem 5rem;
    font-family: 'Inter', sans-serif;
  }
  .prose-container {
    max-width: 680px;
    margin: 0 auto;
  }
  .prose-header {
    margin-bottom: 3rem;
    padding-bottom: 2rem;
    border-bottom: 1px solid rgba(30, 41, 59, 0.1);
  }
  .prose-tag {
    display: inline-block;
    font-size: 0.72rem;
    font-weight: 600;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: #c9943a;
    margin-bottom: 0.75rem;
  }
  h1 {
    font-family: 'Cormorant Garamond', serif;
    font-size: 2.8rem;
    font-weight: 600;
    color: #0f172a;
    line-height: 1.15;
    margin: 0 0 1rem;
  }
  .prose-lead {
    font-size: 1.05rem;
    color: rgba(15, 23, 42, 0.65);
    line-height: 1.7;
    margin: 0;
  }
  .contact-cards {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    margin-bottom: 3rem;
  }
  .contact-card {
    display: flex;
    align-items: flex-start;
    gap: 1.25rem;
    padding: 1.25rem 1.5rem;
    background: white;
    border: 1px solid rgba(30, 41, 59, 0.1);
    border-radius: 8px;
    text-decoration: none;
    color: inherit;
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
  }
  .contact-card:hover {
    border-color: rgba(201, 148, 58, 0.4);
    box-shadow: 0 2px 12px rgba(201, 148, 58, 0.1);
  }
  .contact-card-icon {
    flex-shrink: 0;
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(201, 148, 58, 0.1);
    border-radius: 8px;
    color: #c9943a;
  }
  .contact-card-icon svg {
    width: 20px;
    height: 20px;
  }
  .contact-card > div:last-child {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }
  .contact-card strong {
    font-size: 0.9rem;
    font-weight: 600;
    color: #0f172a;
  }
  .contact-card span {
    font-size: 0.88rem;
    color: #c9943a;
  }
  .contact-card-note {
    font-size: 0.8rem !important;
    color: rgba(15, 23, 42, 0.45) !important;
  }
  .prose-body h2 {
    font-family: 'Cormorant Garamond', serif;
    font-size: 1.45rem;
    font-weight: 600;
    color: #0f172a;
    margin: 2.5rem 0 0.75rem;
  }
  .prose-body p {
    font-size: 0.95rem;
    line-height: 1.75;
    color: rgba(15, 23, 42, 0.72);
  }
  .prose-body a {
    color: #c9943a;
    text-decoration: underline;
    text-underline-offset: 2px;
  }
  .prose-body a:hover {
    color: #a87730;
  }
</style>
