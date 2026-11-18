/* Home page: the growing topic graph in the hero, latest publications, selected projects. */
import { KnowledgeGraph, topicGraph } from "./graph.js";
import { loadJSON, pubItem } from "./site.js";
import { projectItem } from "./research.js";

const pubs = await loadJSON("data/publications.json");

const canvas = document.getElementById("hero-graph");
const yearEl = document.getElementById("graph-year");
const pauseBtn = document.getElementById("graph-pause");
const data = topicGraph(pubs);
const first = Math.min(...data.nodes.map((n) => n.first));
const graph = new KnowledgeGraph(canvas, data, {
  bias: 0.5,
  drift: true,
  labels: "all",
  pointerTarget: canvas.closest(".hero"),
  grow: { from: first, to: new Date().getFullYear(), ms: 4200, onYear: (y) => (yearEl.textContent = y) },
});
window.addEventListener("themechange", () => graph.draw());
pauseBtn.addEventListener("click", () => {
  const paused = pauseBtn.getAttribute("aria-pressed") !== "true";
  pauseBtn.setAttribute("aria-pressed", String(paused));
  pauseBtn.setAttribute("aria-label", paused ? "Play the graph animation" : "Pause the graph animation");
  pauseBtn.querySelector(".pause").toggleAttribute("hidden", paused);
  pauseBtn.querySelector(".play").toggleAttribute("hidden", !paused);
  graph.pause(paused);
});
if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) pauseBtn.hidden = true;
document.getElementById("pub-total").textContent = pubs.length;

document.getElementById("latest-pubs").innerHTML = pubs.slice(0, 3).map((p) => pubItem(p)).join("");

const projects = await loadJSON("data/projects.json");
const picks = ["dynaccurate", "moka", "ds4skills"];
document.getElementById("selected-projects").innerHTML = picks
  .map((id) => projectItem(projects.find((p) => p.id === id), { details: false }))
  .join("");
