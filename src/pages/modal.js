// Tells the stylesheet to stop honouring :target, which cannot be cleared by
// the History API and would otherwise keep a closed dialog on screen.
document.documentElement.dataset.js = "";

const CLOSING = "is-closing";

for (const dialog of document.querySelectorAll("dialog.modal")) {
  const open = () => {
    if (dialog.open) return;
    dialog.classList.remove(CLOSING);
    dialog.showModal();
  };

  // Closing is never gated on the animation finishing. The animation gets a
  // chance to play and a deadline; whichever comes first, the dialog closes.
  const close = () => {
    if (!dialog.open || dialog.classList.contains(CLOSING)) return;

    const finish = () => {
      clearTimeout(deadline);
      dialog.classList.remove(CLOSING);
      dialog.close();
    };

    dialog.classList.add(CLOSING);
    const deadline = setTimeout(finish, 260);
    dialog.addEventListener("animationend", finish, { once: true });
  };

  for (const link of document.querySelectorAll(`a[href="#${dialog.id}"]`)) {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      open();
    });
  }

  dialog.addEventListener("click", (event) => {
    if (event.target.closest("[data-modal-close]")) {
      event.preventDefault();
      close();
      return;
    }
    // The panel fills the dialog box, so a click that landed on the dialog
    // itself came from the backdrop.
    if (event.target === dialog) close();
  });

  // Esc fires cancel before close, so the animation gets its turn.
  dialog.addEventListener("cancel", (event) => {
    if (dialog.classList.contains(CLOSING)) return;
    event.preventDefault();
    close();
  });

  if (location.hash === `#${dialog.id}`) {
    history.replaceState(null, "", location.pathname + location.search);
    open();
  }
}

for (const button of document.querySelectorAll("[data-copy]")) {
  button.addEventListener("click", async () => {
    const original = button.textContent;
    try {
      await navigator.clipboard.writeText(button.dataset.copy);
      button.textContent = "copied";
      button.classList.add("is-done");
    } catch {
      button.textContent = "select it";
    }
    setTimeout(() => {
      button.textContent = original;
      button.classList.remove("is-done");
    }, 1800);
  });
}
