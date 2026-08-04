const dialogs = document.querySelectorAll("dialog.modal");
if (dialogs.length) {
  for (const dialog of dialogs) {
    for (const link of document.querySelectorAll(`a[href="#${dialog.id}"]`)) {
      link.addEventListener("click", (event) => {
        event.preventDefault();
        dialog.showModal();
      });
    }

    dialog.addEventListener("click", (event) => {
      if (event.target.closest("[data-modal-close]")) {
        event.preventDefault();
        dialog.close();
        return;
      }
      // A click that landed on the dialog itself is a click on the backdrop:
      // the panel fills it, so anything else would have hit the panel.
      if (event.target === dialog) dialog.close();
    });

    dialog.addEventListener("close", () => {
      if (location.hash === `#${dialog.id}`) {
        history.replaceState(null, "", location.pathname + location.search);
      }
    });

    if (location.hash === `#${dialog.id}`) dialog.showModal();
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
}
