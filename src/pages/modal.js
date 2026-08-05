import { t } from "../lib/i18n.js";

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

// writeText needs a focused document and a permission that can be refused, and
// where it is refused it sometimes hangs rather than rejecting. The deadline
// keeps the button honest, and execCommand covers what is left. The scratch
// field goes inside the dialog: a modal traps focus, so selecting a node
// outside it would silently do nothing.
async function copyText(text, host) {
  const deadline = new Promise((_, reject) => setTimeout(reject, 400));

  try {
    await Promise.race([navigator.clipboard.writeText(text), deadline]);
    return true;
  } catch {
    /* fall through to the old way */
  }

  const field = document.createElement("textarea");
  field.value = text;
  field.readOnly = true;
  field.style.cssText = "position:fixed;top:0;left:0;opacity:0;pointer-events:none";
  host.append(field);
  field.select();

  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    field.remove();
  }
}

for (const button of document.querySelectorAll("[data-copy]")) {
  const original = button.textContent;
  let reset = null;

  button.addEventListener("click", async () => {
    const host = button.closest("dialog") ?? document.body;
    const copied = await copyText(button.dataset.copy, host);

    button.textContent = copied ? t.copied : t.pressToCopy;
    button.classList.toggle("is-done", copied);

    clearTimeout(reset);
    reset = setTimeout(() => {
      button.textContent = original;
      button.classList.remove("is-done");
    }, 1800);
  });
}
