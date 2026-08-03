/**
 * Zero-dependency Markdown → HTML.
 *
 * Blocks:  headings, fenced code, blockquotes, unordered/ordered lists,
 *          thematic breaks, paragraphs.
 * Inline:  `code`, **bold**, *italic*, ~~strike~~, [links](), ![images]().
 *
 * Everything is HTML-escaped: raw HTML in the source is rendered as text,
 * never injected. Inline code and link/image URLs are extracted before
 * emphasis runs, so `snake_case` and https://x.com/a_b_c survive intact.
 */

const PLACEHOLDER = "\u0000";
const UNSAFE_URL = /^\s*(javascript|data|vbscript):/i;

function escapeHtml(value) {
  if (value == null) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Escaped URL for an href/src, with javascript:-style schemes neutralised. */
function safeUrl(url) {
  const trimmed = String(url ?? "").trim();
  if (UNSAFE_URL.test(trimmed)) return "#";
  return escapeHtml(trimmed);
}

// Inline ------------------------------

/**
 * Holds fragments (code spans, links, images) that must not be touched by the
 * emphasis passes. They are swapped out for placeholders and swapped back last.
 */
class Vault {
  constructor() {
    this.items = [];
  }

  stash(html) {
    this.items.push(html);
    return `${PLACEHOLDER}${this.items.length - 1}${PLACEHOLDER}`;
  }

  restore(text) {
    return text.replace(
      new RegExp(`${PLACEHOLDER}(\\d+)${PLACEHOLDER}`, "g"),
      (_, i) => this.items[Number(i)] ?? ""
    );
  }
}

function applyEmphasis(text) {
  return text
    .replace(/\*\*\*([^*]+)\*\*\*/g, "<strong><em>$1</em></strong>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/__([^_]+)__/g, "<strong>$1</strong>")
    .replace(/~~([^~]+)~~/g, "<del>$1</del>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    // Intraword underscores (snake_case) must not become emphasis.
    .replace(/(^|[\s(])_([^_]+)_(?=$|[\s).,;:!?])/g, "$1<em>$2</em>");
}

/**
 * Convert inline Markdown in a single run of text.
 * Order matters: code → images → links → emphasis → restore.
 */
export function parseInline(text) {
  const vault = new Vault();

  let out = String(text ?? "");

  // `code` — stash raw, escape inside, immune to everything below.
  out = out.replace(/`([^`]+)`/g, (_, code) =>
    vault.stash(`<code>${escapeHtml(code)}</code>`)
  );

  // ![alt](src "title")
  out = out.replace(
    /!\[([^\]]*)\]\(\s*([^\s)]+)(?:\s+["']([^"']*)["'])?\s*\)/g,
    (_, alt, src, title) => {
      const titleAttr = title ? ` title="${escapeHtml(title)}"` : "";
      return vault.stash(
        `<img src="${safeUrl(src)}" alt="${escapeHtml(alt)}"${titleAttr} loading="lazy" decoding="async" />`
      );
    }
  );

  // [text](href "title") — link text still gets emphasis, the URL does not.
  out = out.replace(
    /\[([^\]]+)\]\(\s*([^\s)]+)(?:\s+["']([^"']*)["'])?\s*\)/g,
    (_, label, href, title) => {
      const url = safeUrl(href);
      const titleAttr = title ? ` title="${escapeHtml(title)}"` : "";
      const external = /^https?:\/\//i.test(href);
      const relAttr = external ? ' target="_blank" rel="noopener noreferrer"' : "";
      const inner = applyEmphasis(escapeHtml(label));
      return vault.stash(`<a href="${url}"${titleAttr}${relAttr}>${inner}</a>`);
    }
  );

  out = applyEmphasis(escapeHtml(out));

  return vault.restore(out);
}

// Blocks ------------------------------

const RE = {
  fence: /^(\s*)(`{3,}|~{3,})\s*([\w-]*)\s*$/,
  heading: /^(#{1,6})\s+(.*)$/,
  hr: /^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/,
  quote: /^\s*>\s?(.*)$/,
  ul: /^\s*[-*+]\s+(.*)$/,
  ol: /^\s*(\d+)[.)]\s+(.*)$/,
  blank: /^\s*$/,
};

/**
 * Line-driven block parser. Every line is consumed by exactly one branch,
 * so no content can be silently dropped.
 */
function parseBlocks(lines) {
  const out = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (RE.blank.test(line)) {
      i++;
      continue;
    }

    // Fenced code block
    const fence = line.match(RE.fence);
    if (fence) {
      const marker = fence[2];
      const lang = fence[3];
      const body = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith(marker)) {
        body.push(lines[i]);
        i++;
      }
      i++; // closing fence (or EOF)
      const cls = lang ? ` class="language-${escapeHtml(lang)}"` : "";
      out.push(`<pre><code${cls}>${escapeHtml(body.join("\n"))}</code></pre>`);
      continue;
    }

    if (RE.hr.test(line)) {
      out.push("<hr />");
      i++;
      continue;
    }

    const heading = line.match(RE.heading);
    if (heading) {
      const level = heading[1].length;
      out.push(`<h${level}>${parseInline(heading[2].trim())}</h${level}>`);
      i++;
      continue;
    }

    // Blockquote — collected then parsed recursively so it can hold any block.
    if (RE.quote.test(line)) {
      const body = [];
      while (i < lines.length && RE.quote.test(lines[i])) {
        body.push(lines[i].match(RE.quote)[1]);
        i++;
      }
      out.push(`<blockquote>\n${parseBlocks(body)}\n</blockquote>`);
      continue;
    }

    // Lists — a blank line or any non-item line ends the list.
    const listType = RE.ul.test(line) ? "ul" : RE.ol.test(line) ? "ol" : null;
    if (listType) {
      const pattern = listType === "ul" ? RE.ul : RE.ol;
      const items = [];
      while (i < lines.length && pattern.test(lines[i])) {
        const match = lines[i].match(pattern);
        items.push(listType === "ul" ? match[1] : match[2]);
        i++;
      }
      const lis = items.map((t) => `  <li>${parseInline(t.trim())}</li>`).join("\n");
      const startMatch = listType === "ol" ? line.match(RE.ol) : null;
      const start = startMatch && startMatch[1] !== "1" ? ` start="${Number(startMatch[1])}"` : "";
      out.push(`<${listType}${start}>\n${lis}\n</${listType}>`);
      continue;
    }

    // Paragraph — runs until a blank line or the start of another block.
    const para = [];
    while (
      i < lines.length &&
      !RE.blank.test(lines[i]) &&
      !RE.fence.test(lines[i]) &&
      !RE.heading.test(lines[i]) &&
      !RE.hr.test(lines[i]) &&
      !RE.quote.test(lines[i]) &&
      !RE.ul.test(lines[i]) &&
      !RE.ol.test(lines[i])
    ) {
      para.push(lines[i].trim());
      i++;
    }
    if (para.length) out.push(`<p>${parseInline(para.join(" "))}</p>`);
  }

  return out.join("\n");
}

/**
 * Convert Markdown source to HTML.
 * @param {string} source - Markdown text (body only, no front-matter)
 * @returns {string} HTML
 */
export function parseMarkdown(source) {
  if (source == null || source === "") return "";
  return parseBlocks(String(source).split(/\r?\n/)).trim();
}

/**
 * Plain-text excerpt of a Markdown source — used for meta descriptions.
 * @param {string} source
 * @param {number} [maxLength=160]
 */
export function excerpt(source, maxLength = 160) {
  const text = String(source ?? "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^\s*#{1,6}\s+/gm, "")
    .replace(/^\s*>\s?/gm, "")
    .replace(/[*_`~]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (text.length <= maxLength) return text;
  return text.slice(0, text.lastIndexOf(" ", maxLength - 1)).trimEnd() + "…";
}
