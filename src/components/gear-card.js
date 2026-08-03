/**
 * Gear card – name, description, link, optional image.
 * Data via attributes: name, description, url, image.
 */
const template = document.createElement("template");
template.innerHTML = `
  <style>
    :host { display: block; }
    .card {
      padding: var(--spacing-md, 1rem);
      border-radius: 8px;
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.08);
      text-decoration: none;
      color: inherit;
      display: block;
      transition: border-color 0.2s, background 0.2s;
    }
    .card:hover { border-color: rgba(255,45,109,0.4); background: rgba(255,255,255,0.06); }
    .img-wrap { margin-bottom: 0.75rem; border-radius: 6px; overflow: hidden; background: rgba(0,0,0,0.2); }
    .img-wrap img { display: block; width: 100%; height: auto; vertical-align: top; }
    .name { font-size: 1.25rem; font-weight: 600; margin-bottom: 0.5rem; }
    .description { font-size: 0.9375rem; color: rgba(255,255,255,0.75); line-height: 1.5; }
  </style>
  <a class="card" href="" target="_blank" rel="noopener">
    <div class="img-wrap" hidden>
      <img src="" alt="" loading="lazy" />
    </div>
    <h3 class="name"></h3>
    <p class="description"></p>
  </a>`;

class GearCard extends HTMLElement {
  static get observedAttributes() {
    return ["name", "description", "url", "image"];
  }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.shadowRoot.appendChild(template.content.cloneNode(true));
    this._link = this.shadowRoot.querySelector(".card");
    this._imgWrap = this.shadowRoot.querySelector(".img-wrap");
    this._img = this.shadowRoot.querySelector("img");
    this._name = this.shadowRoot.querySelector(".name");
    this._description = this.shadowRoot.querySelector(".description");
  }

  connectedCallback() {
    this._render();
  }

  attributeChangedCallback() {
    if (this.isConnected) this._render();
  }

  _render() {
    const name = this.getAttribute("name") || "";
    const description = this.getAttribute("description") || "";
    const url = this.getAttribute("url") || "#";
    const image = this.getAttribute("image") || "";

    this._name.textContent = name;
    this._description.textContent = description;
    this._link.href = url;

    if (image) {
      this._img.src = image;
      this._img.alt = name;
      this._imgWrap.hidden = false;
    } else {
      this._imgWrap.hidden = true;
    }
  }
}

customElements.define("gear-card", GearCard);
