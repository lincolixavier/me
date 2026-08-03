/**
 * Shared site header / navigation.
 * Use attribute "active" to highlight current page: home | about | articles | projects | podcasts | gear | life.
 * Optional "about-as-toggle" to render the about link as a toggle (for home hero/about swap).
 * The "home-href" attribute determines relative base for all links (e.g. "../index.html" → base "../").
 */
const NAV_ITEMS = [
  { id: "about", href: "index.html#about"},
  { id: "articles", href: "articles/"},
  { id: "projects", href: "projects/"},
  { id: "podcasts", href: "podcasts/"},
  { id: "gear", href: "gear/"},
  { id: "life", href: "life/"},
];

class SiteHeader extends HTMLElement {
  static get observedAttributes() {
    return ["active", "about-as-toggle", "home-href"];
  }

  connectedCallback() {
    this.render();
  }

  attributeChangedCallback(name, oldVal, newVal) {
    if (oldVal === newVal) return;
    if (this.isConnected) this.render();
  }

  render() {
    const active = (this.getAttribute("active") || "home").toLowerCase();
    const aboutAsToggle = this.hasAttribute("about-as-toggle");
    const homeHref = this.getAttribute("home-href") || "index.html";

    // Derive base path from home-href: "../index.html" → "../", "index.html" → ""
    const base = homeHref.replace(/index\.html$/, "");

    const items = [{ id: "home", href: homeHref }, ...NAV_ITEMS];

    const links = items
      .map((item) => {
        const isActive = item.id === active;
        const href = item.id === "home" ? item.href : base + item.href;
        const cls = ["link", "link--metis", isActive ? "active" : "", aboutAsToggle && item.id === "about" ? "nav-page-toggle" : ""].filter(Boolean).join(" ");
        return `<a href="${href}" class="${cls}">${item.id}</a>`;
      })
      .join("");

    this.innerHTML = `<nav class="nav" aria-label="Primary">${links}</nav>`;
  }
}

customElements.define("site-header", SiteHeader);
