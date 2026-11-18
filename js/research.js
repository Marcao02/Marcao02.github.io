/* Research page: project rows filtered by theme. Also exports the row template. */
import { THEME_NAMES, esc, loadJSON, transition } from "./site.js";

export function projectItem(p, { details = true, link = true } = {}) {
  const logo = p.logo
    ? `<img src="${esc(p.logo)}" alt="${esc(p.name)} logo" loading="lazy" width="112" height="84">`
    : `<span class="mono" aria-hidden="true">${esc(p.name)}</span>`;
  const years = p.start === p.end ? p.start : `${p.start}–${p.end}`;
  const name = link ? `<a href="research.html#${esc(p.id)}">${esc(p.name)}</a>` : esc(p.name);
  const site = p.url ? ` <a href="${esc(p.url)}">Project website</a>` : "";
  const themes = p.themes
    .map((t) => `<span class="tag" style="--c: var(--theme-${t})">${THEME_NAMES[t]}</span>`)
    .join("");
  return `<li class="project reveal" id="${esc(p.id)}" data-themes="${p.themes.join(" ")}">
    <div class="logo-box">${logo}</div>
    <div>
      <h3>${details ? esc(p.name) : name}</h3>
      <p class="subtitle">${esc(p.title)}</p>
      <p class="meta">${years}, ${esc(p.partners)}</p>
      <p class="summary">${esc(p.summary)}${details ? "" : site}</p>
      ${details ? `<p>${themes}</p><details><summary>More about ${esc(p.name)}</summary><p>${esc(p.details)}${site}</p></details>` : ""}
    </div>
  </li>`;
}

const list = document.getElementById("project-list");
if (list) {
  const projects = await loadJSON("data/projects.json");
  list.innerHTML = projects.map((p) => projectItem(p, { link: false })).join("");
  const status = document.getElementById("project-count");
  const chips = [...document.querySelectorAll("[data-theme-filter]")];
  const counts = Object.fromEntries(chips.map((c) => [c.dataset.themeFilter, 0]));
  for (const p of projects) for (const t of p.themes) counts[t] = (counts[t] || 0) + 1;
  counts.all = projects.length;
  for (const c of chips) c.querySelector(".count").textContent = counts[c.dataset.themeFilter];

  const apply = (theme) => {
    let n = 0;
    for (const li of list.children) {
      const show = theme === "all" || li.dataset.themes.split(" ").includes(theme);
      li.hidden = !show;
      n += show;
    }
    status.textContent = `${n} of ${projects.length} projects`;
  };
  for (const c of chips)
    c.addEventListener("click", () => {
      chips.forEach((o) => o.setAttribute("aria-pressed", String(o === c)));
      transition(() => apply(c.dataset.themeFilter));
    });
  apply("all");
  if (location.hash) document.querySelector(location.hash)?.scrollIntoView();
}
