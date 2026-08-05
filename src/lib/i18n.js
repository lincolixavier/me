// Strings the client needs are inlined by the build as application/json, which
// is data rather than script, so no CSP hash is involved even though the payload
// changes per locale. English is the fallback if the tag is ever missing.
const FALLBACK = {
  lang: "en",
  share: "share",
  linkCopied: "copied",
  couldNotCopy: "failed",
  copied: "copied",
  pressToCopy: "press ⌘C",
  sending: "Sending",
  sendMessage: "Send message",
  subscribe: "Subscribe",
  sendingEllipsis: "Sending…",
  nameRequired: "Please tell me your name.",
  messageRequired: "Please write a message.",
  badEmail: "That address does not look right.",
  contactSent: "Sent. I'll get back to you.",
  contactFailed: "Something went wrong. Email me directly instead.",
  contactUnreachable: "Could not reach the server. Email me directly instead.",
  subscribeCheckInbox: "Check your inbox to confirm. The link lasts 48 hours.",
  subscribeFailed: "Could not subscribe you right now.",
  subscribeUnreachable: "Could not reach the server. Try again in a moment.",
  confirmOk: "You are on the list. New posts will arrive by email.",
  confirmExpired: "That link has expired or was already used. Subscribe again and I will send a fresh one.",
  confirmInvalid: "That link does not look right. Subscribe again to get a new one.",
  confirmError: "Something went wrong on my side. Try again in a moment.",
};

function read() {
  const tag = document.getElementById("i18n");
  if (!tag) return FALLBACK;

  try {
    return { ...FALLBACK, ...JSON.parse(tag.textContent) };
  } catch {
    return FALLBACK;
  }
}

export const t = read();
