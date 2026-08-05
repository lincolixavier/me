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
  site.json              name, domain, nav structure, social links
  i18n/en.json           every translatable string, English
  i18n/pt.json           every translatable string, Portuguese
  pages/about.html       prose for the about section
  pages/about.pt.html    the Portuguese version
  pages/life.html        prose for the life page
  pages/life.pt.html     the Portuguese version
  articles/*.md          English articles, YAML front-matter + Markdown
  articles/pt/*.md       Portuguese articles, same file name as their pair
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
  lib/i18n.js            the locale table and the URL/dictionary helpers
  lib/layout.js          the one HTML shell all pages are generated from
  lib/pages.js           per-page builders
  lib/cards.js           card markup
  lib/markdown.js        Markdown → HTML
  lib/front-matter.js    YAML front-matter
  lib/assets.js          copying, robots.txt, sitemap.xml, RSS
  test/                  parser tests

assets/                  favicon and social preview source
```

## Languages

English is the default and owns the root: `/articles/…`. Portuguese lives under
`/pt/`. Nothing English ever moved, so no URL that was already indexed changed.

- **UI copy** comes from `content/i18n/<locale>.json`. The two files have the
  same keys; a key missing from `pt.json` falls back to English rather than
  rendering blank.
- **Client-side strings** are inlined per page as
  `<script type="application/json" id="i18n">` and read by `src/lib/i18n.js`.
  That tag is data, not script, so it needs no CSP hash even though it changes
  per locale.
- **hreflang** is emitted only when a page genuinely exists in both languages,
  because a one-sided annotation is ignored anyway. The sitemap carries the same
  pairs as `xhtml:link` entries.
- **Adding a language** means one entry in `LOCALES` in `scripts/lib/i18n.js`,
  one dictionary file, and a `content/articles/<code>/` directory.

To add a locale-specific string to a JSON content file, replace the string with
a map: `"description": { "en": "…", "pt": "…" }`. Plain strings still work and
are shown in every language.

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

The file name is the article's key: `hello-static-sites.md` is served at
`/articles/hello-static-sites/`. Without a `description` the build derives one
from the first paragraph. Articles sort by date, newest first.

**Its Portuguese version** — the same file name under `content/articles/pt/`.
That shared name is what pairs the two for hreflang and for the language switch,
so it has to match even though the URL will not. Add a `slug:` to the
front-matter to give it a Portuguese URL:

```markdown
---
title: "Lançar vence a perfeição"
date: 2026-04-05
description: "Por que colocar as coisas pra fora importa mais."
tags: ["startups", "mindset"]
slug: lancar-vence-a-perfeicao
---
```

Translation is per article and optional. An article with no counterpart simply
does not appear in that language's listing, gets no hreflang, and its language
switch falls back to that language's home page. A file that exists only under
`articles/pt/` is a Portuguese-only piece, which is a supported case.

Keep `date` and `tags` the same across a pair. Both listings then sort alike and
the tag filter is one shared set instead of two that drift.

**A project, episode or piece of gear** — add an entry to the matching JSON file
in `content/`.

**Anything else** — `content/site.json`. Nav, social links, page titles and
subheads all come from there.

## Social preview images

`bun run og` renders one card per article per language, plus a default card for
each, into `assets/og/`. The card carries the article's title, so the languages
cannot share one:

```
assets/og/<key>.jpg        English
assets/og/pt/<key>.jpg     Portuguese
```

They are keyed by the article's file name, not its slug, which is how a pair
resolves in both languages. A Portuguese page with no card of its own falls back
to the English one rather than shipping no preview at all.

It needs Chrome or Chromium locally and takes a few minutes for the full set.
Pass a filter to regenerate part of it: `bun run og pt/` for every Portuguese
card, `bun run og worker-pools` for one article in both languages. The images are
committed, so the deploy never runs this.

## Notes

- **Pages are fully rendered at build time.** Cards are real HTML, so crawlers
  and readers without JavaScript see the content. Pagination is progressive
  enhancement: with JS off, every card is visible.
- **Absolute paths.** Generated pages link to `/articles/`, `/src/styles/…`, so
  the site must be served from a domain root.
- **The MCP server and `/content-index.json` at the root stay English.** Each
  locale gets its own mirror, so the Portuguese one is `/pt/content-index.json`.
- **View and like counts are keyed by article, not by URL**, so a piece's two
  language versions share one count rather than splitting it.
- **`prefers-reduced-motion` is respected.** The headline stops cycling and the
  3D background drops its render loop, redrawing only when dragged.
