const form = document.querySelector("[data-contact]");

if (form) {
  const status = form.querySelector("[data-status]");
  const submit = form.querySelector("[data-submit]");
  const buttonLabel = form.querySelector("[data-btn-label]");
  const counter = form.querySelector("[data-count]");
  const message = form.elements.message;

  const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const RULES = {
    name: (v) => (v.trim() ? "" : "Please tell me your name."),
    email: (v) =>
      !v.trim()
        ? "An email is needed so I can reply."
        : EMAIL.test(v.trim())
          ? ""
          : "That address does not look right.",
    message: (v) =>
      v.trim().length >= 10 ? "" : "A few more words would help.",
  };

  const fieldOf = (input) => input.closest("[data-field]");

  function validate(input, { silent = false } = {}) {
    const rule = RULES[input.name];
    if (!rule) return true;

    const error = rule(input.value);
    const field = fieldOf(input);

    if (error) {
      if (!silent) {
        field.setAttribute("data-invalid", "");
        field.removeAttribute("data-valid");
        field.querySelector("[data-error]").textContent = error;
        input.setAttribute("aria-invalid", "true");
      }
      return false;
    }

    field.removeAttribute("data-invalid");
    field.setAttribute("data-valid", "");
    field.querySelector("[data-error]").textContent = "";
    input.removeAttribute("aria-invalid");
    return true;
  }

  for (const name of Object.keys(RULES)) {
    const input = form.elements[name];
    if (!input) continue;

    input.addEventListener("blur", () => validate(input));
    input.addEventListener("input", () => {
      if (fieldOf(input).hasAttribute("data-invalid")) validate(input);
    });
  }

  if (counter && message) {
    const count = () => {
      counter.textContent = message.value.length;
    };
    message.addEventListener("input", count);
    count();
  }

  const say = (text, state) => {
    status.textContent = text;
    if (state) status.dataset.state = state;
    else delete status.dataset.state;
  };

  const loading = (on) => {
    submit.disabled = on;
    submit.toggleAttribute("data-loading", on);
    buttonLabel.textContent = on ? "Sending" : "Send message";
  };

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    say("");

    const inputs = Object.keys(RULES).map((n) => form.elements[n]);
    const invalid = inputs.filter((input) => !validate(input));

    if (invalid.length) {
      invalid[0].focus();
      return;
    }

    loading(true);
    say("Sending…", "pending");

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.elements.name.value,
          email: form.elements.email.value,
          message: form.elements.message.value,
        }),
      });

      const body = await response.json().catch(() => ({}));

      if (response.ok) {
        form.reset();
        for (const input of inputs) fieldOf(input).removeAttribute("data-valid");
        if (counter) counter.textContent = "0";
        say("Sent. I'll get back to you.", "ok");
      } else {
        say(body.error || "Something went wrong. Email me directly instead.", "error");
      }
    } catch {
      say("Could not reach the server. Email me directly instead.", "error");
    } finally {
      loading(false);
    }
  });
}
