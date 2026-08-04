/**
 * The one HTML shell every page is generated from.
 *
 * Previously each of the five pages hand-maintained its own copy of the head,
 * import map, canvas element, nav and footer. Changing a meta tag meant editing
 * five files, and in practice they had already drifted apart.
 */
import { escape, attrs, absoluteUrl, indent } from "./html.js";

/**
 * Runs before paint so the splash never flashes on an internal navigation:
 * every navigation is a fresh document, and without this the panel would
 * replay in front of the page the reader just asked for.
 *
 * Exported because the Content Security Policy needs its hash — an inline
 * script is only allowed if the policy names it, and naming it by hash keeps
 * the policy strict without a nonce, which a static site cannot produce.
 */
export const SPLASH_SCRIPT = `try{if(sessionStorage.getItem("splash-seen"))document.documentElement.dataset.splash="seen";else sessionStorage.setItem("splash-seen","1")}catch(e){}`;

const IMPORT_MAP = {
  imports: {
    // The .min build, not the development one: same code, ~70KB less to
    // download and parse on the main thread.
    three: "https://cdn.jsdelivr.net/npm/three@0.162.0/build/three.module.min.js",
    "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.162.0/examples/jsm/",
  },
};

/** Serialised once, so the CSP hash and the emitted text cannot drift apart. */
export const IMPORT_MAP_JSON = JSON.stringify(IMPORT_MAP);

/**
 * Canvas tuning per page type. The home hero pulls the camera back; every other
 * page uses the closer framing of the about view, with bloom and full density,
 * so the network looks alive everywhere instead of only on about.
 */
const CLOSE_FRAMING = {
  "camera-z": 14,
  "orbit-min": 14,
  "orbit-max": 24,
  "auto-rotate-speed": "0.2",
};

export const CANVAS = {
  home: { "camera-z": 22 },
  inner: CLOSE_FRAMING,
  article: CLOSE_FRAMING,
};

function renderNav(site, active) {
  const items = [{ id: "home", href: "/" }, ...site.nav];
  const links = items
    .map((item) => {
      const isActive = item.id === active;
      const isToggle = item.id === "about" && active === "home";
      const cls = ["link", "link--metis", isActive && "active", isToggle && "nav-page-toggle"]
        .filter(Boolean)
        .join(" ");
      const current = isActive ? ' aria-current="page"' : "";
      return `<a href="${escape(item.href)}" class="${cls}"${current}>${escape(item.id)}</a>`;
    })
    .join("");

  // The wordmark and the toggle only surface on small screens, where the seven
  // links cannot sit on one line. On desktop the nav is unchanged.
  return `<header class="site-header" data-header>
  <a class="wordmark" href="/" aria-label="${escape(site.name)} — home">LX</a>
  <button
    class="nav-toggle"
    type="button"
    data-nav-toggle
    aria-expanded="false"
    aria-controls="site-nav"
    aria-label="Open menu"
  >
    <span class="nav-toggle-bars" aria-hidden="true"></span>
  </button>
  <nav class="nav" id="site-nav" aria-label="Primary">${links}</nav>
</header>`;
}

function renderFooter(site) {
  const links = site.social
    .map((item) => {
      const external = /^https?:/i.test(item.href);
      const rel = external ? ' target="_blank" rel="noopener noreferrer"' : "";
      return `<a href="${escape(item.href)}" class="link link--metis"${rel}>${escape(item.label)}</a>`;
    })
    .join("");

  return `<footer class="footer">
  <nav class="nav" aria-label="Social">${links}</nav>
</footer>`;
}

function renderMeta(site, { path, title, description, type = "website", published, modified, ogImage }) {
  const canonical = absoluteUrl(site.url, path);
  const desc = description || site.description;
  const tags = [
    `<meta name="description" content="${escape(desc)}" />`,
    `<link rel="canonical" href="${escape(canonical)}" />`,
    `<meta name="author" content="${escape(site.name)}" />`,
    `<meta name="theme-color" content="${escape(site.themeColor)}" />`,
    "",
    `<meta property="og:type" content="${escape(type)}" />`,
    `<meta property="og:site_name" content="${escape(site.name)}" />`,
    `<meta property="og:locale" content="${escape(site.locale)}" />`,
    `<meta property="og:title" content="${escape(title)}" />`,
    `<meta property="og:description" content="${escape(desc)}" />`,
    `<meta property="og:url" content="${escape(canonical)}" />`,
    "",
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${escape(title)}" />`,
    `<meta name="twitter:description" content="${escape(desc)}" />`,
  ];

  if (site.twitterHandle) {
    tags.push(`<meta name="twitter:creator" content="${escape(site.twitterHandle)}" />`);
  }

  // Only advertise a preview image when one actually exists on disk — a broken
  // og:image is worse than none at all. Pages can bring their own.
  const preview = ogImage || site.ogImage;

  if (preview) {
    const image = absoluteUrl(site.url, preview);
    tags.push(
      "",
      `<meta property="og:image" content="${escape(image)}" />`,
      `<meta property="og:image:width" content="1200" />`,
      `<meta property="og:image:height" content="630" />`,
      `<meta name="twitter:image" content="${escape(image)}" />`
    );
  }

  if (type === "article") {
    if (published) tags.push(`<meta property="article:published_time" content="${escape(published)}" />`);
    if (modified) tags.push(`<meta property="article:modified_time" content="${escape(modified)}" />`);
  }

  return tags.join("\n  ");
}

/**
 * @param {object} options
 * @param {object} options.site        Parsed content/site.json
 * @param {string} options.path        Root-relative page path, e.g. "/articles/"
 * @param {string} options.title       <title> and og:title
 * @param {string} [options.description]
 * @param {string} options.main        Inner HTML for the page body
 * @param {string} [options.active]    Nav item to highlight
 * @param {object} [options.canvas]    Attribute map for <neural-canvas>
 * @param {string[]} [options.scripts] Root-relative module scripts
 * @param {object} [options.jsonLd]    Structured data payload
 * @param {boolean} [options.scrollFades] Render the top/bottom scroll fades
 * @param {string} [options.type]      og:type
 */
export function renderPage({
  site,
  path,
  title,
  description,
  main,
  active = "home",
  canvas = CANVAS.inner,
  scripts = [],
  jsonLd = null,
  scrollFades = true,
  type = "website",
  published,
  modified,
  ogImage = null,
}) {
  const scriptTags = [
    "/src/pages/splash.js",
    "/src/pages/nav.js",
    "/src/components/neural-canvas.js",
    "/src/pages/transitions.js",
    ...scripts,
  ]
    .map((src) => `<script type="module" src="${escape(src)}"></script>`)
    .join("\n  ");

  const fades = scrollFades
    ? `<div class="scroll-fade scroll-fade--top" aria-hidden="true"></div>
    <div class="scroll-fade scroll-fade--bottom" aria-hidden="true"></div>\n    `
    : "";

  const structuredData = jsonLd
    ? `\n  <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>`
    : "";

  return `<!DOCTYPE html>
<html lang="${escape(site.lang)}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="Content-Security-Policy" content="${site.csp.replace(/"/g, "")}" />
  <title>${escape(title)}</title>
  ${renderMeta(site, { path, title, description, type, published, modified, ogImage })}

  <link rel="icon" href="/assets/favicon.svg" type="image/svg+xml" />
  <link rel="preload" as="font" type="font/woff2" href="/assets/fonts/outfit-400.woff2" crossorigin />
  <link rel="preload" as="font" type="font/woff2" href="/assets/fonts/outfit-700.woff2" crossorigin />
  <link rel="stylesheet" href="/src/styles/main.css${site.styleHash ? `?v=${site.styleHash}` : ""}" />
  <link rel="alternate" type="application/rss+xml" title="${escape(site.name)} — articles" href="/feed.xml" />${structuredData}
  <script>${SPLASH_SCRIPT}</script>
</head>
<body>
  <div class="splash" data-splash aria-hidden="true">
    <svg class="splash-mark" viewBox="0 0 64 64" aria-hidden="true">
      <path d="M20 16v26h16" pathLength="1" />
      <circle cx="44" cy="42" r="4" />
    </svg>
  </div>

  <neural-canvas${attrs(canvas)}></neural-canvas>
  <div class="left-fade" aria-hidden="true"></div>

  <div class="page">
    ${fades}${indent(renderNav(site, active), 4).trimStart()}

${indent(main, 4)}

    ${indent(renderFooter(site), 4).trimStart()}
  </div>

  <script type="importmap">${IMPORT_MAP_JSON}</script>
  ${scriptTags}
</body>
</html>
`;
}
