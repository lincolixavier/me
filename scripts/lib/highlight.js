const KEYWORDS = {
  js: [
    "async", "await", "break", "case", "catch", "class", "const", "continue",
    "default", "delete", "do", "else", "export", "extends", "finally", "for",
    "from", "function", "if", "import", "in", "instanceof", "let", "new",
    "of", "return", "static", "super", "switch", "this", "throw", "try",
    "typeof", "var", "void", "while", "yield",
  ],
  ts: [
    "any", "as", "boolean", "declare", "enum", "implements", "interface",
    "keyof", "namespace", "never", "number", "private", "protected", "public",
    "readonly", "string", "type", "unknown",
  ],
};

const LITERALS = ["true", "false", "null", "undefined", "NaN", "Infinity"];

function rulesFor(lang) {
  const common = [
    ["comment", /\/\*[\s\S]*?\*\/|\/\/[^\n]*/y],
    ["string", /&quot;(?:[^&\\\n]|\\.|&(?!quot;))*&quot;|&#39;(?:[^&\\\n]|\\.|&(?!#39;))*&#39;|`(?:[^`\\]|\\.)*`/y],
    ["number", /\b0[xX][\da-fA-F]+\b|\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b/y],
  ];

  if (lang === "css") {
    return [
      ["comment", /\/\*[\s\S]*?\*\//y],
      ["string", /&quot;[^&\n]*&quot;|&#39;[^&\n]*&#39;/y],
      ["property", /--[\w-]+|(?<=[{;]\s*)[a-z-]+(?=\s*:)/y],
      ["selector", /[.#][\w-]+|@[\w-]+/y],
      ["number", /-?\b\d+(?:\.\d+)?(?:px|rem|em|vw|vh|%|s|ms|deg)?\b/y],
    ];
  }

  if (lang === "html") {
    return [
      ["comment", /&lt;!--[\s\S]*?--&gt;/y],
      ["tag", /&lt;\/?[\w-]+|\/?&gt;/y],
      ["string", /&quot;[^&\n]*&quot;|&#39;[^&\n]*&#39;/y],
      ["attr", /\b[\w-]+(?==)/y],
    ];
  }

  if (lang === "bash") {
    return [
      ["comment", /#[^\n]*/y],
      ["string", /&quot;[^&\n]*&quot;|&#39;[^&\n]*&#39;/y],
      ["flag", /(?<=\s)--?[\w-]+/y],
      ["number", /\b\d+\b/y],
    ];
  }

  const words = lang === "ts" ? [...KEYWORDS.js, ...KEYWORDS.ts] : KEYWORDS.js;

  return [
    ...common,
    ["literal", new RegExp(`\\b(?:${LITERALS.join("|")})\\b`, "y")],
    ["keyword", new RegExp(`\\b(?:${words.join("|")})\\b`, "y")],
    ["fn", /\b[A-Za-z_$][\w$]*(?=\s*\()/y],
    ["type", /\b[A-Z][\w$]*\b/y],
    ["punct", /[{}()[\];,.:?!<>=+\-*/%&|^~]+/y],
  ];
}

const ALIASES = {
  javascript: "js",
  js: "js",
  typescript: "ts",
  ts: "ts",
  html: "html",
  css: "css",
  bash: "bash",
  sh: "bash",
  shell: "bash",
};

export function highlight(escapedCode, lang) {
  const key = ALIASES[String(lang || "").toLowerCase()];
  if (!key) return escapedCode;

  const rules = rulesFor(key);
  let out = "";
  let i = 0;

  while (i < escapedCode.length) {
    let matched = false;

    for (const [name, pattern] of rules) {
      pattern.lastIndex = i;
      const match = pattern.exec(escapedCode);
      if (!match || match.index !== i || match[0] === "") continue;

      out += `<span class="tok-${name}">${match[0]}</span>`;
      i += match[0].length;
      matched = true;
      break;
    }

    if (!matched) {
      out += escapedCode[i];
      i += 1;
    }
  }

  return out;
}
