import { redis, isConfigured, json, withinRateLimit, clientIp } from "./_redis.js";
import { sendEmail, siteUrl, emailShell } from "./_email.js";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

  if (!(await withinRateLimit("subscribe-to", email, 2, 60 * 60 * 24))) {
    return json(res, 200, { ok: true });
  }

  try {
    const token = crypto.randomUUID().replace(/-/g, "") + randomHex(TOKEN_BYTES);
    await redis.set(`confirm:${token}`, email, TOKEN_TTL_SECONDS);

    const link = `${siteUrl()}/api/confirm?token=${token}`;

    const footnote =
      "If that was not you, ignore this email. Nothing has been added to any " +
      "list, and the link expires in 48 hours.";

    await sendEmail({
      to: email,
      subject: "Confirm your subscription",
      text: [
        "Someone asked to receive new posts from lincoli.me at this address.",
        "",
        "If that was you, confirm here:",
        link,
        "",
        footnote,
      ].join("\n"),
      html: emailShell({
        heading: "Confirm your subscription",
        body: "Someone asked to receive new posts from lincoli.me at this address. One click and it is done.",
        action: { href: link, label: "Confirm subscription" },
        footnote,
      }),
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
