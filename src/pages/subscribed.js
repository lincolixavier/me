import { t } from "../lib/i18n.js";

const target = document.querySelector("[data-subscribed-message]");

const MESSAGES = {
  ok: t.confirmOk,
  expired: t.confirmExpired,
  invalid: t.confirmInvalid,
  error: t.confirmError,
};

if (target) {
  const status = new URLSearchParams(location.search).get("s") ?? "";
  target.textContent = MESSAGES[status] ?? MESSAGES.error;
}
