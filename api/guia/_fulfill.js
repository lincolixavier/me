import { redis } from "../_redis.js";
import { sendEmail, siteUrl, emailShell } from "../_email.js";

export const OWNER = "hi@lincoli.me";
export const PRICE_CENTS = 6700;
const DOWNLOAD_TTL_SECONDS = 60 * 60 * 24 * 30;
const CLAIM_TTL_SECONDS = 60 * 60 * 24 * 365;

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

export async function notifyOwner(subject, lines) {
  try {
    await sendEmail({ to: OWNER, subject, text: lines.join("\n") });
  } catch (err) {
    console.error("[guia] owner notification failed", err);
  }
}

export async function fulfill({ id, email, name, amount, method, devMode }) {
  const claimKey = `guia:paid:${id}`;
  if (!(await redis.claim(claimKey, "1", CLAIM_TTL_SECONDS))) return "duplicate";

  const address = typeof email === "string" ? email.trim().toLowerCase() : "";
  const value = ((amount ?? 0) / 100).toFixed(2);
  const summary = [
    `Pagamento: ${id}`,
    `Cliente: ${name || "?"} <${address || "sem e-mail"}>`,
    `Valor: R$ ${value}`,
    `Método: ${method || "?"}`,
    `Dev mode: ${devMode ? "sim" : "não"}`,
  ];

  if (!address) {
    await notifyOwner("Guia: venda sem e-mail do cliente", [...summary, "", "Entregar manualmente."]);
    return "no-email";
  }

  try {
    const token = randomToken();
    await redis.set(`guia:dl:${token}`, id, DOWNLOAD_TTL_SECONDS);
    await deliver({ email: address, name, token });
  } catch (err) {
    await redis.del(claimKey).catch(() => {});
    throw err;
  }

  await notifyOwner(`Guia vendido: R$ ${value}${devMode ? " (teste)" : ""}`, summary);
  return "delivered";
}
