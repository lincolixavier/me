/**
 * Home page: swaps the hero for the about section, flying the camera between
 * two framings. Deep-linkable via #about.
 *
 * Both views live on the same page, so "home" and "about" in the nav are two
 * states of one document — the active state moves between them instead of the
 * about link relabelling itself to "home" and shadowing the real home link.
 */
const DURATION = 1400;
const VIEWS = {
  home: { cameraZ: 22, orbitMin: 26, orbitMax: 26, autoRotateSpeed: 0.23 },
  about: { cameraZ: 14, orbitMin: 14, orbitMax: 24, autoRotateSpeed: 0.2 },
};

const page = document.querySelector(".page");
const nav = document.querySelector(".site-header .nav");
const toggle = nav?.querySelector(".nav-page-toggle");
const homeLink = nav?.querySelector('a[href="/"]');
const about = document.getElementById("section-about");
const canvas = document.querySelector("neural-canvas");

const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

if (page && toggle) {
  const setActive = (link, isActive) => {
    link?.classList.toggle("active", isActive);
    if (isActive) link?.setAttribute("aria-current", "page");
    else link?.removeAttribute("aria-current");
  };

  const show = (view) => {
    const isAbout = view === "about";
    page.classList.toggle("view-about", isAbout);
    about?.setAttribute("aria-hidden", String(!isAbout));
    setActive(toggle, isAbout);
    setActive(homeLink, !isAbout);
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

  const goTo = (view) => {
    if (view === "home") {
      flyTo("home");
      show("home");
    } else {
      // Swap after the camera settles so the text does not fade in mid-flight.
      // flyTo falls through to the callback immediately when it cannot animate.
      flyTo("about", () => requestAnimationFrame(() => show("about")));
    }
  };

  toggle.addEventListener("click", (event) => {
    event.preventDefault();
    goTo(page.classList.contains("view-about") ? "home" : "about");
  });

  // Going home from the about view is a state change, not a page load.
  homeLink?.addEventListener("click", (event) => {
    if (!page.classList.contains("view-about")) return;
    event.preventDefault();
    goTo("home");
  });

  if (location.hash === "#about") {
    show("about");
    flyTo("about");
  }
}
