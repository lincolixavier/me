/**
 * POST /api/subscribe → { ok: true }
 *
 * Step one of a double opt-in. Nothing is added to the audience here: the
 * address gets a single-use token stored in Redis and a confirmation email,
 * and only clicking that link puts them on the list.
 *
 * That matters beyond good manners. Without it anyone can subscribe someone
 * else's address, which is both a way to harass people and a fast route to a
 * spam complaint against the sending domain.
 */
import { redis, isConfigured, json, withinRateLimit, clientIp } from "./_redis.js";
import { sendEmail, siteUrl } from "./_email.js";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Long enough that the link cannot be guessed, short enough to be tidy. */
const TOKEN_BYTES = 24;
const TOKEN_TTL_SECONDS = 60 * 60 * 48;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return json(res, 405, { error: "method not allowed" });
  }

  if (!process.env.RESEND_API_KEY) {
    return json(res, 503, { error: "subscriptions are not configured" });
  }

  if (!isConfigured()) {
    return json(res, 503, { error: "subscriptions are not configured" });
  }

  const body = typeof req.body === "string" ? safeParse(req.body) : req.body || {};
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase().slice(0, 160) : "";

  if (!EMAIL.test(email)) {
    return json(res, 400, { error: "that address does not look right" });
  }

  if (!(await withinRateLimit("subscribe", clientIp(req), 10))) {
    return json(res, 429, { error: "too many attempts, try again later" });
  }

  try {
    const token = crypto.randomUUID().replace(/-/g, "") + randomHex(TOKEN_BYTES);
    await redis.set(`confirm:${token}`, email, TOKEN_TTL_SECONDS);

    const link = `${siteUrl()}/api/confirm?token=${token}`;

    await sendEmail({
      to: email,
      subject: "Confirm your subscription",
      text: [
        "Someone asked to receive new posts from lincoli.me at this address.",
        "",
        "If that was you, confirm here:",
        link,
        "",
        "If it was not, ignore this email. Nothing was added to any list, and",
        "this link expires in 48 hours.",
      ].join("\n"),
    });

    return json(res, 200, { ok: true });
  } catch (err) {
    console.error("[subscribe]", err);
    return json(res, 502, { error: "could not send the confirmation email" });
  }
}

function randomHex(bytes) {
  return [...crypto.getRandomValues(new Uint8Array(bytes))]
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("");
}

function safeParse(value) {
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}
