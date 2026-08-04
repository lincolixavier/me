/**
 * POST /api/contact → { ok: true }
 *
 * Takes the contact form and forwards it to the inbox. The simplest thing that
 * actually delivers mail, given what is already here: a Vercel function, the
 * Upstash Redis the counters use for rate limiting, and Resend's REST API over
 * plain fetch, so the project keeps its zero dependencies.
 *
 * Needs RESEND_API_KEY in the environment. Without it the endpoint says so
 * plainly and the page falls back to a mailto link, rather than accepting
 * messages it has no way to deliver.
 */
import { json, withinRateLimit, clientIp } from "./_redis.js";

const TO = "hi@lincoli.me";
const FROM = "Lincoli.me <hi@updates.lincoli.me>";

const LIMITS = { name: 80, email: 160, message: 4000 };
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function clean(value, max) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return json(res, 405, { error: "method not allowed" });
  }

  if (!process.env.RESEND_API_KEY) {
    return json(res, 503, { error: "email is not configured" });
  }

  const body = typeof req.body === "string" ? safeParse(req.body) : req.body || {};
  const name = clean(body.name, LIMITS.name);
  const email = clean(body.email, LIMITS.email);
  const message = clean(body.message, LIMITS.message);

  if (!name || !message || !EMAIL.test(email)) {
    return json(res, 400, { error: "name, a valid email and a message are required" });
  }

  if (!(await withinRateLimit("contact", clientIp(req), 5))) {
    return json(res, 429, { error: "too many messages, try again later" });
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM,
        to: [TO],
        // So hitting reply in the inbox answers the sender, not the robot.
        reply_to: email,
        subject: `Site contact — ${name}`,
        text: `From: ${name} <${email}>\n\n${message}`,
      }),
    });

    if (!response.ok) {
      console.error("[contact] resend", response.status, await response.text());
      return json(res, 502, { error: "could not send the message" });
    }

    return json(res, 200, { ok: true });
  } catch (err) {
    console.error("[contact]", err);
    return json(res, 502, { error: "could not send the message" });
  }
}

function safeParse(value) {
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}
