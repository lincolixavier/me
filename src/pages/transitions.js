const HERO = "article-hero";

const supportsTransitions = "startViewTransition" in document;
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

if (supportsTransitions && !prefersReducedMotion) {
  const articleHero = document.querySelector("[data-article-hero]");
  if (articleHero) articleHero.style.viewTransitionName = HERO;

  const grid = document.querySelector("[data-grid]");

  grid?.addEventListener("click", (event) => {
    const card = event.target.closest("a.card");
    if (!card || !grid.contains(card)) return;

    const title = card.querySelector(".card-title");
    if (title) title.style.viewTransitionName = HERO;
  });

  window.addEventListener("pageshow", () => {
    grid?.querySelectorAll(".card-title").forEach((title) => {
      title.style.viewTransitionName = "";
    });
  });
}
