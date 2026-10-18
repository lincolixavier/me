import { withinRateLimit, clientIp } from "../_redis.js";
import { siteUrl } from "../_email.js";
import { isConfigured, createCheckout } from "./_abacatepay.js";
import { attribution } from "./_attribution.js";

const FALLBACK = "/guia/?checkout=erro#oferta";

function redirect(res, location) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Location", location);
  res.status(303).end();
}

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).end();
  }

  if (!isConfigured()) return redirect(res, FALLBACK);

  if (!(await withinRateLimit("guia-checkout", clientIp(req), 20))) {
    return redirect(res, FALLBACK);
  }

  const ref = [...crypto.getRandomValues(new Uint8Array(12))]
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("");

  try {
    const checkout = await createCheckout({
      completionUrl: `${siteUrl()}/guia/obrigado/?ref=${ref}`,
      returnUrl: `${siteUrl()}/guia/`,
      externalId: ref,
      metadata: { product: "guia-nomade-digital", ref, ...attribution(req, req.query || {}) },
    });

    return redirect(res, checkout.url);
  } catch (err) {
    console.error("[guia/checkout]", err);
    return redirect(res, FALLBACK);
  }
}
