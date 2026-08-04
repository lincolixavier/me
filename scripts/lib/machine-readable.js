/**
 * The build output meant for machines rather than browsers.
 *
 * Three things, all generated from the same articles the HTML comes from:
 *
 *   /articles/<slug>.md   the source of one article
 *   /llms.txt             an index, per the llmstxt.org proposal
 *   /llms-full.txt        every article concatenated, for a single fetch
 *   /content-index.json   what the MCP server reads at runtime
 *
 * None of it is a second copy of the content. The site is written in Markdown,
 * so this is the source travelling further than usual, and an agent that reads
 * it gets prose instead of a page it would have to strip a nav, a footer and a
 * WebGL canvas out of.
 */
import { absoluteUrl } from "./html.js";

/**
 * One article as a standalone Markdown file.
 *
 * The front matter is rebuilt rather than passed through so `source` can be
 * added: whatever quotes this should be able to link back to it.
 */
export function renderArticleMarkdown(site, article) {
  const front = [
    "---",
    `title: ${JSON.stringify(article.title)}`,
    article.date ? `date: ${article.date}` : null,
    article.description ? `description: ${JSON.stringify(article.description)}` : null,
    article.tags.length ? `tags: ${JSON.stringify(article.tags)}` : null,
    `source: ${absoluteUrl(site.url, `/articles/${article.slug}/`)}`,
    `author: ${JSON.stringify(site.name)}`,
    "---",
  ]
    .filter(Boolean)
    .join("\n");

  return `${front}\n\n${article.markdown}\n`;
}

/** A one-line entry in an llms.txt list: `- [name](url): description`. */
function entry(name, url, description) {
  return description ? `- [${name}](${url}): ${description}` : `- [${name}](${url})`;
}

/**
 * The index. The format is deliberately plain Markdown with H2 sections, which
 * is the whole point of the proposal: something a model can read in one pass
 * without a parser.
 */
export function renderLlmsTxt(site, { articles, projects }) {
  const url = (p) => absoluteUrl(site.url, p);

  const sections = [
    `# ${site.name}`,
    "",
    `> ${site.description}`,
    "",
    "Personal site of a software engineer and digital nomad. Everything below is",
    "written by hand. Each article is also served as Markdown at the same path",
    "with a `.md` extension, and the whole site is available in one file at",
    `${url("/llms-full.txt")}.`,
    "",
    "## Articles",
    "",
    ...articles.map((a) =>
      entry(a.title, url(`/articles/${a.slug}.md`), [a.date, a.description].filter(Boolean).join(". "))
    ),
    "",
    "## Projects",
    "",
    ...projects.map((p) =>
      entry(p.name, p.url || url("/projects/"), [p.description, `Status: ${p.status}`].filter(Boolean).join(" "))
    ),
    "",
    "## Pages",
    "",
    entry("About and career", url("/"), "Background, and the roles behind it."),
    entry("Be here now", url("/life/"), "On gratitude and the present moment."),
    entry("Gear", url("/gear/"), "The cameras, lenses and hardware in use."),
    entry("Podcasts", url("/podcasts/"), "Recorded appearances, in English and Portuguese."),
    entry("Contact", url("/contact/"), "How to get in touch."),
    "",
    "## Optional",
    "",
    entry("RSS feed", url("/feed.xml"), "Every article, newest first."),
    entry("MCP server", url("/api/mcp"), "The same content as tools, over Model Context Protocol."),
    "",
  ];

  return sections.join("\n");
}

/** Every article in one file, so an agent can take the lot in a single fetch. */
export function renderLlmsFullTxt(site, articles) {
  const header = [
    `# ${site.name}`,
    "",
    `> ${site.description}`,
    "",
    `Every article from ${site.url}, newest first. ${articles.length} in total.`,
    "",
  ].join("\n");

  const body = articles
    .map((a) => {
      const meta = [
        a.date ? `Published: ${a.date}` : null,
        a.tags.length ? `Tags: ${a.tags.join(", ")}` : null,
        `Source: ${absoluteUrl(site.url, `/articles/${a.slug}/`)}`,
      ]
        .filter(Boolean)
        .join(" · ");

      return `---\n\n# ${a.title}\n\n${meta}\n\n${a.markdown}\n`;
    })
    .join("\n");

  return `${header}\n${body}`;
}

/**
 * What /api/mcp fetches on a cold start. Bodies are included so search can look
 * at the prose rather than only at titles; the whole thing is a few hundred
 * kilobytes and it is fetched once per warm instance.
 */
export function renderContentIndex(site, { articles, projects, gear, podcasts }) {
  return JSON.stringify({
    site: {
      name: site.name,
      url: site.url,
      tagline: site.tagline,
      description: site.description,
      social: site.social,
      career: site.career,
    },
    articles: articles.map((a) => ({
      slug: a.slug,
      title: a.title,
      date: a.date,
      description: a.description,
      tags: a.tags,
      url: absoluteUrl(site.url, `/articles/${a.slug}/`),
      markdown: a.markdown,
    })),
    projects,
    gear,
    podcasts,
  });
}
