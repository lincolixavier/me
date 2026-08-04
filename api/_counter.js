import {
  redis,
  isValidSlug,
  isConfigured,
  toCount,
  json,
  withinRateLimit,
  clientIp,
} from "./_redis.js";

const READ = { GET: (key) => redis.get(key) };
const WRITE = { POST: (key) => redis.incr(key), DELETE: (key) => redis.decr(key) };

export function counter({ name, field = name, limit, methods = ["GET", "POST"] }) {
  const allowed = new Set(methods);
  const ops = { ...READ, ...WRITE };

  return async function handler(req, res) {
    const { slug } = req.query;
    const method = req.method;

    if (!isValidSlug(slug)) return json(res, 400, { error: "invalid slug" });
    if (!isConfigured()) return json(res, 503, { error: "counters not configured" });

    if (!allowed.has(method)) {
      res.setHeader("Allow", methods.join(", "));
      return json(res, 405, { error: "method not allowed" });
    }

    if (method !== "GET" && !(await withinRateLimit(name, clientIp(req), limit))) {
      return json(res, 429, { error: "too many requests" });
    }

    try {
      return json(res, 200, { [field]: toCount(await ops[method](`${name}:${slug}`)) });
    } catch (err) {
      console.error(`[${name}]`, err);
      return json(res, 502, { error: "counter unavailable" });
    }
  };
}
