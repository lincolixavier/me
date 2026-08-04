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
 * Wraps content in the site's look for HTML mail.
 *
 * Tables and inline styles, not flexbox and a stylesheet: mail clients strip
 * <style> blocks and most of them still lay out like it is 2005. The dark
 * background degrades to white in the few that force a light theme, so the
 * text colours are chosen to stay legible either way.
 */
export function emailShell({ heading, body, action, footnote }) {
  const button = action
    ? `<tr><td style="padding:8px 0 4px">
         <a href="${action.href}"
            style="display:inline-block;background:#ff2d6d;color:#ffffff;text-decoration:none;
                   font-weight:600;font-size:15px;padding:13px 28px;border-radius:10px">
           ${action.label}
         </a>
       </td></tr>
       <tr><td style="padding:14px 0 0;font-size:13px;line-height:1.6;color:#8a8a8a">
         Or paste this into your browser:<br />
         <span style="color:#b9b9b9;word-break:break-all">${action.href}</span>
       </td></tr>`
    : "";

  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#121212">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
         style="background:#121212;padding:40px 16px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
             style="max-width:520px;background:#171717;border:1px solid #262626;border-radius:14px">
        <tr><td style="padding:32px 32px 28px;font-family:'Helvetica Neue',Arial,sans-serif">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="padding-bottom:22px;font-size:19px;font-weight:700;
                           letter-spacing:0.04em;color:#ff2d6d">LX</td></tr>
            <tr><td style="padding-bottom:12px;font-size:21px;font-weight:700;
                           line-height:1.3;color:#f2f2f2">${heading}</td></tr>
            <tr><td style="padding-bottom:22px;font-size:15px;line-height:1.65;
                           color:#b9b9b9">${body}</td></tr>
            ${button}
            <tr><td style="padding-top:26px;border-top:1px solid #262626;
                           font-size:12px;line-height:1.6;color:#6f6f6f">
              ${footnote}
            </td></tr>
          </table>
        </td></tr>
      </table>
      <table role="presentation" cellpadding="0" cellspacing="0" style="max-width:520px">
        <tr><td style="padding:16px 8px 0;font-family:'Helvetica Neue',Arial,sans-serif;
                       font-size:12px;color:#5c5c5c">
          <a href="https://www.lincoli.me" style="color:#5c5c5c;text-decoration:none">lincoli.me</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

/**
 * @throws when Resend rejects the message, so callers can decide what the
 *   reader should see rather than silently reporting success.
 */
export async function sendEmail({ to, subject, text, html, replyTo }) {
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
      ...(html ? { html } : {}),
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
