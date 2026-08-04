const BASE = process.env.KV_REST_API_URL;
const TOKEN = process.env.KV_REST_API_TOKEN;

const SLUG = /^[a-z0-9][a-z0-9-]{0,80}$/;

export function isValidSlug(slug) {
  return typeof slug === "string" && SLUG.test(slug);
}

export function isConfigured() {
  return Boolean(BASE && TOKEN);
}

async function command(...args) {
  const response = await fetch(`${BASE}/${args.map(encodeURIComponent).join("/")}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
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
  set: (key, value, seconds) => command("SET", key, value, "EX", String(seconds)),
  mget: (...keys) => command("MGET", ...keys),
};

export function toCount(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

// Fails open: the limiter breaking should not take the site down with it.
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

export function clientIp(req) {
  return (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "unknown";
}

export function json(res, status, payload) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.status(status).send(JSON.stringify(payload));
}
