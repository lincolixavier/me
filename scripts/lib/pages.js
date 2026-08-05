import { escape, formatDate, absoluteUrl } from "./html.js";
import { renderPage, CANVAS } from "./layout.js";
import { url, outputPath } from "./i18n.js";
import {
  renderArticleCard,
  renderProjectCard,
  renderPodcastCard,
  renderGearCard,
} from "./cards.js";

function renderListing({ site, heading, subhead, cards, empty, pageSize, badge = null, extras = "" }) {
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
<nav class="pagination" data-pagination data-page-size="${pageSize}" aria-label="${escape(site.ui.pagination)}" hidden>
  <button class="pagination-btn" type="button" data-prev aria-label="${escape(site.ui.previousPage)}">←</button>
  <span class="pagination-info" data-info></span>
  <button class="pagination-btn" type="button" data-next aria-label="${escape(site.ui.nextPage)}">→</button>
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
        <h2 class="career-heading" id="career-heading">${escape(site.ui.career)}</h2>
        ${site.careerNote ? `<p class="career-note">${escape(site.careerNote)}</p>` : ""}
        <ul class="career-list">
        ${rows}
        </ul>
      </section>`;
}

export function buildHome({ site, aboutHtml, translations }) {
  const words = site.hero.rotatingWords
    .map((w) => `<span class="word">${escape(w)}</span>`)
    .join("\n                  ");

  const main = `<div class="content-swap">
  <main class="hero">
    <section class="hero-content">
      <div class="kicker">${escape(site.hero.kicker)} <span class="name">${escape(site.name.toLowerCase())}</span></div>
      <h1 class="headline">
        <span class="headline-line">
          <span class="muted">${escape(site.hero.always)}</span>
          <span class="highlight">
            <span class="rotating-words">
              <span class="rotating-words-inner">
                ${words}
              </span>
            </span>
          </span>
        </span>
        <span class="muted">${escape(site.hero.something)}</span> <span class="underscore">_</span>
      </h1>
      <div class="subhead">${escape(site.tagline)}</div>
    </section>
    <div></div>
  </main>

  <main class="main-content page-section" id="section-about" aria-hidden="true">
    <section class="about-content">
      <h1 class="page-title">${escape(site.pages.about.title)} <span class="accent">${escape(site.pages.about.accent)}</span></h1>
      <div class="prose">
${aboutHtml.trimEnd()}
      </div>
${renderCareer(site)}
    </section>
    <div></div>
  </main>
</div>`;

  return {
    path: outputPath(site.prefix, "index.html"),
    html: renderPage({
      site,
      path: url(site, "/"),
      title: site.title,
      description: site.description,
      main,
      active: "home",
      canvas: CANVAS.home,
      scripts: ["/src/pages/home.js"],
      jsonLd: personJsonLd(site),
      scrollFades: true,
      translations,
    }),
  };
}

export function buildLife({ site, lifeHtml, translations }) {
  const t = site.pages.life;
  const main = `<main class="main-content page-section">
  <section class="life-text">
    <h1 class="life-title">${escape(t.titleStart)} <span class="accent">${escape(t.accent)}</span> ${escape(t.titleEnd)}</h1>
    <div class="prose life-prose">
${lifeHtml.trimEnd()}
    </div>
  </section>
</main>`;

  return {
    path: outputPath(site.prefix, "life/index.html"),
    html: renderPage({
      site,
      path: url(site, "/life/"),
      title: `${t.navTitle} · ${site.name}`,
      description: t.description,
      main,
      active: "life",
      translations,
    }),
  };
}

const MAX_TAG_CHIPS = 6;

function renderTagFilter(site, articles) {
  const counts = new Map();
  for (const article of articles) {
    for (const tag of article.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }

  if (counts.size < 2) return "";

  const base = url(site, "/articles/");

  const tags = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, MAX_TAG_CHIPS)
    .map(
      ([tag, count]) =>
        `<a class="tag-chip" href="${escape(base)}?tag=${encodeURIComponent(tag)}" data-tag="${escape(tag)}">
          ${escape(tag)}<span class="tag-count">${count}</span>
        </a>`
    )
    .join("\n        ");

  return `
<nav class="tag-filter" data-tag-filter aria-label="${escape(site.ui.filterByTag)}">
  <a class="tag-chip tag-chip--on" href="${escape(base)}" data-tag="">${escape(site.ui.allTags)}<span class="tag-count">${articles.length}</span></a>
  ${tags}
</nav>
<p class="tag-empty" hidden data-tag-empty>${escape(site.ui.noArticlesWithTag)}</p>`;
}

export function buildArticlesIndex({ site, articles, translations }) {
  const config = site.listings.articles;
  const main = `<main class="listing-page">
${renderListing({
  site,
  heading: config.title,
  subhead: config.subhead,
  cards: articles.map((article) => renderArticleCard(article, site)),
  empty: config.empty,
  pageSize: site.pageSize,
  badge: site.ui.humanBadge,
  extras: renderTagFilter(site, articles),
})}
</main>`;

  return {
    path: outputPath(site.prefix, "articles/index.html"),
    html: renderPage({
      site,
      path: url(site, "/articles/"),
      title: `${site.pages.articles.navTitle} · ${site.name}`,
      description: config.subhead,
      main,
      active: "articles",
      scripts: ["/src/pages/listing.js", "/src/pages/tags.js"],
      translations,
    }),
  };
}

function relatedTo(article, all) {
  const tags = new Set(article.tags);
  if (!tags.size) return [];

  return all
    .filter((other) => other.key !== article.key)
    .map((other) => ({ other, shared: other.tags.filter((t) => tags.has(t)).length }))
    .filter(({ shared }) => shared > 0)
    .sort((a, b) => b.shared - a.shared || String(b.other.date).localeCompare(String(a.other.date)))
    .slice(0, 3)
    .map(({ other }) => other);
}

function renderNewsletter(site, slug) {
  const id = `sub-${slug}`;
  const t = site.newsletter;

  return `
    <section class="newsletter" aria-labelledby="newsletter-heading">
      <h2 class="newsletter-heading" id="newsletter-heading">${escape(t.heading)}</h2>
      <p class="newsletter-note">${escape(t.note)}</p>

      <form class="newsletter-form" data-subscribe novalidate>
        <div class="newsletter-field">
          <label class="visually-hidden" for="${escape(id)}">${escape(t.label)}</label>
          <input
            class="newsletter-input"
            id="${escape(id)}"
            type="email"
            name="email"
            required
            autocomplete="email"
            placeholder="${escape(t.placeholder)}"
          />
        </div>

        <button class="btn btn--primary btn--sm" type="submit" data-sub-submit>
          <span class="btn-label" data-sub-label>${escape(t.submit)}</span>
          <span class="btn-spinner" aria-hidden="true"></span>
        </button>
      </form>

      <p class="newsletter-status" role="status" data-sub-status></p>
    </section>`;
}

function renderRelated(site, articles) {
  if (!articles.length) return "";

  const items = articles
    .map(
      (a) =>
        `<li><a href="${escape(url(site, `/articles/${a.slug}/`))}">${escape(a.title)}</a></li>`
    )
    .join("\n        ");

  return `
    <nav class="related" aria-labelledby="related-heading">
      <h2 class="related-heading" id="related-heading">${escape(site.ui.keepReading)}</h2>
      <ul class="related-list">
        ${items}
      </ul>
    </nav>`;
}

export function buildArticle({ site, article, body, allArticles = [], translations }) {
  const dateEl = article.date
    ? `<time class="article-date" datetime="${escape(article.date)}">${escape(formatDate(article.date, site.localeCode))}</time>`
    : "";

  const tagsEl = article.tags.length
    ? `<div class="tags article-tags">${article.tags
        .map((t, i) => `<span class="tag${i === 0 ? " tag--accent" : ""}">${escape(t)}</span>`)
        .join("")}</div>`
    : "";

  const rail = `<aside class="article-rail" data-slug="${escape(article.key)}" aria-label="${escape(site.ui.articleActions)}">
    <span class="rail-metric" hidden data-views>
      <span class="rail-value" data-views-count>0</span>
      <span class="rail-label">${escape(site.ui.views)}</span>
    </span>
    <button class="rail-btn" type="button" hidden data-like aria-pressed="false" aria-label="${escape(site.ui.likeArticle)}">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.5 4.2 13a4.6 4.6 0 1 1 6.5-6.5l1.3 1.3 1.3-1.3A4.6 4.6 0 1 1 19.8 13z"/></svg>
      <span class="rail-value" data-likes-count>0</span>
    </button>
    <button class="rail-btn" type="button" hidden data-share data-title="${escape(article.title)}" aria-label="${escape(site.ui.shareArticle)}">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V4m0 0L8 8m4-4 4 4M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4"/></svg>
      <span class="rail-label" data-share-label>${escape(site.client.share)}</span>
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
${renderNewsletter(site, article.key)}
${renderRelated(site, relatedTo(article, allArticles))}
    <footer class="article-footer">
      <a class="back-link" href="${escape(url(site, "/articles/"))}">${escape(site.ui.backToArticles)}</a>
    </footer>
  </article>
</main>`;

  const path = url(site, `/articles/${article.slug}/`);
  const canonical = absoluteUrl(site.url, path);

  return {
    path: outputPath(site.prefix, `articles/${article.slug}/index.html`),
    html: renderPage({
      site,
      path,
      title: `${article.title} · ${site.name}`,
      description: article.description,
      main,
      active: "articles",
      canvas: CANVAS.article,
      scripts: ["/src/pages/article.js", "/src/pages/newsletter.js"],
      type: "article",
      ogImage: article.ogImage,
      published: article.date || undefined,
      translations,
      jsonLd: {
        "@context": "https://schema.org",
        "@type": "BlogPosting",
        headline: article.title,
        description: article.description,
        datePublished: article.date || undefined,
        keywords: article.tags.join(", ") || undefined,
        inLanguage: site.lang,
        url: canonical,
        mainEntityOfPage: canonical,
        author: { "@type": "Person", name: site.name, url: site.url },
      },
    }),
  };
}

export function buildProjects({ site, projects, translations }) {
  const config = site.listings.projects;
  const main = `<main class="listing-page">
${renderListing({
  site,
  heading: config.title,
  subhead: config.subhead,
  cards: projects.map((project) => renderProjectCard(project, site)),
  empty: config.empty,
  pageSize: site.pageSize,
})}
</main>`;

  return {
    path: outputPath(site.prefix, "projects/index.html"),
    html: renderPage({
      site,
      path: url(site, "/projects/"),
      title: `${site.pages.projects.navTitle} · ${site.name}`,
      description: config.subhead,
      main,
      active: "projects",
      scripts: ["/src/pages/listing.js", "/src/pages/tags.js"],
      translations,
    }),
  };
}

export function buildPodcasts({ site, podcasts, translations }) {
  const config = site.listings.podcasts;
  const sorted = [...podcasts].sort((a, b) =>
    String(b.date ?? "").localeCompare(String(a.date ?? ""))
  );
  const main = `<main class="listing-page">
${renderListing({
  site,
  heading: config.title,
  subhead: config.subhead,
  cards: sorted.map((episode) => renderPodcastCard(episode, site)),
  empty: config.empty,
  pageSize: site.pageSize,
})}
</main>`;

  return {
    path: outputPath(site.prefix, "podcasts/index.html"),
    html: renderPage({
      site,
      path: url(site, "/podcasts/"),
      title: `${site.pages.podcasts.navTitle} · ${site.name}`,
      description: config.subhead,
      main,
      active: "podcasts",
      scripts: ["/src/pages/listing.js", "/src/pages/tags.js"],
      translations,
    }),
  };
}

export function buildGear({ site, categories, translations }) {
  const config = site.listings.gear;

  const items = categories.flatMap((cat) => cat.items || []);

  const sections = items.length
    ? `<div class="gear-list">\n${items.map((item) => renderGearCard(item, site)).join("\n")}\n</div>`
    : `<p class="listing-empty">${escape(config.empty)}</p>`;

  const main = `<main class="listing-page">
<header class="listing-header">
  <h1 class="page-title">${escape(config.title)}</h1>
  <p class="listing-subhead">${escape(config.subhead)}</p>
</header>

<div class="gear-content">
${sections}
<p class="disclosure">${escape(site.pages.gear.disclosure)}</p>
</div>
</main>`;

  return {
    path: outputPath(site.prefix, "gear/index.html"),
    html: renderPage({
      site,
      path: url(site, "/gear/"),
      title: `${site.pages.gear.navTitle} · ${site.name}`,
      description: config.subhead,
      main,
      active: "gear",
      translations,
    }),
  };
}

export function buildContact({ site, translations }) {
  const email = site.email;
  const t = site.pages.contact;

  const main = `<main class="listing-page">
<header class="listing-header">
  <h1 class="page-title">${escape(t.title)}</h1>
  <p class="listing-subhead">${escape(t.subhead)}</p>
</header>

<div class="contact-wrap">
  <form class="contact-form" data-contact novalidate>
    <div class="field" data-field="name">
      <input class="field-input" id="f-name" type="text" name="name" required maxlength="80"
             autocomplete="name" placeholder=" " />
      <label class="field-label" for="f-name">${escape(t.name)}</label>
      <p class="field-error" data-error></p>
    </div>

    <div class="field" data-field="email">
      <input class="field-input" id="f-email" type="email" name="email" required maxlength="160"
             autocomplete="email" placeholder=" " />
      <label class="field-label" for="f-email">${escape(t.email)}</label>
      <p class="field-error" data-error></p>
    </div>

    <div class="field" data-field="message">
      <textarea class="field-input field-input--area" id="f-message" name="message" required
                maxlength="4000" rows="6" placeholder=" "></textarea>
      <label class="field-label" for="f-message">${escape(t.message)}</label>
      <p class="field-hint"><span data-count>0</span>/4000</p>
      <p class="field-error" data-error></p>
    </div>

    <button class="btn btn--primary" type="submit" data-submit>
      <span class="btn-label" data-btn-label>${escape(t.send)}</span>
      <span class="btn-spinner" aria-hidden="true"></span>
    </button>

    <p class="contact-status" role="status" data-status></p>
  </form>

  <p class="contact-fallback">
    ${escape(t.fallbackBefore)} <a href="mailto:${escape(email)}">${escape(email)}</a>${escape(t.fallbackAfter)}
  </p>
</div>
</main>`;

  return {
    path: outputPath(site.prefix, "contact/index.html"),
    html: renderPage({
      site,
      path: url(site, "/contact/"),
      title: `${t.navTitle} · ${site.name}`,
      description: t.description,
      main,
      active: "contact",
      scripts: ["/src/pages/contact.js"],
      translations,
    }),
  };
}

export function buildSubscribed({ site, translations }) {
  const t = site.pages.subscribed;
  const main = `<main class="main-content page-section">
  <section class="about-content">
    <h1 class="page-title">${escape(t.title)}</h1>
    <div class="prose">
      <p data-subscribed-message>${escape(t.checking)}</p>
      <p><a href="${escape(url(site, "/articles/"))}">${escape(t.back)}</a></p>
    </div>
  </section>
</main>`;

  return {
    path: outputPath(site.prefix, "subscribed/index.html"),
    html: renderPage({
      site,
      path: url(site, "/subscribed/"),
      title: `${t.navTitle} · ${site.name}`,
      description: t.description,
      main,
      active: "",
      scripts: ["/src/pages/subscribed.js"],
      translations,
    }),
  };
}

export function build404({ site }) {
  const t = site.pages.notFound;
  const main = `<main class="main-content page-section">
  <section class="about-content">
    <h1 class="page-title">404 <span class="accent">_</span></h1>
    <div class="prose">
      <p>${escape(t.body)}</p>
      <p><a href="${escape(url(site, "/"))}">${escape(t.home)}</a> · <a href="${escape(url(site, "/articles/"))}">${escape(t.articles)}</a></p>
    </div>
  </section>
</main>`;

  return {
    path: outputPath(site.prefix, "404.html"),
    html: renderPage({
      site,
      path: url(site, "/404.html"),
      title: `${t.navTitle} · ${site.name}`,
      description: t.description,
      main,
      active: "",
    }),
  };
}
