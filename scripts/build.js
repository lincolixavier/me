/**
 * Static site generator for lincolixavier.com — no dependencies.
 *
 * Everything under dist/ is generated; nothing in it should ever be edited by
 * hand. Sources of truth:
 *   content/site.json       site metadata, navigation, social links
 *   content/pages/*.html    prose fragments (about, life)
 *   content/articles/*.md   articles, with YAML front-matter
 *   content/*.json          projects, podcasts, gear
 *
 * Run: node scripts/build.js   (or `bun run build`)
 */

import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { parseFrontMatter } from "./lib/front-matter.js";
import { parseMarkdown, excerpt } from "./lib/markdown.js";
import { copyDir, renderRobots, renderSitemap, renderFeed } from "./lib/assets.js";
import {
  buildHome,
  buildLife,
  buildArticlesIndex,
  buildArticle,
  buildProjects,
  buildPodcasts,
  buildGear,
  buildContact,
  build404,
} from "./lib/pages.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = path.join(ROOT, "dist");
const CONTENT = path.join(ROOT, "content");

const warnings = [];

// Reading ------------------------------

async function readJson(relPath, fallback = null) {
  try {
    return JSON.parse(await fs.readFile(path.join(ROOT, relPath), "utf-8"));
  } catch (err) {
    if (err.code === "ENOENT" && fallback !== null) {
      warnings.push(`${relPath} not found — using an empty list.`);
      return fallback;
    }
    throw new Error(`Could not read ${relPath}: ${err.message}`);
  }
}

async function readFragment(relPath) {
  try {
    return await fs.readFile(path.join(ROOT, relPath), "utf-8");
  } catch (err) {
    if (err.code === "ENOENT") {
      warnings.push(`${relPath} not found — that section will be empty.`);
      return "";
    }
    throw err;
  }
}

async function exists(absPath) {
  try {
    await fs.access(absPath);
    return true;
  } catch {
    return false;
  }
}

/** Parses every article, newest first. Missing descriptions fall back to an excerpt. */
async function readArticles() {
  const dir = path.join(CONTENT, "articles");
  let files = [];
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    files = entries.filter((e) => e.isFile() && e.name.endsWith(".md"));
  } catch (err) {
    if (err.code !== "ENOENT") throw err;
    warnings.push("content/articles/ not found — no articles were built.");
    return [];
  }

  const articles = await Promise.all(
    files.map(async (file) => {
      const slug = path.basename(file.name, ".md");
      const raw = await fs.readFile(path.join(dir, file.name), "utf-8");
      const { attributes, body } = parseFrontMatter(raw);

      if (!attributes.title) warnings.push(`${file.name} has no "title" in its front-matter.`);
      if (!attributes.date) warnings.push(`${file.name} has no "date" — it will sort last.`);

      const ogFile = path.join(ROOT, "assets", "og", `${slug}.png`);

      return {
        slug,
        title: attributes.title ?? slug,
        date: attributes.date ?? null,
        description: attributes.description ?? excerpt(body),
        tags: Array.isArray(attributes.tags) ? attributes.tags : [],
        ogImage: (await exists(ogFile)) ? `/assets/og/${slug}.png` : null,
        body: parseMarkdown(body),
      };
    })
  );

  return articles.sort((a, b) => String(b.date ?? "").localeCompare(String(a.date ?? "")));
}

// Writing ------------------------------

async function writeFile(relPath, contents) {
  const target = path.join(DIST, relPath);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, contents, "utf-8");
}

/**
 * Concatenates the stylesheets into the single file the pages link to.
 *
 * They used to be pulled in with @import, which costs a serial round trip per
 * file — the browser cannot even discover them until main.css has arrived and
 * parsed — and leaves a window where the document is rendering but custom
 * properties are not readable yet. The sources stay split; only the output is
 * joined.
 */
const STYLE_ORDER = ["tokens.css", "base.css", "layout.css", "components.css"];

async function readStyles() {
  const parts = await Promise.all(
    STYLE_ORDER.map(async (name) => {
      const css = await fs.readFile(path.join(ROOT, "src", "styles", name), "utf-8");
      return `/* ${name} */\n${css.trim()}`;
    })
  );

  const css = minifyCss(parts.join("\n\n"));

  // The filename never changes, so without a cache key a browser holding an
  // hour-old stylesheet would apply it to freshly deployed markup. The query
  // changes whenever the bytes do, which is all the cache needs to see.
  const hash = crypto.createHash("sha256").update(css).digest("hex").slice(0, 8);
  return { css, hash };
}

/**
 * Conservative CSS minifier: strips comments and collapses the whitespace the
 * parser does not need. It deliberately leaves everything else alone — this is
 * a build for one small stylesheet, not a reason to take on a dependency.
 */
function minifyCss(css) {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\s+/g, " ")
    .replace(/\s*([{}:;,>])\s*/g, "$1")
    // A trailing semicolon before a closing brace is redundant.
    .replace(/;}/g, "}")
    .trim();
}

// Build ------------------------------

async function build() {
  const started = Date.now();

  const site = await readJson("content/site.json");

  /**
   * Social previews are pre-rendered by `bun run og` and committed, so a
   * deploy never depends on a browser being available to draw them. Whatever
   * is on disk gets linked; anything missing falls back to the default rather
   * than advertising an image that would 404.
   */
  site.styleHash = null;
  site.ogImage = (await exists(path.join(ROOT, "assets", "og", "default.png")))
    ? "/assets/og/default.png"
    : null;

  if (!site.ogImage) {
    warnings.push("assets/og/default.png missing — run `bun run og`.");
  }

  const styles = await readStyles();

  const [aboutHtml, lifeHtml, articles, projectsData, podcastsData, gearData] = await Promise.all([
    readFragment("content/pages/about.html"),
    readFragment("content/pages/life.html"),
    readArticles(),
    readJson("content/projects.json", { projects: [] }),
    readJson("content/podcasts.json", { podcasts: [] }),
    readJson("content/gear.json", { categories: [] }),
  ]);

  // Start from a clean slate so deleted content cannot linger in dist/.
  await fs.rm(DIST, { recursive: true, force: true });
  await fs.mkdir(DIST, { recursive: true });

  site.styleHash = styles.hash;

  const pages = [
    buildHome({ site, aboutHtml }),
    buildLife({ site, lifeHtml }),
    buildArticlesIndex({ site, articles }),
    buildProjects({ site, projects: projectsData.projects ?? [] }),
    buildPodcasts({ site, podcasts: podcastsData.podcasts ?? [] }),
    buildGear({ site, categories: gearData.categories ?? [] }),
    buildContact({ site }),
    build404({ site }),
    ...articles.map((article) =>
      buildArticle({ site, article, body: article.body, allArticles: articles })
    ),
  ];

  await Promise.all(pages.map((page) => writeFile(page.path, page.html)));

  // Static assets the pages reference.
  await copyDir(path.join(ROOT, "src"), path.join(DIST, "src"));
  await writeFile("src/styles/main.css", styles.css);
  if (await exists(path.join(ROOT, "assets"))) {
    await copyDir(path.join(ROOT, "assets"), path.join(DIST, "assets"));
  }

  const newest = articles.find((a) => a.date)?.date;
  await writeFile("robots.txt", renderRobots(site));
  await writeFile("feed.xml", renderFeed(site, articles));
  await writeFile(
    "sitemap.xml",
    renderSitemap(site, [
      { path: "/", priority: "1.0" },
      { path: "/articles/", lastmod: newest, priority: "0.8" },
      { path: "/projects/", priority: "0.8" },
      { path: "/podcasts/", priority: "0.6" },
      { path: "/gear/", priority: "0.5" },
      { path: "/life/", priority: "0.5" },
      { path: "/contact/", priority: "0.7" },
      ...articles.map((a) => ({
        path: `/articles/${a.slug}/`,
        lastmod: a.date ?? undefined,
        priority: "0.7",
      })),
    ])
  );

  const elapsed = Date.now() - started;
  console.log(
    `Built ${pages.length} pages (${articles.length} articles) → dist/ in ${elapsed}ms`
  );

  if (warnings.length) {
    console.warn(`\n${warnings.length} warning(s):`);
    for (const warning of warnings) console.warn(`  · ${warning}`);
  }
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
