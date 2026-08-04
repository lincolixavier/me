import { withinRateLimit, clientIp } from "./_redis.js";

const SUPPORTED_PROTOCOLS = ["2025-06-18", "2025-03-26", "2024-11-05"];

const SERVER_INFO = { name: "lincoli.me", version: "1.0.0", title: "Lincoli Xavier" };

const INSTRUCTIONS = `The personal site of Lincoli Xavier, a software engineer and digital nomad: 43 hand-written articles on backend and frontend engineering, Go, remote work, freelancing and building products, plus his projects, career and gear.

Use search_articles to find writing on a topic, then get_article for the full text. Every article is also readable directly at its .md URL.`;

let cached = null;

async function loadIndex(req) {
  if (cached) return cached;

  const host = req.headers["x-forwarded-host"] || req.headers.host;
  const protocol = host?.startsWith("localhost") ? "http" : "https";

  const response = await fetch(`${protocol}://${host}/content-index.json`);
  if (!response.ok) throw new Error(`content-index.json → ${response.status}`);

  cached = await response.json();
  return cached;
}

const TOOLS = [
  {
    name: "search_articles",
    title: "Search articles",
    description:
      "Full-text search across every article: title, description, tags and body. Returns the best matches with a snippet around the hit. Use it before get_article when you do not already know the slug.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Words to look for, e.g. 'go concurrency' or 'pricing'." },
        limit: { type: "integer", description: "How many results to return. Default 5, maximum 20." },
      },
      required: ["query"],
    },
  },
  {
    name: "get_article",
    title: "Get an article",
    description: "The full Markdown of one article, by slug. Slugs come from search_articles or list_articles.",
    inputSchema: {
      type: "object",
      properties: { slug: { type: "string", description: "The article slug, e.g. 'worker-pools-in-go'." } },
      required: ["slug"],
    },
  },
  {
    name: "list_articles",
    title: "List articles",
    description:
      "Every article, newest first, as title, slug, date, tags and description. Optionally filtered to one tag. No bodies: use get_article for those.",
    inputSchema: {
      type: "object",
      properties: { tag: { type: "string", description: "Only articles carrying this tag, e.g. 'go'." } },
    },
  },
  {
    name: "list_projects",
    title: "List projects",
    description:
      "The things he has built, including the ones that failed. Each carries a status: active, wip, stealth, past or failed.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "get_profile",
    title: "Get profile",
    description:
      "Who he is: the tagline, the career history with roles and dates, and where to find him online.",
    inputSchema: { type: "object", properties: {} },
  },
];

function terms(query) {
  return String(query)
    .toLowerCase()
    .split(/[^a-z0-9+#.-]+/i)
    .filter((word) => word.length > 1)
    .slice(0, 12);
}

function score(article, words) {
  const title = article.title.toLowerCase();
  const description = (article.description || "").toLowerCase();
  const tags = article.tags.join(" ").toLowerCase();
  const body = article.markdown.toLowerCase();

  let total = 0;
  let matched = 0;

  for (const word of words) {
    let points = 0;
    if (title.includes(word)) points += 12;
    if (tags.includes(word)) points += 8;
    if (description.includes(word)) points += 5;

    const hits = body.split(word).length - 1;
    if (hits) points += Math.min(hits, 8);

    if (points) matched++;
    total += points;
  }

  return matched === words.length ? total * 2 : total;
}

function snippet(markdown, words) {
  const haystack = markdown.toLowerCase();
  const at = words.map((w) => haystack.indexOf(w)).filter((i) => i >= 0).sort((a, b) => a - b)[0];
  if (at === undefined) return markdown.slice(0, 220).trim();

  const start = Math.max(0, at - 90);
  const text = markdown.slice(start, start + 260).replace(/\s+/g, " ").trim();
  return `${start > 0 ? "…" : ""}${text}…`;
}

function summarise(article) {
  return {
    slug: article.slug,
    title: article.title,
    date: article.date,
    tags: article.tags,
    description: article.description,
    url: article.url,
  };
}

async function callTool(name, args, index) {
  switch (name) {
    case "search_articles": {
      const words = terms(args?.query ?? "");
      if (!words.length) return { error: "Give me something to search for." };

      const limit = Math.min(Math.max(Number(args?.limit) || 5, 1), 20);
      const results = index.articles
        .map((article) => ({ article, points: score(article, words) }))
        .filter((r) => r.points > 0)
        .sort((a, b) => b.points - a.points)
        .slice(0, limit)
        .map(({ article }) => ({ ...summarise(article), snippet: snippet(article.markdown, words) }));

      return { query: args.query, count: results.length, results };
    }

    case "get_article": {
      const article = index.articles.find((a) => a.slug === args?.slug);
      if (!article) {
        return {
          error: `No article with the slug "${args?.slug}".`,
          hint: "Call list_articles or search_articles for valid slugs.",
        };
      }
      return { ...summarise(article), markdown: article.markdown };
    }

    case "list_articles": {
      const tag = args?.tag ? String(args.tag).toLowerCase() : null;
      const articles = tag
        ? index.articles.filter((a) => a.tags.some((t) => t.toLowerCase() === tag))
        : index.articles;
      return { count: articles.length, tag, articles: articles.map(summarise) };
    }

    case "list_projects":
      return { count: index.projects.length, projects: index.projects };

    case "get_profile":
      return {
        name: index.site.name,
        tagline: index.site.tagline,
        description: index.site.description,
        url: index.site.url,
        career: index.site.career,
        links: index.site.social,
      };

    default:
      return null;
  }
}

const rpcResult = (id, result) => ({ jsonrpc: "2.0", id, result });
const rpcError = (id, code, message) => ({ jsonrpc: "2.0", id, error: { code, message } });

async function handleRpc(message, req) {
  const { id, method, params } = message;

  switch (method) {
    case "initialize": {
      const wanted = params?.protocolVersion;
      return rpcResult(id, {
        protocolVersion: SUPPORTED_PROTOCOLS.includes(wanted) ? wanted : SUPPORTED_PROTOCOLS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
        instructions: INSTRUCTIONS,
      });
    }

    case "ping":
      return rpcResult(id, {});

    case "tools/list":
      return rpcResult(id, { tools: TOOLS });

    case "tools/call": {
      const name = params?.name;
      if (!TOOLS.some((tool) => tool.name === name)) {
        return rpcError(id, -32602, `Unknown tool: ${name}`);
      }

      try {
        const index = await loadIndex(req);
        const output = await callTool(name, params?.arguments ?? {}, index);

        return rpcResult(id, {
          content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
          isError: Boolean(output?.error),
        });
      } catch (err) {
        console.error("[mcp]", err);
        return rpcResult(id, {
          content: [{ type: "text", text: "The site's content index could not be read." }],
          isError: true,
        });
      }
    }

    default:
      return rpcError(id, -32601, `Method not found: ${method}`);
  }
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Mcp-Session-Id, MCP-Protocol-Version");

  if (req.method === "OPTIONS") return res.status(204).end();

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST, OPTIONS");
    return res.status(405).json(rpcError(null, -32600, "Use POST with a JSON-RPC 2.0 body."));
  }

  if (!(await withinRateLimit("mcp", clientIp(req), 300))) {
    return res.status(429).json(rpcError(null, -32000, "Too many requests."));
  }

  const body = req.body;
  if (!body || typeof body !== "object") {
    return res.status(400).json(rpcError(null, -32700, "Parse error."));
  }

  const batch = Array.isArray(body) ? body : [body];
  const replies = [];

  for (const message of batch) {
    if (message?.id === undefined) continue;
    replies.push(await handleRpc(message, req));
  }

  if (!replies.length) return res.status(202).end();

  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  return res.status(200).send(JSON.stringify(Array.isArray(body) ? replies : replies[0]));
}
