const splash = document.querySelector("[data-splash]");

if (splash) {
  const reveal = () => splash.classList.add("splash--ready");

  const MINIMUM_MS = 620;
  const shown = performance.now();

  const finish = () => {
    const elapsed = performance.now() - shown;
    setTimeout(reveal, Math.max(0, MINIMUM_MS - elapsed));
  };

  if (document.readyState === "complete") finish();
  else window.addEventListener("load", finish, { once: true });

  window.addEventListener("pageshow", (event) => {
    if (event.persisted) reveal();
  });
}
