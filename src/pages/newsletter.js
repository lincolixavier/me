import { t } from "../lib/i18n.js";

const form = document.querySelector("[data-subscribe]");

if (form) {
  const input = form.elements.email;
  const status = document.querySelector("[data-sub-status]");
  const submit = form.querySelector("[data-sub-submit]");
  const label = form.querySelector("[data-sub-label]");

  const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const say = (text, state) => {
    status.textContent = text;
    if (state) status.dataset.state = state;
    else delete status.dataset.state;
  };

  const loading = (on) => {
    submit.disabled = on;
    submit.toggleAttribute("data-loading", on);
    label.textContent = on ? t.sending : t.subscribe;
  };

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = input.value.trim();

    if (!EMAIL.test(email)) {
      say(t.badEmail, "error");
      input.focus();
      return;
    }

    loading(true);
    say("");

    try {
      const response = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const body = await response.json().catch(() => ({}));

      if (response.ok) {
        form.hidden = true;
        say(t.subscribeCheckInbox, "ok");
      } else {
        say(body.error || t.subscribeFailed, "error");
      }
    } catch {
      say(t.subscribeUnreachable, "error");
    } finally {
      loading(false);
    }
  });
}
