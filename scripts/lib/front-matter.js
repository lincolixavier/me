const DELIMITER = "---";

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
      if (valueStr.startsWith("[")) {
        attrs[key] = parseInlineArray(valueStr);
        i++;
        continue;
      }
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

export function parseFrontMatter(raw) {
  const { fm, body } = split(raw);
  const attributes = fm ? parseFmBlock(fm) : {};
  return { attributes, body };
}
