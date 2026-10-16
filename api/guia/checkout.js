import { withinRateLimit, clientIp } from "../_redis.js";
import { siteUrl } from "../_email.js";
import { isConfigured, createCheckout } from "./_abacatepay.js";

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

  const query = req.query || {};
  const pick = (key) => (typeof query[key] === "string" ? query[key].slice(0, 120) : undefined);

  try {
    const checkout = await createCheckout({
      completionUrl: `${siteUrl()}/guia/obrigado/`,
      returnUrl: `${siteUrl()}/guia/`,
      metadata: {
        product: "guia-nomade-digital",
        source: pick("src"),
        utm_source: pick("utm_source"),
        utm_medium: pick("utm_medium"),
        utm_campaign: pick("utm_campaign"),
      },
    });

    return redirect(res, checkout.url);
  } catch (err) {
    console.error("[guia/checkout]", err);
    return redirect(res, FALLBACK);
  }
}
