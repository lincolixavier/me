import { redis, isConfigured, json } from "../_redis.js";
import { verifySignature, secretMatches } from "./_abacatepay.js";
import { fulfill } from "./_fulfill.js";

// Vercel only parses the body when req.body is read, so the raw stream stays intact for the HMAC.
async function readRaw(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  return Buffer.concat(chunks).toString("utf8");
}

async function fromCheckout(event) {
  const checkout = event.data?.checkout;
  const productId = process.env.ABACATEPAY_PRODUCT_ID;
  if (!checkout?.id || !checkout.items?.some((item) => item.id === productId)) return null;

  return {
    id: checkout.id,
    email: event.data?.customer?.email,
    name: event.data?.customer?.name,
    amount: checkout.paidAmount ?? checkout.amount,
  };
}

async function fromTransparent(event) {
  const charge = event.data?.transparent;
  if (!charge?.id || charge.metadata?.product !== "guia-nomade-digital") return null;

  const stored = await redis.get(`guia:pix:${charge.id}`).catch(() => null);
  const buyer = stored ? JSON.parse(stored) : {};

  return {
    id: charge.id,
    email: buyer.email || charge.metadata?.email || event.data?.customer?.email,
    name: buyer.name || charge.metadata?.name || event.data?.customer?.name,
    amount: charge.paidAmount ?? charge.amount,
  };
}

const HANDLERS = {
  "checkout.completed": fromCheckout,
  "transparent.completed": fromTransparent,
};

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

  const pick = HANDLERS[event.event];
  if (!pick) return json(res, 200, { ignored: true });

  if (!process.env.RESEND_API_KEY || !isConfigured()) {
    console.error("[guia/webhook] delivery is not configured", event.id);
    return json(res, 503, { error: "delivery is not configured" });
  }

  const sale = await pick(event);
  if (!sale) return json(res, 200, { ignored: true });

  try {
    const result = await fulfill({
      ...sale,
      method: event.data?.payerInformation?.method,
      devMode: event.devMode,
    });
    return json(res, 200, { ok: true, result });
  } catch (err) {
    console.error("[guia/webhook] delivery failed", sale.id, err);
    return json(res, 502, { error: "delivery failed" });
  }
}
