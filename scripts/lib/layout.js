import { escape, attrs, absoluteUrl, indent } from "./html.js";

export const SPLASH_SCRIPT = `try{if(sessionStorage.getItem("splash-seen"))document.documentElement.dataset.splash="seen";else sessionStorage.setItem("splash-seen","1")}catch(e){}`;

const IMPORT_MAP = {
  imports: {
    three: "https://cdn.jsdelivr.net/npm/three@0.162.0/build/three.module.min.js",
    "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.162.0/examples/jsm/",
  },
};

export const IMPORT_MAP_JSON = JSON.stringify(IMPORT_MAP);

export const ANALYTICS_HOST = "https://cdn.himetrica.com";

const ANALYTICS_SCRIPTS = ["tracker.js", "vitals.js", "errors.js"];

function renderAnalytics(site) {
  const key = site.analytics?.himetricaKey;
  if (!key) return "";

  return ANALYTICS_SCRIPTS.map(
    (file) =>
      `\n  <script defer src="${ANALYTICS_HOST}/${file}" data-api-key="${escape(key)}"></script>`
  ).join("");
}

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

  return `<header class="site-header" data-header>
  <a class="wordmark" href="/" aria-label="${escape(site.name)}, home">LX</a>
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
</footer>
${renderMcpDialog(site)}`;
}

// Opened with showModal(), but :target keeps it reachable without JavaScript.
function renderMcpDialog(site) {
  const endpoint = absoluteUrl(site.url, "/api/mcp");

  return `<dialog class="modal" id="mcp" aria-labelledby="mcp-title">
  <div class="modal-panel">
    <a class="modal-close" href="#" aria-label="Close" data-modal-close>&times;</a>

    <p class="modal-kicker">Model Context Protocol</p>
    <h2 class="modal-title" id="mcp-title">Talk to this site<span class="accent">.</span></h2>

    <p class="modal-lede">
      Every article, project and role here is readable by an AI client as tools
      rather than as pages. Point yours at the endpoint below.
    </p>

    <div class="modal-endpoint">
      <code>${escape(endpoint)}</code>
      <button type="button" class="modal-copy" autofocus data-copy="${escape(endpoint)}">copy</button>
    </div>

    <ol class="modal-steps">
      <li>Open your client's settings: Claude Desktop, Cursor, or anything that speaks MCP.</li>
      <li>Add a remote MCP server and paste the URL.</li>
      <li>Ask it something, for instance <em>"what has Lincoli written about Go worker pools?"</em></li>
    </ol>

    <p class="modal-foot">
      Five tools: search the writing, read one piece in full, list it by tag,
      list the projects, read the profile. Nothing to install, nothing to sign in to.
    </p>
  </div>
</dialog>`;
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

  const preview = ogImage || site.ogImage;

  if (preview) {
    const image = absoluteUrl(site.url, preview);
    tags.push(
      "",
      `<meta property="og:image" content="${escape(image)}" />`,
      `<meta property="og:image:type" content="${preview.endsWith(".png") ? "image/png" : "image/jpeg"}" />`,
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
    "/src/pages/modal.js",
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

  // Strip quotes, never HTML-escape: escaping would turn 'self' into &#39;self&#39;.
  const csp = site.csp.replace(/"/g, "");

  const structuredData = jsonLd
    ? `\n  <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>`
    : "";

  return `<!DOCTYPE html>
<html lang="${escape(site.lang)}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="Content-Security-Policy" content="${csp}" />
  <title>${escape(title)}</title>
  ${renderMeta(site, { path, title, description, type, published, modified, ogImage })}

  <link rel="icon" href="/assets/favicon.svg" type="image/svg+xml" />
  <link rel="preload" as="font" type="font/woff2" href="/assets/fonts/outfit-400.woff2" crossorigin />
  <link rel="preload" as="font" type="font/woff2" href="/assets/fonts/outfit-700.woff2" crossorigin />
  <link rel="stylesheet" href="/src/styles/main.css${site.styleHash ? `?v=${site.styleHash}` : ""}" />
  <link rel="alternate" type="application/rss+xml" title="${escape(site.name)} · articles" href="/feed.xml" />${
    type === "article"
      ? `\n  <link rel="alternate" type="text/markdown" href="${escape(path.replace(/\/$/, ""))}.md" />`
      : ""
  }${structuredData}
  <script>${SPLASH_SCRIPT}</script>${renderAnalytics(site)}
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
