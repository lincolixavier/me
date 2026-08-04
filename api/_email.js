/**
 * Sending mail through Resend, over plain fetch.
 *
 * Shared by the contact form and the newsletter so the sender address and the
 * error handling exist once rather than in each endpoint.
 */

const FROM = "Lincoli.me <hi@updates.lincoli.me>";

/**
 * The canonical origin, for links inside emails. VERCEL_URL points at the
 * deployment, not the domain, so it is only a fallback for previews.
 */
export function siteUrl() {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/+$/, "");
  if (process.env.VERCEL_ENV === "production") return "https://www.lincoli.me";
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "https://www.lincoli.me";
}

/**
 * @throws when Resend rejects the message, so callers can decide what the
 *   reader should see rather than silently reporting success.
 */
export async function sendEmail({ to, subject, text, replyTo }) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM,
      to: [to],
      subject,
      text,
      ...(replyTo ? { reply_to: replyTo } : {}),
    }),
  });

  if (!response.ok) {
    throw new Error(`resend ${response.status}: ${await response.text()}`);
  }

  return response.json().catch(() => ({}));
}

/**
 * Adds a confirmed address to the audience. Called only after the reader has
 * clicked the link in their own inbox.
 */
export async function addToAudience(email, audienceId) {
  const response = await fetch(`https://api.resend.com/audiences/${audienceId}/contacts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, unsubscribed: false }),
  });

  if (!response.ok) {
    throw new Error(`resend ${response.status}: ${await response.text()}`);
  }

  return response.json().catch(() => ({}));
}
