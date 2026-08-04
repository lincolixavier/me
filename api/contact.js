import { json, withinRateLimit, clientIp } from "./_redis.js";
import { sendEmail, emailShell } from "./_email.js";

const TO = "hi@lincoli.me";

const LIMITS = { name: 80, email: 160, message: 4000 };
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

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
    await sendEmail({
      to: TO,
      subject: `Site contact from ${name}`,
      text: `From: ${name} <${email}>\n\n${message}`,
      html: emailShell({
        heading: `${name} sent a message`,
        body: escapeHtml(message).replace(/\n/g, "<br />"),
        footnote: `Reply to this email to answer ${escapeHtml(name)} at ${escapeHtml(email)}.`,
      }),
      replyTo: email,
    });

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
