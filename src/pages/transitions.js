/**
 * Shared-element navigation, loaded on every page.
 *
 * Cross-document view transitions are declared in CSS (@view-transition). All
 * this adds is the shared name: whichever card the reader clicked becomes the
 * element the article title grows out of. Browsers without support just
 * navigate, and nothing here changes that.
 */
const HERO = "article-hero";

const supportsTransitions = "startViewTransition" in document;
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

if (supportsTransitions && !prefersReducedMotion) {
  // Article page: this title is the other half of the pair.
  const articleHero = document.querySelector("[data-article-hero]");
  if (articleHero) articleHero.style.viewTransitionName = HERO;

  // Listing page: name the card being left behind, and only that one.
  const grid = document.querySelector("[data-grid]");

  grid?.addEventListener("click", (event) => {
    const card = event.target.closest("a.card");
    if (!card || !grid.contains(card)) return;

    const title = card.querySelector(".card-title");
    if (title) title.style.viewTransitionName = HERO;
  });

  // Coming back through history reuses the page, so the name has to go —
  // two elements sharing one name in the same document breaks the transition.
  window.addEventListener("pageshow", () => {
    grid?.querySelectorAll(".card-title").forEach((title) => {
      title.style.viewTransitionName = "";
    });
  });
}
