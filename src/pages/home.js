/**
 * Home page: swaps the hero for the about section, flying the camera between
 * two framings. Deep-linkable via #about.
 */
const DURATION = 1400;
const VIEWS = {
  home: { cameraZ: 22, orbitMin: 26, orbitMax: 26, autoRotateSpeed: 0.23 },
  about: { cameraZ: 14, orbitMin: 14, orbitMax: 24, autoRotateSpeed: 0.2 },
};

const page = document.querySelector(".page");
const toggle = document.querySelector(".nav-page-toggle");
const about = document.getElementById("section-about");
const canvas = document.querySelector("neural-canvas");

const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

if (page && toggle) {
  const show = (view) => {
    const isAbout = view === "about";
    page.classList.toggle("view-about", isAbout);
    about?.setAttribute("aria-hidden", String(!isAbout));
    toggle.textContent = isAbout ? "home" : "about";
    history.replaceState(null, "", isAbout ? "#about" : location.pathname);
  };

  /**
   * The camera animation is only a transition, so a missing or not-yet-loaded
   * canvas must never block the content swap.
   */
  const flyTo = (view, onDone) => {
    const animate = canvas?.api?.animateTo;
    if (!animate || prefersReducedMotion) {
      onDone?.();
      return;
    }
    animate.call(canvas.api, VIEWS[view], DURATION, onDone);
  };

  toggle.addEventListener("click", (event) => {
    event.preventDefault();
    const next = page.classList.contains("view-about") ? "home" : "about";

    if (next === "home") {
      flyTo("home");
      show("home");
    } else {
      // Swap after the camera settles so the text does not fade in mid-flight.
      // flyTo falls through to the callback immediately when it cannot animate.
      flyTo("about", () => requestAnimationFrame(() => show("about")));
    }
  });

  if (location.hash === "#about") {
    show("about");
    flyTo("about");
  }
}
