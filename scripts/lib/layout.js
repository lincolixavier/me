import { escape, attrs, absoluteUrl, indent } from "./html.js";
import { LOCALES, DEFAULT_LOCALE, url } from "./i18n.js";

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

// One link per other locale, pointing at the same page when it exists in that
// language and at that language's home page when it does not.
function renderLanguageSwitch(site, translations) {
  const others = LOCALES.filter((locale) => locale.code !== site.localeCode);
  if (!others.length) return "";

  const links = others
    .map((locale) => {
      const href = translations?.[locale.code] ?? `${locale.prefix}/`;
      const untranslated = !translations?.[locale.code];
      const cls = ["lang-link", untranslated && "lang-link--fallback"].filter(Boolean).join(" ");
      return `<a href="${escape(href)}" class="${cls}" hreflang="${escape(locale.hreflang)}" lang="${escape(locale.htmlLang)}" title="${escape(site.ui.switchTo)}">${escape(locale.label)}</a>`;
    })
    .join("");

  return `<nav class="lang-switch" aria-label="${escape(site.ui.languageNav)}">${links}</nav>`;
}

function renderNav(site, active, translations) {
  const items = [{ id: "home", href: "/" }, ...site.nav];
  const links = items
    .map((item) => {
      const isActive = item.id === active;
      const isToggle = item.id === "about" && active === "home";
      const cls = ["link", "link--metis", isActive && "active", isToggle && "nav-page-toggle"]
        .filter(Boolean)
        .join(" ");
      const current = isActive ? ' aria-current="page"' : "";
      const label = site.navLabels?.[item.id] ?? item.id;
      return `<a href="${escape(url(site, item.href))}" class="${cls}"${current}>${escape(label)}</a>`;
    })
    .join("");

  return `<header class="site-header" data-header>
  <a class="wordmark" href="${escape(url(site, "/"))}" aria-label="${escape(site.name)}, ${escape(site.ui.homeAria)}">LX</a>
  <button
    class="nav-toggle"
    type="button"
    data-nav-toggle
    aria-expanded="false"
    aria-controls="site-nav"
    aria-label="${escape(site.ui.openMenu)}"
  >
    <span class="nav-toggle-bars" aria-hidden="true"></span>
  </button>
  <nav class="nav" id="site-nav" aria-label="${escape(site.ui.primaryNav)}">${links}</nav>
  ${renderLanguageSwitch(site, translations)}
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
  <nav class="nav" aria-label="${escape(site.ui.socialNav)}">${links}</nav>
</footer>
${renderMcpDialog(site)}`;
}

// Opened with showModal(), but :target keeps it reachable without JavaScript.
function renderMcpDialog(site) {
  const endpoint = absoluteUrl(site.url, "/api/mcp");
  const t = site.mcp;

  return `<dialog class="modal" id="mcp" aria-labelledby="mcp-title">
  <div class="modal-panel">
    <a class="modal-close" href="#" aria-label="${escape(t.close)}" data-modal-close>&times;</a>

    <p class="modal-kicker">${escape(t.kicker)}</p>
    <h2 class="modal-title" id="mcp-title">${escape(t.title)}<span class="accent">.</span></h2>

    <p class="modal-lede">
      ${escape(t.lede)}
    </p>

    <div class="modal-endpoint">
      <code>${escape(endpoint)}</code>
      <button type="button" class="modal-copy" autofocus data-copy="${escape(endpoint)}">${escape(t.copy)}</button>
    </div>

    <ol class="modal-steps">
      <li>${escape(t.step1)}</li>
      <li>${escape(t.step2)}</li>
      <li>${escape(t.step3Before)} <em>${escape(t.step3Example)}</em></li>
    </ol>

    <p class="modal-foot">
      ${escape(t.foot)}
    </p>
  </div>
</dialog>`;
}

// hreflang is only honoured when the set is reciprocal, so a page that exists in
// one language alone gets no alternates at all rather than a dangling half-pair.
function renderAlternates(site, translations) {
  if (!translations) return [];

  const present = LOCALES.filter((locale) => translations[locale.code]);
  if (present.length < 2) return [];

  const tags = present.map(
    (locale) =>
      `<link rel="alternate" hreflang="${escape(locale.hreflang)}" href="${escape(absoluteUrl(site.url, translations[locale.code]))}" />`
  );

  const fallback = translations[DEFAULT_LOCALE.code];
  if (fallback) {
    tags.push(
      `<link rel="alternate" hreflang="x-default" href="${escape(absoluteUrl(site.url, fallback))}" />`
    );
  }

  return tags;
}

function renderMeta(
  site,
  { path, title, description, type = "website", published, modified, ogImage, translations }
) {
  const canonical = absoluteUrl(site.url, path);
  const desc = description || site.description;
  const tags = [
    `<meta name="description" content="${escape(desc)}" />`,
    `<link rel="canonical" href="${escape(canonical)}" />`,
    `<meta name="author" content="${escape(site.name)}" />`,
    `<meta name="theme-color" content="${escape(site.themeColor)}" />`,
  ];

  const alternates = renderAlternates(site, translations);
  if (alternates.length) tags.push("", ...alternates);

  tags.push(
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
    `<meta name="twitter:description" content="${escape(desc)}" />`
  );

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
  translations = null,
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

  // application/json is data, not script, so it needs no CSP hash even though it
  // changes per locale. src/lib/i18n.js reads it.
  const clientStrings = `<script type="application/json" id="i18n">${JSON.stringify({
    lang: site.lang,
    ...site.client,
  })}</script>`;

  return `<!DOCTYPE html>
<html lang="${escape(site.lang)}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="Content-Security-Policy" content="${csp}" />
  <title>${escape(title)}</title>
  ${renderMeta(site, { path, title, description, type, published, modified, ogImage, translations })}

  <link rel="icon" href="/assets/favicon.svg" type="image/svg+xml" />
  <link rel="preload" as="font" type="font/woff2" href="/assets/fonts/outfit-400.woff2" crossorigin />
  <link rel="preload" as="font" type="font/woff2" href="/assets/fonts/outfit-700.woff2" crossorigin />
  <link rel="stylesheet" href="/src/styles/main.css${site.styleHash ? `?v=${site.styleHash}` : ""}" />
  <link rel="alternate" type="application/rss+xml" title="${escape(site.name)} · ${escape(site.ui.feedTitle)}" href="${escape(url(site, "/feed.xml"))}" />${
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
    ${fades}${indent(renderNav(site, active, translations), 4).trimStart()}

${indent(main, 4)}

    ${indent(renderFooter(site), 4).trimStart()}
  </div>

  ${clientStrings}
  <script type="importmap">${IMPORT_MAP_JSON}</script>
  ${scriptTags}
</body>
</html>
`;
}
