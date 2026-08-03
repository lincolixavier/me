# lincolixavier.com

Personal site. Static site generator written in plain Node — no dependencies, no
framework, no runtime. The only thing shipped to the browser besides HTML and CSS
is a Three.js neural network background, loaded lazily from a CDN.

## Commands

```bash
bun run build        # content/ + src/ → dist/
bun run dev          # build, then serve dist/ at http://localhost:3000
bun run watch        # rebuild on changes to content/, src/ or scripts/
bun run test         # markdown parser tests
```

The build has no dependencies — `node scripts/build.js` is enough. Only `dev`
reaches the network, for `bunx serve`.

## Deploy

Vercel, configured in `vercel.json`: it runs the build and serves `dist/`.
Pushing to `main` deploys. `dist/` is git-ignored and rebuilt every time, so
there is nothing to commit after a content change other than the content.

## Where things live

Everything under `dist/` is generated. Never edit it by hand.

```
content/                 ← the only place you write
  site.json              name, domain, nav, social links, listing copy
  pages/about.html       prose for the about section
  pages/life.html        prose for the life page
  articles/*.md          articles, YAML front-matter + Markdown
  projects.json          projects listing
  podcasts.json          episodes listing
  gear.json              gear, grouped by category

src/                     ← shipped to the browser as-is
  styles/                tokens → base → layout → components
  components/            <neural-canvas>
  lib/                   Three.js scene
  pages/                 per-page behaviour (about toggle, pagination)

scripts/
  build.js               orchestrator
  lib/layout.js          the one HTML shell all pages are generated from
  lib/pages.js           per-page builders
  lib/cards.js           card markup
  lib/markdown.js        Markdown → HTML
  lib/front-matter.js    YAML front-matter
  lib/assets.js          copying, robots.txt, sitemap.xml, RSS
  test/                  parser tests

assets/                  favicon and social preview source
```

## Adding content

**An article** — drop a `.md` file in `content/articles/`:

```markdown
---
title: "Shipping Beats Perfection"
date: 2026-04-05
description: "Why getting things out the door matters."
tags: ["startups", "mindset"]
---

Your text here. Headings, lists, links, images, blockquotes, `code`
and fenced code blocks all work.
```

The slug comes from the filename, so `hello-static-sites.md` is served at
`/articles/hello-static-sites/`. Without a `description` the build derives one
from the first paragraph. Articles sort by date, newest first.

**A project, episode or piece of gear** — add an entry to the matching JSON file
in `content/`.

**Anything else** — `content/site.json`. Nav, social links, page titles and
subheads all come from there.

## Social preview image

The build only emits `og:image` tags when `assets/og.png` exists. To create it,
export `assets/og.svg` at 1200×630:

```bash
rsvg-convert -w 1200 -h 630 assets/og.svg -o assets/og.png
```

Any design tool works too. Until then the build prints a warning and the pages
ship without a preview image, which is better than pointing at a missing file.

## Notes

- **Pages are fully rendered at build time.** Cards are real HTML, so crawlers
  and readers without JavaScript see the content. Pagination is progressive
  enhancement: with JS off, every card is visible.
- **Absolute paths.** Generated pages link to `/articles/`, `/src/styles/…`, so
  the site must be served from a domain root.
- **`prefers-reduced-motion` is respected.** The headline stops cycling and the
  3D background drops its render loop, redrawing only when dragged.
