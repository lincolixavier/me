/**
 * Zero-dependency minimal Markdown parser.
 * Supports: headers (# ## ###), bold (**), italic (*), links, code blocks, inline code, lists, paragraphs.
 */

function escapeHtml(s) {
  if (s == null || s === "") return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Inline parsing: **bold**, *italic*, `code`, [text](url)
 */
function parseInline(line) {
  let out = escapeHtml(line);
  // Code backticks (inline) - do before bold/italic to avoid conflict
  out = out.replace(/`([^`]+)`/g, "<code>$1</code>");
  // Bold **text**
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/__([^_]+)__/g, "<strong>$1</strong>");
  // Italic *text*
  out = out.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  out = out.replace(/_([^_]+)_/g, "<em>$1</em>");
  // Links [text](url)
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  return out;
}

/**
 * Parse a single block (paragraph, list, code block, or header).
 */
function parseBlock(block, inCodeBlock) {
  const trimmed = block.trim();
  if (!trimmed) return "";

  // Code block (fenced)
  if (trimmed.startsWith("```")) {
    const langMatch = trimmed.match(/^```(\w*)\n?/);
    const rest = trimmed.slice((langMatch ? langMatch[0] : "```").length);
    const end = rest.indexOf("```");
    const code = end === -1 ? rest : rest.slice(0, end);
    const lang = (langMatch && langMatch[1]) ? langMatch[1].trim() : "";
    return `<pre><code${lang ? ` class="language-${escapeHtml(lang)}"` : ""}>${escapeHtml(code.trim())}</code></pre>\n`;
  }

  if (inCodeBlock) return "";

  // Headers (# ## ###)
  const hMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
  if (hMatch) {
    const level = hMatch[1].length;
    const content = parseInline(hMatch[2].trim());
    return `<h${level}>${content}</h${level}>\n`;
  }

  // Unordered list (- item or * item)
  if (/^\s*[-*]\s+/.test(trimmed) || trimmed.split("\n").every((l) => /^\s*[-*]\s+/.test(l))) {
    const items = trimmed.split(/\n/).filter((l) => /^\s*[-*]\s+/.test(l));
    const lis = items
      .map((l) => l.replace(/^\s*[-*]\s+/, ""))
      .map((l) => `<li>${parseInline(l)}</li>`)
      .join("\n");
    return `<ul>\n${lis}\n</ul>\n`;
  }

  // Paragraph(s)
  const paras = trimmed.split(/\n\n+/).map((p) => {
    const line = p.trim();
    if (!line) return "";
    return `<p>${parseInline(line.replace(/\n/g, " "))}</p>`;
  });
  return paras.filter(Boolean).join("\n") + "\n";
}

/**
 * Split source into blocks (by blank lines and code fences).
 */
function splitBlocks(source) {
  const blocks = [];
  let current = "";
  let inFence = false;
  let fenceChar = "";
  const lines = source.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const fence = line.match(/^(`{3,}|~{3,})(\w*)/);
    if (fence && !inFence) {
      if (current.trim()) blocks.push(current);
      current = line + "\n";
      inFence = true;
      fenceChar = fence[1];
      continue;
    }
    if (inFence) {
      current += line + "\n";
      if (line.startsWith(fenceChar)) {
        inFence = false;
        blocks.push(current);
        current = "";
      }
      continue;
    }
    if (line.trim() === "" && current.trim() !== "") {
      blocks.push(current);
      current = "";
    } else {
      if (current) current += "\n";
      current += line;
    }
  }
  if (current.trim()) blocks.push(current);
  return blocks;
}

/**
 * Convert Markdown source to HTML.
 * @param {string} source - Markdown text (body only, no front-matter)
 * @returns {string} HTML
 */
export function parseMarkdown(source) {
  if (source == null || source === "") return "";
  const blocks = splitBlocks(source);
  let html = "";
  let inCodeBlock = false;
  for (const block of blocks) {
    const trimmed = block.trim();
    if (trimmed.startsWith("```")) inCodeBlock = !inCodeBlock;
    html += parseBlock(block, false);
  }
  return html.trim();
}
