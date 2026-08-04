import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { parseFrontMatter } from "./lib/front-matter.js";
import { parseMarkdown, excerpt } from "./lib/markdown.js";
import { copyDir, renderRobots, renderSitemap, renderFeed } from "./lib/assets.js";
import {
  renderArticleMarkdown,
  renderLlmsTxt,
  renderLlmsFullTxt,
  renderContentIndex,
} from "./lib/machine-readable.js";
import { SPLASH_SCRIPT, IMPORT_MAP_JSON, ANALYTICS_HOST } from "./lib/layout.js";
import {
  buildHome,
  buildLife,
  buildArticlesIndex,
  buildArticle,
  buildProjects,
  buildPodcasts,
  buildGear,
  buildContact,
  buildSubscribed,
  build404,
} from "./lib/pages.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = path.join(ROOT, "dist");
const CONTENT = path.join(ROOT, "content");

const warnings = [];

async function readJson(relPath, fallback = null) {
  try {
    return JSON.parse(await fs.readFile(path.join(ROOT, relPath), "utf-8"));
  } catch (err) {
    if (err.code === "ENOENT" && fallback !== null) {
      warnings.push(`${relPath} not found, using an empty list.`);
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
      warnings.push(`${relPath} not found, so that section will be empty.`);
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

async function ogImage(name) {
  for (const ext of ["jpg", "png"]) {
    if (await exists(path.join(ROOT, "assets", "og", `${name}.${ext}`))) {
      return `/assets/og/${name}.${ext}`;
    }
  }
  return null;
}

async function readArticles() {
  const dir = path.join(CONTENT, "articles");
  let files = [];
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    files = entries.filter((e) => e.isFile() && e.name.endsWith(".md"));
  } catch (err) {
    if (err.code !== "ENOENT") throw err;
    warnings.push("content/articles/ not found, so no articles were built.");
    return [];
  }

  const articles = await Promise.all(
    files.map(async (file) => {
      const slug = path.basename(file.name, ".md");
      const raw = await fs.readFile(path.join(dir, file.name), "utf-8");
      const { attributes, body } = parseFrontMatter(raw);

      if (!attributes.title) warnings.push(`${file.name} has no "title" in its front-matter.`);
      if (!attributes.date) warnings.push(`${file.name} has no "date", so it will sort last.`);

      return {
        slug,
        title: attributes.title ?? slug,
        date: attributes.date ?? null,
        description: attributes.description ?? excerpt(body),
        tags: Array.isArray(attributes.tags) ? attributes.tags : [],
        ogImage: await ogImage(slug),
        body: parseMarkdown(body),
        markdown: body.trim(),
      };
    })
  );

  return articles.sort((a, b) => String(b.date ?? "").localeCompare(String(a.date ?? "")));
}

async function writeFile(relPath, contents) {
  const target = path.join(DIST, relPath);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, contents, "utf-8");
}

// Cascade order. Later layers win regardless of specificity.
const STYLE_LAYERS = ["tokens", "base", "layout", "components", "responsive"];

async function readStyles() {
  const parts = await Promise.all(
    STYLE_LAYERS.map(async (layer) => {
      const css = await fs.readFile(path.join(ROOT, "src", "styles", `${layer}.css`), "utf-8");
      return `@layer ${layer} {\n${css.trim()}\n}`;
    })
  );

  parts.unshift(`@layer ${STYLE_LAYERS.join(", ")};`);

  const css = minifyCss(parts.join("\n\n"));

  const hash = crypto.createHash("sha256").update(css).digest("hex").slice(0, 8);
  return { css, hash };
}

function minifyCss(css) {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\s+/g, " ")
    .replace(/\s*([{}:;,>])\s*/g, "$1")
    .replace(/;}/g, "}")
    .trim();
}

function contentSecurityPolicy() {
  // The import map is governed by script-src too, so it needs its own hash.
  const hashes = [SPLASH_SCRIPT, IMPORT_MAP_JSON]
    .map((source) => `'sha256-${crypto.createHash("sha256").update(source).digest("base64")}'`)
    .join(" ");

  return [
    "default-src 'self'",
    `script-src 'self' https://cdn.jsdelivr.net ${ANALYTICS_HOST} ${hashes}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self' https://*.himetrica.com",
    "form-action 'self'",
    "base-uri 'self'",
    "object-src 'none'",
  ].join("; ");
}

async function build() {
  const started = Date.now();

  const site = await readJson("content/site.json");

  site.styleHash = null;
  site.ogImage = await ogImage("default");

  if (!site.ogImage) {
    warnings.push("assets/og/default.* missing. Run `bun run og`.");
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

  await fs.rm(DIST, { recursive: true, force: true });
  await fs.mkdir(DIST, { recursive: true });

  site.styleHash = styles.hash;
  site.csp = contentSecurityPolicy();

  const pages = [
    buildHome({ site, aboutHtml }),
    buildLife({ site, lifeHtml }),
    buildArticlesIndex({ site, articles }),
    buildProjects({ site, projects: projectsData.projects ?? [] }),
    buildPodcasts({ site, podcasts: podcastsData.podcasts ?? [] }),
    buildGear({ site, categories: gearData.categories ?? [] }),
    buildContact({ site }),
    buildSubscribed({ site }),
    build404({ site }),
    ...articles.map((article) =>
      buildArticle({ site, article, body: article.body, allArticles: articles })
    ),
  ];

  await Promise.all(pages.map((page) => writeFile(page.path, page.html)));

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

  const projects = projectsData.projects ?? [];
  await Promise.all(
    articles.map((article) =>
      writeFile(`articles/${article.slug}.md`, renderArticleMarkdown(site, article))
    )
  );
  await writeFile("llms.txt", renderLlmsTxt(site, { articles, projects }));
  await writeFile("llms-full.txt", renderLlmsFullTxt(site, articles));
  await writeFile(
    "content-index.json",
    renderContentIndex(site, {
      articles,
      projects,
      gear: gearData.categories ?? [],
      podcasts: podcastsData.podcasts ?? [],
    })
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
