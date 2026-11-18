/* Topic graph drawn on a canvas: a small force layout, pointer pull,
   optional "growth" by year, and click selection. No dependencies. */

export const THEME_VARS = {
  "evolving-knowledge": "--theme-evolving-knowledge",
  health: "--theme-health",
  "language-skills": "--theme-language-skills",
  systems: "--theme-systems",
};

/** Build topic nodes and co-occurrence edges from the publication list. */
export function topicGraph(pubs) {
  const topics = new Map();
  const pairs = new Map();
  for (const p of pubs) {
    for (const t of p.topics) {
      const n = topics.get(t) || { id: t, count: 0, first: 9999, themes: {} };
      n.count += 1;
      if (p.year) n.first = Math.min(n.first, p.year);
      for (const th of p.themes) n.themes[th] = (n.themes[th] || 0) + 1;
      topics.set(t, n);
    }
    const ts = [...p.topics].sort();
    for (let i = 0; i < ts.length; i++)
      for (let j = i + 1; j < ts.length; j++) {
        const k = ts[i] + "|" + ts[j];
        pairs.set(k, (pairs.get(k) || 0) + 1);
      }
  }
  const nodes = [...topics.values()].map((n) => ({
    ...n,
    theme: Object.entries(n.themes).sort((a, b) => b[1] - a[1])[0][0],
  }));
  const edges = [...pairs.entries()].map(([k, w]) => {
    const [a, b] = k.split("|");
    return { a, b, w };
  });
  return { nodes, edges };
}

const reduceMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export class KnowledgeGraph {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {{nodes: object[], edges: object[]}} data
   * @param {{bias?: number, grow?: {from: number, to: number, ms: number, onYear?: (y: number) => void},
   *          onSelect?: (id: string|null) => void, labels?: "all"|"large"}} opts
   */
  constructor(canvas, data, opts = {}) {
    this.c = canvas;
    this.ctx = canvas.getContext("2d");
    this.opts = opts;
    this.selected = null;
    this.hover = null;
    this.pointer = null;
    this.running = true;
    this.visible = true;
    const max = Math.max(...data.nodes.map((n) => n.count));
    this.nodes = data.nodes.map((n, i) => ({
      ...n,
      r: 5 + 17 * Math.sqrt(n.count / max),
      x: 0, y: 0, vx: 0, vy: 0,
      seed: i * 1.7,
      alpha: opts.grow ? 0 : 1,
    }));
    this.byId = new Map(this.nodes.map((n) => [n.id, n]));
    const maxW = Math.max(...data.edges.map((e) => e.w), 1);
    this.edges = data.edges
      .map((e) => ({ a: this.byId.get(e.a), b: this.byId.get(e.b), w: e.w / maxW }))
      .filter((e) => e.a && e.b);
    this.year = opts.grow ? opts.grow.from : Infinity;
    this.t0 = null; // the growth starts the first time the graph is on screen

    this.resize();
    this.place();
    new ResizeObserver(() => { this.resize(); this.draw(); }).observe(canvas);
    new IntersectionObserver(([e]) => { this.visible = e.isIntersecting; this.kick(); }).observe(canvas);
    document.addEventListener("visibilitychange", () => this.kick());
    this.bindPointer();

    if (reduceMotion()) {
      this.year = Infinity;
      this.nodes.forEach((n) => (n.alpha = 1));
      opts.grow?.onYear?.(opts.grow.to);
      for (let i = 0; i < 400; i++) this.step(false);
      this.running = false;
      this.draw();
    } else {
      this.kick();
    }
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const { width, height } = this.c.getBoundingClientRect();
    this.w = width; this.h = height;
    this.c.width = Math.round(width * dpr);
    this.c.height = Math.round(height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  centre() {
    const bias = this.w > 860 ? (this.opts.bias ?? 0.5) : 0.5;
    return { x: this.w * bias, y: this.h * 0.5 };
  }

  place() {
    const { x, y } = this.centre();
    // Golden-angle spiral: asymmetric, so the force layout does not settle into a ring.
    const R = Math.min(this.w, this.h) * 0.42;
    const N = this.nodes.length;
    this.nodes.forEach((n, i) => {
      const a = i * 2.39996;
      const r = R * Math.sqrt((i + 0.5) / N);
      n.x = x + Math.cos(a) * r * (this.w / Math.max(this.h, 1) > 1.4 ? 1.4 : 1);
      n.y = y + Math.sin(a) * r;
    });
  }

  bindPointer() {
    const pos = (e) => {
      const r = this.c.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const target = this.opts.pointerTarget || this.c;
    target.addEventListener("pointermove", (e) => {
      this.pointer = pos(e);
      const n = this.hit(this.pointer);
      if (n !== this.hover) { this.hover = n; this.c.style.cursor = n && this.opts.onSelect ? "pointer" : ""; }
      this.kick();
    });
    target.addEventListener("pointerleave", () => { this.pointer = null; this.hover = null; this.kick(); });
    if (this.opts.onSelect)
      this.c.addEventListener("click", (e) => {
        const n = this.hit(pos(e));
        this.select(n && n.id !== this.selected ? n.id : null);
        this.opts.onSelect(this.selected);
      });
  }

  hit(p) {
    if (!p) return null;
    let best = null, bd = Infinity;
    for (const n of this.nodes) {
      if (n.alpha < 0.5) continue;
      const d = Math.hypot(n.x - p.x, n.y - p.y);
      if (d < n.r + 10 && d < bd) { best = n; bd = d; }
    }
    return best;
  }

  select(id) { this.selected = id; this.kick(); }

  pause(p) { this.paused = p; this.kick(); }

  kick() {
    if (this.raf) return;
    const still = reduceMotion() || this.paused;
    if (still) { this.draw(); return; }
    if (!this.visible || document.hidden) return;
    const loop = () => {
      this.raf = null;
      if (this.paused || !this.visible || document.hidden) return;
      const energy = this.tick();
      if (!this.opts.drift && this.year === Infinity && energy < 0.01) { this.draw(); return; }
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  tick() {
    const g = this.opts.grow;
    if (g && this.year !== Infinity) {
      this.t0 ??= performance.now();
      const k = Math.min(1, (performance.now() - this.t0) / g.ms);
      const y = Math.round(g.from + (g.to - g.from) * (1 - Math.pow(1 - k, 2)));
      if (y !== this.year) { this.year = y; g.onYear?.(y); }
      if (k >= 1) this.year = Infinity;
    }
    for (const n of this.nodes) {
      const on = n.first <= this.year;
      n.alpha += ((on ? 1 : 0) - n.alpha) * 0.08;
    }
    const energy = this.step(Boolean(this.opts.drift));
    this.draw();
    return energy;
  }

  step(drift) {
    const { x: cx, y: cy } = this.centre();
    const spread = Math.min(this.w, this.h);
    const live = this.nodes.filter((n) => n.alpha > 0.02 || this.year === Infinity);
    for (let i = 0; i < live.length; i++) {
      const a = live[i];
      for (let j = i + 1; j < live.length; j++) {
        const b = live[j];
        let dx = a.x - b.x, dy = a.y - b.y;
        const d2 = Math.max(dx * dx + dy * dy, 40);
        const f = (spread * 12) / d2;
        const d = Math.sqrt(d2);
        dx /= d; dy /= d;
        a.vx += dx * f; a.vy += dy * f;
        b.vx -= dx * f; b.vy -= dy * f;
      }
    }
    const rest = spread * 0.26;
    for (const e of this.edges) {
      if (e.a.alpha < 0.02 || e.b.alpha < 0.02) continue;
      const dx = e.b.x - e.a.x, dy = e.b.y - e.a.y;
      const d = Math.hypot(dx, dy) || 1;
      const f = (d - rest) * 0.0025 * (0.4 + e.w);
      e.a.vx += (dx / d) * f; e.a.vy += (dy / d) * f;
      e.b.vx -= (dx / d) * f; e.b.vy -= (dy / d) * f;
    }
    const t = performance.now() / 1000;
    let energy = 0;
    for (const n of live) {
      n.vx += (cx - n.x) * 0.0016;
      n.vy += (cy - n.y) * 0.0022;
      if (drift) {
        n.vx += Math.sin(t * 0.3 + n.seed) * 0.03;
        n.vy += Math.cos(t * 0.25 + n.seed * 1.3) * 0.03;
        if (this.pointer) {
          const dx = this.pointer.x - n.x, dy = this.pointer.y - n.y;
          const d = Math.hypot(dx, dy);
          if (d < 170 && d > n.r) { n.vx += (dx / d) * 0.12 * (1 - d / 170); n.vy += (dy / d) * 0.12 * (1 - d / 170); }
        }
      }
      n.vx *= 0.86; n.vy *= 0.86;
      energy += n.vx * n.vx + n.vy * n.vy;
      n.x += n.vx; n.y += n.vy;
      n.x = Math.max(n.r + 4, Math.min(this.w - n.r - 4, n.x));
      n.y = Math.max(n.r + 4, Math.min(this.h - n.r - 4, n.y));
    }
    return energy;
  }

  near(n) {
    if (!this.pointer) return false;
    return Math.hypot(this.pointer.x - n.x, this.pointer.y - n.y) < 150;
  }

  draw() {
    const ctx = this.ctx;
    const css = getComputedStyle(document.documentElement);
    const v = (name) => css.getPropertyValue(name).trim();
    const line = v("--line"), text = v("--text"), warm = v("--warm"), bg = v(this.opts.bg || "--paper");
    ctx.clearRect(0, 0, this.w, this.h);
    const focus = this.hover || (this.selected && this.byId.get(this.selected));
    const linked = new Set();
    if (focus) for (const e of this.edges) { if (e.a === focus) linked.add(e.b); if (e.b === focus) linked.add(e.a); }

    for (const e of this.edges) {
      const al = Math.min(e.a.alpha, e.b.alpha);
      if (al < 0.02) continue;
      const lit = focus ? e.a === focus || e.b === focus : this.near(e.a) || this.near(e.b);
      ctx.globalAlpha = al * (lit ? 0.95 : focus ? 0.25 : 0.7);
      ctx.strokeStyle = lit ? warm : line;
      ctx.lineWidth = lit ? 1 + e.w * 2.5 : 1 + e.w * 1.5;
      ctx.beginPath(); ctx.moveTo(e.a.x, e.a.y); ctx.lineTo(e.b.x, e.b.y); ctx.stroke();
    }
    ctx.textBaseline = "middle";
    ctx.font = `500 13px ${v("--sans")}`;
    for (const n of this.nodes) {
      if (n.alpha < 0.02) continue;
      const colour = v(THEME_VARS[n.theme] || "--accent");
      const dim = focus && n !== focus && !linked.has(n);
      ctx.globalAlpha = n.alpha * (dim ? 0.3 : 1);
      ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
      ctx.fillStyle = colour; ctx.fill();
      if (n === focus || n.id === this.selected) {
        ctx.lineWidth = 3; ctx.strokeStyle = warm;
        ctx.beginPath(); ctx.arc(n.x, n.y, n.r + 4, 0, Math.PI * 2); ctx.stroke();
      }
      if ((this.opts.labels !== "large" && this.w >= 520) || n.r > 11 || n === focus || linked.has(n)) {
        const label = n.id;
        const lx = n.x + n.r + 6;
        const tw = ctx.measureText(label).width;
        const x = lx + tw > this.w - 4 ? n.x - n.r - 6 - tw : lx;
        ctx.lineJoin = "round"; ctx.lineWidth = 4; ctx.strokeStyle = bg;
        ctx.strokeText(label, x, n.y);
        ctx.fillStyle = text; ctx.fillText(label, x, n.y);
      }
    }
    ctx.globalAlpha = 1;
  }
}
