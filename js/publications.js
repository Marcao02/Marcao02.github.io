/* Publications page: search, filters by year, type, theme and topic, and the topic graph. */
import { KnowledgeGraph, topicGraph } from "./graph.js";
import { THEME_NAMES, esc, loadJSON, pubItem, transition } from "./site.js";

const pubs = await loadJSON("data/publications.json");
const list = document.getElementById("pub-list");
const status = document.getElementById("pub-count");
const search = document.getElementById("pub-search");
const yearSel = document.getElementById("pub-year");
const typeRow = document.getElementById("type-filters");
const themeRow = document.getElementById("theme-filters");
const topicRow = document.getElementById("topic-filters");
const sortSel = document.getElementById("pub-sort");
const state = { q: "", year: "all", type: "all", theme: "all", topic: null, sort: "new" };

const count = (key) => pubs.reduce((m, p) => {
  for (const v of [].concat(p[key])) m[v] = (m[v] || 0) + 1;
  return m;
}, {});
const chip = (group, value, label, n, colour) =>
  `<button type="button" class="chip" data-${group}="${esc(value)}" aria-pressed="${value === "all"}">` +
  (colour ? `<span class="dot" style="--c: var(--theme-${colour})"></span>` : "") +
  `${esc(label)} <span class="count">${n}</span></button>`;

const types = count("type");
typeRow.insertAdjacentHTML("beforeend", chip("type", "all", "All", pubs.length) +
  Object.entries(types).sort((a, b) => b[1] - a[1]).map(([t, n]) => chip("type", t, t, n)).join(""));
const themes = count("themes");
themeRow.insertAdjacentHTML("beforeend", chip("theme", "all", "All", pubs.length) +
  Object.keys(THEME_NAMES).map((t) => chip("theme", t, THEME_NAMES[t], themes[t] || 0, t)).join(""));
const topics = count("topics");
topicRow.insertAdjacentHTML("beforeend",
  Object.entries(topics).sort((a, b) => b[1] - a[1]).map(([t, n]) => chip("topic", t, t, n)).join(""));
for (const b of topicRow.querySelectorAll("button")) b.setAttribute("aria-pressed", "false");

const years = [...new Set(pubs.map((p) => p.year))].sort((a, b) => b - a);
const decades = [...new Set(years.map((y) => Math.floor(y / 10) * 10))];
yearSel.innerHTML = `<option value="all">All years</option>` +
  years.slice(0, 5).map((y) => `<option value="${y}">${y}</option>`).join("") +
  decades.map((d) => `<option value="d${d}">${d}s</option>`).join("");

const norm = (s) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
const hay = new Map(pubs.map((p) => [p.id, norm(`${p.title} ${p.authors.join(" ")} ${p.venue} ${p.year}`)]));

function matches(p) {
  if (state.type !== "all" && p.type !== state.type) return false;
  if (state.theme !== "all" && !p.themes.includes(state.theme)) return false;
  if (state.topic && !p.topics.includes(state.topic)) return false;
  if (state.year !== "all") {
    if (state.year.startsWith("d")) { if (Math.floor(p.year / 10) * 10 !== +state.year.slice(1)) return false; }
    else if (p.year !== +state.year) return false;
  }
  if (state.q) return norm(state.q).split(/\s+/).every((w) => hay.get(p.id).includes(w));
  return true;
}

function render() {
  const shown = pubs.filter(matches);
  if (state.sort === "cites") shown.sort((a, b) => (b.cites || 0) - (a.cites || 0) || b.year - a.year);
  let last = null;
  list.innerHTML = shown.length
    ? shown.map((p) => { const html = pubItem(p, { repeatYear: state.sort === "new" && p.year === last }); last = p.year; return html; }).join("")
    : `<li class="empty"><p>No publication matches these filters. <button type="button" class="btn secondary" id="reset">Clear all filters</button></p></li>`;
  status.textContent = shown.length === pubs.length
    ? `${pubs.length} publications`
    : `${shown.length} of ${pubs.length} publications`;
  document.getElementById("reset")?.addEventListener("click", reset);
}

function update(fn) {
  fn();
  transition(render);
}

function press(row, attr, value) {
  for (const b of row.querySelectorAll("button")) b.setAttribute("aria-pressed", String(b.dataset[attr] === value));
}

function setTopic(t) {
  state.topic = t;
  press(topicRow, "topic", t);
  graph.select(t);
}

function reset() {
  update(() => {
    Object.assign(state, { q: "", year: "all", type: "all", theme: "all", sort: "new" });
    search.value = ""; yearSel.value = "all"; sortSel.value = "new";
    press(typeRow, "type", "all"); press(themeRow, "theme", "all");
    setTopic(null);
  });
}

let timer;
search.addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(() => update(() => (state.q = search.value.trim())), 150); });
yearSel.addEventListener("change", () => update(() => (state.year = yearSel.value)));
sortSel.addEventListener("change", () => update(() => (state.sort = sortSel.value)));
typeRow.addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) update(() => { state.type = b.dataset.type; press(typeRow, "type", state.type); }); });
themeRow.addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) update(() => { state.theme = b.dataset.theme; press(themeRow, "theme", state.theme); }); });
topicRow.addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (b) update(() => setTopic(state.topic === b.dataset.topic ? null : b.dataset.topic));
});

const graph = new KnowledgeGraph(document.getElementById("topic-graph"), topicGraph(pubs), {
  labels: "all",
  bg: "--surface",
  onSelect: (id) => update(() => setTopic(id)),
});
window.addEventListener("themechange", () => graph.draw());

const total = pubs.reduce((n, p) => n + (p.cites || 0), 0);
document.getElementById("cite-total").textContent = total.toLocaleString("en");
render();
