/**
 * Zero-dependency YAML front-matter parser.
 * Extracts metadata between the first --- and second ---.
 * Supports: title, date, description, tags (and other keys).
 */

const DELIMITER = "---";

/**
 * Splits content into front-matter string and body.
 * @param {string} raw - Full file content
 * @returns {{ fm: string, body: string }}
 */
function split(raw) {
  const s = String(raw);
  const first = s.indexOf(DELIMITER);
  if (first === -1) return { fm: "", body: s.trimStart() };
  const afterFirst = s.slice(first + DELIMITER.length);
  const second = afterFirst.indexOf(DELIMITER);
  if (second === -1) return { fm: "", body: s.trimStart() };
  const fm = afterFirst.slice(0, second).trim();
  const body = afterFirst.slice(second + DELIMITER.length).trimStart();
  return { fm, body };
}

/**
 * Parses a simple YAML-like key: value line.
 * Handles: "key: value", key: "quoted value", key: ["a","b"], key: [a, b]
 */
function parseValue(valueStr) {
  const v = valueStr.trim();
  if (v === "" || v === "null") return null;
  if (v === "true") return true;
  if (v === "false") return false;
  if (v.startsWith('"') && v.endsWith('"'))
    return v.slice(1, -1).replace(/\\"/g, '"');
  if (v.startsWith("'") && v.endsWith("'"))
    return v.slice(1, -1).replace(/\\'/g, "'");
  return v;
}

/**
 * Parses inline array: ["a", "b"] or [a, b]
 */
function parseInlineArray(str) {
  const s = str.trim();
  if (!s.startsWith("[") || !s.endsWith("]")) return null;
  const inner = s.slice(1, -1).trim();
  if (!inner) return [];
  const parts = [];
  let current = "";
  let inQuoted = false;
  let quote = null;
  for (let i = 0; i < inner.length; i++) {
    const c = inner[i];
    if (!inQuoted) {
      if (c === '"' || c === "'") {
        inQuoted = true;
        quote = c;
        current = "";
      } else if (c === ",") {
        if (current.trim()) parts.push(parseValue(current.trim()));
        current = "";
      } else {
        current += c;
      }
    } else {
      if (c === quote && inner[i - 1] !== "\\") {
        inQuoted = false;
        parts.push(parseValue(quote + current + quote));
        current = "";
      } else {
        current += c;
      }
    }
  }
  if (current.trim()) parts.push(parseValue(current.trim()));
  return parts;
}

/**
 * Parses front-matter block (multiline key: value and YAML-style list for tags).
 */
function parseFmBlock(fmStr) {
  const attrs = {};
  const lines = fmStr.split(/\r?\n/);
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const match = line.match(/^(\w+):\s*(.*)$/);
    if (match) {
      const key = match[1];
      let valueStr = match[2].trim();
      // Inline array e.g. tags: ["tech", "web"]
      if (valueStr.startsWith("[")) {
        attrs[key] = parseInlineArray(valueStr);
        i++;
        continue;
      }
      // Multiline list (YAML-style)
      if (valueStr === "" || valueStr === "|") {
        const nextLine = lines[i + 1];
        if (nextLine && /^\s*-\s+/.test(nextLine)) {
          const list = [];
          i++;
          while (i < lines.length && /^\s*-\s+/.test(lines[i])) {
            list.push(lines[i].replace(/^\s*-\s+/, "").trim().replace(/^["']|["']$/g, ""));
            i++;
          }
          attrs[key] = list;
          continue;
        }
      }
      attrs[key] = parseValue(valueStr || "");
    }
    i++;
  }
  return attrs;
}

/**
 * Parse front-matter from raw markdown content.
 * @param {string} raw - Full file content
 * @returns {{ attributes: Record<string, unknown>, body: string }}
 */
export function parseFrontMatter(raw) {
  const { fm, body } = split(raw);
  const attributes = fm ? parseFmBlock(fm) : {};
  return { attributes, body };
}
