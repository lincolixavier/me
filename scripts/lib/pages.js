import { escape, formatDate, absoluteUrl } from "./html.js";
import { renderPage, CANVAS } from "./layout.js";
import {
  renderArticleCard,
  renderProjectCard,
  renderPodcastCard,
  renderGearCard,
} from "./cards.js";

function renderListing({ heading, subhead, cards, empty, pageSize, badge = null, extras = "" }) {
  if (!cards.length) {
    return `<div class="cards-grid"><p class="listing-empty">${escape(empty)}</p></div>`;
  }

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
  <h1 class="page-title">${escape(heading)}${badge ? `<span class="human-badge">${escape(badge)}</span>` : ""}</h1>
  <p class="listing-subhead">${escape(subhead)}</p>
</header>
${extras}

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

function renderCareer(site) {
  if (!site.career?.length) return "";

  const rows = site.career
    .map(
      (job) => `<li class="career-row">
          <span class="career-period">${escape(job.period)}</span>
          <span class="career-role">${escape(job.role)}</span>
          <span class="career-company">${escape(job.company)}</span>
        </li>`
    )
    .join("\n        ");

  return `
      <section class="career" aria-labelledby="career-heading">
        <h2 class="career-heading" id="career-heading">Career</h2>
        ${site.careerNote ? `<p class="career-note">${escape(site.careerNote)}</p>` : ""}
        <ul class="career-list">
        ${rows}
        </ul>
      </section>`;
}

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
${renderCareer(site)}
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
      scrollFades: true,
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

const MAX_TAG_CHIPS = 6;

function renderTagFilter(articles) {
  const counts = new Map();
  for (const article of articles) {
    for (const tag of article.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }

  if (counts.size < 2) return "";

  const tags = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, MAX_TAG_CHIPS)
    .map(
      ([tag, count]) =>
        `<a class="tag-chip" href="/articles/?tag=${encodeURIComponent(tag)}" data-tag="${escape(tag)}">
          ${escape(tag)}<span class="tag-count">${count}</span>
        </a>`
    )
    .join("\n        ");

  return `
<nav class="tag-filter" data-tag-filter aria-label="Filter by tag">
  <a class="tag-chip tag-chip--on" href="/articles/" data-tag="">all<span class="tag-count">${articles.length}</span></a>
  ${tags}
</nav>
<p class="tag-empty" hidden data-tag-empty>No articles with that tag.</p>`;
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
  badge: "100% human-written",
  extras: renderTagFilter(articles),
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
      scripts: ["/src/pages/listing.js", "/src/pages/tags.js"],
    }),
  };
}

function relatedTo(article, all) {
  const tags = new Set(article.tags);
  if (!tags.size) return [];

  return all
    .filter((other) => other.slug !== article.slug)
    .map((other) => ({ other, shared: other.tags.filter((t) => tags.has(t)).length }))
    .filter(({ shared }) => shared > 0)
    .sort((a, b) => b.shared - a.shared || String(b.other.date).localeCompare(String(a.other.date)))
    .slice(0, 3)
    .map(({ other }) => other);
}

function renderNewsletter(slug) {
  const id = `sub-${slug}`;

  return `
    <section class="newsletter" aria-labelledby="newsletter-heading">
      <h2 class="newsletter-heading" id="newsletter-heading">Get new posts by email</h2>
      <p class="newsletter-note">No schedule, no spam. Unsubscribe whenever.</p>

      <form class="newsletter-form" data-subscribe novalidate>
        <div class="newsletter-field">
          <label class="visually-hidden" for="${escape(id)}">Your email</label>
          <input
            class="newsletter-input"
            id="${escape(id)}"
            type="email"
            name="email"
            required
            autocomplete="email"
            placeholder="you@example.com"
          />
        </div>

        <button class="btn btn--primary btn--sm" type="submit" data-sub-submit>
          <span class="btn-label" data-sub-label>Subscribe</span>
          <span class="btn-spinner" aria-hidden="true"></span>
        </button>
      </form>

      <p class="newsletter-status" role="status" data-sub-status></p>
    </section>`;
}

function renderRelated(articles) {
  if (!articles.length) return "";

  const items = articles
    .map(
      (a) =>
        `<li><a href="/articles/${escape(a.slug)}/">${escape(a.title)}</a></li>`
    )
    .join("\n        ");

  return `
    <nav class="related" aria-labelledby="related-heading">
      <h2 class="related-heading" id="related-heading">Keep reading</h2>
      <ul class="related-list">
        ${items}
      </ul>
    </nav>`;
}

export function buildArticle({ site, article, body, allArticles = [] }) {
  const dateEl = article.date
    ? `<time class="article-date" datetime="${escape(article.date)}">${escape(formatDate(article.date))}</time>`
    : "";

  const tagsEl = article.tags.length
    ? `<div class="tags article-tags">${article.tags
        .map((t, i) => `<span class="tag${i === 0 ? " tag--accent" : ""}">${escape(t)}</span>`)
        .join("")}</div>`
    : "";

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
${renderNewsletter(article.slug)}
${renderRelated(relatedTo(article, allArticles))}
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
      scripts: ["/src/pages/article.js", "/src/pages/newsletter.js"],
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
      scripts: ["/src/pages/listing.js", "/src/pages/tags.js"],
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
      scripts: ["/src/pages/listing.js", "/src/pages/tags.js"],
    }),
  };
}

export function buildGear({ site, categories }) {
  const config = site.listings.gear;

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
<p class="disclosure">Some links on this page are affiliate links. Buying through them costs you nothing extra.</p>
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

export function buildContact({ site }) {
  const email = site.email;

  const main = `<main class="listing-page">
<header class="listing-header">
  <h1 class="page-title">contact</h1>
  <p class="listing-subhead">Work, writing, or anything worth a conversation.</p>
</header>

<div class="contact-wrap">
  <form class="contact-form" data-contact novalidate>
    <div class="field" data-field="name">
      <input class="field-input" id="f-name" type="text" name="name" required maxlength="80"
             autocomplete="name" placeholder=" " />
      <label class="field-label" for="f-name">Name</label>
      <p class="field-error" data-error></p>
    </div>

    <div class="field" data-field="email">
      <input class="field-input" id="f-email" type="email" name="email" required maxlength="160"
             autocomplete="email" placeholder=" " />
      <label class="field-label" for="f-email">Email</label>
      <p class="field-error" data-error></p>
    </div>

    <div class="field" data-field="message">
      <textarea class="field-input field-input--area" id="f-message" name="message" required
                maxlength="4000" rows="6" placeholder=" "></textarea>
      <label class="field-label" for="f-message">Message</label>
      <p class="field-hint"><span data-count>0</span>/4000</p>
      <p class="field-error" data-error></p>
    </div>

    <button class="btn btn--primary" type="submit" data-submit>
      <span class="btn-label" data-btn-label>Send message</span>
      <span class="btn-spinner" aria-hidden="true"></span>
    </button>

    <p class="contact-status" role="status" data-status></p>
  </form>

  <p class="contact-fallback">
    Or write straight to <a href="mailto:${escape(email)}">${escape(email)}</a>.
  </p>
</div>
</main>`;

  return {
    path: "contact/index.html",
    html: renderPage({
      site,
      path: "/contact/",
      title: `Contact · ${site.name}`,
      description: "Get in touch about work, writing, or anything worth a conversation.",
      main,
      active: "contact",
      scripts: ["/src/pages/contact.js"],
    }),
  };
}

export function buildSubscribed({ site }) {
  const main = `<main class="main-content page-section">
  <section class="about-content">
    <h1 class="page-title">newsletter</h1>
    <div class="prose">
      <p data-subscribed-message>Checking that link…</p>
      <p><a href="/articles/">Back to the articles</a></p>
    </div>
  </section>
</main>`;

  return {
    path: "subscribed/index.html",
    html: renderPage({
      site,
      path: "/subscribed/",
      title: `Newsletter · ${site.name}`,
      description: "Subscription confirmation.",
      main,
      active: "",
      scripts: ["/src/pages/subscribed.js"],
    }),
  };
}

export function build404({ site }) {
  const main = `<main class="main-content page-section">
  <section class="about-content">
    <h1 class="page-title">404 <span class="accent">_</span></h1>
    <div class="prose">
      <p>This page does not exist, or it moved.</p>
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
