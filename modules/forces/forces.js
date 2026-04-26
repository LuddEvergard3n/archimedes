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
    ctx.font      = '12px "Share Tech Mono", monospace';
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
          color: '#c07828',
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
    ctx.font      = '10px "Share Tech Mono", monospace';
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
          color: '#3d7a55',
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
      ctx.font = '9px "Share Tech Mono", monospace';
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
      ctx.font      = '11px "Share Tech Mono", monospace';
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
    case 'newton3':   return new Newton3Simulation(canvas);
    case 'colisao':   return new ColisaoSimulation(canvas, chartCanvas);
    default:
      console.warn(`[forces] Unknown simulation ID: ${simId}`);
      return new Newton2Simulation(canvas, chartCanvas);
  }
}

export { createForcesSimulation, InertiaSimulation, Newton2Simulation, FrictionSimulation, ResultantSimulation, Newton3Simulation, ColisaoSimulation };

/* ══════════════════════════════════════════════════════════════════════════ *
 *  Newton3Simulation — 3ª Lei de Newton: ação e reação
 *  Para todo par de corpos A e B: F_AB = −F_BA
 *  Dois blocos ligados por mola comprimida: ao soltar, impulsionados em
 *  direções opostas com momentos iguais e opostos.
 * ══════════════════════════════════════════════════════════════════════════ */

class Newton3Simulation extends SimBase {
  constructor(canvas) {
    super(canvas);
    this.m1    = 2;    /* kg */
    this.m2    = 4;    /* kg */
    this.F     = 20;   /* N — força da mola */
    this._x1   = 0; this._x2 = 0;
    this._v1   = 0; this._v2 = 0;
    this._released = false;
  }

  _onReset() {
    this.m1 = this.params.m1 ?? 2;
    this.m2 = this.params.m2 ?? 4;
    this.F  = this.params.F  ?? 20;
    this._x1 = 0; this._x2 = 0;
    this._v1 = 0; this._v2 = 0;
    this._released = false;
  }

  _onParamChange(key, value) {
    if (key === 'm1') this.m1 = value;
    if (key === 'm2') this.m2 = value;
    if (key === 'F')  this.F  = value;
    this._x1 = 0; this._x2 = 0;
    this._v1 = 0; this._v2 = 0;
    this._released = false;
  }

  _update(dt) {
    if (!this._released) {
      /* Empurrão instantâneo: impulso J = F·Δt curto */
      /* Por conservação de momento: m1·v1 + m2·v2 = 0 */
      /* e ação-reação: |J1| = |J2| → v1 = F*dt/m1, v2 = -F*dt/m2 */
      const impulse = this.F * 0.05; /* N·s — impulso fixo */
      this._v1 =  impulse / this.m1;
      this._v2 = -impulse / this.m2;
      this._released = true;
    }
    this._x1 += this._v1 * dt;
    this._x2 += this._v2 * dt;
    this.time += dt;
  }

  _render() {
    const { ctx, canvas } = this;
    const cw = canvas.width, ch = canvas.height;
    clearCanvas(ctx);
    drawGrid(ctx);

    const cy     = ch / 2;
    const scale  = 60;   /* px/m */
    const cx     = cw / 2;
    const halfW  = 28;   /* meia largura dos blocos */

    /* Superfície */
    drawSurface(ctx, 0, cw, cy + 22);

    /* Blocos */
    const x1px = cx + this._x1 * scale - halfW;
    const x2px = cx + this._x2 * scale + halfW;

    drawRect(ctx, cx + this._x1 * scale, cy - 8, 56, 44);
    drawRect(ctx, cx + this._x2 * scale, cy - 8, 56, 44);

    /* Labels de massa */
    drawLabel(ctx, `m₁=${this.m1} kg`, cx + this._x1 * scale, cy - 28, COLORS.textSecondary, 'center');
    drawLabel(ctx, `m₂=${this.m2} kg`, cx + this._x2 * scale, cy - 28, COLORS.textSecondary, 'center');

    /* Mola no centro (antes de soltar) */
    if (!this._released || this.time < 0.12) {
      ctx.save();
      ctx.strokeStyle = COLORS.amber + 'aa';
      ctx.lineWidth   = 2;
      const springX1 = cx + this._x1 * scale + halfW;
      const springX2 = cx + this._x2 * scale - halfW;
      const mid = (springX1 + springX2) / 2;
      const n   = 6;
      ctx.beginPath();
      ctx.moveTo(springX1, cy);
      for (let i = 0; i < n; i++) {
        const sx = springX1 + (i / n) * (springX2 - springX1);
        ctx.lineTo(sx + (springX2 - springX1) / (2 * n), cy + (i % 2 === 0 ? -10 : 10));
      }
      ctx.lineTo(springX2, cy);
      ctx.stroke();
      ctx.restore();
    }

    /* Vetores de força (ação-reação) */
    if (this._released) {
      const fScale = 1.5;
      drawArrow(ctx, cx + this._x1 * scale - halfW, cy, -this.F * fScale, 0, COLORS.force, 'F₂₁', 2);
      drawArrow(ctx, cx + this._x2 * scale + halfW, cy,  this.F * fScale, 0, COLORS.force, 'F₁₂', 2);

      /* Vetores de velocidade */
      drawArrow(ctx, cx + this._x1 * scale, cy - 36, this._v1 * 8, 0, COLORS.velocity, 'v₁', 1.5);
      drawArrow(ctx, cx + this._x2 * scale, cy - 36, this._v2 * 8, 0, COLORS.velocity, 'v₂', 1.5);
    }

    /* Readouts */
    const p1 = this.m1 * this._v1, p2 = this.m2 * this._v2;
    drawReadout(ctx, 'v₁',    this._v1.toFixed(3),   'm/s',   12, 12);
    drawReadout(ctx, 'v₂',    this._v2.toFixed(3),   'm/s',   12, 36);
    drawReadout(ctx, 'p₁=m₁v₁', p1.toFixed(3),      'kg·m/s',12, 60);
    drawReadout(ctx, 'p₂=m₂v₂', p2.toFixed(3),      'kg·m/s',12, 84);
    drawReadout(ctx, 'p_tot', (p1 + p2).toFixed(4),  'kg·m/s',12, 108);
    drawLabel(ctx, 'F₁₂ = −F₂₁', cw - 8, ch - 10, COLORS.textMuted, 'right');
    if (!this._released) {
      drawLabel(ctx, 'Pressione Play para soltar a mola', cw / 2, cy + 60, COLORS.amber, 'center');
    }
  }
}

/* ══════════════════════════════════════════════════════════════════════════ *
 *  ColisaoSimulation — Colisões elástica e inelástica
 *  Conservação de momento: m₁v₁ + m₂v₂ = m₁v₁' + m₂v₂'
 *  Elástica: também conserva Ec → formulas analíticas exatas
 *  Inelástica: corpos se unem → v' = (m₁v₁ + m₂v₂)/(m₁ + m₂)
 * ══════════════════════════════════════════════════════════════════════════ */

class ColisaoSimulation extends SimBase {
  constructor(canvas, chartCanvas) {
    super(canvas);
    this.m1    = 3;    /* kg */
    this.m2    = 2;    /* kg */
    this.v1i   = 4;    /* m/s */
    this.v2i   = -1;   /* m/s */
    this.tipo  = 'elastica'; /* 'elastica' | 'inelastica' */
    this._x1   = 0; this._x2 = 0;
    this._v1   = 0; this._v2 = 0;
    this._collided = false;
    this._Ec_before = 0; this._Ec_after = 0;
  }

  _onReset() {
    this.m1   = this.params.m1   ?? 3;
    this.m2   = this.params.m2   ?? 2;
    this.v1i  = this.params.v1i  ?? 4;
    this.v2i  = this.params.v2i  ?? -1;
    this.tipo = this.params.tipo ?? 'elastica';
    this._reset_state();
  }

  _onParamChange(key, value) {
    if (key === 'm1')   this.m1   = value;
    if (key === 'm2')   this.m2   = value;
    if (key === 'v1i')  this.v1i  = value;
    if (key === 'v2i')  this.v2i  = value;
    if (key === 'tipo') this.tipo = value;
    this._reset_state();
  }

  _reset_state() {
    const scale  = 50;
    this._x1 = -80 / scale; /* m — posição inicial */
    this._x2 =  80 / scale;
    this._v1 = this.v1i;
    this._v2 = this.v2i;
    this._collided   = false;
    this._Ec_before  = 0.5 * this.m1 * this.v1i ** 2 + 0.5 * this.m2 * this.v2i ** 2;
    this._Ec_after   = 0;
  }

  _update(dt) {
    if (this._collided) {
      this._x1 += this._v1 * dt;
      this._x2 += this._v2 * dt;
      this.time += dt;
      return;
    }

    this._x1 += this._v1 * dt;
    this._x2 += this._v2 * dt;

    /* Detectar colisão (distância < tamanho dos blocos ≈ 0.6 m) */
    if (Math.abs(this._x2 - this._x1) < 0.58) {
      this._collide();
    }
    this.time += dt;
  }

  _collide() {
    this._collided = true;
    const m1 = this.m1, m2 = this.m2;
    const v1 = this._v1,  v2 = this._v2;

    if (this.tipo === 'elastica') {
      /* Fórmulas analíticas para colisão elástica 1D */
      this._v1 = ((m1 - m2) * v1 + 2 * m2 * v2) / (m1 + m2);
      this._v2 = ((m2 - m1) * v2 + 2 * m1 * v1) / (m1 + m2);
    } else {
      /* Colisão perfeitamente inelástica — corpos se unem */
      const vf = (m1 * v1 + m2 * v2) / (m1 + m2);
      this._v1 = vf;
      this._v2 = vf;
    }

    this._Ec_after = 0.5 * m1 * this._v1 ** 2 + 0.5 * m2 * this._v2 ** 2;
  }

  _render() {
    const { ctx, canvas } = this;
    const cw = canvas.width, ch = canvas.height;
    clearCanvas(ctx);
    drawGrid(ctx);

    const cy    = ch / 2;
    const scale = 50;  /* px/m */
    const cx    = cw / 2;
    const bw    = 56;

    drawSurface(ctx, 0, cw, cy + 22);

    const x1px = cx + this._x1 * scale;
    const x2px = cx + this._x2 * scale;

    /* Blocos — se unem após colisão inelástica */
    if (this._collided && this.tipo === 'inelastica') {
      const mid = (x1px + x2px) / 2;
      drawRect(ctx, mid, cy - 8, bw * 2 + 4, 44, COLORS.bodyFill, COLORS.force);
      drawLabel(ctx, `m₁+m₂=${this.m1+this.m2} kg`, mid, cy - 28, COLORS.textSecondary, 'center');
    } else {
      drawRect(ctx, x1px, cy - 8, bw, 44);
      drawRect(ctx, x2px, cy - 8, bw, 44);
      drawLabel(ctx, `m₁=${this.m1}`, x1px, cy - 28, COLORS.textSecondary, 'center');
      drawLabel(ctx, `m₂=${this.m2}`, x2px, cy - 28, COLORS.textSecondary, 'center');
    }

    /* Vetores de velocidade */
    const vs = 8;
    drawArrow(ctx, x1px, cy - 40, this._v1 * vs, 0, COLORS.velocity, `v₁=${this._v1.toFixed(1)}`, 1.5);
    if (!(this._collided && this.tipo === 'inelastica')) {
      drawArrow(ctx, x2px, cy - 40, this._v2 * vs, 0, COLORS.velocity, `v₂=${this._v2.toFixed(1)}`, 1.5);
    }

    /* Readouts */
    const ptot = this.m1 * this._v1 + this.m2 * this._v2;
    const ptot_i = this.m1 * this.v1i + this.m2 * this.v2i;
    drawReadout(ctx, 'p_total', ptot.toFixed(3),       'kg·m/s', 12, 12);
    drawReadout(ctx, 'p_antes', ptot_i.toFixed(3),     'kg·m/s', 12, 36);
    drawReadout(ctx, 'Ec_antes', this._Ec_before.toFixed(2), 'J', 12, 60);
    if (this._collided) {
      drawReadout(ctx, 'Ec_depois', this._Ec_after.toFixed(2), 'J', 12, 84);
      const perdaEc = this._Ec_before - this._Ec_after;
      drawReadout(ctx, 'ΔEc', perdaEc.toFixed(2), 'J', 12, 108);
    }
    const tipoLabel = this.tipo === 'elastica' ? 'Elástica (Ec conservada)' : 'Inelástica (Ec não conservada)';
    drawLabel(ctx, tipoLabel, cw - 8, ch - 10, COLORS.textMuted, 'right');
  }
}
