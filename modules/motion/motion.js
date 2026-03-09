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
          { label: 'posição (m)', xUnit: 't (s)', yUnit: 'x (m)', color: '#00d4ff' },
          { label: 'velocidade (m/s)', xUnit: 't (s)', yUnit: 'v (m/s)', color: '#00c878' }
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
    ctx.font      = '9px "JetBrains Mono", monospace';
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
          { label: 'posição (m)', xUnit: 't (s)', yUnit: 'x (m)', color: '#00d4ff' },
          { label: 'velocidade (m/s)', xUnit: 't (s)', yUnit: 'v (m/s)', color: '#f0a500' }
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
    ctx.font = '9px "JetBrains Mono", monospace';
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
          color: '#e84040',
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
    const result = Physics.motion_step(this.h, -this.v, -this.g, dt);
    /* In free fall: a = -g (downward), h decreases */
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
    ctx.font = '9px "JetBrains Mono", monospace';
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
 * @param {string} simId — 'mru' | 'mruv' | 'free-fall'
 * @param {HTMLCanvasElement} canvas
 * @param {HTMLCanvasElement|null} chartCanvas
 * @returns {SimulationBase}
 */
function createMotionSimulation(simId, canvas, chartCanvas) {
  switch (simId) {
    case 'mru':       return new MRUSimulation(canvas, chartCanvas);
    case 'mruv':      return new MRUVSimulation(canvas, chartCanvas);
    case 'free-fall': return new FreeFallSimulation(canvas, chartCanvas);
    default:
      console.warn(`[motion] Unknown simulation ID: ${simId}`);
      return new MRUSimulation(canvas, chartCanvas);
  }
}

export { createMotionSimulation, MRUSimulation, MRUVSimulation, FreeFallSimulation };
