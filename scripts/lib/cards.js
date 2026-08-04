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

  // The tags ride on the card so the listing can filter without another pass
  // over the data at runtime.
  const tagAttr = (Array.isArray(tags) ? tags : []).join("|");

  return `<a class="card" href="/articles/${escape(slug)}/" data-tags="${escape(tagAttr)}">
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

/**
 * Small flags marking the language an episode is in. Inline SVG rather than
 * emoji: flag emoji do not render at all on Windows, which is exactly where a
 * reader most needs to know before committing to two hours of audio.
 */
const FLAGS = {
  pt: {
    label: "In Portuguese",
    svg: `<svg viewBox="0 0 28 20" aria-hidden="true"><rect width="28" height="20" rx="2.5" fill="#009b3a"/><path d="M14 3.2 25 10l-11 6.8L3 10z" fill="#fedf00"/><circle cx="14" cy="10" r="4" fill="#002776"/></svg>`,
  },
  en: {
    label: "In English",
    svg: `<svg viewBox="0 0 28 20" aria-hidden="true"><rect width="28" height="20" rx="2.5" fill="#012169"/><path d="M0 0l28 20M28 0L0 20" stroke="#fff" stroke-width="4"/><path d="M0 0l28 20M28 0L0 20" stroke="#c8102e" stroke-width="2"/><path d="M14 0v20M0 10h28" stroke="#fff" stroke-width="6.5"/><path d="M14 0v20M0 10h28" stroke="#c8102e" stroke-width="3.5"/></svg>`,
  },
};

function renderFlag(lang) {
  const flag = FLAGS[lang];
  if (!flag) return "";
  return `<span class="flag" role="img" aria-label="${escape(flag.label)}">${flag.svg}</span>`;
}

export function renderPodcastCard(episode) {
  const { title, description, date, duration, url, show, platform, lang } = episode;
  const dateEl = date
    ? `<time class="card-date" datetime="${escape(date)}">${escape(formatDateShort(date))}</time>`
    : "";
  const durationEl = duration ? `<span class="pill">${escape(duration)}</span>` : "";
  const platformEl = platform ? `<span class="pill">${escape(platform)}</span>` : "";
  // The show carries more meaning than the platform, so it takes the accent.
  const showEl = show ? `<span class="pill pill--accent">${escape(show)}</span>` : "";

  return `<a class="card"${attrs({
    href: url || "#",
    target: url ? "_blank" : false,
    rel: url ? "noopener noreferrer" : false,
  })}>
  <h3 class="card-title">${escape(title)}</h3>
  ${description ? `<p class="card-description">${escape(description)}</p>` : ""}
  ${cardFooter(dateEl + renderFlag(lang) + showEl + durationEl + platformEl)}
</a>`;
}

/**
 * Gear cards can carry more than one link, so the card is a container rather
 * than one big anchor: nesting a second link inside the first would be invalid
 * markup, and screen readers would announce the card as a single destination.
 *
 * Paid links are marked rel="sponsored", which is what search engines ask for
 * and what keeps the rest of the site's links trustworthy.
 */
export function renderGearCard(item) {
  const { name, description, url, image, affiliate, links = [] } = item;

  const imageEl = image
    ? `<div class="gear-image"><img src="${escape(image)}" alt="${escape(name)}" loading="lazy" decoding="async" /></div>`
    : "";

  const rel = ["noopener", "noreferrer", affiliate && "sponsored"].filter(Boolean).join(" ");

  const title = url
    ? `<a class="gear-link" href="${escape(url)}" target="_blank" rel="${rel}">${escape(name)}</a>`
    : escape(name);

  const extras = links.length
    ? `<div class="gear-links">${links
        .map(
          (link) =>
            `<a class="gear-chip" href="${escape(link.href)}" target="_blank" rel="noopener noreferrer">${escape(link.label)}</a>`
        )
        .join("")}</div>`
    : "";

  return `<div class="card card--gear">${imageEl ? `\n  ${imageEl}` : ""}
  <h3 class="card-title card-title--lg">${title}</h3>
  ${description ? `<p class="card-description card-description--full">${escape(description)}</p>` : ""}
  ${extras}
</div>`;
}
