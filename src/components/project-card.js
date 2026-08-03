/**
 * Project card – name, description, tags, status, link.
 * Data via attributes: name, description, url, tags, status.
 */
const template = document.createElement("template");
template.innerHTML = `
  <style>
    :host { display: block; }
    .card {
      padding: 1rem 1.125rem;
      border-radius: 10px;
      background: rgba(255,255,255,0.03);
      border: 1px solid rgba(255,255,255,0.07);
      text-decoration: none;
      color: inherit;
      display: block;
      transition: border-color 0.25s, background 0.25s;
    }
    .card:hover {
      border-color: rgba(255,45,109,0.35);
      background: rgba(255,255,255,0.055);
    }
    .title {
      font-size: 1rem;
      font-weight: 600;
      line-height: 1.3;
      margin-bottom: 0.375rem;
      color: rgba(255,255,255,0.95);
    }
    .description {
      font-size: 0.8125rem;
      color: rgba(255,255,255,0.5);
      line-height: 1.5;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
      margin: 0;
    }
    .footer {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 0.5rem;
      margin-top: 0.75rem;
      padding-top: 0.625rem;
      border-top: 1px solid rgba(255,255,255,0.06);
    }
    .status {
      font-size: 0.625rem;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      font-weight: 600;
      padding: 3px 8px;
      border-radius: 4px;
      margin-right: auto;
    }
    .status--active { background: rgba(45,200,110,0.15); color: rgba(90,220,140,0.9); }
    .status--wip { background: rgba(255,180,45,0.15); color: rgba(255,195,90,0.9); }
    .status--archived { background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.45); }
    .tag {
      font-size: 0.625rem;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      font-weight: 600;
      padding: 3px 8px;
      border-radius: 4px;
      background: rgba(255,255,255,0.06);
      color: rgba(255,255,255,0.45);
    }
  </style>
  <a class="card" href="" target="_blank" rel="noopener">
    <h3 class="title"></h3>
    <p class="description"></p>
    <div class="footer">
      <span class="status" hidden></span>
      <div class="tags"></div>
    </div>
  </a>`;

class ProjectCard extends HTMLElement {
  static get observedAttributes() {
    return ["name", "description", "url", "tags", "status"];
  }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.shadowRoot.appendChild(template.content.cloneNode(true));
    this._link = this.shadowRoot.querySelector(".card");
    this._title = this.shadowRoot.querySelector(".title");
    this._description = this.shadowRoot.querySelector(".description");
    this._status = this.shadowRoot.querySelector(".status");
    this._tags = this.shadowRoot.querySelector(".tags");
  }

  connectedCallback() { this._render(); }
  attributeChangedCallback() { if (this.isConnected) this._render(); }

  _render() {
    const name = this.getAttribute("name") || "";
    const description = this.getAttribute("description") || "";
    const url = this.getAttribute("url") || "#";
    const tagsStr = this.getAttribute("tags") || "";
    const status = this.getAttribute("status") || "";

    this._title.textContent = name;
    this._description.textContent = description;
    this._link.href = url;

    if (status) {
      this._status.textContent = status;
      this._status.hidden = false;
      this._status.className = "status";
      const cls = status.toLowerCase().replace(/\s+/g, "-");
      this._status.classList.add("status--" + cls);
    } else {
      this._status.hidden = true;
    }

    this._tags.innerHTML = "";
    const tags = tagsStr.split(",").map((t) => t.trim()).filter(Boolean);
    tags.forEach((t) => {
      const span = document.createElement("span");
      span.className = "tag";
      span.textContent = t;
      this._tags.appendChild(span);
    });
  }
}

customElements.define("project-card", ProjectCard);
