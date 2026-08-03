/**
 * Small HTML helpers shared by every template.
 * Everything that reaches the output goes through escape() unless it is
 * explicitly authored HTML (content/pages/*.html, rendered Markdown).
 */

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

/** `attrs({ class: "a", hidden: false, id: null })` → ` class="a"` */
export function attrs(map) {
  return Object.entries(map)
    .filter(([, v]) => v !== false && v != null && v !== "")
    .map(([k, v]) => (v === true ? ` ${k}` : ` ${k}="${escape(v)}"`))
    .join("");
}

/** ISO date → "Mar 1, 2026". Returns the input unchanged if unparseable. */
export function formatDate(raw) {
  if (!raw) return "";
  const d = new Date(`${raw}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return raw;
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

/** Uppercase short form used on cards: "MAR 1, 2026". */
export function formatDateShort(raw) {
  return formatDate(raw).toUpperCase();
}

/** Joins a site URL and a root-relative path without doubling slashes. */
export function absoluteUrl(base, path = "/") {
  return `${String(base).replace(/\/+$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Filters falsy entries and joins with a space — for conditional class lists. */
export function classNames(...names) {
  return names.filter(Boolean).join(" ");
}

/** Indents a block of HTML so generated pages stay readable. */
export function indent(html, spaces = 0) {
  if (!spaces) return html;
  const pad = " ".repeat(spaces);
  return String(html)
    .split("\n")
    .map((line) => (line.trim() ? pad + line : line))
    .join("\n");
}
