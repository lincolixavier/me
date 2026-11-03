import { sendEmail, emailShell, siteUrl } from "../_email.js";
import { monthLabel, toIndex } from "./_calc.js";

const STATUS = { ahead: "adiantado", "on-track": "no ritmo", behind: "atrasado" };

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const pct = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

export const money = (cents) => brl.format(cents / 100);
export const percentText = (value) => `${pct.format(Math.min(value, 999))}%`;
export const statusText = (value) => STATUS[value] ?? value;

function pageUrl() {
  return `${siteUrl()}/china/`;
}

function unsubscribeUrl(participantId, token) {
  return `${siteUrl()}/api/china?unsubscribe=${participantId}.${token}`;
}

function deliver({ to, participantId, token, subject, heading, lines }) {
  const stop = unsubscribeUrl(participantId, token);
  const footnote =
    "Você recebe este e-mail porque cadastrou seu endereço na página da viagem. " +
    `<a href="${stop}" style="color:#8a8a8a">Parar de receber</a>.`;

  return sendEmail({
    to,
    subject,
    text: [...lines, "", `Abrir a página: ${pageUrl()}`, "", `Parar de receber: ${stop}`].join("\n"),
    html: emailShell({
      heading,
      body: lines.map((line) => `<p style="margin:0 0 10px">${line}</p>`).join(""),
      action: { href: pageUrl(), label: "Abrir a página" },
      pasteHint: "Ou cole no navegador:",
      footnote,
    }),
  });
}

export function sendSummary({ to, participantId, token, name, person, group, month }) {
  const lines = [
    `Oi, ${name}. Este é o seu resumo da viagem para a China no começo de ${monthLabel(toIndex(month))}.`,
    `Juntado: ${money(person.total)} (${percentText(person.percent)} da meta).`,
    `Falta: ${money(person.remaining)}.`,
    person.remaining > 0
      ? `Para fechar até agosto de 2027: ${money(person.monthlyNeeded)} por mês.`
      : "Sua meta está garantida.",
    `Status: ${statusText(person.status)}.`,
    `O grupo está em ${percentText(group.percent)} da meta de ${money(group.goal)}.`,
  ];
  return deliver({
    to,
    participantId,
    token,
    subject: `China 2027: seu resumo de ${monthLabel(toIndex(month))}`,
    heading: `${percentText(person.percent)} da sua meta`,
    lines,
  });
}

export function sendReminder({ to, participantId, token, name, month }) {
  return deliver({
    to,
    participantId,
    token,
    subject: "China 2027: falta lançar o valor do mês",
    heading: "Já lançou o valor deste mês?",
    lines: [
      `Oi, ${name}. Ainda não vi nenhum lançamento seu em ${monthLabel(toIndex(month))}.`,
      "Leva um minuto: abra a página, escolha seu nome e informe quanto juntou.",
    ],
  });
}

export function sendMilestone({ to, participantId, token, name, threshold, person }) {
  const done = threshold === 100;
  return deliver({
    to,
    participantId,
    token,
    subject: done ? "China 2027: meta batida!" : `China 2027: você chegou a ${threshold}%`,
    heading: done ? "Meta batida. Parabéns!" : `Parabéns, ${threshold}% da meta!`,
    lines: [
      `Oi, ${name}. Você já juntou ${money(person.total)}.`,
      done
        ? "Sua parte da viagem está garantida."
        : `Faltam ${money(person.remaining)}, cerca de ${money(person.monthlyNeeded)} por mês até agosto de 2027.`,
    ],
  });
}
