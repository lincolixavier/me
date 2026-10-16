import { issueSignedToken, presignUrl } from "@vercel/blob";
import { redis, isConfigured, withinRateLimit, clientIp } from "../_redis.js";

const TOKEN = /^[a-f0-9]{48}$/;
const MAX_DOWNLOADS = 20;
const EXPIRED = "/guia/obrigado/?link=expirado";
const PDF_PATHNAME = "Guia do Nomade Digital.pdf";
const URL_TTL_MS = 10 * 60 * 1000;

async function signedPdfUrl() {
  const validUntil = Date.now() + URL_TTL_MS;
  const token = await issueSignedToken({ pathname: PDF_PATHNAME, operations: ["get"], validUntil });
  const { presignedUrl } = await presignUrl(token, {
    operation: "get",
    pathname: PDF_PATHNAME,
    access: "private",
    validUntil,
  });
  return presignedUrl;
}

function redirect(res, location) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-Robots-Tag", "noindex");
  res.setHeader("Location", location);
  res.status(302).end();
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).end();
  }

  const token = typeof req.query?.token === "string" ? req.query.token : "";
  if (!TOKEN.test(token) || !isConfigured()) return redirect(res, EXPIRED);

  if (!(await withinRateLimit("guia-download", clientIp(req), 30))) return redirect(res, EXPIRED);

  try {
    const checkoutId = await redis.get(`guia:dl:${token}`);
    if (!checkoutId) return redirect(res, EXPIRED);

    const count = await redis.incr(`guia:dl-count:${token}`);
    if (count === 1) await redis.expire(`guia:dl-count:${token}`, 60 * 60 * 24 * 30);
    if (count > MAX_DOWNLOADS) return redirect(res, EXPIRED);

    return redirect(res, await signedPdfUrl());
  } catch (err) {
    console.error("[guia/download]", err);
    return redirect(res, EXPIRED);
  }
}
