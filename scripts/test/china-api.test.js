import test from "node:test";
import assert from "node:assert/strict";

process.env.KV_REST_API_URL = "https://redis.test";
process.env.KV_REST_API_TOKEN = "token";
process.env.RESEND_API_KEY = "re_test";
process.env.CRON_SECRET = "cron-secret";
process.env.SITE_URL = "https://site.test";
for (let i = 1; i <= 5; i++) process.env[`PIN_PARTICIPANTE_${i}`] = `${i}${i}${i}${i}`;

const { default: handler, runJobs } = await import("../../api/china/index.js");

let store;
let emails;

function redisCommand([command, key, ...args]) {
  switch (command) {
    case "GET":
      return store.get(key) ?? null;
    case "INCR": {
      const next = Number(store.get(key) ?? 0) + 1;
      store.set(key, String(next));
      return next;
    }
    case "EXPIRE":
      return 1;
    case "DEL":
      return store.delete(key) ? 1 : 0;
    case "SET":
      if (args.includes("NX") && store.has(key)) return null;
      store.set(key, args[0]);
      return "OK";
    case "HSET": {
      const hash = store.get(key) ?? new Map();
      for (let i = 0; i < args.length; i += 2) hash.set(args[i], args[i + 1]);
      store.set(key, hash);
      return args.length / 2;
    }
    case "HDEL": {
      const hash = store.get(key);
      if (!hash) return 0;
      return args.filter((field) => hash.delete(field)).length;
    }
    case "HGETALL":
      return [...(store.get(key) ?? new Map())].flat();
    default:
      throw new Error(`unexpected ${command}`);
  }
}

test.beforeEach(() => {
  store = new Map();
  emails = [];
  globalThis.fetch = async (url, init = {}) => {
    const parsed = new URL(url);
    if (parsed.host === "api.resend.com") {
      emails.push(JSON.parse(init.body));
      return { ok: true, json: async () => ({ id: "email" }) };
    }
    const parts = parsed.pathname.split("/").slice(1).map(decodeURIComponent);
    return { ok: true, json: async () => ({ result: redisCommand(parts) }) };
  };
});

function mockRes() {
  return {
    statusCode: null,
    headers: {},
    body: null,
    setHeader(k, v) {
      this.headers[k.toLowerCase()] = v;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    send(payload) {
      this.body = payload;
      return this;
    },
    writeHead(code, headers) {
      this.statusCode = code;
      Object.assign(this.headers, headers);
    },
    end() {},
  };
}

async function post(payload, { ip = "1.1.1.1", origin = "https://site.test" } = {}) {
  const res = mockRes();
  await handler(
    { method: "POST", query: {}, body: payload, headers: { origin, host: "site.test", "x-forwarded-for": ip } },
    res
  );
  return { status: res.statusCode, body: JSON.parse(res.body) };
}

async function get(query = {}, headers = {}) {
  const res = mockRes();
  await handler({ method: "GET", query, headers: { host: "site.test", ...headers } }, res);
  return { status: res.statusCode, body: res.body ? JSON.parse(res.body) : null, headers: res.headers };
}

const add = (amountCents, extra = {}) =>
  post({ action: "add", participantId: "p1", pin: "1111", month: "2026-12", amountCents, ...extra });

test("the public state carries no PIN and no e-mail", async () => {
  await post({ action: "email", participantId: "p1", pin: "1111", email: "a@b.co" });
  const { status, body } = await get();
  assert.equal(status, 200);
  assert.equal(body.people.length, 5);
  assert.equal(body.group.goal, 5_650_000);
  const raw = JSON.stringify(body);
  assert.ok(!/"(pin|email|token|off)"/.test(raw));
  assert.ok(!raw.includes("a@b.co"));
});

test("a cross-origin write is refused before the PIN is checked", async () => {
  const { status } = await post({ action: "verify", participantId: "p1", pin: "1111" }, { origin: "https://evil.test" });
  assert.equal(status, 403);
});

test("the right PIN opens, a wrong one does not, and someone else's PIN is wrong", async () => {
  assert.equal((await post({ action: "verify", participantId: "p1", pin: "1111" })).status, 200);
  assert.equal((await post({ action: "verify", participantId: "p1", pin: "0000" })).status, 401);
  assert.equal((await post({ action: "verify", participantId: "p1", pin: "2222" })).status, 401);
});

test("five wrong PINs lock the IP, even for the right PIN", async () => {
  for (let i = 0; i < 5; i++) {
    assert.equal((await post({ action: "verify", participantId: "p2", pin: "9999" })).status, 401);
  }
  assert.equal((await post({ action: "verify", participantId: "p2", pin: "2222" })).status, 429);
  assert.equal((await post({ action: "verify", participantId: "p2", pin: "2222" }, { ip: "2.2.2.2" })).status, 200);
});

test("a participant whose PIN env is missing cannot sign in", async () => {
  const saved = process.env.PIN_PARTICIPANTE_3;
  delete process.env.PIN_PARTICIPANTE_3;
  try {
    assert.equal((await post({ action: "verify", participantId: "p3", pin: "" })).status, 401);
    assert.equal((await post({ action: "verify", participantId: "p3", pin: "undefined" })).status, 401);
  } finally {
    process.env.PIN_PARTICIPANTE_3 = saved;
  }
});

test("inputs are validated on the server", async () => {
  assert.equal((await add(0)).status, 422);
  assert.equal((await add(10.5)).status, 422);
  assert.equal((await add("1000")).status, 422);
  assert.equal((await add(5_000_001)).status, 422);
  assert.equal((await add(100, { month: "2026-11" })).status, 422);
  assert.equal((await add(100, { month: "2027-09" })).status, 422);
  assert.equal((await add(100, { month: "dez" })).status, 422);
  assert.equal((await post({ action: "verify", participantId: "p9", pin: "1111" })).status, 422);
  assert.equal((await post({ action: "drop", participantId: "p1", pin: "1111" })).status, 400);
  assert.equal((await post({ action: "email", participantId: "p1", pin: "1111", email: "nope" })).status, 422);
});

test("add, edit and remove a contribution", async () => {
  const created = await add(100_00);
  assert.equal(created.status, 200);
  const entry = created.body.state.history[0];
  assert.equal(entry.amountCents, 100_00);
  assert.equal(entry.participantId, "p1");
  assert.ok(entry.createdAt);

  const edited = await post({ action: "update", participantId: "p1", pin: "1111", id: entry.id, month: "2026-12", amountCents: 250_00 });
  assert.equal(edited.status, 200);
  assert.equal(edited.body.state.people[0].total, 250_00);
  assert.equal(edited.body.state.history[0].createdAt, entry.createdAt);

  const foreign = await post({ action: "remove", participantId: "p2", pin: "2222", id: entry.id });
  assert.equal(foreign.status, 404);

  const removed = await post({ action: "remove", participantId: "p1", pin: "1111", id: entry.id });
  assert.equal(removed.status, 200);
  assert.equal(removed.body.state.history.length, 0);
});

test("crossing milestones sends one congratulation for the highest, once", async () => {
  await post({ action: "email", participantId: "p1", pin: "1111", email: "p1@test.co" });
  await add(600_000);
  assert.equal(emails.length, 1);
  assert.match(emails[0].subject, /50%/);

  await add(10_00);
  assert.equal(emails.length, 1);

  await add(600_000);
  assert.equal(emails.length, 2);
  assert.match(emails[1].subject, /meta batida/);
});

test("the unsubscribe link only works with the right token", async () => {
  await post({ action: "email", participantId: "p1", pin: "1111", email: "p1@test.co" });
  const token = store.get("china:participant:p1").get("token");

  const bad = await get({ unsubscribe: `p1.${"0".repeat(32)}` });
  assert.match(bad.headers.Location, /email=invalid/);
  assert.equal(store.get("china:participant:p1").get("off"), "0");

  const good = await get({ unsubscribe: `p1.${token}` });
  assert.match(good.headers.Location, /email=off/);
  assert.equal(store.get("china:participant:p1").get("off"), "1");
});

test("the cron endpoint requires the secret", async () => {
  assert.equal((await get({ job: "cron" })).status, 401);
  assert.equal((await get({ job: "cron" }, { authorization: "Bearer wrong" })).status, 401);
  assert.equal((await get({ job: "cron" }, { authorization: "Bearer cron-secret" })).status, 200);
});

test("the first of the month sends one summary per subscribed person", async () => {
  await post({ action: "email", participantId: "p1", pin: "1111", email: "p1@test.co" });
  await post({ action: "email", participantId: "p2", pin: "2222", email: "p2@test.co", receive: false });

  const firstOfJanuary = new Date("2027-01-01T12:00:00Z");
  assert.deepEqual(await runJobs(firstOfJanuary), { summary: 1, reminder: 0 });
  assert.equal(emails[0].to[0], "p1@test.co");
  assert.match(emails[0].text, /Falta: R\$/);
  assert.match(emails[0].text, /grupo está em 0%/);
  assert.match(emails[0].text, /Parar de receber: https:\/\/site\.test\/api\/china\?unsubscribe=p1\./);

  assert.deepEqual(await runJobs(firstOfJanuary), { summary: 0, reminder: 0 });
});

test("the reminder goes out from the 10th only to whoever has not launched this month", async () => {
  await post({ action: "email", participantId: "p1", pin: "1111", email: "p1@test.co" });
  await post({ action: "email", participantId: "p2", pin: "2222", email: "p2@test.co" });

  store.set("china:contributions:p2", new Map([[
    "00000000-0000-0000-0000-000000000000",
    JSON.stringify({ id: "00000000-0000-0000-0000-000000000000", month: "2027-01", amountCents: 100, createdAt: "2027-01-05T12:00:00.000Z" }),
  ]]));

  assert.deepEqual(await runJobs(new Date("2027-01-09T12:00:00Z")), { summary: 0, reminder: 0 });
  assert.deepEqual(await runJobs(new Date("2027-01-10T12:00:00Z")), { summary: 0, reminder: 1 });
  assert.equal(emails.at(-1).to[0], "p1@test.co");
  assert.deepEqual(await runJobs(new Date("2027-01-11T12:00:00Z")), { summary: 0, reminder: 0 });
});
