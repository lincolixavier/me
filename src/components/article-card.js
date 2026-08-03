/**
 * Article card – title, date, description, link, tags as badges.
 * Data via attributes: title, date, description, slug, tags (comma-separated), base.
 */
const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

function formatDate(raw) {
  if (!raw) return "";
  const d = new Date(raw + "T00:00:00");
  if (isNaN(d.getTime())) return raw;
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

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
    .date {
      font-size: 0.6875rem;
      color: rgba(255,255,255,0.35);
      letter-spacing: 0.05em;
      text-transform: uppercase;
      font-weight: 500;
      margin-right: auto;
    }
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
    .tag.accent {
      background: rgba(255,45,109,0.15);
      color: rgba(255,45,109,0.9);
    }
  </style>
  <a class="card" href="">
    <div class="body">
      <h3 class="title"></h3>
      <p class="description"></p>
    </div>
    <div class="footer">
      <span class="date"></span>
      <div class="tags"></div>
    </div>
  </a>`;

class ArticleCard extends HTMLElement {
  static get observedAttributes() {
    return ["title", "date", "description", "slug", "tags", "base"];
  }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.shadowRoot.appendChild(template.content.cloneNode(true));
    this._link = this.shadowRoot.querySelector(".card");
    this._title = this.shadowRoot.querySelector(".title");
    this._description = this.shadowRoot.querySelector(".description");
    this._date = this.shadowRoot.querySelector(".date");
    this._tags = this.shadowRoot.querySelector(".tags");
  }

  connectedCallback() { this._render(); }
  attributeChangedCallback() { if (this.isConnected) this._render(); }

  _render() {
    const title = this.getAttribute("title") || "";
    const date = this.getAttribute("date") || "";
    const description = this.getAttribute("description") || "";
    const slug = this.getAttribute("slug") || "";
    const tagsStr = this.getAttribute("tags") || "";
    const base = this.getAttribute("base") || "articles";

    this._title.textContent = title;
    this._description.textContent = description;
    this._link.href = slug ? `${base}/${slug}.html` : "#";

    this._date.textContent = formatDate(date);
    this._date.hidden = !date;

    this._tags.innerHTML = "";
    const tags = tagsStr.split(",").map((t) => t.trim()).filter(Boolean);
    tags.forEach((t, i) => {
      const span = document.createElement("span");
      span.className = i === 0 ? "tag accent" : "tag";
      span.textContent = t;
      this._tags.appendChild(span);
    });
  }
}

customElements.define("article-card", ArticleCard);
