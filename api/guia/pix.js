import { redis, isConfigured as redisConfigured, withinRateLimit, clientIp, json } from "../_redis.js";
import { isConfigured, createPix, checkPix } from "./_abacatepay.js";
import { fulfill, PRICE_CENTS } from "./_fulfill.js";
import { attribution, utm } from "./_attribution.js";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CHARGE_ID = /^pix_char_[A-Za-z0-9]{8,64}$/;
const EXPIRES_IN_SECONDS = 60 * 30;
const BUYER_TTL_SECONDS = 60 * 60 * 24 * 7;

function clean(value, max) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function sameOrigin(req) {
  try {
    return new URL(req.headers.origin).host === req.headers.host;
  } catch {
    return false;
  }
}

function randomRef() {
  return [...crypto.getRandomValues(new Uint8Array(12))]
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("");
}

function qrImage(value) {
  if (typeof value !== "string" || !value) return "";
  return value.startsWith("data:") ? value : `data:image/png;base64,${value}`;
}

async function create(req, res) {
  if (!sameOrigin(req)) return json(res, 403, { error: "forbidden" });
  if (!(await withinRateLimit("guia-pix", clientIp(req), 10))) {
    return json(res, 429, { error: "Muitas tentativas. Tente de novo em alguns minutos." });
  }

  const body = typeof req.body === "object" && req.body ? req.body : {};
  const name = clean(body.name, 80);
  const email = clean(body.email, 160).toLowerCase();
  if (name.length < 2) return json(res, 422, { error: "Informe seu nome.", field: "name" });
  if (!EMAIL.test(email)) return json(res, 422, { error: "Confira o e-mail.", field: "email" });

  const ref = randomRef();
  const fields = attribution(req, body);
  const request = {
    amount: PRICE_CENTS,
    description: "Guia do Nômade Digital",
    expiresIn: EXPIRES_IN_SECONDS,
    externalId: ref,
    utm: utm(fields),
    metadata: { product: "guia-nomade-digital", ref, name, email, ...fields },
  };

  const charge = await createPix(request);

  await redis.set(`guia:pix:${charge.id}`, JSON.stringify({ name, email, ref }), BUYER_TTL_SECONDS);

  return json(res, 200, {
    id: charge.id,
    ref,
    brCode: charge.brCode,
    qr: qrImage(charge.brCodeBase64),
    expiresAt: charge.expiresAt,
  });
}

async function status(req, res) {
  const id = typeof req.query?.id === "string" ? req.query.id : "";
  if (!CHARGE_ID.test(id)) return json(res, 400, { error: "invalid id" });
  if (!(await withinRateLimit("guia-pix-status", clientIp(req), 900))) return json(res, 429, { status: "PENDING" });

  const stored = await redis.get(`guia:pix:${id}`);
  if (!stored) return json(res, 404, { error: "not found" });
  const buyer = JSON.parse(stored);

  const charge = await checkPix(id);
  if (charge.status !== "PAID") return json(res, 200, { status: charge.status });

  try {
    await fulfill({ id, email: buyer.email, name: buyer.name, amount: PRICE_CENTS, method: "PIX" });
  } catch (err) {
    console.error("[guia/pix] delivery failed", id, err);
  }
  return json(res, 200, { status: "PAID", ref: buyer.ref });
}

export default async function handler(req, res) {
  if (req.method !== "POST" && req.method !== "GET") {
    res.setHeader("Allow", "GET, POST");
    return json(res, 405, { error: "method not allowed" });
  }

  if (!isConfigured() || !redisConfigured() || !process.env.RESEND_API_KEY) {
    return json(res, 503, { error: "Pagamento indisponível agora." });
  }

  try {
    return req.method === "POST" ? await create(req, res) : await status(req, res);
  } catch (err) {
    console.error("[guia/pix]", err);
    return json(res, 502, { error: "Não consegui gerar o PIX agora. Tente de novo em instantes." });
  }
}
