/**
 * Share button. Uses the native share sheet where it exists (mobile, Safari),
 * and falls back to copying the URL. The button is rendered by the build but
 * stays hidden until this module confirms one of the two paths works, so it
 * never sits there doing nothing.
 */
const button = document.querySelector("[data-share]");

if (button) {
  const label = button.querySelector("[data-share-label]");
  const canShare = typeof navigator.share === "function";
  const canCopy = !!navigator.clipboard?.writeText;

  if (!canShare && !canCopy) {
    button.remove();
  } else {
    button.hidden = false;

    let resetTimer = null;
    const flash = (text) => {
      label.textContent = text;
      clearTimeout(resetTimer);
      resetTimer = setTimeout(() => {
        label.textContent = "share";
        button.classList.remove("share-btn--done");
      }, 2000);
    };

    button.addEventListener("click", async () => {
      const url = location.href;
      const title = button.dataset.title || document.title;

      if (canShare) {
        try {
          await navigator.share({ title, url });
          return;
        } catch (err) {
          // Cancelling the share sheet rejects too — that is not a failure,
          // so fall through to copying only if sharing is actually broken.
          if (err.name === "AbortError") return;
        }
      }

      try {
        await navigator.clipboard.writeText(url);
        button.classList.add("share-btn--done");
        flash("link copied");
      } catch {
        flash("could not copy");
      }
    });
  }
}
