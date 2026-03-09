/**
 * modules/forces/forces.js — Forces simulation module
 *
 * Simulations:
 *   inertia    — Newton's 1st law: body at rest / constant motion
 *   newton2    — Newton's 2nd law: F = m·a
 *   friction   — Kinetic friction: f = μk·N
 *   resultant  — Resultant force from multiple force components
 */

import { Physics } from '../../js/wasm-loader.js';
import {
  clearCanvas, drawGrid, drawArrow, drawRect,
  drawSurface, drawLabel, drawReadout, COLORS
} from '../../engine/renderer.js';
import { ChartEngine } from '../../engine/chart-engine.js';

/* ─────────────────────────────────────────────────────────────────────────── *
 * Shared base class (same pattern as motion.js)
 * ─────────────────────────────────────────────────────────────────────────── */

class SimBase {
  constructor(canvas) {
    this.canvas  = canvas;
    this.ctx     = canvas.getContext('2d');
    this.running = false;
    this.time    = 0;
    this._raf    = null;
    this._lastTs = null;
    this.params  = {};
    this._onTime = null;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this._lastTs = null;
    this._loop();
  }

  pause() {
    this.running = false;
    if (this._raf) { cancelAnimationFrame(this._raf); this._raf = null; }
  }

  reset() {
    this.pause();
    this.time = 0;
    this._onReset();
    this._render();
  }

  setParam(key, value) {
    this.params[key] = value;
    this._onParamChange(key, value);
    if (!this.running) this._render();
  }

  onTimeUpdate(fn) { this._onTime = fn; }

  _onReset()                 {}
  _onParamChange(key, value) { void key; void value; }
  _update(dt)                {}
  _render()                  {}
  dispose()                  { this.pause(); }

  _loop() {
    if (!this.running) return;
    this._raf = requestAnimationFrame(ts => {
      if (this._lastTs !== null) {
        const dt = Math.min((ts - this._lastTs) / 1000, 0.033);
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
 * InertiaSimulation — Newton's 1st Law
 *
 * Body slides on a frictionless surface. No net force → no acceleration.
 * Demonstrates that uniform motion requires no force.
 * ─────────────────────────────────────────────────────────────────────────── */

class InertiaSimulation extends SimBase {
  constructor(canvas) {
    super(canvas);
    this.x      = 0;
    this.v      = 4;   /* m/s — constant (no force) */
    this.worldW = 100; /* m */
    this.params = { v: 4 };
  }

  _onReset() {
    this.x = 0;
    this.v = this.params.v ?? 4;
  }

  _onParamChange(key, value) {
    if (key === 'v') { this.v = value; this.x = 0; }
  }

  _update(dt) {
    /* No force → acceleration = 0 → velocity constant */
    this.x += this.v * dt;
    this.time += dt;
    if (this.x > this.worldW) this.x = 0; /* wrap */
  }

  _render() {
    const ctx = this.ctx;
    const cw  = this.canvas.width;
    const ch  = this.canvas.height;
    const cy  = ch / 2;

    clearCanvas(ctx);
    drawGrid(ctx, 30);
    drawSurface(ctx, 20, cw - 20, cy + 25);

    const bx = 20 + (this.x / this.worldW) * (cw - 40);
    drawRect(ctx, bx, cy, 44, 44);

    /* Show zero resultant above body */
    ctx.save();
    ctx.font      = '12px "JetBrains Mono", monospace';
    ctx.fillStyle = COLORS.cyan;
    ctx.textAlign = 'center';
    ctx.fillText('ΣF = 0', bx, cy - 32);
    ctx.restore();

    /* Velocity vector */
    if (Math.abs(this.v) > 0.05) {
      const scale = 50 / 10;
      drawArrow(ctx, bx + 22, cy, this.v * scale, 0, COLORS.green, `v`);
    }

    drawReadout(ctx, 'v', this.v, 'm/s', 14, 20, COLORS.green);
    drawReadout(ctx, 'a', 0,      'm/s²',14, 36, COLORS.amber);
    drawReadout(ctx, 'ΣF', 0,     'N',   14, 52, COLORS.cyan);
    drawReadout(ctx, 't', this.time, 's', 14, 68, COLORS.textMuted);
  }
}

/* ─────────────────────────────────────────────────────────────────────────── *
 * Newton2Simulation — Newton's 2nd Law: F = m·a
 *
 * User can adjust applied force and mass independently.
 * Observe how acceleration changes with each.
 * ─────────────────────────────────────────────────────────────────────────── */

class Newton2Simulation extends SimBase {
  constructor(canvas, chartCanvas) {
    super(canvas);

    this.x      = 0;
    this.v      = 0;
    this.mass   = 5;   /* kg */
    this.force  = 20;  /* N */
    this.worldW = 100;

    this.params = { mass: 5, force: 20 };

    this.chart = chartCanvas
      ? new ChartEngine(chartCanvas, {
          label: 'aceleração vs tempo',
          xUnit: 't (s)', yUnit: 'a (m/s²)',
          color: '#f0a500',
        })
      : null;
  }

  get acceleration() {
    return Physics.forces_acceleration(this.force, this.mass);
  }

  _onReset() {
    this.x    = 0;
    this.v    = 0;
    this.mass = this.params.mass ?? 5;
    this.force = this.params.force ?? 20;
    if (this.chart) this.chart.clear();
  }

  _onParamChange(key, value) {
    if (key === 'mass')  this.mass  = value;
    if (key === 'force') this.force = value;
    this.x = 0; this.v = 0;
    if (this.chart) this.chart.clear();
    this.time = 0;
  }

  _update(dt) {
    const a = this.acceleration;
    const result = Physics.motion_step(this.x, this.v, a, dt);
    this.x = result.x;
    this.v = result.v;
    this.time += dt;

    if (this.x >= this.worldW) { this.x = this.worldW; this.v = 0; this.pause(); }

    if (this.chart && (Math.round(this.time * 60) % 3 === 0)) {
      this.chart.addPoint(this.time, a);
    }
  }

  _render() {
    const ctx = this.ctx;
    const cw  = this.canvas.width;
    const ch  = this.canvas.height;
    const cy  = ch / 2;
    const a   = this.acceleration;

    clearCanvas(ctx);
    drawGrid(ctx, 30);
    drawSurface(ctx, 20, cw - 20, cy + 28);

    const bx = 20 + (this.x / this.worldW) * (cw - 40);
    /* Body size proportional to mass (visual cue) */
    const sz = 30 + this.mass * 3;
    drawRect(ctx, bx, cy, sz, sz);

    /* Mass label inside body */
    ctx.save();
    ctx.font      = '10px "JetBrains Mono", monospace';
    ctx.fillStyle = COLORS.textMuted;
    ctx.textAlign = 'center';
    ctx.fillText(`${this.mass}kg`, bx, cy + 3);
    ctx.restore();

    /* Applied force arrow */
    const fScale = 3;
    drawArrow(ctx, bx + sz / 2, cy, this.force * fScale, 0, COLORS.amber, `F=${this.force}N`);

    /* Acceleration arrow (smaller scale, different color) */
    if (a > 0.01) {
      drawArrow(ctx, bx, cy - 24, a * 12, 0, COLORS.red, `a`);
    }

    /* HUD */
    drawReadout(ctx, 'F',  this.force, 'N',    14, 20, COLORS.amber);
    drawReadout(ctx, 'm',  this.mass,  'kg',   14, 36, COLORS.textMuted);
    drawReadout(ctx, 'a',  a,          'm/s²', 14, 52, COLORS.red);
    drawReadout(ctx, 'v',  this.v,     'm/s',  14, 68, COLORS.green);

    if (this.chart) this.chart.render();
  }
}

/* ─────────────────────────────────────────────────────────────────────────── *
 * FrictionSimulation — Kinetic friction: f = μk·N
 *
 * Body pushed with constant force. Toggle friction on/off.
 * Observe deceleration when push stops.
 * ─────────────────────────────────────────────────────────────────────────── */

class FrictionSimulation extends SimBase {
  constructor(canvas, chartCanvas) {
    super(canvas);

    this.x          = 0;
    this.v          = 0;
    this.mass       = 4;   /* kg  */
    this.forceApplied = 20; /* N  */
    this.mu_k       = 0.3; /* adimensional */
    this.hasFriction = true;
    this.worldW     = 100;

    this.params = { mass: 4, force: 20, mu_k: 0.3, friction: true };

    this.chart = chartCanvas
      ? new ChartEngine(chartCanvas, {
          label: 'v vs t',
          xUnit: 't (s)', yUnit: 'v (m/s)',
          color: '#00c878',
        })
      : null;
  }

  _onReset() {
    this.x          = 0;
    this.v          = 0;
    this.mass       = this.params.mass  ?? 4;
    this.forceApplied = this.params.force ?? 20;
    this.mu_k       = this.params.mu_k  ?? 0.3;
    this.hasFriction = this.params.friction ?? true;
    if (this.chart) this.chart.clear();
  }

  _onParamChange(key, value) {
    if (key === 'mass')     this.mass         = value;
    if (key === 'force')    this.forceApplied = value;
    if (key === 'mu_k')     this.mu_k         = value;
    if (key === 'friction') this.hasFriction  = value;
    this.x = 0; this.v = 0;
    if (this.chart) this.chart.clear();
    this.time = 0;
  }

  _update(dt) {
    const normal = Physics.forces_weight(this.mass, 9.8);
    const result = Physics.forces_step(
      this.x, this.v,
      this.forceApplied,
      this.mass,
      this.mu_k,
      normal,
      this.hasFriction,
      dt
    );
    this.x = result.x;
    this.v = result.v;
    this.time += dt;

    if (this.x >= this.worldW) { this.x = this.worldW; this.v = 0; this.pause(); }
    if (this.v < 0)            { this.v = 0; }

    if (this.chart && (Math.round(this.time * 60) % 3 === 0)) {
      this.chart.addPoint(this.time, this.v);
    }
  }

  _render() {
    const ctx = this.ctx;
    const cw  = this.canvas.width;
    const ch  = this.canvas.height;
    const cy  = ch / 2;

    clearCanvas(ctx);
    drawGrid(ctx, 30);
    drawSurface(ctx, 20, cw - 20, cy + 28);

    const bx     = 20 + (this.x / this.worldW) * (cw - 40);
    const normal = Physics.forces_weight(this.mass, 9.8);
    const fric   = this.hasFriction
      ? Physics.forces_friction(normal, this.mu_k)
      : 0;
    const netF   = this.forceApplied - fric;

    drawRect(ctx, bx, cy, 44, 44);

    /* Applied force arrow */
    drawArrow(ctx, bx + 22, cy, this.forceApplied * 3, 0, COLORS.amber, `F=${this.forceApplied}N`);

    /* Friction arrow (opposing direction) */
    if (this.hasFriction && fric > 0.1 && this.v > 0.05) {
      drawArrow(ctx, bx - 22, cy, -fric * 3, 0, COLORS.red, `f=${fric.toFixed(1)}N`);
    }

    /* Normal force arrow (upward) */
    drawArrow(ctx, bx, cy - 22, 0, -30, COLORS.purple, `N`);

    /* Weight arrow (downward) */
    drawArrow(ctx, bx, cy + 22, 0, 30, COLORS.textMuted, `P`);

    /* Surface texture changes with friction */
    if (this.hasFriction) {
      ctx.save();
      ctx.font = '9px "JetBrains Mono", monospace';
      ctx.fillStyle = COLORS.textMuted;
      ctx.textAlign = 'center';
      ctx.fillText(`μk = ${this.mu_k.toFixed(2)}`, cw / 2, cy + 50);
      ctx.restore();
    }

    drawReadout(ctx, 'F_ap',  this.forceApplied, 'N',    14, 20, COLORS.amber);
    drawReadout(ctx, 'f',     fric,               'N',    14, 36, COLORS.red);
    drawReadout(ctx, 'F_net', netF,               'N',    14, 52, COLORS.cyan);
    drawReadout(ctx, 'v',     this.v,             'm/s',  14, 68, COLORS.green);

    if (this.chart) this.chart.render();
  }
}

/* ─────────────────────────────────────────────────────────────────────────── *
 * ResultantSimulation — Vector sum of forces
 *
 * Two adjustable force vectors. Shows resultant visually.
 * Body accelerates according to F_net.
 * ─────────────────────────────────────────────────────────────────────────── */

class ResultantSimulation extends SimBase {
  constructor(canvas) {
    super(canvas);

    this.x      = 0;
    this.v      = 0;
    this.mass   = 5;  /* kg */
    this.f1     = 30; /* N — rightward */
    this.f2     = 10; /* N — leftward (opposing) */
    this.worldW = 100;

    this.params = { mass: 5, f1: 30, f2: 10 };
  }

  get netForce() { return this.f1 - this.f2; }
  get acceleration() { return Physics.forces_acceleration(this.netForce, this.mass); }

  _onReset() {
    this.x    = 0;
    this.v    = 0;
    this.mass = this.params.mass ?? 5;
    this.f1   = this.params.f1   ?? 30;
    this.f2   = this.params.f2   ?? 10;
    this.time = 0;
  }

  _onParamChange(key, value) {
    if (key === 'mass') this.mass = value;
    if (key === 'f1')   this.f1   = value;
    if (key === 'f2')   this.f2   = value;
    this.x = 0; this.v = 0; this.time = 0;
  }

  _update(dt) {
    const result = Physics.motion_step(this.x, this.v, this.acceleration, dt);
    this.x = result.x;
    this.v = result.v;
    this.time += dt;

    if (this.x >= this.worldW) { this.x = this.worldW; this.v = 0; this.pause(); }
    if (this.x <= 0 && this.v < 0) { this.x = 0; this.v = 0; }
  }

  _render() {
    const ctx    = this.ctx;
    const cw     = this.canvas.width;
    const ch     = this.canvas.height;
    const cy     = ch / 2;
    const net    = this.netForce;
    const a      = this.acceleration;

    clearCanvas(ctx);
    drawGrid(ctx, 30);
    drawSurface(ctx, 20, cw - 20, cy + 28);

    const bx = 20 + (this.x / this.worldW) * (cw - 40);
    drawRect(ctx, bx, cy, 44, 44);

    const scale = 3;

    /* F1 — rightward */
    drawArrow(ctx, bx + 22, cy - 8, this.f1 * scale, 0, COLORS.amber, `F₁=${this.f1}N`);

    /* F2 — leftward */
    drawArrow(ctx, bx - 22, cy + 8, -this.f2 * scale, 0, COLORS.red, `F₂=${this.f2}N`);

    /* Resultant */
    if (Math.abs(net) > 0.1) {
      const resColor = net > 0 ? COLORS.cyan : COLORS.purple;
      drawArrow(ctx, bx, cy + 30, net * scale, 0, resColor, `FR=${net.toFixed(1)}N`);
    } else {
      /* Equilibrium label */
      ctx.save();
      ctx.font      = '11px "JetBrains Mono", monospace';
      ctx.fillStyle = COLORS.cyan;
      ctx.textAlign = 'center';
      ctx.fillText('Equilíbrio', bx, cy + 50);
      ctx.restore();
    }

    drawReadout(ctx, 'F₁',  this.f1,  'N',    14, 20, COLORS.amber);
    drawReadout(ctx, 'F₂',  this.f2,  'N',    14, 36, COLORS.red);
    drawReadout(ctx, 'FR',  net,       'N',    14, 52, COLORS.cyan);
    drawReadout(ctx, 'a',   a,         'm/s²', 14, 68, COLORS.green);
  }
}

/* ─────────────────────────────────────────────────────────────────────────── *
 * Factory
 * ─────────────────────────────────────────────────────────────────────────── */

/**
 * @param {string} simId — 'inertia' | 'newton2' | 'friction' | 'resultant'
 * @param {HTMLCanvasElement} canvas
 * @param {HTMLCanvasElement|null} chartCanvas
 * @returns {SimBase}
 */
function createForcesSimulation(simId, canvas, chartCanvas) {
  switch (simId) {
    case 'inertia':   return new InertiaSimulation(canvas);
    case 'newton2':   return new Newton2Simulation(canvas, chartCanvas);
    case 'friction':  return new FrictionSimulation(canvas, chartCanvas);
    case 'resultant': return new ResultantSimulation(canvas);
    default:
      console.warn(`[forces] Unknown simulation ID: ${simId}`);
      return new Newton2Simulation(canvas, chartCanvas);
  }
}

export { createForcesSimulation, InertiaSimulation, Newton2Simulation, FrictionSimulation, ResultantSimulation };
