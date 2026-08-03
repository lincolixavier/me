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

  const items = cards
    .map((html, i) => `<div class="card-slot" data-index="${i}">\n${html}\n</div>`)
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
      description: "On gratitude and living in the present.",
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

  const main = `<main class="article-page">
  <article class="article-content">
    <header class="article-header">
      <h1 class="page-title">${escape(article.title)}</h1>
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
      type: "article",
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
  const main = `<main class="listing-page">
${renderListing({
  heading: config.title,
  subhead: config.subhead,
  cards: podcasts.map(renderPodcastCard),
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

  const sections = categories.length
    ? categories
        .map((cat) => {
          const id = `gear-${String(cat.name || "gear").replace(/\s+/g, "-").toLowerCase()}`;
          const items = (cat.items || []).map(renderGearCard).join("\n");
          return `<section class="gear-category" aria-labelledby="${escape(id)}">
  <h2 class="gear-category-title" id="${escape(id)}">${escape(cat.name || "Gear")}</h2>
  <div class="gear-list">
${items}
  </div>
</section>`;
        })
        .join("\n")
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
