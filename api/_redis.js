/**
 * Minimal Upstash Redis client over its REST API.
 *
 * The whole site has no dependencies, and this does not need to break that:
 * the REST API is a plain fetch, so @upstash/redis would buy us nothing here.
 */

const BASE = process.env.KV_REST_API_URL;
const TOKEN = process.env.KV_REST_API_TOKEN;

/** Slugs come from the URL, so they are untrusted until proven otherwise. */
const SLUG = /^[a-z0-9][a-z0-9-]{0,80}$/;

export function isValidSlug(slug) {
  return typeof slug === "string" && SLUG.test(slug);
}

export function isConfigured() {
  return Boolean(BASE && TOKEN);
}

/**
 * Runs a single Redis command, e.g. command("INCR", "views:my-post").
 * @returns {Promise<any>} the command's result
 */
async function command(...args) {
  const response = await fetch(`${BASE}/${args.map(encodeURIComponent).join("/")}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
    // Counters must never be served from a cache.
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Upstash ${response.status}: ${await response.text()}`);
  }

  const body = await response.json();
  return body.result;
}

export const redis = {
  get: (key) => command("GET", key),
  incr: (key) => command("INCR", key),
  decr: (key) => command("DECR", key),
  expire: (key, seconds) => command("EXPIRE", key, String(seconds)),
  /** Reads several keys at once; missing keys come back as null. */
  mget: (...keys) => command("MGET", ...keys),
};

/** Counters are never negative, and a missing key reads as 0. */
export function toCount(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function json(res, status, payload) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.status(status).send(JSON.stringify(payload));
}
