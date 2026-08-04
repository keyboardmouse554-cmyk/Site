# thecrypto.support — redesign

A self-contained static site for thecrypto.support: interactive 3D background,
full design system, and a trust-first content architecture built for a crypto
help-desk service.

## What's inside

- `index.html` — hero, wallet marquee, services bento, how-it-works timeline,
  safety pledge (full-bleed statement + written pledge card), stats, case notes,
  pricing, FAQ, intake form, full footer
- `css/style.css` — design system: Space Grotesk (display) · Inter (body) ·
  JetBrains Mono (labels/numerals), near-black base with cyan→violet accents,
  gradient-border glass cards, film grain, reveal/loader choreography
- `js/main.js` — Three.js scene (iridescent gem, orbiting crypto coins with
  canvas-textured faces, 1,100-particle shader field, PMREM environment
  lighting, ACES tone mapping, UnrealBloom) with per-section choreography,
  scroll/mouse-eased camera, FPS watchdog that sheds bloom/resolution on weak
  GPUs, WebGL-context-loss recovery; plus preloader, scramble text, magnetic
  buttons, card tilt, mobile menu, counters, intake form
- `vendor/` — Three.js r160 + required addons, vendored (zero external
  dependencies, no build step)
- `fonts/` — all fonts self-hosted (woff2)
- SEO/social: OG + Twitter cards, `og.png`, FAQPage JSON-LD, canonical,
  `robots.txt`, `sitemap.xml`, favicon set + web manifest
- `terms.html`, `privacy.html` — legal stubs (drafts)

## Resilience

- No-JS / old browsers: full content renders statically (reveals are gated on
  import-map support and protected by a CSS dead-man switch)
- `prefers-reduced-motion`: static scene frame, no loader, no animations
- WebGL unavailable: canvas hides, page works untouched
- Slow GPU: bloom then resolution are shed automatically at runtime

## Run locally

```sh
python3 -m http.server 8000
```

Open http://localhost:8000 (a server is required — the JS is an ES module).
Deploy anywhere static (Vercel/Netlify/GitHub Pages/Cloudflare Pages); no build.

## Owner to-dos before launch

These need the owner's real data — deliberately not faked:

1. **Case notes → real testimonials.** The three case notes are anonymized
   session-type summaries. Replace or augment with real client quotes and
   review-profile links (Trustpilot/Google) once collected. Never invent them.
2. **Prices.** $49 / $79 / $19 are placeholders — set real rates.
3. **Legal pages.** `terms.html` / `privacy.html` are drafts — have them
   reviewed, and add the operating legal entity + jurisdiction to the footer.
4. **Contact backend.** The form composes a pre-filled email (with a visible
   copy fallback). For higher conversion, wire it to a form endpoint
   (Formspree/Basin) and/or add a live-chat widget (Crisp/Tawk) — the FAQ
   already promises Telegram/phone, so connect those handles too.
5. **Analytics.** Add a privacy-friendly tracker (Plausible/Fathom) with events
   on CTA clicks and form submits to measure the funnel.
6. **"Who's behind this."** A short team block (real names/photos) would be the
   single strongest trust addition in this niche.
