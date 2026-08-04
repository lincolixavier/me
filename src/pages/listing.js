const grid = document.querySelector("[data-grid]");
const nav = document.querySelector("[data-pagination]");

if (grid && nav) {
  const allSlots = Array.from(grid.querySelectorAll(".card-slot"));
  const pageSize = Number(nav.dataset.pageSize) || 6;

  const info = nav.querySelector("[data-info]");
  const prev = nav.querySelector("[data-prev]");
  const next = nav.querySelector("[data-next]");

  let current = 0;
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
