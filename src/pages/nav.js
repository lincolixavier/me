/**
 * Mobile menu.
 *
 * The panel and its animation live in CSS; this only flips the state and keeps
 * the accessible name and aria-expanded in step with it. Without JavaScript the
 * toggle never appears and the links stay in the header, so nothing is lost.
 */
const header = document.querySelector("[data-header]");
const toggle = document.querySelector("[data-nav-toggle]");
const nav = document.getElementById("site-nav");

if (header && toggle && nav) {
  const setOpen = (open) => {
    header.toggleAttribute("data-nav-open", open);
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    // The page behind must not scroll while the panel covers it.
    document.body.style.overflow = open ? "hidden" : "";
  };

  const isOpen = () => header.hasAttribute("data-nav-open");

  toggle.addEventListener("click", () => setOpen(!isOpen()));

  // Following a link inside the panel navigates; closing first avoids the
  // menu being captured half-open in the outgoing view transition.
  nav.addEventListener("click", (event) => {
    if (event.target.closest("a")) setOpen(false);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && isOpen()) {
      setOpen(false);
      toggle.focus();
    }
  });

  // Rotating to landscape can cross the breakpoint and strand the open state.
  window.matchMedia("(min-width: 901px)").addEventListener("change", (event) => {
    if (event.matches) setOpen(false);
  });
}
