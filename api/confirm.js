/**
 * GET /api/confirm?token=… → redirect to /subscribed/
 *
 * Step two of the double opt-in, and the only place an address is actually
 * added to the audience. The token is single use: it is deleted before the
 * audience call, so a link that leaks from an inbox cannot be replayed.
 */
import { redis, isConfigured, json } from "./_redis.js";
import { addToAudience, siteUrl } from "./_email.js";

const AUDIENCE_ID = "58b6a2f9-97e2-4923-866b-ea5ac5835036";
const TOKEN = /^[a-f0-9]{32,128}$/;

function redirect(res, status) {
  res.writeHead(302, { Location: `${siteUrl()}/subscribed/?s=${status}` });
  res.end();
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return json(res, 405, { error: "method not allowed" });
  }

  const token = String(req.query.token || "");

  if (!TOKEN.test(token)) return redirect(res, "invalid");
  if (!isConfigured() || !process.env.RESEND_API_KEY) return redirect(res, "error");

  try {
    const key = `confirm:${token}`;
    const email = await redis.get(key);

    // Expired, already used, or never existed — the reader cannot tell which,
    // and does not need to.
    if (!email) return redirect(res, "expired");

    await redis.del(key);
    await addToAudience(email, AUDIENCE_ID);

    return redirect(res, "ok");
  } catch (err) {
    console.error("[confirm]", err);
    return redirect(res, "error");
  }
}
