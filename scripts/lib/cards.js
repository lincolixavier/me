/**
 * Card markup, rendered at build time.
 *
 * These used to be Shadow-DOM custom elements that fetched JSON on the client:
 * the content was invisible to crawlers and to anyone with JS disabled, and the
 * styles duplicated the design tokens as hardcoded rgba() values. Now the HTML
 * ships complete and the styles live in src/styles/components.css, where they
 * can use var(--accent) like everything else.
 */
import { escape, attrs, formatDateShort } from "./html.js";

function tagList(tags, { accentFirst = false } = {}) {
  const list = (Array.isArray(tags) ? tags : []).filter(Boolean);
  if (!list.length) return "";
  const spans = list
    .map((tag, i) => {
      const cls = accentFirst && i === 0 ? "tag tag--accent" : "tag";
      return `<span class="${cls}">${escape(tag)}</span>`;
    })
    .join("");
  return `<div class="tags">${spans}</div>`;
}

function cardFooter(inner) {
  return inner.trim() ? `<div class="card-footer">${inner}</div>` : "";
}

export function renderArticleCard(article) {
  const { slug, title, date, description, tags } = article;
  const dateEl = date
    ? `<time class="card-date" datetime="${escape(date)}">${escape(formatDateShort(date))}</time>`
    : "";

  return `<a class="card" href="/articles/${escape(slug)}/">
  <h3 class="card-title">${escape(title)}</h3>
  ${description ? `<p class="card-description">${escape(description)}</p>` : ""}
  ${cardFooter(dateEl + tagList(tags, { accentFirst: true }))}
</a>`;
}

export function renderProjectCard(project) {
  const { name, description, url, tags, status } = project;
  const statusEl = status
    ? `<span class="status status--${escape(String(status).toLowerCase().replace(/\s+/g, "-"))}">${escape(status)}</span>`
    : "";

  // Something not shipped yet has nowhere to link — render it as a plain card
  // rather than an anchor pointing at "#".
  const tag = url ? "a" : "div";
  const linkAttrs = url
    ? attrs({ href: url, target: "_blank", rel: "noopener noreferrer" })
    : "";

  return `<${tag} class="card${url ? "" : " card--static"}"${linkAttrs}>
  <h3 class="card-title">${escape(name)}</h3>
  ${description ? `<p class="card-description">${escape(description)}</p>` : ""}
  ${cardFooter(statusEl + tagList(tags))}
</${tag}>`;
}

export function renderPodcastCard(episode) {
  const { title, description, date, duration, url, platform } = episode;
  const dateEl = date
    ? `<time class="card-date" datetime="${escape(date)}">${escape(formatDateShort(date))}</time>`
    : "";
  const durationEl = duration ? `<span class="pill">${escape(duration)}</span>` : "";
  const platformEl = platform ? `<span class="pill pill--accent">${escape(platform)}</span>` : "";

  return `<a class="card"${attrs({
    href: url || "#",
    target: url ? "_blank" : false,
    rel: url ? "noopener noreferrer" : false,
  })}>
  <h3 class="card-title">${escape(title)}</h3>
  ${description ? `<p class="card-description">${escape(description)}</p>` : ""}
  ${cardFooter(dateEl + durationEl + platformEl)}
</a>`;
}

export function renderGearCard(item) {
  const { name, description, url, image } = item;
  const imageEl = image
    ? `<div class="gear-image"><img src="${escape(image)}" alt="${escape(name)}" loading="lazy" decoding="async" /></div>`
    : "";

  return `<a class="card card--gear"${attrs({
    href: url || "#",
    target: url ? "_blank" : false,
    rel: url ? "noopener noreferrer" : false,
  })}>${imageEl ? `\n  ${imageEl}` : ""}
  <h3 class="card-title card-title--lg">${escape(name)}</h3>
  ${description ? `<p class="card-description card-description--full">${escape(description)}</p>` : ""}
</a>`;
}
