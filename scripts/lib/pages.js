/**
 * Page builders. Each returns { path, html } for a single output file.
 * All content comes from content/ — nothing here is hand-written copy.
 */
import { escape, formatDate, absoluteUrl } from "./html.js";
import { renderPage, CANVAS } from "./layout.js";
import {
  renderArticleCard,
  renderProjectCard,
  renderPodcastCard,
  renderGearCard,
} from "./cards.js";

/**
 * Grid of pre-rendered cards. Pagination is progressive enhancement: with JS
 * off every card is already in the DOM and visible.
 */
function renderListing({ heading, subhead, cards, empty, pageSize }) {
  if (!cards.length) {
    return `<div class="cards-grid"><p class="listing-empty">${escape(empty)}</p></div>`;
  }

  // The entrance stagger is capped so the tail of a long list is not left
  // waiting several seconds for its turn.
  const items = cards
    .map(
      (html, i) =>
        `<div class="card-slot" data-index="${i}" style="--card-index: ${Math.min(i, 8)}">\n${html}\n</div>`
    )
    .join("\n");

  const pagination =
    cards.length > pageSize
      ? `
<nav class="pagination" data-pagination data-page-size="${pageSize}" aria-label="Pagination" hidden>
  <button class="pagination-btn" type="button" data-prev aria-label="Previous page">←</button>
  <span class="pagination-info" data-info></span>
  <button class="pagination-btn" type="button" data-next aria-label="Next page">→</button>
</nav>`
      : "";

  return `<header class="listing-header">
  <h1 class="page-title">${escape(heading)}</h1>
  <p class="listing-subhead">${escape(subhead)}</p>
</header>

<div class="cards-grid" data-grid>
${items}
</div>${pagination}`;
}

function personJsonLd(site) {
  return {
    "@context": "https://schema.org",
    "@type": "Person",
    name: site.name,
    url: site.url,
    description: site.description,
    jobTitle: "Software Engineer",
    sameAs: site.social
      .filter((s) => /^https?:/i.test(s.href))
      .map((s) => s.href),
  };
}

// ------------------------------------------------------------------

export function buildHome({ site, aboutHtml }) {
  const words = site.hero.rotatingWords
    .map((w) => `<span class="word">${escape(w)}</span>`)
    .join("\n                  ");

  const main = `<div class="content-swap">
  <main class="hero">
    <section class="hero-content">
      <div class="kicker">${escape(site.hero.kicker)} <span class="name">${escape(site.name.toLowerCase())}</span></div>
      <h1 class="headline">
        <span class="headline-line">
          <span class="muted">always</span>
          <span class="highlight">
            <span class="rotating-words">
              <span class="rotating-words-inner">
                ${words}
              </span>
            </span>
          </span>
        </span>
        <span class="muted">something</span> <span class="underscore">_</span>
      </h1>
      <div class="subhead">${escape(site.tagline)}</div>
    </section>
    <div></div>
  </main>

  <main class="main-content page-section" id="section-about" aria-hidden="true">
    <section class="about-content">
      <h1 class="page-title">about <span class="accent">me</span></h1>
      <div class="prose">
${aboutHtml.trimEnd()}
      </div>
    </section>
    <div></div>
  </main>
</div>`;

  return {
    path: "index.html",
    html: renderPage({
      site,
      path: "/",
      title: site.title,
      description: site.description,
      main,
      active: "home",
      canvas: CANVAS.home,
      scripts: ["/src/pages/home.js"],
      jsonLd: personJsonLd(site),
      scrollFades: false,
    }),
  };
}

export function buildLife({ site, lifeHtml }) {
  const main = `<main class="main-content page-section">
  <section class="life-text">
    <h1 class="life-title">be <span class="accent">here</span> now.</h1>
    <div class="prose life-prose">
${lifeHtml.trimEnd()}
    </div>
  </section>
</main>`;

  return {
    path: "life/index.html",
    html: renderPage({
      site,
      path: "/life/",
      title: `Life · ${site.name}`,
      description: "On staying present without giving up ambition.",
      main,
      active: "life",
    }),
  };
}

export function buildArticlesIndex({ site, articles }) {
  const config = site.listings.articles;
  const main = `<main class="listing-page">
${renderListing({
  heading: config.title,
  subhead: config.subhead,
  cards: articles.map(renderArticleCard),
  empty: config.empty,
  pageSize: site.pageSize,
})}
</main>`;

  return {
    path: "articles/index.html",
    html: renderPage({
      site,
      path: "/articles/",
      title: `Articles · ${site.name}`,
      description: config.subhead,
      main,
      active: "articles",
      scripts: ["/src/pages/listing.js"],
    }),
  };
}

export function buildArticle({ site, article, body }) {
  const dateEl = article.date
    ? `<time class="article-date" datetime="${escape(article.date)}">${escape(formatDate(article.date))}</time>`
    : "";

  const tagsEl = article.tags.length
    ? `<div class="tags article-tags">${article.tags
        .map((t, i) => `<span class="tag${i === 0 ? " tag--accent" : ""}">${escape(t)}</span>`)
        .join("")}</div>`
    : "";

  // The rail rides alongside the text and stays put while it scrolls, so the
  // counters and the share button are reachable from anywhere in a long read
  // instead of only once someone has made it to the end.
  const rail = `<aside class="article-rail" data-slug="${escape(article.slug)}" aria-label="Article actions">
    <span class="rail-metric" hidden data-views>
      <span class="rail-value" data-views-count>0</span>
      <span class="rail-label">views</span>
    </span>
    <button class="rail-btn" type="button" hidden data-like aria-pressed="false" aria-label="Like this article">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.5 4.2 13a4.6 4.6 0 1 1 6.5-6.5l1.3 1.3 1.3-1.3A4.6 4.6 0 1 1 19.8 13z"/></svg>
      <span class="rail-value" data-likes-count>0</span>
    </button>
    <button class="rail-btn" type="button" hidden data-share data-title="${escape(article.title)}" aria-label="Share this article">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V4m0 0L8 8m4-4 4 4M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4"/></svg>
      <span class="rail-label" data-share-label>share</span>
    </button>
  </aside>`;

  const main = `<main class="article-page">
  ${rail}
  <article class="article-content">
    <header class="article-header">
      <h1 class="page-title" data-article-hero>${escape(article.title)}</h1>
      ${dateEl}
      ${tagsEl}
    </header>
    <div class="prose article-body">
${body}
    </div>
    <footer class="article-footer">
      <a class="back-link" href="/articles/">← all articles</a>
    </footer>
  </article>
</main>`;

  const url = absoluteUrl(site.url, `/articles/${article.slug}/`);

  return {
    path: `articles/${article.slug}/index.html`,
    html: renderPage({
      site,
      path: `/articles/${article.slug}/`,
      title: `${article.title} · ${site.name}`,
      description: article.description,
      main,
      active: "articles",
      canvas: CANVAS.article,
      scripts: ["/src/pages/article.js"],
      type: "article",
      ogImage: article.ogImage,
      published: article.date || undefined,
      jsonLd: {
        "@context": "https://schema.org",
        "@type": "BlogPosting",
        headline: article.title,
        description: article.description,
        datePublished: article.date || undefined,
        keywords: article.tags.join(", ") || undefined,
        url,
        mainEntityOfPage: url,
        author: { "@type": "Person", name: site.name, url: site.url },
      },
    }),
  };
}

export function buildProjects({ site, projects }) {
  const config = site.listings.projects;
  const main = `<main class="listing-page">
${renderListing({
  heading: config.title,
  subhead: config.subhead,
  cards: projects.map(renderProjectCard),
  empty: config.empty,
  pageSize: site.pageSize,
})}
</main>`;

  return {
    path: "projects/index.html",
    html: renderPage({
      site,
      path: "/projects/",
      title: `Projects · ${site.name}`,
      description: config.subhead,
      main,
      active: "projects",
      scripts: ["/src/pages/listing.js"],
    }),
  };
}

export function buildPodcasts({ site, podcasts }) {
  const config = site.listings.podcasts;
  const sorted = [...podcasts].sort((a, b) =>
    String(b.date ?? "").localeCompare(String(a.date ?? ""))
  );
  const main = `<main class="listing-page">
${renderListing({
  heading: config.title,
  subhead: config.subhead,
  cards: sorted.map(renderPodcastCard),
  empty: config.empty,
  pageSize: site.pageSize,
})}
</main>`;

  return {
    path: "podcasts/index.html",
    html: renderPage({
      site,
      path: "/podcasts/",
      title: `Podcasts · ${site.name}`,
      description: config.subhead,
      main,
      active: "podcasts",
      scripts: ["/src/pages/listing.js"],
    }),
  };
}

export function buildGear({ site, categories }) {
  const config = site.listings.gear;

  // One flat list. The categories exist in the data, but splitting six items
  // across two headed sections made the page look emptier than it is.
  const items = categories.flatMap((cat) => cat.items || []);

  const sections = items.length
    ? `<div class="gear-list">\n${items.map(renderGearCard).join("\n")}\n</div>`
    : `<p class="listing-empty">${escape(config.empty)}</p>`;

  const main = `<main class="listing-page">
<header class="listing-header">
  <h1 class="page-title">${escape(config.title)}</h1>
  <p class="listing-subhead">${escape(config.subhead)}</p>
</header>

<div class="gear-content">
${sections}
</div>
</main>`;

  return {
    path: "gear/index.html",
    html: renderPage({
      site,
      path: "/gear/",
      title: `Gear · ${site.name}`,
      description: config.subhead,
      main,
      active: "gear",
    }),
  };
}

export function build404({ site }) {
  const main = `<main class="main-content page-section">
  <section class="about-content">
    <h1 class="page-title">404 <span class="accent">_</span></h1>
    <div class="prose">
      <p>This page does not exist — or it moved.</p>
      <p><a href="/">Back home</a> · <a href="/articles/">Read something instead</a></p>
    </div>
  </section>
</main>`;

  return {
    path: "404.html",
    html: renderPage({
      site,
      path: "/404.html",
      title: `Not found · ${site.name}`,
      description: "Page not found.",
      main,
      active: "",
    }),
  };
}
