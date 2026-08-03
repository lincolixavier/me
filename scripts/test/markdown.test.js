/**
 * Run: node --test scripts/test/
 * Each case here is a bug the previous parser shipped.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { parseMarkdown, excerpt } from "../lib/markdown.js";

test("underscores in a URL do not become emphasis", () => {
  const html = parseMarkdown("Veja [meu post](https://ex.com/a_b_c) aqui.");
  assert.match(html, /href="https:\/\/ex\.com\/a_b_c"/);
  assert.doesNotMatch(html, /<em>/);
});

test("inline code is immune to emphasis", () => {
  const html = parseMarkdown("Use `snake_case_name` e `a*b*c`.");
  assert.match(html, /<code>snake_case_name<\/code>/);
  assert.match(html, /<code>a\*b\*c<\/code>/);
});

test("text after a list is not dropped", () => {
  const html = parseMarkdown("- a\n- b\ntexto solto");
  assert.match(html, /<li>a<\/li>/);
  assert.match(html, /<li>b<\/li>/);
  assert.match(html, /texto solto/);
});

test("images render as <img>", () => {
  const html = parseMarkdown("![um gato](/img/cat.png)");
  assert.match(html, /<img src="\/img\/cat\.png" alt="um gato"/);
  assert.doesNotMatch(html, /<a /);
});

test("blockquotes render as <blockquote>", () => {
  const html = parseMarkdown("> uma citação\n> em duas linhas");
  assert.match(html, /<blockquote>/);
  assert.match(html, /uma citação em duas linhas/);
  assert.doesNotMatch(html, /&gt;/);
});

test("ordered lists are supported", () => {
  const html = parseMarkdown("1. um\n2. dois");
  assert.match(html, /<ol>/);
  assert.match(html, /<li>um<\/li>/);
});

test("an indented line under a list item stays in that item", () => {
  const html = parseMarkdown("1. **Livro A**\n   Uma descrição.\n2. **Livro B**\n   Outra descrição.");
  // One list, not one per item.
  assert.equal(html.match(/<ol>/g).length, 1);
  assert.equal(html.match(/<li>/g).length, 2);
  assert.match(html, /<li><strong>Livro A<\/strong> Uma descrição\.<\/li>/);
  assert.doesNotMatch(html, /<p>Uma descrição/);
});

test("headings, bold, italic and strike still work", () => {
  assert.match(parseMarkdown("## Título"), /<h2>Título<\/h2>/);
  assert.match(parseMarkdown("**forte**"), /<strong>forte<\/strong>/);
  assert.match(parseMarkdown("*ênfase*"), /<em>ênfase<\/em>/);
  assert.match(parseMarkdown("~~riscado~~"), /<del>riscado<\/del>/);
});

test("fenced code keeps content verbatim and escaped", () => {
  const html = parseMarkdown('```js\nconst a = "<b>";\n```');
  assert.match(html, /<pre><code class="language-js">/);
  assert.match(html, /&lt;b&gt;/);
});

test("raw HTML in the source is escaped, not injected", () => {
  const html = parseMarkdown('<script>alert(1)</script>');
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;/);
});

test("javascript: URLs are neutralised", () => {
  const html = parseMarkdown("[x](javascript:alert(1))");
  assert.doesNotMatch(html, /javascript:/);
});

test("external links get rel=noopener", () => {
  assert.match(parseMarkdown("[x](https://a.com)"), /rel="noopener noreferrer"/);
  assert.doesNotMatch(parseMarkdown("[x](/local)"), /rel=/);
});

test("thematic break renders as <hr>", () => {
  assert.match(parseMarkdown("a\n\n---\n\nb"), /<hr \/>/);
});

test("paragraphs separated by blank lines stay separate", () => {
  const html = parseMarkdown("um\n\ndois");
  assert.equal(html.match(/<p>/g).length, 2);
});

test("excerpt strips markup and truncates on a word boundary", () => {
  const text = excerpt("# Título\n\nUm **texto** com [link](https://a.com) e mais palavras.", 30);
  assert.doesNotMatch(text, /[*#\[\]]/);
  assert.ok(text.length <= 31, `got ${text.length}`);
});
