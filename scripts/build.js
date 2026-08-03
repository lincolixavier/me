// Build: content/articles/*.md → dist/articles/*.html + articles/index.json (Node only, no deps)
// Run: node scripts/build.js  |  Watch: node --watch scripts/build.js

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseFrontMatter } from "./lib/front-matter.js";
import { parseMarkdown } from "./lib/markdown.js";

// Paths & config ------------------------------

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const PATHS = {
  contentArticles: path.join(ROOT, "content", "articles"),
  distArticles: path.join(ROOT, "dist", "articles"),
  articlesIndexJson: path.join(ROOT, "articles", "index.json"),
};

const BASE_HREF = "../../";

const IMPORT_MAP = {
  imports: {
    three: "https://cdn.jsdelivr.net/npm/three@0.162.0/build/three.module.js",
    "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.162.0/examples/jsm/",
  },
};

const ARTICLE_SCRIPTS = [
  "src/components/site-header.js",
  "src/components/site-footer.js",
  "src/components/neural-canvas.js",
];

// HTML & template helpers ------------------------------

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatDate(raw) {
  if (!raw) return "";
  const d = new Date(raw + "T00:00:00");
  if (isNaN(d.getTime())) return raw;
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

function escapeHtml(value) {
  if (value == null || value === "") return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderArticlePage({ title, description, date, body }) {
  const safeTitle = escapeHtml(title);
  const safeDescription = escapeHtml(description ?? "");
  const safeDate = escapeHtml(date ?? "");
  const formattedDate = formatDate(date);
  const dateBlock =
    safeDate !== ""
      ? `<time class="article-date" datetime="${safeDate}">${escapeHtml(formattedDate)}</time>`
      : "";

  const scriptTags = ARTICLE_SCRIPTS.map(
    (src) => `<script type="module" src="${BASE_HREF}${src}"></script>`
  ).join("\n  ");

  return `<!DOCTYPE html>
            <html lang="en">
            <head>
              <meta charset="UTF-8" />
              <meta name="viewport" content="width=device-width, initial-scale=1.0" />
              <title>${safeTitle}</title>
              <meta name="description" content="${safeDescription}" />
              <link rel="preconnect" href="https://fonts.googleapis.com" />
              <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
              <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@200;300;400;500;600;700&display=swap" rel="stylesheet" />
              <link href="${BASE_HREF}src/styles/main.css" rel="stylesheet" />
            </head>
            <body>
              <neural-canvas camera-z="14" orbit-min="14" orbit-max="24" bloom="false" auto-rotate-speed="0.1" density="0.45"></neural-canvas>
              <div class="left-fade" aria-hidden="true"></div>

              <div class="page">
                <div class="scroll-fade scroll-fade--top" aria-hidden="true"></div>
                <div class="scroll-fade scroll-fade--bottom" aria-hidden="true"></div>
                <site-header active="articles" home-href="${BASE_HREF}index.html"></site-header>

                <main class="article-page">
                  <article class="article-content">
                    <header class="article-header">
                      <h1 class="page-title">${safeTitle}</h1>
                      ${dateBlock}
                    </header>
                    <div class="prose article-body">
            ${body}
                    </div>
                  </article>
                </main>

                <site-footer></site-footer>
              </div>

              <script type="importmap">
                ${JSON.stringify(IMPORT_MAP, null, 2)}
              </script>
              ${scriptTags}
            </body>
            </html>
            `;
  }

// Article metadata ------------------------------

function buildArticleMetadata(attributes, slug) {
  const tags = Array.isArray(attributes?.tags) ? attributes.tags : [];
  return {
    slug,
    title: (attributes?.title ?? slug),
    date: attributes?.date ?? null,
    description: attributes?.description ?? null,
    tags,
  };
}

function sortByDateDesc(metadata) {
  metadata.sort((a, b) => {
    const dateA = a.date ?? "";
    const dateB = b.date ?? "";
    return dateB.localeCompare(dateA);
  });
}

// I/O and pipeline ------------------------------

async function ensureDirectories() {
  await fs.mkdir(PATHS.contentArticles, { recursive: true });
  await fs.mkdir(PATHS.distArticles, { recursive: true });
  await fs.mkdir(path.dirname(PATHS.articlesIndexJson), { recursive: true });
}

async function listMarkdownFiles() {
  try {
    const entries = await fs.readdir(PATHS.contentArticles, {
      withFileTypes: true,
    });
    return entries.filter((e) => e.isFile() && e.name.endsWith(".md"));
  } catch (err) {
    if (err.code === "ENOENT") {
      await fs.mkdir(PATHS.contentArticles, { recursive: true });
      return [];
    }
    throw err;
  }
}

async function readAndParseArticle(filePath, slug) {
  const raw = await fs.readFile(filePath, "utf-8");
  const { attributes, body } = parseFrontMatter(raw);
  const metadata = buildArticleMetadata(attributes ?? {}, slug);
  const htmlBody = parseMarkdown(body);
  return { metadata, htmlBody: String(htmlBody) };
}

async function buildOneArticle(dirent) {
  const slug = path.basename(dirent.name, ".md");
  const filePath = path.join(PATHS.contentArticles, dirent.name);

  const { metadata, htmlBody } = await readAndParseArticle(filePath, slug);
  const html = renderArticlePage({
    title: metadata.title,
    description: metadata.description,
    date: metadata.date,
    body: htmlBody,
  });

  const outPath = path.join(PATHS.distArticles, `${slug}.html`);
  await fs.writeFile(outPath, html, "utf-8");

  return metadata;
}

/**
 * Writes articles/index.json with the given metadata array.
 * @param {ArticleMetadata[]} metadata
 */
async function writeArticlesIndex(metadata) {
  await fs.writeFile(
    PATHS.articlesIndexJson,
    JSON.stringify({ articles: metadata }, null, 2),
    "utf-8"
  );
}

// Main build ------------------------------

async function build() {
  await ensureDirectories();

  const mdFiles = await listMarkdownFiles();
  const metadata = await Promise.all(mdFiles.map(buildOneArticle));

  sortByDateDesc(metadata);
  await writeArticlesIndex(metadata);

  console.log(
    `Built ${metadata.length} article(s) → dist/articles/*.html, articles/index.json`
  );
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
