/**
 * Turns the ?s= the confirmation endpoint redirects with into a sentence.
 *
 * The outcome is a query parameter rather than four separate pages so the
 * whole thing stays one static file. Anything unrecognised falls back to the
 * failure wording, because a confirmation that cannot be verified should not
 * claim to have worked.
 */
const target = document.querySelector("[data-subscribed-message]");

const MESSAGES = {
  ok: "You are on the list. New posts will arrive by email.",
  expired: "That link has expired or was already used. Subscribe again and I will send a fresh one.",
  invalid: "That link does not look right. Subscribe again to get a new one.",
  error: "Something went wrong on my side. Try again in a moment.",
};

if (target) {
  const status = new URLSearchParams(location.search).get("s") ?? "";
  target.textContent = MESSAGES[status] ?? MESSAGES.error;
}
