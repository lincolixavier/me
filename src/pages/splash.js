/**
 * Shortens the splash once the page is actually usable.
 *
 * Hiding it is the CSS animation's job — see .splash in components.css — so
 * this only brings the moment forward. If this file never loads, the panel
 * still lifts on its own.
 */
const splash = document.querySelector("[data-splash]");

if (splash) {
  const reveal = () => splash.classList.add("splash--ready");

  // Give the mark enough time to read as a mark rather than a flash, but no
  // longer than it takes the page to be ready.
  const MINIMUM_MS = 620;
  const shown = performance.now();

  const finish = () => {
    const elapsed = performance.now() - shown;
    setTimeout(reveal, Math.max(0, MINIMUM_MS - elapsed));
  };

  if (document.readyState === "complete") finish();
  else window.addEventListener("load", finish, { once: true });

  // A returning history entry should never re-play it.
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) reveal();
  });
}
