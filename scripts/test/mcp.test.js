import test from "node:test";
import assert from "node:assert/strict";

import handler from "../../api/mcp.js";
import { renderLlmsTxt, renderArticleMarkdown } from "../lib/machine-readable.js";

const SITE = {
  name: "Lincoli Xavier",
  url: "https://www.lincoli.me",
  tagline: "software engineer",
  description: "Builds things.",
  social: [{ label: "github", href: "https://github.com/x" }],
  career: [{ role: "Founder", company: "Unlocd", period: "since 2024" }],
};

const ARTICLES = [
  {
    slug: "worker-pools-in-go",
    title: "Using a worker pool in Go",
    date: "2023-03-22",
    description: "Bounded concurrency.",
    tags: ["go", "concurrency"],
    url: "https://www.lincoli.me/articles/worker-pools-in-go/",
    markdown: "You have ten thousand things to process. A worker pool fixes this.",
  },
  {
    slug: "hello-static-sites",
    title: "Why I still love static sites",
    date: "2026-03-01",
    description: "Keeping the web simple.",
    tags: ["web"],
    url: "https://www.lincoli.me/articles/hello-static-sites/",
    markdown: "No React, no Vue, no Next, unless you want them.",
  },
];

const INDEX = {
  site: SITE,
  articles: ARTICLES,
  projects: [{ id: "arki", name: "Arki", status: "active" }],
  gear: [],
  podcasts: [],
};

function stubFetch() {
  const original = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, json: async () => structuredClone(INDEX) });
  return () => {
    globalThis.fetch = original;
  };
}

function mockRes() {
  const res = {
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
    json(payload) {
      this.body = JSON.stringify(payload);
      return this;
    },
    end() {
      return this;
    },
  };
  return res;
}

async function rpc(body, method = "POST") {
  const restore = stubFetch();
  const res = mockRes();
  try {
    await handler({ method, headers: { host: "www.lincoli.me" }, body }, res);
  } finally {
    restore();
  }
  return { res, json: res.body ? JSON.parse(res.body) : null };
}

const call = (name, args = {}) =>
  rpc({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } });

const payload = (json) => JSON.parse(json.result.content[0].text);

test("initialize echoes a protocol version the client asked for", async () => {
  const { json } = await rpc({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: { protocolVersion: "2024-11-05" },
  });

  assert.equal(json.result.protocolVersion, "2024-11-05");
  assert.equal(json.result.serverInfo.name, "lincoli.me");
  assert.ok(json.result.capabilities.tools);
});

test("initialize falls back to the newest version for an unknown one", async () => {
  const { json } = await rpc({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: { protocolVersion: "1999-01-01" },
  });

  assert.equal(json.result.protocolVersion, "2025-06-18");
});

test("every advertised tool has a name, a description and a schema", async () => {
  const { json } = await rpc({ jsonrpc: "2.0", id: 1, method: "tools/list" });

  assert.ok(json.result.tools.length >= 5);
  for (const tool of json.result.tools) {
    assert.ok(tool.name, "tool needs a name");
    assert.ok(tool.description.length > 20, `${tool.name} needs a real description`);
    assert.equal(tool.inputSchema.type, "object");
  }
});

test("search finds an article by a word in its body", async () => {
  const { json } = await call("search_articles", { query: "worker pool" });
  const out = payload(json);

  assert.equal(out.results[0].slug, "worker-pools-in-go");
  assert.ok(out.results[0].snippet.includes("worker pool"));
});

test("search ranks a title match above a body match", async () => {
  const { json } = await call("search_articles", { query: "static" });
  assert.equal(payload(json).results[0].slug, "hello-static-sites");
});

test("search for nothing in particular returns no results, not everything", async () => {
  const { json } = await call("search_articles", { query: "zzzznotathing" });
  assert.equal(payload(json).count, 0);
});

test("an unknown slug is a tool error the model can read, not a crash", async () => {
  const { json } = await call("get_article", { slug: "does-not-exist" });

  assert.equal(json.result.isError, true);
  assert.match(payload(json).error, /does-not-exist/);
});

test("get_article returns the whole markdown", async () => {
  const { json } = await call("get_article", { slug: "worker-pools-in-go" });
  assert.match(payload(json).markdown, /ten thousand things/);
});

test("list_articles filters by tag", async () => {
  const { json } = await call("list_articles", { tag: "go" });
  const out = payload(json);

  assert.equal(out.count, 1);
  assert.equal(out.articles[0].slug, "worker-pools-in-go");
});

test("an unknown tool is a JSON-RPC error", async () => {
  const { json } = await call("drop_database");
  assert.equal(json.error.code, -32602);
});

test("a notification gets no body back", async () => {
  const { res } = await rpc({ jsonrpc: "2.0", method: "notifications/initialized" });
  assert.equal(res.statusCode, 202);
  assert.equal(res.body, null);
});

test("GET is refused, since no stream lives here", async () => {
  const { res } = await rpc(null, "GET");
  assert.equal(res.statusCode, 405);
});

test("llms.txt links the markdown copies, not the HTML pages", () => {
  const txt = renderLlmsTxt(SITE, { articles: ARTICLES, projects: [] });

  assert.match(txt, /^# Lincoli Xavier$/m);
  assert.match(txt, /articles\/worker-pools-in-go\.md/);
  assert.doesNotMatch(txt, /articles\/worker-pools-in-go\/\)/);
});

test("the markdown copy carries a source URL back to the page", () => {
  const md = renderArticleMarkdown(SITE, { ...ARTICLES[0], markdown: "Body." });

  assert.match(md, /^source: https:\/\/www\.lincoli\.me\/articles\/worker-pools-in-go\/$/m);
  assert.match(md, /\nBody\.\n$/);
});
