/**
 * POST /api/subscribe → { ok: true, already?: true }
 *
 * Adds an address to the Resend audience. Same shape as the contact endpoint:
 * a Vercel function talking to Resend over plain fetch, rate limited with the
 * Upstash Redis the counters already use, so nothing new is added to the
 * project to make this work.
 */
import { json, withinRateLimit, clientIp } from "./_redis.js";

/** Not a secret — the API key is. Kept here so the list lives with its code. */
const AUDIENCE_ID = "58b6a2f9-97e2-4923-866b-ea5ac5835036";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return json(res, 405, { error: "method not allowed" });
  }

  if (!process.env.RESEND_API_KEY) {
    return json(res, 503, { error: "subscriptions are not configured" });
  }

  const body = typeof req.body === "string" ? safeParse(req.body) : req.body || {};
  const email = typeof body.email === "string" ? body.email.trim().slice(0, 160) : "";

  if (!EMAIL.test(email)) {
    return json(res, 400, { error: "that address does not look right" });
  }

  if (!(await withinRateLimit("subscribe", clientIp(req), 10))) {
    return json(res, 429, { error: "too many attempts, try again later" });
  }

  try {
    const response = await fetch(
      `https://api.resend.com/audiences/${AUDIENCE_ID}/contacts`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, unsubscribed: false }),
      }
    );

    const result = await response.json().catch(() => ({}));

    if (response.ok) return json(res, 200, { ok: true });

    // Someone subscribing twice has done nothing wrong, so it is not an error
    // to them even though the API rejects the duplicate.
    const message = String(result?.message || result?.name || "");
    if (response.status === 409 || /already|exists/i.test(message)) {
      return json(res, 200, { ok: true, already: true });
    }

    console.error("[subscribe] resend", response.status, message);
    return json(res, 502, { error: "could not subscribe you right now" });
  } catch (err) {
    console.error("[subscribe]", err);
    return json(res, 502, { error: "could not subscribe you right now" });
  }
}

function safeParse(value) {
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}
