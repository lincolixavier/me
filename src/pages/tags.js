/**
 * Tag filtering on the articles listing.
 *
 * Every chip is a real link to /articles/?tag=x, so a filtered view can be
 * shared and works if this script never loads. When it does load it filters
 * the cards already in the DOM and updates the URL, which avoids a round trip
 * for something the browser is already holding.
 */
const filter = document.querySelector("[data-tag-filter]");
const grid = document.querySelector("[data-grid]");

if (filter && grid) {
  const empty = document.querySelector("[data-tag-empty]");
  const chips = [...filter.querySelectorAll("[data-tag]")];
  const slots = [...grid.querySelectorAll(".card-slot")];

  const tagsOf = (slot) => {
    const value = slot.querySelector("[data-tags]")?.dataset.tags ?? "";
    return value ? value.split("|") : [];
  };

  function apply(tag, { push = true } = {}) {
    const visible = [];

    for (const slot of slots) {
      const match = !tag || tagsOf(slot).includes(tag);
      slot.hidden = !match;
      if (match) {
        // The entrance animation is keyed off this, so re-indexing keeps the
        // stagger reading top to bottom instead of skipping filtered rows.
        slot.style.setProperty("--card-index", Math.min(visible.length, 8));
        visible.push(slot);
      }
    }

    const shown = visible.length;

    for (const chip of chips) {
      chip.classList.toggle("tag-chip--on", chip.dataset.tag === tag);
    }

    if (empty) empty.hidden = shown > 0;

    // Pagination owns the hidden attribute once it takes over, so it needs the
    // eligible set rather than having to work out what the filter did.
    document.dispatchEvent(new CustomEvent("cards:filtered", { detail: { visible } }));

    if (push) {
      const url = tag ? `/articles/?tag=${encodeURIComponent(tag)}` : "/articles/";
      history.pushState({ tag }, "", url);
    }
  }

  filter.addEventListener("click", (event) => {
    const chip = event.target.closest("[data-tag]");
    if (!chip) return;
    event.preventDefault();
    apply(chip.dataset.tag);
  });

  window.addEventListener("popstate", () => {
    apply(new URLSearchParams(location.search).get("tag") ?? "", { push: false });
  });

  const initial = new URLSearchParams(location.search).get("tag");
  if (initial) apply(initial, { push: false });
}
