/**
 * Contact form.
 *
 * Submits over fetch so the reader stays on the page. If anything at all goes
 * wrong — the endpoint is unconfigured, the network drops, the browser has no
 * JavaScript at the moment it is needed — the mailto address is right below
 * the form, so there is always a way through.
 */
const form = document.querySelector("[data-contact]");

if (form) {
  const status = form.querySelector("[data-status]");
  const submit = form.querySelector("[data-submit]");

  const say = (text, state) => {
    status.textContent = text;
    status.dataset.state = state;
  };

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const data = Object.fromEntries(new FormData(form));

    if (!data.name?.trim() || !data.message?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email || "")) {
      say("Please fill in your name, a valid email and a message.", "error");
      return;
    }

    submit.disabled = true;
    say("Sending…", "pending");

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const body = await response.json().catch(() => ({}));

      if (response.ok) {
        form.reset();
        say("Sent. I'll get back to you.", "ok");
      } else {
        say(body.error || "Something went wrong. Email me directly instead.", "error");
      }
    } catch {
      say("Could not reach the server. Email me directly instead.", "error");
    } finally {
      submit.disabled = false;
    }
  });
}
