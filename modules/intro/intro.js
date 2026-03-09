/**
 * modules/intro/intro.js — Introduction to Physics module
 *
 * Simulations:
 *   pendulum-observe — Simple pendulum to observe periodic phenomenon
 *   units-demo       — Physical quantities and units
 */

import {
  clearCanvas, drawGrid, drawArrow, drawCircle,
  drawSurface, drawLabel, drawReadout, COLORS
} from '../../engine/renderer.js';

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

  start()   { if (this.running) return; this.running = true; this._lastTs = null; this._loop(); }
  pause()   { this.running = false; if (this._raf) { cancelAnimationFrame(this._raf); this._raf = null; } }
  reset()   { this.pause(); this.time = 0; this._onReset(); this._render(); }
  dispose() { this.pause(); }

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
 * PendulumSimulation — observe periodic motion
 * ─────────────────────────────────────────────────────────────────────────── */

class PendulumSimulation extends SimBase {
  constructor(canvas) {
    super(canvas);
    this.g        = 9.8;
    this.lengthM  = 1.0;   /* m */
    this.theta0   = 0.6;   /* rad — initial angle */
    this.theta    = 0.6;
    this.omega    = 0;     /* angular velocity rad/s */
    this.params   = { length: 1.0, angle: 0.6 };
  }

  _onReset() {
    this.lengthM = this.params.length ?? 1.0;
    this.theta0  = this.params.angle  ?? 0.6;
    this.theta   = this.theta0;
    this.omega   = 0;
  }

  _onParamChange(key, value) {
    if (key === 'length') { this.lengthM = value; }
    if (key === 'angle')  { this.theta0  = value; this.theta = value; this.omega = 0; }
  }

  _update(dt) {
    /* Simple pendulum: θ'' = -(g/L)·sin(θ) */
    const alpha = -(this.g / this.lengthM) * Math.sin(this.theta);
    this.omega  += alpha * dt;
    this.theta  += this.omega * dt;
    this.time   += dt;
  }

  _render() {
    const ctx    = this.ctx;
    const cw     = this.canvas.width;
    const ch     = this.canvas.height;
    const pivotX = cw / 2;
    const pivotY = ch * 0.15;

    clearCanvas(ctx);
    drawGrid(ctx, 30);

    /* Pivot */
    ctx.save();
    ctx.fillStyle = COLORS.surface;
    ctx.fillRect(pivotX - 20, pivotY - 8, 40, 8);
    ctx.restore();

    /* Scale: 1 m = 160px */
    const scale  = 160;
    const lenPx  = this.lengthM * scale;
    const bobX   = pivotX + lenPx * Math.sin(this.theta);
    const bobY   = pivotY + lenPx * Math.cos(this.theta);

    /* String */
    ctx.save();
    ctx.strokeStyle = COLORS.textMuted;
    ctx.lineWidth   = 1.5;
    ctx.beginPath();
    ctx.moveTo(pivotX, pivotY);
    ctx.lineTo(bobX, bobY);
    ctx.stroke();
    ctx.restore();

    /* Bob */
    drawCircle(ctx, bobX, bobY, 16);

    /* Angle arc */
    if (Math.abs(this.theta0) > 0.05) {
      ctx.save();
      ctx.strokeStyle = 'rgba(0, 212, 255, 0.20)';
      ctx.lineWidth   = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(pivotX, pivotY, 40, Math.PI / 2 - this.theta0, Math.PI / 2 + this.theta0);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    /* Period estimation T = 2π√(L/g) */
    const T = 2 * Math.PI * Math.sqrt(this.lengthM / this.g);

    drawReadout(ctx, 'L',  this.lengthM, 'm',   14, 20, COLORS.cyan);
    drawReadout(ctx, 'θ',  (this.theta * 180 / Math.PI).toFixed(1), '°', 14, 36, COLORS.amber);
    drawReadout(ctx, 'T',  T.toFixed(2), 's',  14, 52, COLORS.green);
    drawReadout(ctx, 't',  this.time,    's',  14, 68, COLORS.textMuted);

    /* Observation prompt */
    ctx.save();
    ctx.font      = '11px "JetBrains Mono", monospace';
    ctx.fillStyle = COLORS.textMuted;
    ctx.textAlign = 'center';
    ctx.fillText('Observe: o período depende de L, não da amplitude.', cw / 2, ch - 16);
    ctx.restore();
  }
}

/* ─────────────────────────────────────────────────────────────────────────── *
 * UnitsDemoSimulation — physical quantities and units
 * ─────────────────────────────────────────────────────────────────────────── */

class UnitsDemoSimulation extends SimBase {
  constructor(canvas) {
    super(canvas);
    this.time = 0;
    this._phase = 0;
  }

  _update(dt) {
    this.time   += dt;
    this._phase += dt;
  }

  _render() {
    const ctx = this.ctx;
    const cw  = this.canvas.width;
    const ch  = this.canvas.height;

    clearCanvas(ctx);
    drawGrid(ctx, 30);

    /* Animated ruler for length */
    const pulse = 0.5 + 0.5 * Math.sin(this._phase * 1.5);
    const rulerW = 200 + pulse * 40;
    const rulerX = cw / 2 - rulerW / 2;
    const rulerY = ch * 0.25;

    ctx.save();
    ctx.strokeStyle = COLORS.cyan;
    ctx.lineWidth   = 2;
    ctx.beginPath();
    ctx.moveTo(rulerX, rulerY);
    ctx.lineTo(rulerX + rulerW, rulerY);
    /* End ticks */
    ctx.moveTo(rulerX, rulerY - 8); ctx.lineTo(rulerX, rulerY + 8);
    ctx.moveTo(rulerX + rulerW, rulerY - 8); ctx.lineTo(rulerX + rulerW, rulerY + 8);
    ctx.stroke();
    ctx.font      = '11px "JetBrains Mono", monospace';
    ctx.fillStyle = COLORS.cyan;
    ctx.textAlign = 'center';
    ctx.fillText(`${(rulerW / 80).toFixed(2)} m`, rulerX + rulerW / 2, rulerY - 14);
    ctx.restore();

    /* Animated mass */
    const massSize = 30 + pulse * 10;
    const massX    = cw * 0.25;
    const massY    = ch * 0.55;
    ctx.save();
    ctx.fillStyle   = '#1a2d1a';
    ctx.strokeStyle = COLORS.amber;
    ctx.lineWidth   = 2;
    ctx.fillRect(massX - massSize / 2, massY - massSize / 2, massSize, massSize);
    ctx.strokeRect(massX - massSize / 2, massY - massSize / 2, massSize, massSize);
    ctx.font      = '10px "JetBrains Mono", monospace';
    ctx.fillStyle = COLORS.amber;
    ctx.textAlign = 'center';
    ctx.fillText(`${(massSize / 10).toFixed(1)} kg`, massX, massY - massSize / 2 - 8);
    ctx.restore();

    /* Animated timer */
    const timerX = cw * 0.72;
    const timerY = ch * 0.50;
    const angle  = (this._phase % (2 * Math.PI));

    ctx.save();
    ctx.strokeStyle = COLORS.green;
    ctx.lineWidth   = 2;
    ctx.beginPath();
    ctx.arc(timerX, timerY, 30, 0, 2 * Math.PI);
    ctx.stroke();
    /* Hand */
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(timerX, timerY);
    ctx.lineTo(timerX + 24 * Math.sin(angle), timerY - 24 * Math.cos(angle));
    ctx.stroke();
    ctx.font      = '10px "JetBrains Mono", monospace';
    ctx.fillStyle = COLORS.green;
    ctx.textAlign = 'center';
    ctx.fillText(`${this.time.toFixed(1)} s`, timerX, timerY + 44);
    ctx.restore();

    /* Bottom labels */
    ctx.save();
    ctx.font      = '10px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    const labels = [
      { x: cw / 2, label: 'Comprimento [m]',   color: COLORS.cyan  },
      { x: massX,  label: 'Massa [kg]',         color: COLORS.amber },
      { x: timerX, label: 'Tempo [s]',          color: COLORS.green },
    ];
    for (const l of labels) {
      ctx.fillStyle = l.color;
      ctx.fillText(l.label, l.x, ch - 16);
    }
    ctx.restore();
  }
}

/* ─────────────────────────────────────────────────────────────────────────── *
 * Factory
 * ─────────────────────────────────────────────────────────────────────────── */

function createIntroSimulation(simId, canvas) {
  switch (simId) {
    case 'pendulum-observe': return new PendulumSimulation(canvas);
    case 'units-demo':       return new UnitsDemoSimulation(canvas);
    default:
      console.warn(`[intro] Unknown simulation ID: ${simId}`);
      return new PendulumSimulation(canvas);
  }
}

export { createIntroSimulation, PendulumSimulation, UnitsDemoSimulation };
