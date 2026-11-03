import { timingSafeEqual, randomBytes, randomUUID } from "node:crypto";
import { redis, isConfigured, json, clientIp } from "../_redis.js";
import { siteUrl } from "../_email.js";
import { PARTICIPANTS, findParticipant } from "./_participants.js";
import { summarize, localDate, milestonesDue, toIndex, toKey, START, END } from "./_calc.js";
import {
  loadContributions,
  getContribution,
  saveContribution,
  removeContribution,
  loadPerson,
  savePerson,
  clearPersonFields,
} from "./_store.js";
import { sendSummary, sendReminder, sendMilestone } from "./_mail.js";

const PIN = /^\d{4}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CONTRIBUTION_ID = /^[0-9a-f-]{36}$/;
const TOKEN = /^[a-f0-9]{32}$/;
const MAX_AMOUNT_CENTS = 5_000_000;

const IP_FAILURES = 5;
const IP_WINDOW_SECONDS = 15 * 60;
const PERSON_FAILURES = 15;
const PERSON_WINDOW_SECONDS = 60 * 60;
const CLAIM_SECONDS = 60 * 60 * 24 * 400;
const MONTH_CLAIM_SECONDS = 60 * 60 * 24 * 40;

function body(req) {
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return req.body && typeof req.body === "object" ? req.body : {};
}

function sameOrigin(req) {
  try {
    return new URL(req.headers.origin).host === req.headers.host;
  } catch {
    return false;
  }
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && timingSafeEqual(left, right);
}

async function failures(key) {
  return Number(await redis.get(key)) || 0;
}

async function recordFailure(key, windowSeconds) {
  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, windowSeconds);
}

export async function authorize(req, participant, pin) {
  const ipKey = `china:pin-fail:ip:${clientIp(req)}`;
  const personKey = `china:pin-fail:person:${participant.id}`;
  const locked = { status: 429, error: "Muitas tentativas erradas. Tente de novo em 15 minutos." };

  if ((await failures(ipKey)) >= IP_FAILURES) return locked;
  if ((await failures(personKey)) >= PERSON_FAILURES) return locked;

  const expected = process.env[participant.pinEnv];
  if (PIN.test(String(pin ?? "")) && PIN.test(String(expected ?? "")) && safeEqual(pin, expected)) {
    return null;
  }

  await recordFailure(ipKey, IP_WINDOW_SECONDS);
  await recordFailure(personKey, PERSON_WINDOW_SECONDS);
  return { status: 401, error: "PIN incorreto." };
}

function emailActive(person) {
  return Boolean(person.email && person.token && person.off !== "1");
}

async function state(now = new Date()) {
  return summarize(PARTICIPANTS, await loadContributions(), now);
}

async function notifyMilestones(participant, snapshot) {
  const person = snapshot.people.find((p) => p.id === participant.id);
  const claimed = [];
  for (const threshold of milestonesDue(person.total, person.goal)) {
    if (await redis.claim(`china:mail:milestone:${participant.id}:${threshold}`, "1", CLAIM_SECONDS)) {
      claimed.push(threshold);
    }
  }
  if (!claimed.length) return;

  const profile = await loadPerson(participant.id);
  if (!emailActive(profile)) return;

  const threshold = Math.max(...claimed);
  try {
    await sendMilestone({
      to: profile.email,
      participantId: participant.id,
      token: profile.token,
      name: participant.name,
      threshold,
      person,
    });
  } catch (err) {
    console.error("[china] milestone email failed", participant.id, threshold, err);
    await redis.del(`china:mail:milestone:${participant.id}:${threshold}`);
  }
}

function validMonth(month, now) {
  const index = toIndex(month);
  if (index === null) return false;
  const latest = Math.min(END, Math.max(localDate(now).index, START));
  return index >= START && index <= latest;
}

function validAmount(value) {
  return Number.isInteger(value) && value > 0 && value <= MAX_AMOUNT_CENTS;
}

async function mutate(req, res) {
  if (!sameOrigin(req)) return json(res, 403, { error: "forbidden" });

  const input = body(req);
  const participant = findParticipant(input.participantId);
  if (!participant) return json(res, 422, { error: "Escolha seu nome." });

  const denied = await authorize(req, participant, input.pin);
  if (denied) return json(res, denied.status, { error: denied.error });

  const now = new Date();

  switch (input.action) {
    case "verify": {
      const person = await loadPerson(participant.id);
      return json(res, 200, { ok: true, email: person.email ?? "", receive: person.off !== "1" });
    }

    case "add":
    case "update": {
      if (!validMonth(input.month, now)) {
        return json(res, 422, { error: "Mês fora do período da viagem.", field: "month" });
      }
      if (!validAmount(input.amountCents)) {
        return json(res, 422, { error: "Confira o valor.", field: "amount" });
      }

      let contribution;
      if (input.action === "update") {
        if (!CONTRIBUTION_ID.test(String(input.id ?? ""))) return json(res, 404, { error: "Lançamento não encontrado." });
        const existing = await getContribution(participant.id, input.id);
        if (!existing) return json(res, 404, { error: "Lançamento não encontrado." });
        contribution = { ...existing, month: input.month, amountCents: input.amountCents, updatedAt: now.toISOString() };
      } else {
        contribution = { id: randomUUID(), month: input.month, amountCents: input.amountCents, createdAt: now.toISOString() };
      }

      await saveContribution(participant.id, contribution);
      const snapshot = await state(now);
      await notifyMilestones(participant, snapshot);
      return json(res, 200, { ok: true, state: snapshot });
    }

    case "remove": {
      if (!CONTRIBUTION_ID.test(String(input.id ?? ""))) return json(res, 404, { error: "Lançamento não encontrado." });
      if (!(await removeContribution(participant.id, input.id))) {
        return json(res, 404, { error: "Lançamento não encontrado." });
      }
      return json(res, 200, { ok: true, state: await state(now) });
    }

    case "email": {
      const email = typeof input.email === "string" ? input.email.trim().toLowerCase().slice(0, 160) : "";
      if (!email) {
        await clearPersonFields(participant.id, "email", "token", "off");
        return json(res, 200, { ok: true, email: "", receive: false });
      }
      if (!EMAIL.test(email)) return json(res, 422, { error: "Confira o e-mail.", field: "email" });

      const person = await loadPerson(participant.id);
      const receive = input.receive !== false;
      await savePerson(participant.id, {
        email,
        token: TOKEN.test(person.token ?? "") ? person.token : randomBytes(16).toString("hex"),
        off: receive ? "0" : "1",
      });
      return json(res, 200, { ok: true, email, receive });
    }

    default:
      return json(res, 400, { error: "Ação inválida." });
  }
}

async function unsubscribe(req, res) {
  const [id, token] = String(req.query.unsubscribe).split(".");
  const participant = findParticipant(id);
  let outcome = "invalid";

  if (participant && TOKEN.test(token ?? "")) {
    const person = await loadPerson(participant.id);
    if (person.token && safeEqual(person.token, token)) {
      await savePerson(participant.id, { off: "1" });
      outcome = "off";
    }
  }

  res.writeHead(302, { Location: `${siteUrl()}/china/?email=${outcome}` });
  res.end();
}

async function claimOrSkip(key, send) {
  if (!(await redis.claim(key, "1", MONTH_CLAIM_SECONDS))) return false;
  try {
    await send();
    return true;
  } catch (err) {
    console.error("[china] email failed", key, err);
    await redis.del(key);
    return false;
  }
}

export async function runJobs(now = new Date()) {
  const today = localDate(now);
  const month = toKey(today.index);
  const contributions = await loadContributions();
  const snapshot = summarize(PARTICIPANTS, contributions, now);
  const sent = { summary: 0, reminder: 0 };

  for (const participant of PARTICIPANTS) {
    await notifyMilestones(participant, snapshot);

    const profile = await loadPerson(participant.id);
    if (!emailActive(profile)) continue;

    const person = snapshot.people.find((p) => p.id === participant.id);
    const base = { to: profile.email, participantId: participant.id, token: profile.token, name: participant.name };

    if (today.day <= 3 && today.index >= START && today.index <= END + 1) {
      const ok = await claimOrSkip(`china:mail:summary:${participant.id}:${month}`, () =>
        sendSummary({ ...base, person, group: snapshot.group, month })
      );
      if (ok) sent.summary++;
    }

    const launchedThisMonth = (contributions[participant.id] ?? []).some(
      (c) => localDate(new Date(c.createdAt)).index === today.index
    );
    if (today.day >= 10 && today.index >= START && today.index <= END && !launchedThisMonth && person.remaining > 0) {
      const ok = await claimOrSkip(`china:mail:reminder:${participant.id}:${month}`, () =>
        sendReminder({ ...base, month })
      );
      if (ok) sent.reminder++;
    }
  }

  return sent;
}

async function cron(req, res) {
  const secret = process.env.CRON_SECRET;
  if (!secret || !safeEqual(req.headers.authorization ?? "", `Bearer ${secret}`)) {
    return json(res, 401, { error: "unauthorized" });
  }
  if (!process.env.RESEND_API_KEY) return json(res, 503, { error: "email not configured" });
  return json(res, 200, { ok: true, sent: await runJobs() });
}

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return json(res, 405, { error: "method not allowed" });
  }

  if (!isConfigured()) return json(res, 503, { error: "Indisponível agora." });

  try {
    if (req.method === "POST") return await mutate(req, res);
    if (req.query?.job === "cron") return await cron(req, res);
    if (req.query?.unsubscribe) return await unsubscribe(req, res);
    return json(res, 200, await state());
  } catch (err) {
    console.error("[china]", err);
    return json(res, 502, { error: "Não consegui falar com o servidor. Tente de novo em instantes." });
  }
}
