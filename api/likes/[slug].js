/**
 * GET    /api/likes/<slug> → { likes }
 * POST   /api/likes/<slug> → { likes }  (+1)
 * DELETE /api/likes/<slug> → { likes }  (-1)
 *
 * Whether a given visitor has liked something lives in their localStorage, so
 * the server only ever moves the counter. Clearing storage lets someone like
 * twice; for a personal blog that is a fine trade against storing identifiers.
 */
import { redis, isValidSlug, isConfigured, toCount, json } from "../_redis.js";

export default async function handler(req, res) {
  const { slug } = req.query;

  if (!isValidSlug(slug)) return json(res, 400, { error: "invalid slug" });
  if (!isConfigured()) return json(res, 503, { error: "counters not configured" });

  const key = `likes:${slug}`;

  try {
    if (req.method === "POST") {
      return json(res, 200, { likes: toCount(await redis.incr(key)) });
    }
    if (req.method === "DELETE") {
      // DECR can go negative if storage got out of sync, so clamp at zero.
      return json(res, 200, { likes: toCount(await redis.decr(key)) });
    }
    if (req.method === "GET") {
      return json(res, 200, { likes: toCount(await redis.get(key)) });
    }
    res.setHeader("Allow", "GET, POST, DELETE");
    return json(res, 405, { error: "method not allowed" });
  } catch (err) {
    console.error("[likes]", err);
    return json(res, 502, { error: "counter unavailable" });
  }
}
