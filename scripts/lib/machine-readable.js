import { absoluteUrl } from "./html.js";
import { pick, url as localeUrl } from "./i18n.js";

export function renderArticleMarkdown(site, article) {
  const front = [
    "---",
    `title: ${JSON.stringify(article.title)}`,
    article.date ? `date: ${article.date}` : null,
    article.description ? `description: ${JSON.stringify(article.description)}` : null,
    article.tags.length ? `tags: ${JSON.stringify(article.tags)}` : null,
    `lang: ${site.lang}`,
    `source: ${absoluteUrl(site.url, localeUrl(site, `/articles/${article.slug}/`))}`,
    `author: ${JSON.stringify(site.name)}`,
    "---",
  ]
    .filter(Boolean)
    .join("\n");

  return `${front}\n\n${article.markdown}\n`;
}

function entry(name, url, description) {
  return description ? `- [${name}](${url}): ${description}` : `- [${name}](${url})`;
}

export function renderLlmsTxt(site, { articles, projects }) {
  const url = (p) => absoluteUrl(site.url, localeUrl(site, p));
  const t = site.llms;

  const sections = [
    `# ${site.name}`,
    "",
    `> ${site.description}`,
    "",
    `${t.intro} ${absoluteUrl(site.url, localeUrl(site, "/llms-full.txt"))}.`,
    "",
    `## ${t.articles}`,
    "",
    ...articles.map((a) =>
      entry(a.title, url(`/articles/${a.slug}.md`), [a.date, a.description].filter(Boolean).join(". "))
    ),
    "",
    `## ${t.projects}`,
    "",
    ...projects.map((p) =>
      entry(
        p.name,
        p.url || url("/projects/"),
        [pick(p.description, site.localeCode), `${t.status}: ${site.status?.[p.status] ?? p.status}`]
          .filter(Boolean)
          .join(" ")
      )
    ),
    "",
    `## ${t.pages}`,
    "",
    entry(t.aboutPage, url("/"), t.aboutPageDesc),
    entry(t.lifePage, url("/life/"), t.lifePageDesc),
    entry(t.gearPage, url("/gear/"), t.gearPageDesc),
    entry(t.podcastsPage, url("/podcasts/"), t.podcastsPageDesc),
    entry(t.contactPage, url("/contact/"), t.contactPageDesc),
    "",
    `## ${t.optional}`,
    "",
    entry(t.rss, url("/feed.xml"), t.rssDesc),
    entry(t.mcp, absoluteUrl(site.url, "/api/mcp"), t.mcpDesc),
    "",
  ];

  return sections.join("\n");
}

export function renderLlmsFullTxt(site, articles) {
  const t = site.llms;

  const header = [
    `# ${site.name}`,
    "",
    `> ${site.description}`,
    "",
    `${t.fullIntro} ${site.url}, ${t.fullCount} ${articles.length} ${t.fullTotal}`,
    "",
  ].join("\n");

  const body = articles
    .map((a) => {
      const meta = [
        a.date ? `${t.published}: ${a.date}` : null,
        a.tags.length ? `${t.tags}: ${a.tags.join(", ")}` : null,
        `${t.source}: ${absoluteUrl(site.url, localeUrl(site, `/articles/${a.slug}/`))}`,
      ]
        .filter(Boolean)
        .join(" · ");

      return `---\n\n# ${a.title}\n\n${meta}\n\n${a.markdown}\n`;
    })
    .join("\n");

  return `${header}\n${body}`;
}

export function renderContentIndex(site, { articles, projects, gear, podcasts }) {
  const localize = (value) => pick(value, site.localeCode);

  return JSON.stringify({
    site: {
      name: site.name,
      url: site.url,
      lang: site.lang,
      tagline: site.tagline,
      description: site.description,
      social: site.social,
      career: site.career,
    },
    articles: articles.map((a) => ({
      key: a.key,
      slug: a.slug,
      title: a.title,
      date: a.date,
      description: a.description,
      tags: a.tags,
      url: absoluteUrl(site.url, localeUrl(site, `/articles/${a.slug}/`)),
      markdown: a.markdown,
    })),
    projects: projects.map((p) => ({ ...p, description: localize(p.description) })),
    gear: gear.map((category) => ({
      ...category,
      items: (category.items ?? []).map((item) => ({
        ...item,
        description: localize(item.description),
      })),
    })),
    podcasts: podcasts.map((p) => ({ ...p, description: localize(p.description) })),
  });
}
