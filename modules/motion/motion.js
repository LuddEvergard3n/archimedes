/**
 * modules/motion/motion.js — Motion simulation module
 *
 * Simulations:
 *   mru        — Uniform rectilinear motion (constant velocity)
 *   mruv       — Uniformly accelerated rectilinear motion
 *   free-fall  — Free fall under gravity
 *
 * Each simulation is self-contained in a SimulationBase subclass.
 * The exported `createMotionSimulation(id)` factory returns the right one.
 */

import { Physics } from '../../js/wasm-loader.js';
import {
  clearCanvas, drawGrid, drawArrow, drawCircle,
  drawSurface, drawTrail, drawLabel, drawReadout, COLORS
} from '../../engine/renderer.js';
import { ChartEngine, DualChartEngine } from '../../engine/chart-engine.js';

/* ─────────────────────────────────────────────────────────────────────────── *
 * Base class for all simulations
 * ─────────────────────────────────────────────────────────────────────────── */

class SimulationBase {
  /** @param {HTMLCanvasElement} canvas */
  constructor(canvas) {
    this.canvas   = canvas;
    this.ctx      = canvas.getContext('2d');
    this.running  = false;
    this.time     = 0;
    this._raf     = null;
    this._lastTs  = null;
    this.params   = {};
    this._onTime  = null; /* callback: (t) => void */
  }

  /** Start/resume simulation. */
  start() {
    if (this.running) return;
    this.running = true;
    this._lastTs = null;
    this._loop();
  }

  /** Pause simulation. */
  pause() {
    this.running = false;
    if (this._raf) { cancelAnimationFrame(this._raf); this._raf = null; }
  }

  /** Reset simulation to initial state. */
  reset() {
    this.pause();
    this.time = 0;
    this._onReset();
    this._render();
  }

  /**
   * Set a simulation parameter.
   * @param {string} key
   * @param {*} value
   */
  setParam(key, value) {
    this.params[key] = value;
    this._onParamChange(key, value);
    if (!this.running) this._render();
  }

  /** Register a time callback for UI updates. */
  onTimeUpdate(fn) { this._onTime = fn; }

  /** Subclasses override these. */
  _onReset() {}
  _onParamChange(key, value) { void key; void value; }
  _update(dt) {}
  _render() {}

  dispose() { this.pause(); }

  /** Main RAF loop with capped delta time. */
  _loop() {
    if (!this.running) return;
    this._raf = requestAnimationFrame(ts => {
      if (this._lastTs !== null) {
        const dt = Math.min((ts - this._lastTs) / 1000, 0.033); /* cap at ~30fps equiv */
        this._update(dt);
        this._render();
        if (this._onTime) this._onTime(this.time);
      }
      this._lastTs = ts;
      this._loop();
    });
  }
}

/* ─────────────────────────────────────────────────────────────────────────── *
 * MRU — Uniform Rectilinear Motion
 * ─────────────────────────────────────────────────────────────────────────── */

class MRUSimulation extends SimulationBase {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {HTMLCanvasElement} chartCanvas
   */
  constructor(canvas, chartCanvas) {
    super(canvas);

    /* Physics state */
    this.x  = 0;   /* m — position */
    this.v0 = 5;   /* m/s — velocity (constant in MRU) */
    this.x0 = 0;   /* m — initial position */

    /* World scale: 100m maps to canvas width */
    this.worldW  = 100; /* m */
    this.trailMax = 60;
    this.trail    = [];

    /* Compare mode: second body */
    this.compareMode = false;
    this.x2  = 0;
    this.v02 = 2;
    this.trail2 = [];

    this.params = { v0: 5, x0: 0, v02: 2, compare: false };

    /* Graph */
    this.chart = chartCanvas
      ? new DualChartEngine(
          chartCanvas,
          { label: 'posição (m)', xUnit: 't (s)', yUnit: 'x (m)', color: '#4472b0' },
          { label: 'velocidade (m/s)', xUnit: 't (s)', yUnit: 'v (m/s)', color: '#3d7a55' }
        )
      : null;
  }

  _onReset() {
    this.x  = this.x0 = this.params.x0 ?? 0;
    this.v0 = this.params.v0 ?? 5;
    this.x2 = this.x0;
    this.v02 = this.params.v02 ?? 2;
    this.trail  = [];
    this.trail2 = [];
    if (this.chart) this.chart.clear();
  }

  _onParamChange(key, value) {
    if (key === 'v0')      { this.v0  = value; this.x  = this.x0; this.trail  = []; }
    if (key === 'x0')      { this.x0  = value; this.x  = value;   this.trail  = []; }
    if (key === 'v02')     { this.v02 = value; this.x2 = this.x0; this.trail2 = []; }
    if (key === 'compare') { this.compareMode = value; }
    if (this.chart) this.chart.clear();
    this.time = 0;
  }

  _update(dt) {
    const result = Physics.motion_step(this.x, this.v0, 0, dt);
    this.x = result.x;
    this.time += dt;

    /* Wrap around at world edges */
    if (this.x > this.worldW)  this.x -= this.worldW;
    if (this.x < 0)            this.x += this.worldW;

    /* Trail */
    const { cx: px } = this._worldToCanvas(this.x);
    const cy = this.canvas.height / 2;
    this.trail.push({ x: px, y: cy });
    if (this.trail.length > this.trailMax) this.trail.shift();

    if (this.compareMode) {
      const r2 = Physics.motion_step(this.x2, this.v02, 0, dt);
      this.x2 = r2.x;
      if (this.x2 > this.worldW) this.x2 -= this.worldW;
      if (this.x2 < 0)           this.x2 += this.worldW;
      const { cx: px2 } = this._worldToCanvas(this.x2);
      this.trail2.push({ x: px2, y: cy + 30 });
      if (this.trail2.length > this.trailMax) this.trail2.shift();
    }

    /* Charts: add every 3rd frame to avoid too many points */
    if (this.chart && (Math.round(this.time * 60) % 3 === 0)) {
      this.chart.addPoint(0, this.time, this.x - this.x0 + this.params.x0);
      this.chart.addPoint(1, this.time, this.v0);
    }
  }

  _worldToCanvas(x) {
    const cw = this.canvas.width;
    const cx = (x / this.worldW) * cw;
    return { cx };
  }

  _render() {
    const ctx = this.ctx;
    const cw  = this.canvas.width;
    const ch  = this.canvas.height;
    const cy  = ch / 2;

    clearCanvas(ctx);
    drawGrid(ctx, 30);

    /* Track */
    drawSurface(ctx, 20, cw - 20, cy + 22);

    /* Distance markers */
    ctx.save();
    ctx.font      = '9px "Share Tech Mono", monospace';
    ctx.fillStyle = COLORS.textMuted;
    ctx.textAlign = 'center';
    for (let m = 0; m <= this.worldW; m += 20) {
      const px = (m / this.worldW) * (cw - 40) + 20;
      ctx.fillText(`${m}m`, px, cy + 38);
    }
    ctx.restore();

    /* Trail */
    drawTrail(ctx, this.trail, COLORS.cyan);
    if (this.compareMode) drawTrail(ctx, this.trail2, COLORS.amber);

    /* Body 1 */
    const { cx: bx } = this._worldToCanvas(this.x);
    drawCircle(ctx, bx, cy, 16);

    /* Velocity arrow */
    const arrowLen = (this.v0 / 20) * 80;
    drawArrow(ctx, bx, cy, arrowLen, 0, COLORS.cyan, `v=${this.v0.toFixed(1)} m/s`);

    /* Body 2 (compare mode) */
    if (this.compareMode) {
      const { cx: bx2 } = this._worldToCanvas(this.x2);
      drawCircle(ctx, bx2, cy + 30, 14, '#2a1a00', COLORS.amber);
      const arrowLen2 = (this.v02 / 20) * 80;
      drawArrow(ctx, bx2, cy + 30, arrowLen2, 0, COLORS.amber, `v=${this.v02.toFixed(1)} m/s`);
    }

    /* HUD */
    drawReadout(ctx, 'x', this.x, 'm', 14, 20, COLORS.cyan);
    drawReadout(ctx, 't', this.time, 's', 14, 34, COLORS.textMuted);
    drawReadout(ctx, 'v', this.v0, 'm/s', 14, 48, COLORS.green);

    /* Chart */
    if (this.chart) this.chart.render();
  }
}

/* ─────────────────────────────────────────────────────────────────────────── *
 * MRUV — Uniformly Accelerated Motion
 * ─────────────────────────────────────────────────────────────────────────── */

class MRUVSimulation extends SimulationBase {
  constructor(canvas, chartCanvas) {
    super(canvas);

    this.x  = 0;
    this.v  = 0;
    this.x0 = 0;
    this.v0 = 0;
    this.a  = 3;

    this.worldW = 100;
    this.trail  = [];

    this.params = { v0: 0, a: 3, x0: 0 };

    this.chart = chartCanvas
      ? new DualChartEngine(
          chartCanvas,
          { label: 'posição (m)', xUnit: 't (s)', yUnit: 'x (m)', color: '#4472b0' },
          { label: 'velocidade (m/s)', xUnit: 't (s)', yUnit: 'v (m/s)', color: '#c07828' }
        )
      : null;
  }

  _onReset() {
    this.x  = this.x0 = this.params.x0 ?? 0;
    this.v  = this.v0 = this.params.v0 ?? 0;
    this.a  = this.params.a ?? 3;
    this.trail = [];
    if (this.chart) this.chart.clear();
  }

  _onParamChange(key, value) {
    if (key === 'v0') { this.v0 = value; this.v = value; }
    if (key === 'a')  { this.a  = value; }
    if (key === 'x0') { this.x0 = value; this.x = value; }
    this.trail = [];
    if (this.chart) this.chart.clear();
    this.time  = 0;
  }

  _update(dt) {
    const result = Physics.motion_step(this.x, this.v, this.a, dt);
    this.x = result.x;
    this.v = result.v;
    this.time += dt;

    /* Stop at edges */
    if (this.x >= this.worldW) { this.x = this.worldW; this.v = 0; this.pause(); }
    if (this.x <= 0 && this.v < 0) { this.x = 0; this.v = 0; this.pause(); }

    const cx = (this.x / this.worldW) * this.canvas.width;
    const cy = this.canvas.height / 2;
    this.trail.push({ x: cx, y: cy });
    if (this.trail.length > 80) this.trail.shift();

    if (this.chart && (Math.round(this.time * 60) % 3 === 0)) {
      this.chart.addPoint(0, this.time, this.x);
      this.chart.addPoint(1, this.time, this.v);
    }
  }

  _render() {
    const ctx = this.ctx;
    const cw  = this.canvas.width;
    const ch  = this.canvas.height;
    const cy  = ch / 2;

    clearCanvas(ctx);
    drawGrid(ctx, 30);
    drawSurface(ctx, 20, cw - 20, cy + 22);

    /* Markers */
    ctx.save();
    ctx.font = '9px "Share Tech Mono", monospace';
    ctx.fillStyle = COLORS.textMuted;
    ctx.textAlign = 'center';
    for (let m = 0; m <= this.worldW; m += 20) {
      const px = (m / this.worldW) * (cw - 40) + 20;
      ctx.fillText(`${m}m`, px, cy + 38);
    }
    ctx.restore();

    drawTrail(ctx, this.trail, COLORS.cyan);

    const bx = (this.x / this.worldW) * cw;
    drawCircle(ctx, bx, cy, 16);

    /* Velocity arrow */
    if (Math.abs(this.v) > 0.1) {
      const scale = 60 / 20;
      drawArrow(ctx, bx, cy, this.v * scale, 0, COLORS.cyan, `v`);
    }
    /* Acceleration arrow */
    if (Math.abs(this.a) > 0.01) {
      const scale = 40 / 10;
      drawArrow(ctx, bx, cy + 10, this.a * scale, 0, COLORS.amber, `a`);
    }

    drawReadout(ctx, 'x', this.x, 'm',   14, 20, COLORS.cyan);
    drawReadout(ctx, 'v', this.v, 'm/s', 14, 34, COLORS.green);
    drawReadout(ctx, 'a', this.a, 'm/s²',14, 48, COLORS.amber);
    drawReadout(ctx, 't', this.time, 's', 14, 62, COLORS.textMuted);

    if (this.chart) this.chart.render();
  }
}

/* ─────────────────────────────────────────────────────────────────────────── *
 * Free Fall
 * ─────────────────────────────────────────────────────────────────────────── */

class FreeFallSimulation extends SimulationBase {
  constructor(canvas, chartCanvas) {
    super(canvas);

    this.g       = 9.8;
    this.h0      = 50;   /* m — initial height */
    this.h       = 50;   /* m — current height */
    this.v       = 0;    /* m/s — velocity (downward positive) */
    this.trail   = [];

    /* Compare: two objects with different masses (same g!) */
    this.showCompare = false;
    this.h2 = 50;
    this.v2 = 0;
    this.trail2 = [];

    this.params = { h0: 50, showCompare: false };

    this.chart = chartCanvas
      ? new ChartEngine(chartCanvas, {
          label: 'h vs t',
          xUnit: 't (s)', yUnit: 'h (m)',
          color: '#7a4a96',
          fillArea: true,
        })
      : null;
  }

  _onReset() {
    this.h0 = this.params.h0 ?? 50;
    this.h  = this.h0;
    this.h2 = this.h0;
    this.v  = 0;
    this.v2 = 0;
    this.trail  = [];
    this.trail2 = [];
    if (this.chart) this.chart.clear();
  }

  _onParamChange(key, value) {
    if (key === 'h0') {
      this.h0 = value;
      this.h  = value;
      this.h2 = value;
    }
    if (key === 'showCompare') this.showCompare = value;
    this.trail  = [];
    this.trail2 = [];
    if (this.chart) this.chart.clear();
    this.time = 0;
    this.v = 0;
    this.v2 = 0;
  }

  _update(dt) {
    /* Semi-implicit Euler for free fall: a = -g downward, h decreases */
    this.v = this.v + this.g * dt;
    this.h = this.h - this.v * dt;
    this.time += dt;

    if (this.h <= 0) { this.h = 0; this.v = 0; this.pause(); }

    /* Canvas mapping: h=0 at bottom */
    const ch   = this.canvas.height;
    const cw   = this.canvas.width;
    const bodyX = cw * 0.35;
    const bodyY = this._hToY(this.h);
    this.trail.push({ x: bodyX, y: bodyY });
    if (this.trail.length > 80) this.trail.shift();

    if (this.showCompare) {
      this.v2 = this.v2 + this.g * dt;
      this.h2 = this.h2 - this.v2 * dt;
      if (this.h2 <= 0) this.h2 = 0;
      const bodyX2 = cw * 0.65;
      const bodyY2 = this._hToY(this.h2);
      this.trail2.push({ x: bodyX2, y: bodyY2 });
      if (this.trail2.length > 80) this.trail2.shift();
    }

    if (this.chart && (Math.round(this.time * 60) % 3 === 0)) {
      this.chart.addPoint(this.time, this.h);
    }
  }

  _hToY(h) {
    const ch = this.canvas.height;
    const margin = 40;
    /* Map h0 → top margin, h=0 → bottom margin */
    return margin + (1 - h / this.h0) * (ch - margin * 2 - 20);
  }

  _render() {
    const ctx = this.ctx;
    const cw  = this.canvas.width;
    const ch  = this.canvas.height;

    clearCanvas(ctx);
    drawGrid(ctx, 30);

    /* Ground line */
    const groundY = this._hToY(0) + 20;
    ctx.save();
    ctx.strokeStyle = COLORS.surface;
    ctx.lineWidth   = 2;
    ctx.beginPath();
    ctx.moveTo(20, groundY);
    ctx.lineTo(cw - 20, groundY);
    ctx.stroke();
    ctx.restore();

    /* Height scale markers */
    ctx.save();
    ctx.font = '9px "Share Tech Mono", monospace';
    ctx.fillStyle = COLORS.textMuted;
    ctx.textAlign = 'left';
    for (let hm = 0; hm <= this.h0; hm += 10) {
      const py = this._hToY(hm);
      ctx.fillText(`${hm}m`, 6, py + 3);
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(54, 79, 104, 0.25)';
      ctx.lineWidth = 0.5;
      ctx.moveTo(28, py);
      ctx.lineTo(cw - 28, py);
      ctx.stroke();
    }
    ctx.restore();

    /* Body 1 trail and body */
    drawTrail(ctx, this.trail, COLORS.red);
    const bodyX = cw * 0.35;
    const bodyY = this._hToY(this.h);
    drawCircle(ctx, bodyX, bodyY, 16, '#2a0a0a', COLORS.red);

    /* Velocity arrow (downward) */
    if (this.v > 0.1) {
      const scale = 3;
      drawArrow(ctx, bodyX, bodyY + 16, 0, this.v * scale, COLORS.red, `v`);
    }

    /* Gravity label */
    drawArrow(ctx, bodyX + 24, bodyY, 0, 30, COLORS.amber, `g`);

    /* Body 2 */
    if (this.showCompare) {
      drawTrail(ctx, this.trail2, COLORS.amber);
      const bodyX2 = cw * 0.65;
      const bodyY2 = this._hToY(this.h2);
      drawCircle(ctx, bodyX2, bodyY2, 22, '#2a1a00', COLORS.amber);
      drawLabel(ctx, '2×m', bodyX2, bodyY2 + 3, COLORS.amber, 'center');
    }

    /* HUD */
    drawReadout(ctx, 'h', this.h, 'm',   cw - 14 - 80, 20, COLORS.red);
    drawReadout(ctx, 'v', this.v, 'm/s', cw - 14 - 80, 34, COLORS.amber);
    drawReadout(ctx, 't', this.time, 's', cw - 14 - 80, 48, COLORS.textMuted);

    if (this.chart) this.chart.render();
  }
}

/* ─────────────────────────────────────────────────────────────────────────── *
 * Factory
 * ─────────────────────────────────────────────────────────────────────────── */

/**
 * Create the correct motion simulation for a given experiment ID.
 * @param {string} simId — 'mru' | 'mruv' | 'free-fall' | 'obliquo' | 'circular'
 * @param {HTMLCanvasElement} canvas
 * @param {HTMLCanvasElement|null} chartCanvas
 * @returns {SimulationBase}
 */
function createMotionSimulation(simId, canvas, chartCanvas) {
  switch (simId) {
    case 'mru':       return new MRUSimulation(canvas, chartCanvas);
    case 'mruv':      return new MRUVSimulation(canvas, chartCanvas);
    case 'free-fall': return new FreeFallSimulation(canvas, chartCanvas);
    case 'obliquo':   return new ObliquoSimulation(canvas, chartCanvas);
    case 'circular':  return new CircularSimulation(canvas, chartCanvas);
    default:
      console.warn(`[motion] Unknown simulation ID: ${simId}`);
      return new MRUSimulation(canvas, chartCanvas);
  }
}

export { createMotionSimulation, MRUSimulation, MRUVSimulation, FreeFallSimulation, ObliquoSimulation, CircularSimulation };

/* ══════════════════════════════════════════════════════════════════════════ *
 *  ObliquoSimulation — Lançamento oblíquo
 *  x(t) = v₀·cos(θ)·t
 *  y(t) = v₀·sin(θ)·t − ½·g·t²
 *  Alcance: R = v₀²·sin(2θ)/g   Altura max: H = v₀²·sin²(θ)/(2g)
 * ══════════════════════════════════════════════════════════════════════════ */

class ObliquoSimulation extends SimulationBase {
  constructor(canvas, chartCanvas) {
    super(canvas);
    this.v0    = 20;          /* m/s */
    this.theta = Math.PI / 4; /* rad — 45° */
    this.g     = 9.8;         /* m/s² */
    this._x    = 0;
    this._y    = 0;
    this._trail = [];
    this._landed = false;
    this._chart  = chartCanvas ? new ChartEngine(chartCanvas) : null;
  }

  _onReset() {
    this.v0    = this.params.v0    ?? 20;
    this.theta = (this.params.angle ?? 45) * Math.PI / 180;
    this.g     = this.params.g     ?? 9.8;
    this._x    = 0;
    this._y    = 0;
    this._trail = [];
    this._landed = false;
    if (this._chart) this._chart.clear();
  }

  _onParamChange(key, value) {
    if (key === 'v0')    this.v0    = value;
    if (key === 'angle') this.theta = value * Math.PI / 180;
    if (key === 'g')     this.g     = value;
    this._x = 0; this._y = 0; this._trail = []; this._landed = false;
    if (this._chart) this._chart.clear();
  }

  _update(dt) {
    if (this._landed) return;

    /* MRU horizontal + MRUV vertical */
    this._x = this.v0 * Math.cos(this.theta) * this.time;
    this._y = this.v0 * Math.sin(this.theta) * this.time
              - 0.5 * this.g * this.time * this.time;

    this._trail.push({ x: this._x, y: this._y });
    if (this._trail.length > 500) this._trail.shift();

    if (this._chart) this._chart.addPoint(this._x, this._y);

    /* Aterrisou? */
    if (this.time > 0.1 && this._y <= 0) {
      this._y = 0;
      this._landed = true;
    }

    if (!this._landed) this.time += dt;
  }

  _render() {
    const { ctx, canvas } = this;
    const cw = canvas.width, ch = canvas.height;
    clearCanvas(ctx);
    drawGrid(ctx);

    /* Escala: alcance máximo cabe na tela */
    const R    = this.v0 * this.v0 * Math.sin(2 * this.theta) / this.g;
    const Hmax = this.v0 * this.v0 * Math.sin(this.theta) ** 2 / (2 * this.g);
    const scale = Math.min((cw - 40) / Math.max(R, 1), (ch - 60) / Math.max(Hmax, 1));
    const ox = 30, oy = ch - 30; /* origem em px */

    /* Solo */
    drawSurface(ctx, 0, cw, oy);

    /* Trajetória ideal (pré-calculada) — linha pontilhada */
    const tTotal = 2 * this.v0 * Math.sin(this.theta) / this.g;
    ctx.save();
    ctx.setLineDash([5, 4]);
    ctx.strokeStyle = COLORS.textMuted + '55';
    ctx.lineWidth   = 1;
    ctx.beginPath();
    for (let i = 0; i <= 80; i++) {
      const t  = (i / 80) * tTotal;
      const px = ox + this.v0 * Math.cos(this.theta) * t * scale;
      const py = oy - (this.v0 * Math.sin(this.theta) * t - 0.5 * this.g * t * t) * scale;
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    /* Trilha real */
    if (this._trail.length > 1) {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(ox + this._trail[0].x * scale, oy - this._trail[0].y * scale);
      for (const p of this._trail) ctx.lineTo(ox + p.x * scale, oy - p.y * scale);
      ctx.strokeStyle = COLORS.velocity;
      ctx.lineWidth   = 2;
      ctx.stroke();
      ctx.restore();
    }

    /* Projétil */
    const px = ox + this._x * scale;
    const py = oy - this._y * scale;
    drawCircle(ctx, px, py, 7);

    /* Vetor velocidade instantânea */
    if (!this._landed) {
      const vx = this.v0 * Math.cos(this.theta);
      const vy = this.v0 * Math.sin(this.theta) - this.g * this.time;
      const vs = 2.5;
      drawArrow(ctx, px, py, vx * vs, -vy * vs, COLORS.velocity, 'v', 2);
    }

    /* Ângulo de lançamento no origem */
    ctx.save();
    ctx.strokeStyle = COLORS.amber + 'aa';
    ctx.lineWidth = 1.5;
    const aLen = 40;
    ctx.beginPath();
    ctx.moveTo(ox, oy);
    ctx.lineTo(ox + aLen * Math.cos(this.theta), oy - aLen * Math.sin(this.theta));
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(ox, oy, 22, -this.theta, 0);
    ctx.strokeStyle = COLORS.amber + '66';
    ctx.lineWidth = 1;
    ctx.stroke();
    drawLabel(ctx, `${Math.round(this.theta * 180 / Math.PI)}°`, ox + 28, oy - 10, COLORS.amber, 'left');
    ctx.restore();

    /* Readouts */
    drawReadout(ctx, 'v₀',  this.v0.toFixed(1),              'm/s',  12, 12);
    drawReadout(ctx, 'θ',   (this.theta*180/Math.PI).toFixed(0), '°', 12, 36);
    drawReadout(ctx, 'R',   R.toFixed(1),                    'm',    12, 60);
    drawReadout(ctx, 'H',   Hmax.toFixed(1),                 'm',    12, 84);
    drawReadout(ctx, 't',   this.time.toFixed(2),             's',    12, 108);

    if (this._landed) {
      drawLabel(ctx, `Alcance real: ${this._x.toFixed(1)} m`, cw / 2, oy - 18, COLORS.amber, 'center');
    }
  }
}

/* ══════════════════════════════════════════════════════════════════════════ *
 *  CircularSimulation — Movimento circular uniforme
 *  v = ω·r   a_c = v²/r = ω²·r   T = 2π/ω   f = 1/T
 *  Mostra: posição, velocidade tangencial, aceleração centrípeta
 * ══════════════════════════════════════════════════════════════════════════ */

class CircularSimulation extends SimulationBase {
  constructor(canvas, chartCanvas) {
    super(canvas);
    this.omega = 2 * Math.PI / 3; /* rad/s — 1 volta a cada 3s */
    this.r     = 1.0;             /* m */
    this._phi  = 0;               /* ângulo atual */
    this._chart = chartCanvas ? new ChartEngine(chartCanvas) : null;
  }

  _onReset() {
    this.omega = this.params.omega ?? (2 * Math.PI / 3);
    this.r     = this.params.r    ?? 1.0;
    this._phi  = 0;
    if (this._chart) this._chart.clear();
  }

  _onParamChange(key, value) {
    if (key === 'omega') this.omega = value;
    if (key === 'r')     this.r     = value;
  }

  _update(dt) {
    this._phi  = (this._phi + this.omega * dt) % (2 * Math.PI);
    this.time += dt;
    if (this._chart) {
      /* Gráfico: posição x(t) = r·cos(ω·t) */
      this._chart.addPoint(this.time, this.r * Math.cos(this._phi));
    }
  }

  _render() {
    const { ctx, canvas } = this;
    const cw = canvas.width, ch = canvas.height;
    clearCanvas(ctx);
    drawGrid(ctx);

    const cx = cw / 2, cy = ch / 2;
    const scale = Math.min(cw, ch) * 0.35 / Math.max(this.r, 0.1); /* px/m */
    const rPx   = this.r * scale;

    /* Órbita */
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, rPx, 0, Math.PI * 2);
    ctx.strokeStyle = COLORS.textMuted + '40';
    ctx.lineWidth   = 1;
    ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    /* Centro */
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, 4, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.amber + 'aa'; ctx.fill();
    ctx.restore();

    /* Raio */
    const px = cx + rPx * Math.cos(this._phi);
    const py = cy - rPx * Math.sin(this._phi);
    ctx.save();
    ctx.strokeStyle = COLORS.textMuted + '60';
    ctx.lineWidth   = 1;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(px, py);
    ctx.stroke();
    drawLabel(ctx, `r = ${this.r.toFixed(1)} m`, (cx + px) / 2 + 8, (cy + py) / 2 - 6, COLORS.textMuted, 'left');
    ctx.restore();

    /* Velocidade tangencial */
    const v    = this.omega * this.r; /* m/s */
    const vScale = Math.min(50 / Math.max(v, 0.1), 20);
    const vtx  = -Math.sin(this._phi) * v * vScale;
    const vty  =  Math.cos(this._phi) * v * vScale;
    drawArrow(ctx, px, py, vtx, vty, COLORS.velocity, 'v', 2);

    /* Aceleração centrípeta */
    const ac    = this.omega * this.omega * this.r; /* m/s² */
    const acScale = Math.min(40 / Math.max(ac, 0.1), 15);
    const acx   = (cx - px) / rPx * ac * acScale;
    const acy   = (cy - py) / rPx * ac * acScale;
    drawArrow(ctx, px, py, acx, acy, COLORS.accel, 'aₓ', 2);

    /* Corpo */
    drawCircle(ctx, px, py, 10);

    /* Ângulo */
    ctx.save();
    ctx.strokeStyle = COLORS.amber + '55';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, 28, -this._phi, 0);
    ctx.stroke();
    drawLabel(ctx, `${(this._phi * 180 / Math.PI % 360).toFixed(0)}°`, cx + 36, cy + 6, COLORS.amber, 'left');
    ctx.restore();

    /* Readouts */
    const T = Math.abs(this.omega) > 1e-6 ? (2 * Math.PI / Math.abs(this.omega)) : Infinity;
    const f = 1 / T;
    drawReadout(ctx, 'ω',   this.omega.toFixed(3),  'rad/s',  cw - 160, 12);
    drawReadout(ctx, 'r',   this.r.toFixed(2),       'm',      cw - 160, 36);
    drawReadout(ctx, 'v',   v.toFixed(3),            'm/s',    cw - 160, 60);
    drawReadout(ctx, 'aₓ',  ac.toFixed(3),           'm/s²',   cw - 160, 84);
    drawReadout(ctx, 'T',   T.toFixed(3),            's',      cw - 160, 108);
    drawReadout(ctx, 'f',   f.toFixed(3),            'Hz',     cw - 160, 132);
    drawLabel(ctx, 'aₓ = ω²·r = v²/r', cw - 8, ch - 10, COLORS.textMuted, 'right');
  }
}
