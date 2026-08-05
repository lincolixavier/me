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
  LOCALES,
  DEFAULT_LOCALE,
  resolveSite,
  outputPath,
  withPrefix,
  staticTranslations,
} from "./lib/i18n.js";
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

async function readFragment(relPath, { optional = false } = {}) {
  try {
    return await fs.readFile(path.join(ROOT, relPath), "utf-8");
  } catch (err) {
    if (err.code === "ENOENT") {
      if (!optional) warnings.push(`${relPath} not found, so that section will be empty.`);
      return null;
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

/**
 * A card carries the article's title, so each language needs its own. Non-default
 * locales look in assets/og/<code>/ first and fall back to the English card,
 * which is still better than no preview at all while a translation is new.
 */
async function ogImage(name, locale = DEFAULT_LOCALE) {
  const dirs = locale.default ? [""] : [`${locale.code}/`, ""];

  for (const dir of dirs) {
    for (const ext of ["jpg", "png"]) {
      const rel = `/assets/og/${dir}${name}.${ext}`;
      if (await exists(path.join(ROOT, rel))) return rel;
    }
  }
  return null;
}

/**
 * Read one locale's articles. The default locale lives in content/articles/,
 * every other one in content/articles/<code>/. A file name is the article's key
 * — its identity across languages — while `slug` may be overridden per locale so
 * a Portuguese piece can carry a Portuguese URL.
 */
async function readArticles(locale) {
  const dir = locale.default
    ? path.join(CONTENT, "articles")
    : path.join(CONTENT, "articles", locale.code);

  let files = [];
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    files = entries.filter((e) => e.isFile() && e.name.endsWith(".md"));
  } catch (err) {
    if (err.code !== "ENOENT") throw err;
    if (locale.default) warnings.push("content/articles/ not found, so no articles were built.");
    return [];
  }

  const articles = await Promise.all(
    files.map(async (file) => {
      const key = path.basename(file.name, ".md");
      const raw = await fs.readFile(path.join(dir, file.name), "utf-8");
      const { attributes, body } = parseFrontMatter(raw);

      const where = locale.default ? file.name : `${locale.code}/${file.name}`;
      if (!attributes.title) warnings.push(`${where} has no "title" in its front-matter.`);
      if (!attributes.date) warnings.push(`${where} has no "date", so it will sort last.`);

      return {
        key,
        slug: attributes.slug ?? key,
        title: attributes.title ?? key,
        date: attributes.date ?? null,
        description: attributes.description ?? excerpt(body),
        tags: Array.isArray(attributes.tags) ? attributes.tags : [],
        ogImage: await ogImage(key, locale),
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

/**
 * Which locales carry each article, keyed by article key. hreflang has to be
 * reciprocal, so a piece that exists in one language only gets no alternates.
 */
function indexTranslations(articlesByLocale) {
  const index = new Map();

  for (const [code, articles] of Object.entries(articlesByLocale)) {
    for (const article of articles) {
      if (!index.has(article.key)) index.set(article.key, {});
      const prefix = LOCALES.find((locale) => locale.code === code).prefix;
      index.get(article.key)[code] = withPrefix(prefix, `/articles/${article.slug}/`);
    }
  }

  return index;
}

async function build() {
  const started = Date.now();

  const site = await readJson("content/site.json");

  site.styleHash = null;

  const defaultOgImages = Object.fromEntries(
    await Promise.all(
      LOCALES.map(async (locale) => [locale.code, await ogImage("default", locale)])
    )
  );

  for (const locale of LOCALES) {
    if (!defaultOgImages[locale.code]) {
      warnings.push(`assets/og/ has no default card for ${locale.code}. Run \`bun run og\`.`);
    }
  }

  const styles = await readStyles();

  const [projectsData, podcastsData, gearData] = await Promise.all([
    readJson("content/projects.json", { projects: [] }),
    readJson("content/podcasts.json", { podcasts: [] }),
    readJson("content/gear.json", { categories: [] }),
  ]);

  const dictionaries = Object.fromEntries(
    await Promise.all(
      LOCALES.map(async (locale) => [locale.code, await readJson(`content/i18n/${locale.code}.json`)])
    )
  );

  const articlesByLocale = Object.fromEntries(
    await Promise.all(LOCALES.map(async (locale) => [locale.code, await readArticles(locale)]))
  );

  const translationIndex = indexTranslations(articlesByLocale);

  // Prose fragments: fall back to the default locale rather than rendering a blank section.
  const fragments = {};
  for (const locale of LOCALES) {
    const suffix = locale.default ? "" : `.${locale.code}`;
    fragments[locale.code] = {
      about:
        (await readFragment(`content/pages/about${suffix}.html`, { optional: !locale.default })) ??
        fragments[DEFAULT_LOCALE.code]?.about ??
        "",
      life:
        (await readFragment(`content/pages/life${suffix}.html`, { optional: !locale.default })) ??
        fragments[DEFAULT_LOCALE.code]?.life ??
        "",
    };
    if (!locale.default) {
      for (const name of ["about", "life"]) {
        if (fragments[locale.code][name] === fragments[DEFAULT_LOCALE.code][name]) {
          warnings.push(`content/pages/${name}${suffix}.html missing, falling back to English.`);
        }
      }
    }
  }

  await fs.rm(DIST, { recursive: true, force: true });
  await fs.mkdir(DIST, { recursive: true });

  site.styleHash = styles.hash;
  site.csp = contentSecurityPolicy();

  const projects = projectsData.projects ?? [];
  const podcasts = podcastsData.podcasts ?? [];
  const categories = gearData.categories ?? [];

  const sitemapEntries = [];
  let pageCount = 0;

  for (const locale of LOCALES) {
    const resolved = resolveSite(site, locale, dictionaries[locale.code]);
    resolved.ogImage = defaultOgImages[locale.code];
    const articles = articlesByLocale[locale.code];

    const articleTranslations = (article) => {
      const entry = translationIndex.get(article.key) ?? {};
      return Object.keys(entry).length > 1 ? entry : null;
    };

    const pages = [
      buildHome({
        site: resolved,
        aboutHtml: fragments[locale.code].about,
        translations: staticTranslations("/"),
      }),
      buildLife({
        site: resolved,
        lifeHtml: fragments[locale.code].life,
        translations: staticTranslations("/life/"),
      }),
      buildArticlesIndex({
        site: resolved,
        articles,
        translations: staticTranslations("/articles/"),
      }),
      buildProjects({ site: resolved, projects, translations: staticTranslations("/projects/") }),
      buildPodcasts({ site: resolved, podcasts, translations: staticTranslations("/podcasts/") }),
      buildGear({ site: resolved, categories, translations: staticTranslations("/gear/") }),
      buildContact({ site: resolved, translations: staticTranslations("/contact/") }),
      buildSubscribed({ site: resolved, translations: staticTranslations("/subscribed/") }),
      build404({ site: resolved }),
      ...articles.map((article) =>
        buildArticle({
          site: resolved,
          article,
          body: article.body,
          allArticles: articles,
          translations: articleTranslations(article),
        })
      ),
    ];

    await Promise.all(pages.map((page) => writeFile(page.path, page.html)));
    pageCount += pages.length;

    // Machine-readable mirrors, one set per language.
    await Promise.all(
      articles.map((article) =>
        writeFile(
          outputPath(locale.prefix, `articles/${article.slug}.md`),
          renderArticleMarkdown(resolved, article)
        )
      )
    );
    await writeFile(
      outputPath(locale.prefix, "feed.xml"),
      renderFeed(resolved, articles)
    );
    await writeFile(
      outputPath(locale.prefix, "llms.txt"),
      renderLlmsTxt(resolved, { articles, projects })
    );
    await writeFile(
      outputPath(locale.prefix, "llms-full.txt"),
      renderLlmsFullTxt(resolved, articles)
    );
    await writeFile(
      outputPath(locale.prefix, "content-index.json"),
      renderContentIndex(resolved, { articles, projects, gear: categories, podcasts })
    );

    const newest = articles.find((a) => a.date)?.date;
    const staticPages = [
      { path: "/", priority: "1.0" },
      { path: "/articles/", lastmod: newest, priority: "0.8" },
      { path: "/projects/", priority: "0.8" },
      { path: "/podcasts/", priority: "0.6" },
      { path: "/gear/", priority: "0.5" },
      { path: "/life/", priority: "0.5" },
      { path: "/contact/", priority: "0.7" },
    ];

    for (const page of staticPages) {
      sitemapEntries.push({
        ...page,
        path: withPrefix(locale.prefix, page.path),
        alternates: hreflangMap(staticTranslations(page.path)),
      });
    }

    for (const article of articles) {
      sitemapEntries.push({
        path: withPrefix(locale.prefix, `/articles/${article.slug}/`),
        lastmod: article.date ?? undefined,
        priority: "0.7",
        alternates: hreflangMap(articleTranslations(article)),
      });
    }
  }

  await copyDir(path.join(ROOT, "src"), path.join(DIST, "src"));
  await writeFile("src/styles/main.css", styles.css);
  if (await exists(path.join(ROOT, "assets"))) {
    await copyDir(path.join(ROOT, "assets"), path.join(DIST, "assets"));
  }

  await writeFile("robots.txt", renderRobots(site));
  await writeFile("sitemap.xml", renderSitemap(site, sitemapEntries));

  const elapsed = Date.now() - started;
  const counts = LOCALES.map(
    (locale) => `${locale.code}: ${articlesByLocale[locale.code].length}`
  ).join(", ");
  console.log(`Built ${pageCount} pages (articles — ${counts}) → dist/ in ${elapsed}ms`);

  if (warnings.length) {
    console.warn(`\n${warnings.length} warning(s):`);
    for (const warning of warnings) console.warn(`  · ${warning}`);
  }
}

// Sitemap alternates are keyed by hreflang value, not locale code, and include
// x-default so search engines know which version to serve an unmatched visitor.
function hreflangMap(translations) {
  if (!translations) return null;

  const present = LOCALES.filter((locale) => translations[locale.code]);
  if (present.length < 2) return null;

  const map = {};
  for (const locale of present) map[locale.hreflang] = translations[locale.code];
  if (translations[DEFAULT_LOCALE.code]) map["x-default"] = translations[DEFAULT_LOCALE.code];
  return map;
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
