/* Shared behaviour: theme toggle, mobile menu, copy-email, reveal fallback, footer year. */

document.documentElement.classList.add("js");

const root = document.documentElement;
const themeBtn = document.querySelector("[data-theme-toggle]");
const systemDark = () => window.matchMedia("(prefers-color-scheme: dark)").matches;
const currentTheme = () => root.dataset.theme || (systemDark() ? "dark" : "light");

function paintThemeButton() {
  if (!themeBtn) return;
  const dark = currentTheme() === "dark";
  themeBtn.setAttribute("aria-label", dark ? "Switch to light theme" : "Switch to dark theme");
  themeBtn.querySelector(".sun").toggleAttribute("hidden", !dark);
  themeBtn.querySelector(".moon").toggleAttribute("hidden", dark);
}
let pendingTheme = null; // a second quick click must see the theme the first one asked for
let themeClicks = 0;
themeBtn?.addEventListener("click", () => {
  const next = (pendingTheme ?? currentTheme()) === "dark" ? "light" : "dark";
  pendingTheme = next;
  const click = ++themeClicks;
  transition(() => {
    if (click !== themeClicks) return; // a later click's transition takes over
    root.dataset.theme = next;
    pendingTheme = null;
    localStorage.setItem("theme", next);
    paintThemeButton();
    window.dispatchEvent(new Event("themechange"));
  });
});
paintThemeButton();

const menuBtn = document.querySelector("[data-menu-toggle]");
const nav = document.getElementById("site-nav");
menuBtn?.addEventListener("click", () => {
  const open = menuBtn.getAttribute("aria-expanded") !== "true";
  menuBtn.setAttribute("aria-expanded", String(open));
  nav.dataset.open = String(open);
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && nav?.dataset.open === "true") {
    nav.dataset.open = "false";
    menuBtn.setAttribute("aria-expanded", "false");
    menuBtn.focus();
  }
});

for (const btn of document.querySelectorAll("[data-copy]")) {
  const msg = btn.parentElement.querySelector(".copied-msg");
  btn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(btn.dataset.copy);
      msg.textContent = "Email copied";
    } catch {
      msg.textContent = "Copy failed: select the address";
    }
    setTimeout(() => (msg.textContent = ""), 2500);
  });
}

for (const el of document.querySelectorAll("[data-year-now]")) el.textContent = new Date().getFullYear();

if (!CSS.supports("animation-timeline: view()") && "IntersectionObserver" in window) {
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
  }, { rootMargin: "0px 0px -8% 0px" });
  document.querySelectorAll(".reveal").forEach((el) => io.observe(el));
}

/* Shared helpers for the page scripts */
export const THEME_NAMES = {
  "evolving-knowledge": "Evolving knowledge",
  health: "Health",
  "language-skills": "Language and skills",
  systems: "Systems and control",
};

export async function loadJSON(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return res.json();
}

export function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
}

const ME = /silveira$/i; // every spelling of his name, from the .bib and from Scholar

export function pubItem(p, { showYear = true, repeatYear = false } = {}) {
  const cites = p.cites
    ? `<a class="cites" href="${esc(p.scholar)}">Cited by ${p.cites}</a>`
    : "";
  const pdf = p.pdf ? `<a class="cites" href="${esc(p.pdf)}">PDF</a>` : "";
  const href = p.doi ? `https://doi.org/${p.doi}` : p.url;
  const title = href ? `<a href="${esc(href)}">${esc(p.title)}</a>` : esc(p.title);
  const authors = p.authors
    .map((a) => (ME.test(a.trim()) ? `<strong>${esc(a)}</strong>` : esc(a)))
    .join(", ");
  return `<li class="pub" data-id="${esc(p.id)}">
    ${showYear ? `<span class="year${repeatYear ? " repeat" : ""}">${p.year}</span>` : ""}
    <div>
      <h3>${title}</h3>
      <p class="authors">${authors}</p>
      <p class="venue"><span class="tag">${esc(p.type)}</span>${p.venue ? `<em>${esc(p.venue)}</em>` : ""}${pdf}${cites}</p>
    </div>
  </li>`;
}

/** Run a DOM update inside a view transition when supported and motion is allowed. */
export function transition(update) {
  if (!document.startViewTransition || matchMedia("(prefers-reduced-motion: reduce)").matches) return update();
  const vt = document.startViewTransition(update);
  vt.ready.catch(() => {});
  vt.finished.catch(() => {});
}
