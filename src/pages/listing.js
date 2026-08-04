/**
 * Pagination for listing pages, as progressive enhancement.
 *
 * Every card is already in the HTML — this only hides the ones outside the
 * current page. With JS disabled the full list stays visible and usable.
 *
 * The tag filter hides cards too, so pagination works over whatever is left
 * rather than over every card in the DOM. It listens for cards:filtered to
 * recount, which is why filtering does not strand the reader on page 4 of a
 * list that now has one page.
 */
const grid = document.querySelector("[data-grid]");
const nav = document.querySelector("[data-pagination]");

if (grid && nav) {
  const allSlots = Array.from(grid.querySelectorAll(".card-slot"));
  const pageSize = Number(nav.dataset.pageSize) || 6;

  const info = nav.querySelector("[data-info]");
  const prev = nav.querySelector("[data-prev]");
  const next = nav.querySelector("[data-next]");

  let current = 0;
  // Cards the filter is not hiding. Pagination owns .card-slot[hidden] for
  // everything else, so it tracks eligibility separately.
  let eligible = allSlots;

  const totalPages = () => Math.max(1, Math.ceil(eligible.length / pageSize));

  function render() {
    const start = current * pageSize;
    const end = start + pageSize;

    for (const slot of allSlots) {
      const index = eligible.indexOf(slot);
      slot.hidden = index === -1 || index < start || index >= end;
    }

    const pages = totalPages();
    nav.hidden = pages < 2;
    info.textContent = `${current + 1} / ${pages}`;
    prev.disabled = current === 0;
    next.disabled = current === pages - 1;
  }

  function go(page) {
    current = Math.min(Math.max(page, 0), totalPages() - 1);
    render();
    grid.scrollIntoView({ block: "start", behavior: "smooth" });
  }

  prev.addEventListener("click", () => go(current - 1));
  next.addEventListener("click", () => go(current + 1));

  document.addEventListener("cards:filtered", (event) => {
    eligible = event.detail?.visible ?? allSlots;
    current = 0;
    render();
  });

  render();
}
