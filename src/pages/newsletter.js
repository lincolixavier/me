/**
 * Newsletter subscribe.
 *
 * Same three states as the contact form: idle, sending, and a result that
 * stays on screen. Subscribing twice is treated as success, because from the
 * reader's side it is — they asked to be on the list and they are.
 */
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
    label.textContent = on ? "Sending" : "Subscribe";
  };

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = input.value.trim();

    if (!EMAIL.test(email)) {
      say("That address does not look right.", "error");
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
        say(body.already ? "You are already on the list." : "Done. Talk soon.", "ok");
      } else {
        say(body.error || "Could not subscribe you right now.", "error");
      }
    } catch {
      say("Could not reach the server. Try again in a moment.", "error");
    } finally {
      loading(false);
    }
  });
}
