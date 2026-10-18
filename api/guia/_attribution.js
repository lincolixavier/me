const KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "gclid", "gbraid", "wbraid", "fbclid", "referrer", "landing"];

function clean(value, max = 200) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : undefined;
}

function header(req, name) {
  const value = req.headers?.[name];
  if (typeof value !== "string" || !value) return undefined;
  try {
    return decodeURIComponent(value).slice(0, 120);
  } catch {
    return value.slice(0, 120);
  }
}

export function attribution(req, input = {}) {
  const fields = { source: clean(input.src, 60) };
  for (const key of KEYS) fields[key] = clean(input[key]);

  Object.assign(fields, {
    country: header(req, "x-vercel-ip-country"),
    region: header(req, "x-vercel-ip-country-region"),
    city: header(req, "x-vercel-ip-city"),
    user_agent: clean(req.headers?.["user-agent"]),
    language: clean(req.headers?.["accept-language"], 60),
  });

  return Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined));
}

export function utm(fields) {
  return {
    source: fields.utm_source,
    medium: fields.utm_medium,
    campaign: fields.utm_campaign,
    term: fields.utm_term,
    content: fields.utm_content,
  };
}
