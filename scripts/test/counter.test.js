import test from "node:test";
import assert from "node:assert/strict";

process.env.KV_REST_API_URL = "https://redis.test";
process.env.KV_REST_API_TOKEN = "token";

const { counter } = await import("../../api/_counter.js");

const views = counter({ name: "views", limit: 60 });
const likes = counter({ name: "likes", limit: 30, methods: ["GET", "POST", "DELETE"] });

let commands = [];

function stubRedis(results = {}) {
  commands = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const [, command, ...rest] = new URL(url).pathname.split("/");
    const key = decodeURIComponent(rest.join("/"));
    commands.push(`${command} ${key}`);
    return { ok: true, json: async () => ({ result: results[`${command} ${key}`] ?? 1 }) };
  };
  return () => {
    globalThis.fetch = original;
  };
}

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
  };
}

async function hit(handler, method, slug, results) {
  const restore = stubRedis(results);
  const res = mockRes();
  try {
    await handler({ method, query: { slug }, headers: { "x-forwarded-for": "1.2.3.4" } }, res);
  } finally {
    restore();
  }
  return { res, body: res.body ? JSON.parse(res.body) : null };
}

test("a view read touches the views key and nothing else", async () => {
  const { res, body } = await hit(views, "GET", "worker-pools-in-go", {
    "GET views:worker-pools-in-go": 7,
  });

  assert.equal(res.statusCode, 200);
  assert.deepEqual(body, { views: 7 });
  assert.deepEqual(commands, ["GET views:worker-pools-in-go"]);
});

test("counters are namespaced per slug", async () => {
  await hit(views, "GET", "goals-2025");
  assert.ok(commands[0].endsWith("views:goals-2025"));

  await hit(likes, "GET", "goals-2025");
  assert.ok(commands[0].endsWith("likes:goals-2025"));
});

test("a view POST increments, and a read does not", async () => {
  await hit(views, "POST", "a");
  assert.ok(commands.includes("INCR views:a"));

  await hit(views, "GET", "a");
  assert.ok(!commands.some((c) => c.startsWith("INCR")));
});

test("likes can be taken back, views cannot", async () => {
  const removed = await hit(likes, "DELETE", "a");
  assert.equal(removed.res.statusCode, 200);

  const refused = await hit(views, "DELETE", "a");
  assert.equal(refused.res.statusCode, 405);
  assert.equal(refused.res.headers.allow, "GET, POST");
});

test("a refused method costs no rate limit budget", async () => {
  await hit(views, "DELETE", "a");
  assert.deepEqual(commands, []);
});

test("a slug that is not a slug is rejected before Redis is touched", async () => {
  for (const bad of ["../etc", "Has Caps", "", "a".repeat(90)]) {
    const { res } = await hit(views, "GET", bad);
    assert.equal(res.statusCode, 400, `expected 400 for ${JSON.stringify(bad)}`);
  }
  assert.deepEqual(commands, []);
});

test("a negative count reads as zero", async () => {
  const { body } = await hit(likes, "DELETE", "a", { DECR: -3, "DECR likes:a": -3 });
  assert.deepEqual(body, { likes: 0 });
});
