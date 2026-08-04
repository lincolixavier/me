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
  del: (key) => command("DEL", key),
  /** SET with an expiry in one round trip, so a token can never outlive it. */
  set: (key, value, seconds) => command("SET", key, value, "EX", String(seconds)),
  /** Reads several keys at once; missing keys come back as null. */
  mget: (...keys) => command("MGET", ...keys),
};

/** Counters are never negative, and a missing key reads as 0. */
export function toCount(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * Simple fixed-window limiter shared by every endpoint that writes.
 * Fails open: the limiter breaking should not take the site down with it.
 *
 * @returns {Promise<boolean>} true when the caller is still within budget
 */
export async function withinRateLimit(prefix, ip, max, windowSeconds = 3600) {
  if (!isConfigured()) return true;

  try {
    const key = `rl:${prefix}:${ip}`;
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, windowSeconds);
    return count <= max;
  } catch {
    return true;
  }
}

/** Vercel sets this header itself, so the client cannot forge the first hop. */
export function clientIp(req) {
  return (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "unknown";
}

export function json(res, status, payload) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.status(status).send(JSON.stringify(payload));
}
