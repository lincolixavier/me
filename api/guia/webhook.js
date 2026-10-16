import { redis, isConfigured, json } from "../_redis.js";
import { sendEmail, siteUrl, emailShell } from "../_email.js";
import { verifySignature, secretMatches } from "./_abacatepay.js";

const OWNER = "hi@lincoli.me";
const DOWNLOAD_TTL_SECONDS = 60 * 60 * 24 * 30;
const CLAIM_TTL_SECONDS = 60 * 60 * 24 * 365;

// Vercel only parses the body when req.body is read, so the raw stream stays intact for the HMAC.
async function readRaw(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  return Buffer.concat(chunks).toString("utf8");
}

function randomToken() {
  return [...crypto.getRandomValues(new Uint8Array(24))]
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("");
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function deliver({ email, name, token }) {
  const link = `${siteUrl()}/api/guia/download?token=${token}`;
  const first = (name || "").trim().split(/\s+/)[0];
  const greeting = first ? `Oi, ${first}!` : "Oi!";
  const footnote =
    "O link vale por 30 dias. Dúvidas ou pedido de reembolso dentro da garantia de 7 dias: " +
    "é só responder este e-mail.";

  await sendEmail({
    to: email,
    replyTo: OWNER,
    subject: "Seu Guia do Nômade Digital chegou",
    text: [
      greeting,
      "",
      "Pagamento confirmado. Baixe o Guia do Nômade Digital aqui:",
      link,
      "",
      footnote,
      "",
      "Lincoli",
    ].join("\n"),
    html: emailShell({
      heading: "Seu guia chegou",
      body: `${escapeHtml(greeting)} Pagamento confirmado. Clique abaixo para baixar o PDF do Guia do Nômade Digital. Boa viagem.`,
      action: { href: link, label: "Baixar o guia" },
      footnote,
    }),
  });
}

async function notifyOwner(subject, lines) {
  try {
    await sendEmail({ to: OWNER, subject, text: lines.join("\n") });
  } catch (err) {
    console.error("[guia/webhook] owner notification failed", err);
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return json(res, 405, { error: "method not allowed" });
  }

  if (!secretMatches(req.query?.webhookSecret)) {
    return json(res, 401, { error: "unauthorized" });
  }

  const raw = await readRaw(req);
  if (!verifySignature(raw, req.headers["x-webhook-signature"])) {
    return json(res, 401, { error: "invalid signature" });
  }

  let event;
  try {
    event = JSON.parse(raw);
  } catch {
    return json(res, 400, { error: "invalid json" });
  }

  if (event.event !== "checkout.completed") return json(res, 200, { ignored: true });

  const checkout = event.data?.checkout;
  const customer = event.data?.customer;
  const productId = process.env.ABACATEPAY_PRODUCT_ID;

  if (!checkout?.id || !checkout.items?.some((item) => item.id === productId)) {
    return json(res, 200, { ignored: true });
  }

  if (!process.env.RESEND_API_KEY || !isConfigured()) {
    console.error("[guia/webhook] delivery is not configured", checkout.id);
    return json(res, 503, { error: "delivery is not configured" });
  }

  const claimKey = `guia:paid:${checkout.id}`;
  if (!(await redis.claim(claimKey, "1", CLAIM_TTL_SECONDS))) {
    return json(res, 200, { duplicate: true });
  }

  const email = typeof customer?.email === "string" ? customer.email.trim().toLowerCase() : "";
  const amount = ((checkout.paidAmount ?? checkout.amount ?? 0) / 100).toFixed(2);
  const summary = [
    `Checkout: ${checkout.id}`,
    `Cliente: ${customer?.name ?? "?"} <${email || "sem e-mail"}>`,
    `Valor: R$ ${amount}`,
    `Método: ${event.data?.payerInformation?.method ?? "?"}`,
    `Dev mode: ${event.devMode ? "sim" : "não"}`,
  ];

  if (!email) {
    await notifyOwner("Guia: venda sem e-mail do cliente", [...summary, "", "Entregar manualmente."]);
    return json(res, 200, { ok: true, delivered: false });
  }

  try {
    const token = randomToken();
    await redis.set(`guia:dl:${token}`, checkout.id, DOWNLOAD_TTL_SECONDS);
    await deliver({ email, name: customer?.name, token });
  } catch (err) {
    console.error("[guia/webhook] delivery failed", checkout.id, err);
    await redis.del(claimKey).catch(() => {});
    return json(res, 502, { error: "delivery failed" });
  }

  await notifyOwner(`Guia vendido: R$ ${amount}${event.devMode ? " (teste)" : ""}`, summary);
  return json(res, 200, { ok: true, delivered: true });
}
