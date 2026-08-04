# thecrypto.support — 3D upgrade

A self-contained static site for thecrypto.support with an interactive 3D background.

## What's inside

- `index.html` — single-page layout: hero, services, how-it-works, stats, FAQ, contact CTA
- `css/style.css` — dark glassmorphism theme, cyan→violet→pink accent gradient, reveal animations
- `js/main.js` — Three.js scene (crystal core, three orbiting coin rings, 1,600-particle field) with mouse parallax and scroll-driven camera, plus card tilt, animated counters, and staggered scroll reveals
- `vendor/three.module.min.js` — Three.js r160, vendored so the site has zero external dependencies

## Run locally

Any static server works, e.g.:

```sh
python3 -m http.server 8000
```

then open http://localhost:8000. (A server is required because the JS is an ES module; opening `index.html` directly from disk won't load it.)

## Deploy

Push the repo to any static host (Vercel, Netlify, GitHub Pages, Cloudflare Pages). No build step.

## Accessibility

Respects `prefers-reduced-motion`: the 3D scene renders a single static frame and all scroll/tilt animations are disabled.
