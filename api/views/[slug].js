/**
 * GET  /api/views/<slug> → { views }
 * POST /api/views/<slug> → { views }  (increments first)
 *
 * The client only POSTs once per visitor per article, tracked in
 * localStorage. That is not fraud-proof, and it is not meant to be — it just
 * stops a refresh from inflating the number.
 */
import { redis, isValidSlug, isConfigured, toCount, json } from "../_redis.js";

export default async function handler(req, res) {
  const { slug } = req.query;

  if (!isValidSlug(slug)) return json(res, 400, { error: "invalid slug" });
  if (!isConfigured()) return json(res, 503, { error: "counters not configured" });

  const key = `views:${slug}`;

  try {
    if (req.method === "POST") {
      return json(res, 200, { views: toCount(await redis.incr(key)) });
    }
    if (req.method === "GET") {
      return json(res, 200, { views: toCount(await redis.get(key)) });
    }
    res.setHeader("Allow", "GET, POST");
    return json(res, 405, { error: "method not allowed" });
  } catch (err) {
    console.error("[views]", err);
    return json(res, 502, { error: "counter unavailable" });
  }
}
