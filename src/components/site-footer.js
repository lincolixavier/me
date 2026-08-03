/**
 * Shared site footer with social / utility links.
 */
const FOOTER_ITEMS = [
  { dataHover: "email", href: "#about" },
  { dataHover: "linkedin", href: "#blog" },
  { dataHover: "twitter", href: "#connect" },
  { dataHover: "github", href: "#about" },
  { dataHover: "instagram", href: "#blog" },
  { dataHover: "youtube", href: "#connect" },
  { dataHover: "substack", href: "#connect" },
  { dataHover: "nomad community", href: "#connect" },
];

class SiteFooter extends HTMLElement {
  connectedCallback() {
    if (this.innerHTML.trim()) return;
    const links = FOOTER_ITEMS.map(
      (item) =>
        `<a href="${item.href}" class="link link--metis">${item.dataHover}</a>`
    ).join("");
    this.innerHTML = `
      <footer class="footer">
        <nav class="nav" aria-label="Primary">${links}</nav>
      </footer>`;
  }
}

customElements.define("site-footer", SiteFooter);
