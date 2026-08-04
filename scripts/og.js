import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { parseFrontMatter } from "./lib/front-matter.js";
import { escape } from "./lib/html.js";

const run = promisify(execFile);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "assets", "og");
const FONTS = path.join(ROOT, "assets", "fonts");

const CHROME = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
];

const WIDTH = 1200;
const HEIGHT = 630;

function titleSize(title) {
  if (title.length <= 28) return 76;
  if (title.length <= 52) return 62;
  if (title.length <= 80) return 52;
  return 44;
}

function camera(seed) {
  const n = Math.abs(hash(seed));
  return {
    yaw: ((n % 1000) / 1000) * Math.PI * 2,
    pitch: -0.22 + (((n >> 10) % 1000) / 1000) * 0.62,
    distance: 30 + (((n >> 20) % 1000) / 1000) * 8,
  };
}

function template({ title, meta, kicker, seed, network }) {
  return `<!doctype html>
<meta charset="utf-8" />
<style>
  @font-face {
    font-family: "Outfit";
    font-weight: 400;
    src: url("file://${FONTS}/outfit-400.woff2") format("woff2");
  }
  @font-face {
    font-family: "Outfit";
    font-weight: 600;
    src: url("file://${FONTS}/outfit-600.woff2") format("woff2");
  }
  @font-face {
    font-family: "Outfit";
    font-weight: 700;
    src: url("file://${FONTS}/outfit-700.woff2") format("woff2");
  }

  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    width: ${WIDTH}px;
    height: ${HEIGHT}px;
    background: #121212;
    font-family: "Outfit", system-ui, sans-serif;
    color: #fff;
    overflow: hidden;
    position: relative;
  }

  #network {
    position: absolute;
    inset: 0;
  }

  .glow {
    position: absolute;
    inset: 0;
    background:
      radial-gradient(60% 70% at 82% 28%, rgba(255, 45, 109, 0.22), transparent 70%),
      radial-gradient(45% 55% at 12% 88%, rgba(255, 45, 109, 0.10), transparent 70%);
  }

  .scrim {
    position: absolute;
    inset: 0;
    background: radial-gradient(
      58% 62% at 50% 50%,
      rgba(18, 18, 18, 0.94) 0%,
      rgba(18, 18, 18, 0.78) 45%,
      rgba(18, 18, 18, 0.20) 78%,
      rgba(18, 18, 18, 0) 100%
    );
  }

  .band {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    width: 700px;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 22px;
  }

  .mark {
    font-size: 34px;
    font-weight: 700;
    letter-spacing: 0.04em;
    background: linear-gradient(136deg, #ff416c 0%, #aa003a 100%);
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  .kicker {
    font-size: 21px;
    font-weight: 500;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.42);
  }

  .title {
    font-size: ${titleSize(title)}px;
    font-weight: 700;
    line-height: 1.1;
    letter-spacing: -0.025em;
    text-wrap: balance;
  }

  .rule {
    width: 88px;
    height: 5px;
    border-radius: 3px;
    background: linear-gradient(136deg, #ff416c 0%, #aa003a 100%);
  }

  .meta {
    font-size: 23px;
    font-weight: 400;
    letter-spacing: 0.02em;
    color: rgba(255, 255, 255, 0.58);
  }
</style>
<canvas id="network" width="${WIDTH}" height="${HEIGHT}"></canvas>
<div class="glow"></div>
<div class="scrim"></div>
<div class="band">
  <div class="mark">LX</div>
  ${kicker ? `<div class="kicker">${escape(kicker)}</div>` : ""}
  <h1 class="title">${escape(title)}</h1>
  <div class="rule"></div>
  <div class="meta">${escape(meta)}</div>
</div>
<script>
  window.__OG_NETWORK__ = ${JSON.stringify({
    camera: camera(seed),
    centre: [0.5, 0.46],
    density: 1,
    opacity: 0.95,
  })};
</script>
<script>${network}</script>
`;
}

async function findChrome() {
  for (const candidate of CHROME) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
    }
  }
  return null;
}

async function shoot(chrome, html, pngFile) {
  const tmp = path.join(os.tmpdir(), `og-${Math.abs(hash(pngFile))}.html`);
  await fs.writeFile(tmp, html, "utf-8");

  await run(chrome, [
    "--headless",
    "--disable-gpu",
    "--no-sandbox",
    "--hide-scrollbars",
    "--force-device-scale-factor=1",
    `--window-size=${WIDTH},${HEIGHT}`,
    `--screenshot=${pngFile}`,
    `file://${tmp}`,
  ]);

  await fs.rm(tmp, { force: true });
}

async function compress(pngFile) {
  const jpgFile = pngFile.replace(/\.png$/, ".jpg");

  const converters = [
    ["sips", ["-s", "format", "jpeg", "-s", "formatOptions", "82", pngFile, "--out", jpgFile]],
    ["magick", [pngFile, "-quality", "82", jpgFile]],
    ["convert", [pngFile, "-quality", "82", jpgFile]],
  ];

  for (const [bin, args] of converters) {
    try {
      await run(bin, args);
      await fs.rm(pngFile, { force: true });
      return jpgFile;
    } catch {
    }
  }

  return pngFile;
}

function hash(value) {
  let h = 0;
  for (let i = 0; i < value.length; i++) h = (h * 31 + value.charCodeAt(i)) | 0;
  return h;
}

async function readArticles() {
  const dir = path.join(ROOT, "content", "articles");
  const entries = await fs.readdir(dir, { withFileTypes: true });

  return Promise.all(
    entries
      .filter((e) => e.isFile() && e.name.endsWith(".md"))
      .map(async (file) => {
        const slug = path.basename(file.name, ".md");
        const raw = await fs.readFile(path.join(dir, file.name), "utf-8");
        const { attributes } = parseFrontMatter(raw);
        return { slug, title: attributes.title ?? slug };
      })
  );
}

async function main() {
  const chrome = await findChrome();
  if (!chrome) {
    console.error(
      "No Chrome or Chromium found. Install one, or generate the images on a machine that has it. They are committed, so the deploy does not need it."
    );
    process.exit(1);
  }

  const site = JSON.parse(await fs.readFile(path.join(ROOT, "content", "site.json"), "utf-8"));
  const host = site.url.replace(/^https?:\/\//, "");

  await fs.mkdir(OUT, { recursive: true });

  const network = await fs.readFile(path.join(ROOT, "scripts", "lib", "og-network.browser.js"), "utf-8");

  const jobs = [
    {
      file: "default.png",
      html: template({
        title: site.name,
        meta: site.tagline,
        kicker: null,
        seed: "lincoli.me",
        network,
      }),
    },
    ...(await readArticles()).map((article) => ({
      file: `${article.slug}.png`,
      html: template({
        title: article.title,
        meta: host,
        kicker: "Article",
        seed: article.slug,
        network,
      }),
    })),
  ];

  const filter = process.argv[2];
  const selected = filter ? jobs.filter((job) => job.file.includes(filter)) : jobs;

  for (const job of selected) {
    const png = path.join(OUT, job.file);
    await shoot(chrome, job.html, png);
    await compress(png);
    process.stdout.write(".");
  }

  console.log(`\nWrote ${selected.length} images to assets/og/`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
