import crypto from "node:crypto";

const API = "https://api.abacatepay.com/v2";

// Fixed HMAC key published by AbacatePay for v2 webhook signatures.
const SIGNATURE_KEY =
  "t9dXRhHHo3yDEj5pVDYz0frf7q6bMKyMRmxxCPIPp3RCplBfXRxqlC6ZpiWmOqj4L63qEaeUOtrCI8P0VMUgo6iIga2ri9ogaHFs0WIIywSMg0q7RmBfybe1E5XJcfC4IW3alNqym0tXoAKkzvfEjZxV6bE0oG2zJrNNYmUCKZyV0KZ3JS8Votf9EAWWYdiDkMkpbMdPggfh1EqHlVkMiTady6jOR3hyzGEHrIz2Ret0xHKMbiqkr9HS1JhNHDX9";

export function isConfigured() {
  return Boolean(process.env.ABACATEPAY_API_KEY && process.env.ABACATEPAY_PRODUCT_ID);
}

async function call(path, { method = "GET", body } = {}) {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${process.env.ABACATEPAY_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.success || !payload.data) {
    throw new Error(`abacatepay ${path} ${response.status}: ${JSON.stringify(payload.error ?? payload)}`);
  }

  return payload.data;
}

export function createPix(data) {
  return call("/transparents/create", { method: "POST", body: { method: "PIX", data } });
}

export function checkPix(id) {
  return call(`/transparents/check?id=${encodeURIComponent(id)}`);
}

export async function createCheckout({ completionUrl, returnUrl, externalId, metadata }) {
  const data = await call("/checkouts/create", {
    method: "POST",
    body: {
      items: [{ id: process.env.ABACATEPAY_PRODUCT_ID, quantity: 1 }],
      methods: ["PIX"],
      completionUrl,
      returnUrl,
      externalId,
      metadata,
    },
  });
  if (!data.url) throw new Error("abacatepay checkout without url");
  return data;
}

export function verifySignature(rawBody, signature) {
  if (typeof signature !== "string" || !signature) return false;

  const received = Buffer.from(signature);
  const keys = [SIGNATURE_KEY, process.env.ABACATEPAY_PUBLIC_KEY].filter(Boolean);

  return keys.some((key) => {
    const expected = Buffer.from(
      crypto.createHmac("sha256", key).update(Buffer.from(rawBody, "utf8")).digest("base64")
    );
    return expected.length === received.length && crypto.timingSafeEqual(expected, received);
  });
}

export function secretMatches(value) {
  const secret = process.env.ABACATEPAY_WEBHOOK_SECRET;
  if (!secret || typeof value !== "string") return false;

  const a = Buffer.from(value);
  const b = Buffer.from(secret);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
