/**
 * modules/energy/energy.js — Energy simulation module
 *
 * Simulations:
 *   kinetic      — Ec = ½·m·v²
 *   ramp-energy  — Potential ↔ Kinetic conversion on inclined plane
 *   conservation — Energy conservation (with / without friction)
 */

import { Physics } from '../../js/wasm-loader.js';
import {
  clearCanvas, drawGrid, drawArrow, drawCircle,
  drawRamp, drawSurface, drawLabel, drawReadout, COLORS
} from '../../engine/renderer.js';
import { ChartEngine } from '../../engine/chart-engine.js';

/* ─────────────────────────────────────────────────────────────────────────── *
 * Shared base
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

  start()  { if (this.running) return; this.running = true; this._lastTs = null; this._loop(); }
  pause()  { this.running = false; if (this._raf) { cancelAnimationFrame(this._raf); this._raf = null; } }
  reset()  { this.pause(); this.time = 0; this._onReset(); this._render(); }
  dispose(){ this.pause(); }

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
 * KineticSimulation — Ec = ½·m·v²
 *
 * Body slides on frictionless surface. Adjust mass and velocity.
 * Shows how Ec grows with v² (quadratic), not linear.
 * ─────────────────────────────────────────────────────────────────────────── */

class KineticSimulation extends SimBase {
  constructor(canvas) {
    super(canvas);
    this.mass   = 2;   /* kg */
    this.v      = 5;   /* m/s */
    this.x      = 0;
    this.worldW = 100;
    this.params = { mass: 2, v: 5 };
  }

  get kineticEnergy() {
    return Physics.energy_kinetic(this.mass, this.v);
  }

  _onReset() {
    this.x    = 0;
    this.mass = this.params.mass ?? 2;
    this.v    = this.params.v    ?? 5;
  }

  _onParamChange(key, value) {
    if (key === 'mass') this.mass = value;
    if (key === 'v')    { this.v = value; this.x = 0; }
  }

  _update(dt) {
    this.x += this.v * dt;
    this.time += dt;
    if (this.x > this.worldW) this.x = 0;
  }

  _render() {
    const ctx = this.ctx;
    const cw  = this.canvas.width;
    const ch  = this.canvas.height;
    const cy  = ch / 2;
    const ec  = this.kineticEnergy;

    clearCanvas(ctx);
    drawGrid(ctx, 30);
    drawSurface(ctx, 20, cw - 20, cy + 28);

    const bx = 20 + (this.x / this.worldW) * (cw - 40);
    const sz = 28 + this.mass * 4;
    drawCircle(ctx, bx, cy, sz / 2);

    /* Velocity arrow */
    drawArrow(ctx, bx + sz / 2, cy, this.v * 6, 0, COLORS.cyan, `v=${this.v.toFixed(1)}`);

    /* Energy bar (visual) */
    const barMax  = 500; /* J max for bar */
    const barW    = 120;
    const barH    = 12;
    const barX    = cw - barW - 20;
    const barY    = ch - 50;
    const barFill = Math.min(ec / barMax, 1);

    ctx.save();
    ctx.fillStyle = '#1c1a14';
    ctx.strokeStyle = COLORS.textMuted;
    ctx.lineWidth = 1;
    ctx.fillRect(barX, barY, barW, barH);
    ctx.strokeRect(barX, barY, barW, barH);
    ctx.fillStyle = COLORS.red;
    ctx.fillRect(barX, barY, barW * barFill, barH);
    ctx.font      = '9px "Share Tech Mono", monospace';
    ctx.fillStyle = COLORS.textMuted;
    ctx.textAlign = 'right';
    ctx.fillText('Ec (J)', barX - 4, barY + 9);
    ctx.fillStyle = COLORS.red;
    ctx.textAlign = 'left';
    ctx.fillText(ec.toFixed(1), barX + barW + 4, barY + 9);
    ctx.restore();

    drawReadout(ctx, 'm',  this.mass, 'kg', 14, 20, COLORS.textMuted);
    drawReadout(ctx, 'v',  this.v,    'm/s',14, 36, COLORS.cyan);
    drawReadout(ctx, 'Ec', ec,        'J',  14, 52, COLORS.red);
  }
}

/* ─────────────────────────────────────────────────────────────────────────── *
 * RampEnergySimulation — Ep ↔ Ec on inclined plane
 *
 * Body starts at top of ramp. Slides down (with or without friction).
 * Live bars show Ep, Ec and total energy at every moment.
 * ─────────────────────────────────────────────────────────────────────────── */

class RampEnergySimulation extends SimBase {
  constructor(canvas, chartCanvas) {
    super(canvas);

    this.g          = 9.8;
    this.mass       = 2;      /* kg */
    this.angleDeg   = 30;     /* degrees */
    this.hasFriction = false;
    this.mu_k       = 0.2;

    /* Ramp geometry in world units */
    this.rampLenM   = 10;     /* m — ramp length */
    this.s          = 0;      /* m — distance along ramp from top */
    this.v          = 0;      /* m/s */

    this.params = { mass: 2, angle: 30, friction: false, mu_k: 0.2 };

    this.chart = chartCanvas
      ? new ChartEngine(chartCanvas, {
          label: 'Energia vs tempo',
          xUnit: 't (s)', yUnit: 'E (J)',
          color: '#7a4a96',
        })
      : null;

    /* Canvas layout: ramp drawn from bottom-right */
    this._rampBaseX = 0;
    this._rampBaseY = 0;
    this._pxPerMeter = 0;
    this._rampPxLen  = 0;
  }

  get angleRad() { return this.angleDeg * Math.PI / 180; }

  get height() {
    const traveled = this.s;
    return (this.rampLenM - traveled) * Math.sin(this.angleRad);
  }

  get ep() { return Physics.energy_potential(this.mass, this.g, this.height); }
  get ec() { return Physics.energy_kinetic(this.mass, this.v); }
  get etotal() { return this.ep + this.ec; }

  _onReset() {
    this.s          = 0;
    this.v          = 0;
    this.mass       = this.params.mass     ?? 2;
    this.angleDeg   = this.params.angle    ?? 30;
    this.hasFriction = this.params.friction ?? false;
    this.mu_k       = this.params.mu_k     ?? 0.2;
    if (this.chart) this.chart.clear();
  }

  _onParamChange(key, value) {
    if (key === 'mass')     this.mass       = value;
    if (key === 'angle')    this.angleDeg   = value;
    if (key === 'friction') this.hasFriction = value;
    if (key === 'mu_k')     this.mu_k       = value;
    this.s = 0; this.v = 0;
    if (this.chart) this.chart.clear();
    this.time = 0;
  }

  _update(dt) {
    const result = Physics.energy_ramp_step(
      this.s, this.v, this.rampLenM,
      this.angleRad,
      this.mass, this.mu_k,
      this.hasFriction,
      this.g, dt
    );
    this.s = result.s;
    this.v = result.v;
    this.time += dt;

    /* Stop at bottom */
    if (this.s >= this.rampLenM) { this.s = this.rampLenM; this.v = 0; this.pause(); }

    if (this.chart && (Math.round(this.time * 60) % 3 === 0)) {
      this.chart.addPoint(this.time, this.ep);
    }
  }

  _render() {
    const ctx = this.ctx;
    const cw  = this.canvas.width;
    const ch  = this.canvas.height;

    clearCanvas(ctx);
    drawGrid(ctx, 30);

    /* Compute ramp pixel geometry */
    const margin    = 40;
    const rampPxLen = (cw - margin * 2) * 0.65;
    const baseX     = margin + rampPxLen;
    const baseY     = ch - margin;
    const rad       = this.angleRad;
    const topX      = baseX - rampPxLen * Math.cos(rad);
    const topY      = baseY - rampPxLen * Math.sin(rad);

    drawRamp(ctx, baseX, baseY, rampPxLen, rad);

    /* Body position along ramp */
    const pxPerM = rampPxLen / this.rampLenM;
    const bodyS  = this.s * pxPerM; /* pixels from top */
    const bodyX  = topX + bodyS * Math.cos(rad);
    const bodyY  = topY + bodyS * Math.sin(rad);

    drawCircle(ctx, bodyX, bodyY, 14);

    /* Height annotation */
    const h = this.height;
    if (h > 0.05) {
      ctx.save();
      ctx.strokeStyle = COLORS.textMuted;
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(bodyX, bodyY);
      ctx.lineTo(bodyX, baseY);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.font      = '10px "Share Tech Mono", monospace';
      ctx.fillStyle = COLORS.textMuted;
      ctx.textAlign = 'left';
      ctx.fillText(`h=${h.toFixed(2)}m`, bodyX + 6, (bodyY + baseY) / 2);
      ctx.restore();
    }

    /* Energy bars */
    this._drawEnergyBars(ctx, cw, ch);

    /* HUD */
    drawReadout(ctx, 'h',   h,          'm', 14, 20, COLORS.textMuted);
    drawReadout(ctx, 'v',   this.v,     'm/s',14, 36, COLORS.cyan);
    drawReadout(ctx, 'Ep',  this.ep,    'J',  14, 52, COLORS.red);
    drawReadout(ctx, 'Ec',  this.ec,    'J',  14, 68, COLORS.green);
    drawReadout(ctx, 'E_t', this.etotal,'J',  14, 84, COLORS.amber);

    if (this.chart) this.chart.render();
  }

  _drawEnergyBars(ctx, cw, ch) {
    const totalE0 = Physics.energy_potential(this.mass, this.g,
      this.rampLenM * Math.sin(this.angleRad));
    const maxE    = Math.max(totalE0, 1);
    const barH    = 80;
    const barW    = 18;
    const barsX   = cw - 70;
    const barsY   = ch - barH - 30;

    const bars = [
      { label: 'Ep', val: this.ep,    color: COLORS.red   },
      { label: 'Ec', val: this.ec,    color: COLORS.cyan  },
      { label: 'Et', val: this.etotal,color: COLORS.amber },
    ];

    ctx.save();
    bars.forEach((b, i) => {
      const x    = barsX + i * (barW + 6);
      const fill = Math.min(b.val / maxE, 1);
      const fillH = barH * fill;

      ctx.fillStyle   = '#1c1a14';
      ctx.strokeStyle = COLORS.textMuted;
      ctx.lineWidth   = 0.5;
      ctx.fillRect(x, barsY, barW, barH);
      ctx.strokeRect(x, barsY, barW, barH);

      ctx.fillStyle = b.color + '99';
      ctx.fillRect(x, barsY + barH - fillH, barW, fillH);

      ctx.font      = '9px "Share Tech Mono", monospace';
      ctx.fillStyle = b.color;
      ctx.textAlign = 'center';
      ctx.fillText(b.label, x + barW / 2, barsY + barH + 10);
    });
    ctx.restore();
  }
}

/* ─────────────────────────────────────────────────────────────────────────── *
 * ConservationSimulation — Energy conservation comparison
 *
 * Same ramp, side-by-side: left = no friction, right = with friction.
 * Both start at the same height. Energy bars track each case.
 * ─────────────────────────────────────────────────────────────────────────── */

class ConservationSimulation extends SimBase {
  constructor(canvas) {
    super(canvas);

    this.g          = 9.8;
    this.mass       = 2;
    this.angleDeg   = 30;
    this.mu_k       = 0.25;
    this.rampLenM   = 10;

    /* Body A — no friction */
    this.sA = 0; this.vA = 0;
    /* Body B — with friction */
    this.sB = 0; this.vB = 0;

    this.params = { mass: 2, angle: 30, mu_k: 0.25 };
  }

  get angleRad()  { return this.angleDeg * Math.PI / 180; }
  get heightA()   { return (this.rampLenM - this.sA) * Math.sin(this.angleRad); }
  get heightB()   { return (this.rampLenM - this.sB) * Math.sin(this.angleRad); }
  get epA() { return Physics.energy_potential(this.mass, this.g, this.heightA); }
  get ecA() { return Physics.energy_kinetic(this.mass, this.vA); }
  get epB() { return Physics.energy_potential(this.mass, this.g, this.heightB); }
  get ecB() { return Physics.energy_kinetic(this.mass, this.vB); }

  _onReset() {
    this.sA = 0; this.vA = 0;
    this.sB = 0; this.vB = 0;
    this.mass     = this.params.mass  ?? 2;
    this.angleDeg = this.params.angle ?? 30;
    this.mu_k     = this.params.mu_k  ?? 0.25;
  }

  _onParamChange(key, value) {
    if (key === 'mass')  this.mass     = value;
    if (key === 'angle') this.angleDeg = value;
    if (key === 'mu_k')  this.mu_k     = value;
    this.sA = 0; this.vA = 0;
    this.sB = 0; this.vB = 0;
    this.time = 0;
  }

  _update(dt) {
    const rad = this.angleRad;
    /* A: frictionless */
    const rA = Physics.energy_ramp_step(this.sA, this.vA, this.rampLenM, rad, this.mass, 0,         false, this.g, dt);
    /* B: with friction */
    const rB = Physics.energy_ramp_step(this.sB, this.vB, this.rampLenM, rad, this.mass, this.mu_k, true,  this.g, dt);
    this.sA = rA.s; this.vA = rA.v;
    this.sB = rB.s; this.vB = rB.v;
    this.time += dt;
    if (this.sA >= this.rampLenM) { this.sA = this.rampLenM; this.vA = 0; }
    if (this.sB >= this.rampLenM) { this.sB = this.rampLenM; this.vB = 0; }
    if (this.sA >= this.rampLenM && this.sB >= this.rampLenM) this.pause();
  }

  _render() {
    const ctx = this.ctx;
    const cw  = this.canvas.width;
    const ch  = this.canvas.height;

    clearCanvas(ctx);
    drawGrid(ctx, 30);

    const margin = 30;
    const halfW  = (cw - margin * 3) / 2;
    const rad    = this.angleRad;
    const baseY  = ch - margin;
    const totalE0 = Physics.energy_potential(this.mass, this.g, this.rampLenM * Math.sin(rad));

    /* Draw two ramps side by side */
    this._drawHalf(ctx, margin, halfW, baseY, rad, this.sA, this.vA, this.epA, this.ecA, totalE0, false, COLORS.cyan, 'Sem atrito');
    this._drawHalf(ctx, margin * 2 + halfW, halfW, baseY, rad, this.sB, this.vB, this.epB, this.ecB, totalE0, true, COLORS.amber, `μk = ${this.mu_k}`);
  }

  _drawHalf(ctx, offsetX, w, baseY, rad, s, v, ep, ec, totalE0, hasFriction, color, tag) {
    ctx.save();
    ctx.translate(offsetX, 0);

    const rampPxLen = w * 0.85;
    const bX        = rampPxLen;
    const topX      = bX - rampPxLen * Math.cos(rad);  /* correct ramp top X */
    const topY      = baseY - rampPxLen * Math.sin(rad);

    drawRamp(ctx, bX, baseY, rampPxLen, rad);

    const pxPerM  = rampPxLen / this.rampLenM;
    const bodyPxS = s * pxPerM;
    const bodyX   = topX + bodyPxS * Math.cos(rad);
    const bodyY   = topY + bodyPxS * Math.sin(rad);
    drawCircle(ctx, bodyX, bodyY, 12, '#1c1a14', color);

    /* Energy bar */
    const maxE = Math.max(totalE0, 1);
    const barH = 50;
    const barX = w - 24;
    ctx.fillStyle = '#1c1a14';
    ctx.fillRect(barX, baseY - barH, 14, barH);

    const epFill = (ep / maxE) * barH;
    const ecFill = (ec / maxE) * barH;
    ctx.fillStyle = COLORS.red + '88';
    ctx.fillRect(barX, baseY - epFill, 14, epFill);
    ctx.fillStyle = COLORS.cyan + '88';
    ctx.fillRect(barX, baseY - epFill - ecFill, 14, ecFill);

    ctx.font      = '9px "Share Tech Mono", monospace';
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.fillText(tag, rampPxLen / 2, baseY + 14);

    ctx.restore();
  }
}

/* ─────────────────────────────────────────────────────────────────────────── *
 * Factory
 * ─────────────────────────────────────────────────────────────────────────── */

/**
 * @param {string} simId — 'kinetic' | 'ramp-energy' | 'conservation'
 * @param {HTMLCanvasElement} canvas
 * @param {HTMLCanvasElement|null} chartCanvas
 * @returns {SimBase}
 */
function createEnergySimulation(simId, canvas, chartCanvas) {
  switch (simId) {
    case 'kinetic':      return new KineticSimulation(canvas);
    case 'ramp-energy':  return new RampEnergySimulation(canvas, chartCanvas);
    case 'conservation': return new ConservationSimulation(canvas);
    default:
      console.warn(`[energy] Unknown simulation ID: ${simId}`);
      return new RampEnergySimulation(canvas, chartCanvas);
  }
}

export { createEnergySimulation, KineticSimulation, RampEnergySimulation, ConservationSimulation };
