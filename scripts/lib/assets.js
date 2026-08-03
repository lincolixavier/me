/**
 * Non-HTML build output: static file copying, robots.txt, sitemap.xml, RSS.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { escape, absoluteUrl } from "./html.js";

/** Recursively copy a directory, skipping the noise we never want shipped. */
export async function copyDir(from, to, { skip = [".DS_Store", ".gitkeep"] } = {}) {
  const entries = await fs.readdir(from, { withFileTypes: true });
  await fs.mkdir(to, { recursive: true });

  for (const entry of entries) {
    if (skip.includes(entry.name)) continue;
    const src = path.join(from, entry.name);
    const dest = path.join(to, entry.name);
    if (entry.isDirectory()) await copyDir(src, dest, { skip });
    else await fs.copyFile(src, dest);
  }
}

export function renderRobots(site) {
  return `User-agent: *
Allow: /

Sitemap: ${absoluteUrl(site.url, "/sitemap.xml")}
`;
}

/**
 * @param {object} site
 * @param {Array<{path: string, lastmod?: string, priority?: string}>} pages
 */
export function renderSitemap(site, pages) {
  const entries = pages
    .map(({ path: p, lastmod, priority }) => {
      const parts = [
        `    <loc>${escape(absoluteUrl(site.url, p))}</loc>`,
        lastmod ? `    <lastmod>${escape(lastmod)}</lastmod>` : "",
        priority ? `    <priority>${escape(priority)}</priority>` : "",
      ].filter(Boolean);
      return `  <url>\n${parts.join("\n")}\n  </url>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries}
</urlset>
`;
}

/** RSS 2.0 feed of the articles, newest first. */
export function renderFeed(site, articles) {
  const items = articles
    .map((a) => {
      const url = absoluteUrl(site.url, `/articles/${a.slug}/`);
      const pubDate = a.date ? new Date(`${a.date}T00:00:00Z`).toUTCString() : "";
      return `    <item>
      <title>${escape(a.title)}</title>
      <link>${escape(url)}</link>
      <guid isPermaLink="true">${escape(url)}</guid>
      ${a.description ? `<description>${escape(a.description)}</description>` : ""}
      ${pubDate ? `<pubDate>${escape(pubDate)}</pubDate>` : ""}
    </item>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escape(site.name)} — articles</title>
    <link>${escape(absoluteUrl(site.url, "/articles/"))}</link>
    <description>${escape(site.description)}</description>
    <language>${escape(site.lang)}</language>
    <atom:link href="${escape(absoluteUrl(site.url, "/feed.xml"))}" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>
`;
}
