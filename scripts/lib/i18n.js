// Every locale the site is generated in. The default one owns the root paths,
// so the English URLs that are already indexed never move.
export const LOCALES = [
  {
    code: "en",
    prefix: "",
    htmlLang: "en",
    ogLocale: "en_US",
    hreflang: "en",
    label: "EN",
    default: true,
  },
  {
    code: "pt",
    prefix: "/pt",
    htmlLang: "pt-BR",
    ogLocale: "pt_BR",
    hreflang: "pt-BR",
    label: "PT",
    default: false,
  },
];

export const DEFAULT_LOCALE = LOCALES.find((locale) => locale.default);

export function localeByCode(code) {
  return LOCALES.find((locale) => locale.code === code) ?? DEFAULT_LOCALE;
}

// Prefix a root-relative path for the given locale. "/articles/" → "/pt/articles/".
export function withPrefix(prefix, path) {
  if (!prefix) return path;
  if (path === "/") return `${prefix}/`;
  return `${prefix}${path}`;
}

// Bound to a locale-resolved site object so page builders can write url(site, "/articles/").
export function url(site, path) {
  return withPrefix(site.prefix, path);
}

// Where a page lands in dist/ for this locale. "articles/index.html" → "pt/articles/index.html".
export function outputPath(prefix, relPath) {
  return prefix ? `${prefix.replace(/^\//, "")}/${relPath}` : relPath;
}

/**
 * Read a content value that may be either a plain string or a per-locale map.
 * Lets content/*.json opt into translation field by field, with no migration for
 * the fields that read the same in both languages.
 */
export function pick(value, code) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value[code] ?? value[DEFAULT_LOCALE.code] ?? "";
  }
  return value;
}

/** Every locale's path for a page that exists in all of them. */
export function staticTranslations(path) {
  return Object.fromEntries(LOCALES.map((locale) => [locale.code, withPrefix(locale.prefix, path)]));
}

/**
 * Fold a locale dictionary into the shared site config. The result is what every
 * page builder receives as `site`, so translated copy is reached the same way the
 * untranslated version used to be.
 */
export function resolveSite(site, locale, dict) {
  return {
    ...site,
    ...dict,
    name: site.name,
    url: site.url,
    locale: locale.ogLocale,
    lang: locale.htmlLang,
    prefix: locale.prefix,
    localeCode: locale.code,
  };
}
