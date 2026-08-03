/**
 * Pagination for listing pages, as progressive enhancement.
 *
 * Every card is already in the HTML — this only hides the ones outside the
 * current page. With JS disabled the full list stays visible and usable.
 */
const grid = document.querySelector("[data-grid]");
const nav = document.querySelector("[data-pagination]");

if (grid && nav) {
  const slots = Array.from(grid.querySelectorAll(".card-slot"));
  const pageSize = Number(nav.dataset.pageSize) || 6;
  const totalPages = Math.max(1, Math.ceil(slots.length / pageSize));

  const info = nav.querySelector("[data-info]");
  const prev = nav.querySelector("[data-prev]");
  const next = nav.querySelector("[data-next]");

  let current = 0;

  function render() {
    const start = current * pageSize;
    const end = start + pageSize;
    slots.forEach((slot, i) => {
      slot.hidden = i < start || i >= end;
    });

    info.textContent = `${current + 1} / ${totalPages}`;
    prev.disabled = current === 0;
    next.disabled = current === totalPages - 1;
  }

  function go(page) {
    current = Math.min(Math.max(page, 0), totalPages - 1);
    render();
    grid.scrollIntoView({ block: "start", behavior: "smooth" });
  }

  prev.addEventListener("click", () => go(current - 1));
  next.addEventListener("click", () => go(current + 1));

  nav.hidden = false;
  render();
}
