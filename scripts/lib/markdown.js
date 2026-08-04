import { highlight } from "./highlight.js";

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

function safeUrl(url) {
  const trimmed = String(url ?? "").trim();
  if (UNSAFE_URL.test(trimmed)) return "#";
  return escapeHtml(trimmed);
}

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
    .replace(/(^|[\s(])_([^_]+)_(?=$|[\s).,;:!?])/g, "$1<em>$2</em>");
}

export function parseInline(text) {
  const vault = new Vault();

  let out = String(text ?? "");

  out = out.replace(/`([^`]+)`/g, (_, code) =>
    vault.stash(`<code>${escapeHtml(code)}</code>`)
  );

  out = out.replace(
    /!\[([^\]]*)\]\(\s*([^\s)]+)(?:\s+["']([^"']*)["'])?\s*\)/g,
    (_, alt, src, title) => {
      const titleAttr = title ? ` title="${escapeHtml(title)}"` : "";
      return vault.stash(
        `<img src="${safeUrl(src)}" alt="${escapeHtml(alt)}"${titleAttr} loading="lazy" decoding="async" />`
      );
    }
  );

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

const RE = {
  fence: /^(\s*)(`{3,}|~{3,})\s*([\w-]*)\s*$/,
  heading: /^(#{1,6})\s+(.*)$/,
  hr: /^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/,
  quote: /^\s*>\s?(.*)$/,
  ul: /^\s*[-*+]\s+(.*)$/,
  ol: /^\s*(\d+)[.)]\s+(.*)$/,
  blank: /^\s*$/,
};

function parseBlocks(lines) {
  const out = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (RE.blank.test(line)) {
      i++;
      continue;
    }

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
      i++;
      const cls = lang ? ` class="language-${escapeHtml(lang)}"` : "";
      const code = highlight(escapeHtml(body.join("\n")), lang);
      out.push(`<pre><code${cls}>${code}</code></pre>`);
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

    if (RE.quote.test(line)) {
      const body = [];
      while (i < lines.length && RE.quote.test(lines[i])) {
        body.push(lines[i].match(RE.quote)[1]);
        i++;
      }
      out.push(`<blockquote>\n${parseBlocks(body)}\n</blockquote>`);
      continue;
    }

    const listType = RE.ul.test(line) ? "ul" : RE.ol.test(line) ? "ol" : null;
    if (listType) {
      const pattern = listType === "ul" ? RE.ul : RE.ol;
      const items = [];
      while (i < lines.length && pattern.test(lines[i])) {
        const match = lines[i].match(pattern);
        items.push(listType === "ul" ? match[1] : match[2]);
        i++;

        while (
          i < lines.length &&
          !RE.blank.test(lines[i]) &&
          /^\s+\S/.test(lines[i]) &&
          !RE.ul.test(lines[i]) &&
          !RE.ol.test(lines[i])
        ) {
          items[items.length - 1] += ` ${lines[i].trim()}`;
          i++;
        }
      }
      const lis = items.map((t) => `  <li>${parseInline(t.trim())}</li>`).join("\n");
      const startMatch = listType === "ol" ? line.match(RE.ol) : null;
      const start = startMatch && startMatch[1] !== "1" ? ` start="${Number(startMatch[1])}"` : "";
      out.push(`<${listType}${start}>\n${lis}\n</${listType}>`);
      continue;
    }

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

export function parseMarkdown(source) {
  if (source == null || source === "") return "";
  return parseBlocks(String(source).split(/\r?\n/)).trim();
}

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
