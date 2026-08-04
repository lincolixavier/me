const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function escape(value) {
  if (value == null) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function attrs(map) {
  return Object.entries(map)
    .filter(([, v]) => v !== false && v != null && v !== "")
    .map(([k, v]) => (v === true ? ` ${k}` : ` ${k}="${escape(v)}"`))
    .join("");
}

export function formatDate(raw) {
  if (!raw) return "";
  const d = new Date(`${raw}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return raw;
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

export function formatDateShort(raw) {
  return formatDate(raw).toUpperCase();
}

export function absoluteUrl(base, path = "/") {
  return `${String(base).replace(/\/+$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}

export function classNames(...names) {
  return names.filter(Boolean).join(" ");
}

export function indent(html, spaces = 0) {
  if (!spaces) return html;
  const pad = " ".repeat(spaces);
  return String(html)
    .split("\n")
    .map((line) => (line.trim() ? pad + line : line))
    .join("\n");
}
