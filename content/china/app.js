const TIME_ZONE = "America/Sao_Paulo";
const STATUS = { ahead: "Adiantado", "on-track": "No ritmo", behind: "Atrasado" };
const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const MONTHS_LONG = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];
const SVG = "http://www.w3.org/2000/svg";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const brlShort = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const pct = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
const dateTime = new Intl.DateTimeFormat("pt-BR", { timeZone: TIME_ZONE, dateStyle: "short", timeStyle: "short" });

const $ = (selector, root = document) => root.querySelector(selector);

let data = null;
let session = null;

const money = (cents) => brl.format(cents / 100);
const percentText = (value) => `${pct.format(value)}%`;

function monthParts(key) {
  const [year, month] = key.split("-").map(Number);
  return { year, month };
}

function monthShort(key) {
  const { year, month } = monthParts(key);
  return `${MONTHS[month - 1]}/${String(year).slice(2)}`;
}

function monthLong(key) {
  const { year, month } = monthParts(key);
  return `${MONTHS_LONG[month - 1]} de ${year}`;
}

function projectionText(projection) {
  if (projection.reached) return "meta batida";
  if (!projection.month) return "sem lançamentos ainda";
  return `${monthLong(projection.month)}${projection.onTime ? "" : " (depois do prazo)"}`;
}

function parseAmount(raw) {
  let value = String(raw).replace(/R\$|\s/g, "");
  if (!value) return null;
  if (value.includes(",")) value = value.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(value)) value = value.replace(/\./g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(value)) return null;
  return Math.round(Number(value) * 100);
}

function setBar(bar, value) {
  const clamped = Math.max(0, Math.min(100, value));
  bar.firstElementChild.style.width = `${clamped}%`;
  bar.setAttribute("aria-valuenow", String(Math.round(clamped)));
}

function chip(el, status) {
  el.textContent = STATUS[status] ?? "";
  el.dataset.status = status;
}

function el(tag, attrs = {}, text) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  if (text !== undefined) node.textContent = text;
  return node;
}

function svg(tag, attrs = {}) {
  const node = document.createElementNS(SVG, tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  return node;
}

function notice(message) {
  const box = $("[data-notice]");
  box.textContent = message;
  box.hidden = !message;
}

function nameOf(id) {
  return data.people.find((p) => p.id === id)?.name ?? id;
}

function renderGroup() {
  const g = data.group;
  $("[data-group-goal]").textContent = brlShort.format(g.goal / 100);
  $("[data-group-percent]").textContent = percentText(g.percent);
  setBar($("[data-group-bar]"), g.percent);
  $("[data-group-total]").textContent = money(g.total);
  $("[data-group-remaining]").textContent = money(g.remaining);
  $("[data-group-completed]").textContent = `${g.completed} de ${data.people.length}`;
  $("[data-group-projection]").textContent = projectionText(g.projection);
  chip($("[data-group-status]"), g.status);
}

function renderPeople() {
  const list = $("[data-people]");
  list.replaceChildren(
    ...data.people.map((p) => {
      const card = el("article", { class: "person" });
      const head = el("div", { class: "person-head" });
      head.append(el("h3", {}, p.name));
      const status = el("span", { class: "chip" });
      chip(status, p.status);
      head.append(status);

      const bar = el("div", { class: "bar", role: "progressbar", "aria-label": `Progresso de ${p.name}`, "aria-valuemin": "0", "aria-valuemax": "100" });
      bar.append(el("span"));
      setBar(bar, p.percent);

      const facts = el("dl", { class: "facts facts-sm" });
      const rows = [
        ["Juntado", `${money(p.total)} (${percentText(p.percent)})`],
        ["Falta", money(p.remaining)],
        ["Por mês a partir de agora", p.remaining > 0 ? money(p.monthlyNeeded) : "nada, meta batida"],
        ["Meses restantes", String(p.monthsRemaining)],
        ["Chega a 100% em", projectionText(p.projection)],
      ];
      for (const [term, value] of rows) {
        const row = el("div");
        row.append(el("dt", {}, term), el("dd", {}, value));
        facts.append(row);
      }

      card.append(head, bar, facts);
      return card;
    })
  );
}

function renderChart() {
  const select = $("[data-chart-select]");
  const chosen = select.value || "group";
  if (select.options.length === 1) {
    for (const p of data.people) select.append(el("option", { value: p.id }, p.name));
  }

  const source = chosen === "group" ? data.group : data.people.find((p) => p.id === chosen) ?? data.group;
  const points = source.series;

  const width = 640;
  const height = 260;
  const pad = { top: 16, right: 32, bottom: 32, left: 64 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const max = Math.max(source.goal, ...points.map((p) => p.real ?? 0));

  const x = (i) => pad.left + (innerW * i) / (points.length - 1);
  const y = (v) => pad.top + innerH - (innerH * v) / max;

  const root = svg("svg", { viewBox: `0 0 ${width} ${height}`, role: "img", "aria-label": `Acumulado real e ideal: ${chosen === "group" ? "grupo" : nameOf(chosen)}` });

  for (const fraction of [0, 0.5, 1]) {
    const value = source.goal * fraction;
    root.append(svg("line", { x1: pad.left, x2: width - pad.right, y1: y(value), y2: y(value), class: "grid" }));
    const label = svg("text", { x: pad.left - 8, y: y(value) + 4, "text-anchor": "end", class: "axis" });
    label.textContent = brlShort.format(value / 100);
    root.append(label);
  }

  points.forEach((p, i) => {
    const label = svg("text", { x: x(i), y: height - 10, "text-anchor": "middle", class: "axis" });
    label.textContent = monthShort(p.month);
    root.append(label);
  });

  const path = (values) =>
    values
      .map((v, i) => (v === null ? null : `${x(i)},${y(v)}`))
      .filter(Boolean)
      .join(" ");

  root.append(svg("polyline", { points: path(points.map((p) => p.ideal)), class: "line-ideal" }));

  const real = points.map((p) => p.real);
  if (real.some((v) => v !== null)) {
    root.append(svg("polyline", { points: path(real), class: "line-real" }));
    real.forEach((v, i) => {
      if (v === null) return;
      const dot = svg("circle", { cx: x(i), cy: y(v), r: 4, class: "dot-real" });
      const title = svg("title");
      title.textContent = `${monthShort(points[i].month)}: ${money(v)} (ideal ${money(points[i].ideal)})`;
      dot.append(title);
      root.append(dot);
    });
  }

  $("[data-chart]").replaceChildren(root);
}

function renderHistory() {
  const body = $("[data-history]");
  body.replaceChildren(
    ...data.history.map((c) => {
      const row = el("tr");
      row.append(
        el("td", {}, nameOf(c.participantId)),
        el("td", {}, monthShort(c.month)),
        el("td", { class: "num" }, money(c.amountCents)),
        el("td", {}, dateTime.format(new Date(c.createdAt)))
      );
      return row;
    })
  );
  $("[data-history-empty]").hidden = data.history.length > 0;
}

function availableMonths() {
  const months = [];
  let [year, month] = data.start.split("-").map(Number);
  const latest = data.currentMonth > data.end ? data.end : data.currentMonth < data.start ? data.start : data.currentMonth;
  for (;;) {
    const key = `${year}-${String(month).padStart(2, "0")}`;
    months.push(key);
    if (key >= latest) break;
    month++;
    if (month > 12) {
      month = 1;
      year++;
    }
  }
  return months.reverse();
}

function renderSession() {
  const loginForm = $("[data-login]");
  const sessionBox = $("[data-session]");
  loginForm.hidden = Boolean(session);
  sessionBox.hidden = !session;

  const picker = $("[data-participant-select]");
  if (picker.options.length === 1) {
    for (const p of data.people) picker.append(el("option", { value: p.id }, p.name));
  }

  if (!session) return;

  $("[data-session-name]").textContent = nameOf(session.participantId);

  const monthSelect = $("[data-month-select]");
  const selected = monthSelect.value;
  monthSelect.replaceChildren(...availableMonths().map((m) => el("option", { value: m }, monthLong(m))));
  if (selected) monthSelect.value = selected;

  const mine = data.history.filter((c) => c.participantId === session.participantId);
  const list = $("[data-mine]");
  if (!mine.length) {
    list.replaceChildren(el("li", { class: "empty" }, "Você ainda não lançou nada."));
    return;
  }
  list.replaceChildren(
    ...mine.map((c) => {
      const item = el("li");
      const text = el("span", {}, `${monthLong(c.month)}: ${money(c.amountCents)}`);
      const edit = el("button", { type: "button", class: "link" }, "Editar");
      const remove = el("button", { type: "button", class: "link danger" }, "Remover");
      edit.addEventListener("click", () => startEdit(c));
      remove.addEventListener("click", () => removeEntry(c, remove));
      item.append(text, edit, remove);
      return item;
    })
  );
}

function render() {
  renderGroup();
  renderChart();
  renderPeople();
  renderHistory();
  renderSession();
}

async function call(payload) {
  const response = await fetch("/api/china", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...session, ...payload }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body.error || "Algo deu errado. Tente de novo.");
    error.status = response.status;
    throw error;
  }
  return body;
}

function showError(selector, message) {
  const box = $(selector);
  box.textContent = message ?? "";
  box.hidden = !message;
}

function handleAuthFailure(err) {
  if (err.status === 401 || err.status === 429) {
    session = null;
    renderSession();
    showError("[data-login-error]", err.message);
    return true;
  }
  return false;
}

function resetEntry() {
  const form = $("[data-entry]");
  form.reset();
  form.elements.id.value = "";
  $("[data-entry-submit]").textContent = "Lançar";
  $("[data-entry-cancel]").hidden = true;
  showError("[data-entry-error]", "");
}

function startEdit(contribution) {
  const form = $("[data-entry]");
  form.elements.id.value = contribution.id;
  form.elements.month.value = contribution.month;
  form.elements.amount.value = (contribution.amountCents / 100).toFixed(2).replace(".", ",");
  $("[data-entry-submit]").textContent = "Salvar alteração";
  $("[data-entry-cancel]").hidden = false;
  form.elements.amount.focus();
}

async function removeEntry(contribution, button) {
  if (button.dataset.confirm !== "1") {
    button.dataset.confirm = "1";
    button.textContent = "Confirmar remoção";
    return;
  }
  button.disabled = true;
  try {
    const result = await call({ action: "remove", id: contribution.id });
    data = result.state;
    render();
  } catch (err) {
    if (!handleAuthFailure(err)) showError("[data-entry-error]", err.message);
    button.disabled = false;
  }
}

async function onLogin(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const participantId = form.elements.participant.value;
  const pin = form.elements.pin.value.trim();
  showError("[data-login-error]", "");
  if (!participantId) return showError("[data-login-error]", "Escolha seu nome.");
  if (!/^\d{4}$/.test(pin)) return showError("[data-login-error]", "O PIN tem 4 dígitos.");

  const button = form.querySelector("button");
  button.disabled = true;
  session = { participantId, pin };
  try {
    const result = await call({ action: "verify" });
    form.elements.pin.value = "";
    const emailForm = $("[data-email]");
    emailForm.elements.email.value = result.email;
    emailForm.elements.receive.checked = result.email ? result.receive : true;
    $("[data-email-status]").textContent = result.email
      ? result.receive ? "Você está recebendo os e-mails." : "Os e-mails estão pausados."
      : "Nenhum e-mail cadastrado.";
    resetEntry();
    renderSession();
  } catch (err) {
    session = null;
    showError("[data-login-error]", err.message);
  } finally {
    button.disabled = false;
  }
}

async function onEntry(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const amountCents = parseAmount(form.elements.amount.value);
  showError("[data-entry-error]", "");
  if (!amountCents) return showError("[data-entry-error]", "Informe um valor como 450,00.");

  const id = form.elements.id.value;
  const button = $("[data-entry-submit]");
  button.disabled = true;
  try {
    const result = await call({
      action: id ? "update" : "add",
      ...(id ? { id } : {}),
      month: form.elements.month.value,
      amountCents,
    });
    data = result.state;
    resetEntry();
    render();
  } catch (err) {
    if (!handleAuthFailure(err)) showError("[data-entry-error]", err.message);
  } finally {
    button.disabled = false;
  }
}

async function onEmail(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const status = $("[data-email-status]");
  const button = form.querySelector("button");
  button.disabled = true;
  try {
    const result = await call({
      action: "email",
      email: form.elements.email.value,
      receive: form.elements.receive.checked,
    });
    status.textContent = !result.email
      ? "E-mail removido. Você não vai receber nada."
      : result.receive
        ? "Salvo. Você vai receber os e-mails."
        : "Salvo. Os e-mails estão pausados.";
  } catch (err) {
    if (!handleAuthFailure(err)) status.textContent = err.message;
  } finally {
    button.disabled = false;
  }
}

async function load() {
  const outcome = new URLSearchParams(location.search).get("email");
  if (outcome === "off") notice("Pronto. Você não vai mais receber os e-mails da viagem.");
  if (outcome === "invalid") notice("Esse link de descadastro não é válido. Entre com seu PIN para mudar o e-mail.");

  try {
    const response = await fetch("/api/china", { cache: "no-store" });
    if (!response.ok) throw new Error();
    data = await response.json();
    render();
  } catch {
    notice("Não consegui carregar os dados agora. Recarregue a página em instantes.");
  }
}

$("[data-login]").addEventListener("submit", onLogin);
$("[data-entry]").addEventListener("submit", onEntry);
$("[data-email]").addEventListener("submit", onEmail);
$("[data-entry-cancel]").addEventListener("click", resetEntry);
$("[data-chart-select]").addEventListener("change", renderChart);
$("[data-logout]").addEventListener("click", () => {
  session = null;
  resetEntry();
  renderSession();
});

load();
