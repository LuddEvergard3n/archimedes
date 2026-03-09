/**
 * modules/fluids/fluids.js — Fluids simulation module
 *
 * Simulations:
 *   buoyancy  — Archimedes' principle: E = ρf·g·V_sub
 *   density   — Floating/sinking based on density ratio
 *   pressure  — Hydrostatic pressure: P = P₀ + ρ·g·h
 */

import { Physics } from '../../js/wasm-loader.js';
import {
  clearCanvas, drawGrid, drawArrow, drawRect, drawCircle,
  drawFluidContainer, drawLabel, drawReadout, COLORS
} from '../../engine/renderer.js';

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
 * BuoyancySimulation — Archimedes' principle
 *
 * Object dropped into fluid. Reaches equilibrium based on density ratio.
 * User can change object density and fluid density.
 * Displays buoyancy force, weight, and net force arrows.
 * ─────────────────────────────────────────────────────────────────────────── */

class BuoyancySimulation extends SimBase {
  constructor(canvas) {
    super(canvas);

    this.g              = 9.8;
    this.objDensity     = 600;   /* kg/m³ — wood-like: floats */
    this.fluidDensity   = 1000;  /* kg/m³ — water */
    this.objSideM       = 0.1;   /* m — cube side */

    /* Derived */
    this.objVolume = this.objSideM ** 3; /* m³ */
    this.objMass   = this.objDensity * this.objVolume;

    /* Canvas layout constants (set on first render) */
    this._containerX = 0;
    this._containerY = 0;
    this._containerW = 0;
    this._containerH = 0;
    this._fluidFrac  = 0.85;

    /* Dynamic state: y = vertical center of object in canvas pixels */
    this.y    = 0;  /* initialized in _onReset */
    this.vy   = 0;  /* m/s */
    this._pxPerM = 100; /* pixels per meter — set in render */

    this.params = { objDensity: 600, fluidDensity: 1000 };
  }

  _onReset() {
    this.objDensity   = this.params.objDensity   ?? 600;
    this.fluidDensity = this.params.fluidDensity ?? 1000;
    this.objMass      = this.objDensity * this.objVolume;
    this.vy = 0;
    /* Start object above fluid */
    this.y = this._containerY > 0
      ? this._containerY - 30
      : 50;
  }

  _onParamChange(key, value) {
    if (key === 'objDensity') {
      this.objDensity = value;
      this.objMass    = value * this.objVolume;
    }
    if (key === 'fluidDensity') this.fluidDensity = value;
    this.vy = 0;
    /* Reset position to top */
    this.y  = this._containerY > 0 ? this._containerY - 20 : 50;
    this.time = 0;
  }

  _update(dt) {
    /* Container geometry in meters */
    const fluidTopPx = this._containerY + this._containerH * (1 - this._fluidFrac);
    const fluidTopM  = 0;
    const objHeightM = this.objSideM;
    const pxPerM     = this._pxPerM;

    /* Convert y (canvas px) to physical y (m, 0 = fluid surface, + = above) */
    const yM        = (fluidTopPx - this.y) / pxPerM;
    const containerBottomM = this._containerH * this._fluidFrac / pxPerM;

    const result = Physics.fluids_object_step(
      yM, this.vy / pxPerM,
      this.objDensity, objHeightM, this.objVolume,
      this.fluidDensity,
      this.g, dt,
      0,                   /* fluid surface at yM = 0 */
      -containerBottomM    /* container bottom (negative = below surface) */
    );

    /* Convert back to canvas coordinates */
    this.y  = fluidTopPx - result.y * pxPerM;
    this.vy = result.v * pxPerM;

    /* Clamp to container bounds */
    const maxY = this._containerY + this._containerH - 10;
    const minY = this._containerY + 10;
    if (this.y > maxY) { this.y = maxY; this.vy = 0; }
    if (this.y < minY) { this.y = minY; this.vy = 0; }

    this.time += dt;
    this._subFrac = result.submerged_fraction;
  }

  _render() {
    const ctx = this.ctx;
    const cw  = this.canvas.width;
    const ch  = this.canvas.height;

    /* Set container geometry on first render */
    if (this._containerW === 0) {
      this._containerX = cw * 0.25;
      this._containerY = ch * 0.10;
      this._containerW = cw * 0.50;
      this._containerH = ch * 0.78;
      this._pxPerM     = this._containerH * this._fluidFrac / 2.0;
      /* Start object above fluid */
      this.y = this._containerY + this._containerH * (1 - this._fluidFrac) - 20;
    }

    clearCanvas(ctx);
    drawGrid(ctx, 30);

    /* Fluid container */
    drawFluidContainer(
      ctx,
      this._containerX, this._containerY,
      this._containerW, this._containerH,
      this._fluidFrac,
      `rgba(0, ${this.fluidDensity > 1200 ? 60 : 80}, 200, 0.28)`
    );

    /* Fluid density label */
    ctx.save();
    ctx.font      = '9px "JetBrains Mono", monospace';
    ctx.fillStyle = 'rgba(0, 150, 255, 0.6)';
    ctx.textAlign = 'center';
    ctx.fillText(
      `ρ_f = ${this.fluidDensity} kg/m³`,
      this._containerX + this._containerW / 2,
      this._containerY + this._containerH * (1 - this._fluidFrac) + 14
    );
    ctx.restore();

    /* Object (cube) */
    const pxSide = this.objSideM * this._pxPerM * 1.5;
    const bx     = this._containerX + this._containerW / 2;
    const by     = this.y;

    drawRect(ctx, bx, by, pxSide, pxSide, '#1a2d1a', COLORS.green);

    /* Density label inside object */
    ctx.save();
    ctx.font      = '9px "JetBrains Mono", monospace';
    ctx.fillStyle = COLORS.textMuted;
    ctx.textAlign = 'center';
    ctx.fillText(`${this.objDensity}`, bx, by + 3);
    ctx.restore();

    /* Forces */
    const weight   = Physics.forces_weight(this.objMass, this.g);
    const subF     = (this._subFrac ?? 0);
    const subVol   = subF * this.objVolume;
    const buoyancy = Physics.fluids_buoyancy(this.fluidDensity, this.g, subVol);
    const netF     = buoyancy - weight;

    /* Weight arrow (down) */
    const wScale = 40 / 20;
    drawArrow(ctx, bx, by + pxSide / 2, 0, weight * wScale, COLORS.red, `P=${weight.toFixed(1)}N`);

    /* Buoyancy arrow (up) */
    if (buoyancy > 0.1) {
      drawArrow(ctx, bx, by - pxSide / 2, 0, -buoyancy * wScale, COLORS.cyan, `E=${buoyancy.toFixed(1)}N`);
    }

    /* Equilibrium status */
    const status = Math.abs(netF) < 0.5 ? 'Equilíbrio' :
                   netF > 0 ? 'Sobe' : 'Afunda';
    const statusColor = Math.abs(netF) < 0.5 ? COLORS.cyan : netF > 0 ? COLORS.green : COLORS.red;

    drawReadout(ctx, 'P',    weight,   'N',    14, 20, COLORS.red);
    drawReadout(ctx, 'E',    buoyancy, 'N',    14, 36, COLORS.cyan);
    drawReadout(ctx, 'F_net',netF,     'N',    14, 52, statusColor);
    drawLabel(ctx, status, 14, 68, statusColor);
  }
}

/* ─────────────────────────────────────────────────────────────────────────── *
 * DensitySimulation — ρ = m/V and floating condition
 *
 * Static display. User changes object density relative to fluid.
 * Shows equilibrium submersion depth visually.
 * ─────────────────────────────────────────────────────────────────────────── */

class DensitySimulation extends SimBase {
  constructor(canvas) {
    super(canvas);
    this.objDensity   = 700;  /* kg/m³ */
    this.fluidDensity = 1000; /* kg/m³ */
    this.params = { objDensity: 700, fluidDensity: 1000 };
  }

  _onReset() {
    this.objDensity   = this.params.objDensity   ?? 700;
    this.fluidDensity = this.params.fluidDensity ?? 1000;
  }

  _onParamChange(key, value) {
    if (key === 'objDensity')   this.objDensity   = value;
    if (key === 'fluidDensity') this.fluidDensity = value;
  }

  _update(dt) { this.time += dt; }

  _render() {
    const ctx = this.ctx;
    const cw  = this.canvas.width;
    const ch  = this.canvas.height;

    clearCanvas(ctx);
    drawGrid(ctx, 30);

    const containerX = cw * 0.20;
    const containerY = ch * 0.10;
    const containerW = cw * 0.60;
    const containerH = ch * 0.78;
    const fluidFrac  = 0.75;

    drawFluidContainer(ctx, containerX, containerY, containerW, containerH, fluidFrac);

    /* Compute equilibrium submersion */
    const subFrac   = Physics.fluids_equilibrium_fraction(this.objDensity, this.fluidDensity);
    const sinks     = this.objDensity > this.fluidDensity;
    const floats    = this.objDensity < this.fluidDensity;
    const neutral   = !sinks && !floats;

    const objSize   = containerW * 0.25;
    const fluidTopY = containerY + containerH * (1 - fluidFrac);
    const maxObjY   = containerY + containerH - objSize / 2 - 4;

    /* Object Y center */
    let objY;
    if (sinks) {
      objY = maxObjY;
    } else if (floats) {
      /* Partially submerged */
      const subPx = objSize * subFrac;
      objY = fluidTopY + subPx - objSize / 2;
    } else {
      /* Neutrally buoyant: suspended at mid-fluid */
      objY = fluidTopY + (containerH * fluidFrac) * 0.5;
    }

    const objColor = sinks ? COLORS.red : floats ? COLORS.green : COLORS.cyan;
    drawRect(ctx, containerX + containerW / 2, objY, objSize, objSize, '#0a1520', objColor);

    /* Submersion indicator */
    if (!sinks) {
      ctx.save();
      ctx.strokeStyle = COLORS.textMuted;
      ctx.setLineDash([3, 3]);
      ctx.lineWidth   = 1;
      ctx.beginPath();
      ctx.moveTo(containerX + containerW / 2 - objSize / 2 - 6, fluidTopY);
      ctx.lineTo(containerX + containerW / 2 + objSize / 2 + 6, fluidTopY);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.font      = '9px "JetBrains Mono", monospace';
      ctx.fillStyle = COLORS.textMuted;
      ctx.textAlign = 'center';
      const subPct = (subFrac * 100).toFixed(0);
      ctx.fillText(`${subPct}% submerso`, containerX + containerW / 2, fluidTopY + containerH * fluidFrac * 0.3);
      ctx.restore();
    }

    /* Status */
    const status     = sinks ? 'Afunda' : neutral ? 'Neutro' : 'Flutua';
    const statusColor = sinks ? COLORS.red : neutral ? COLORS.cyan : COLORS.green;

    ctx.save();
    ctx.font      = '13px "JetBrains Mono", monospace';
    ctx.fillStyle = statusColor;
    ctx.textAlign = 'center';
    ctx.fillText(status, containerX + containerW / 2, containerY + containerH + 22);
    ctx.restore();

    drawReadout(ctx, 'ρ_obj',   this.objDensity,   'kg/m³', 14, 20, objColor);
    drawReadout(ctx, 'ρ_fluido',this.fluidDensity,  'kg/m³', 14, 36, COLORS.cyan);
    drawReadout(ctx, 'ρ_obj/ρ_f', (this.objDensity / this.fluidDensity).toFixed(2), '', 14, 52, COLORS.textMuted);
  }
}

/* ─────────────────────────────────────────────────────────────────────────── *
 * PressureSimulation — P = P₀ + ρ·g·h
 *
 * Fluid column. User drags a depth indicator.
 * Live pressure readout at chosen depth.
 * ─────────────────────────────────────────────────────────────────────────── */

class PressureSimulation extends SimBase {
  constructor(canvas) {
    super(canvas);

    this.g            = 9.8;
    this.p0           = 101325; /* Pa — atmospheric */
    this.fluidDensity = 1000;   /* kg/m³ */
    this.fluidDepthM  = 3.0;    /* m — total fluid column */
    this.probeDepthM  = 1.5;    /* m — user-adjustable probe depth */

    /* Layout computed on render */
    this._containerX = 0;
    this._containerH = 0;
    this._pxPerM     = 0;

    this.params = { fluidDensity: 1000, probeDepth: 1.5, fluidDepth: 3 };
  }

  _onReset() {
    this.fluidDensity = this.params.fluidDensity ?? 1000;
    this.probeDepthM  = this.params.probeDepth   ?? 1.5;
    this.fluidDepthM  = this.params.fluidDepth   ?? 3;
  }

  _onParamChange(key, value) {
    if (key === 'fluidDensity') this.fluidDensity = value;
    if (key === 'probeDepth')   this.probeDepthM  = Math.min(value, this.fluidDepthM);
    if (key === 'fluidDepth')   this.fluidDepthM  = value;
  }

  get pressure() {
    return Physics.fluids_pressure(this.p0, this.fluidDensity, this.g, this.probeDepthM);
  }

  _update(dt) { this.time += dt; }

  _render() {
    const ctx = this.ctx;
    const cw  = this.canvas.width;
    const ch  = this.canvas.height;

    const cx        = cw * 0.25;
    const cy        = ch * 0.08;
    const cW        = cw * 0.50;
    const cH        = ch * 0.80;
    const fluidFrac = 0.90;
    const pxPerM    = (cH * fluidFrac) / this.fluidDepthM;

    this._containerX = cx;
    this._containerH = cH;
    this._pxPerM     = pxPerM;

    clearCanvas(ctx);
    drawGrid(ctx, 30);

    drawFluidContainer(ctx, cx, cy, cW, cH, fluidFrac,
      `rgba(0, 80, 200, 0.22)`);

    const fluidTopY   = cy + cH * (1 - fluidFrac);
    const probeY      = fluidTopY + this.probeDepthM * pxPerM;

    /* Depth markers on right side */
    ctx.save();
    ctx.font      = '9px "JetBrains Mono", monospace';
    ctx.fillStyle = COLORS.textMuted;
    ctx.textAlign = 'left';
    const step = Math.ceil(this.fluidDepthM / 5);
    for (let d = 0; d <= this.fluidDepthM; d += step) {
      const py = fluidTopY + d * pxPerM;
      ctx.fillText(`${d}m`, cx + cW + 6, py + 3);
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(54, 79, 104, 0.3)';
      ctx.lineWidth   = 0.5;
      ctx.moveTo(cx, py);
      ctx.lineTo(cx + cW, py);
      ctx.stroke();
    }
    ctx.restore();

    /* Pressure gradient (darker at bottom) */
    const grad = ctx.createLinearGradient(0, fluidTopY, 0, fluidTopY + this.fluidDepthM * pxPerM);
    grad.addColorStop(0, 'rgba(0, 80, 200, 0.0)');
    grad.addColorStop(1, 'rgba(0, 80, 200, 0.18)');
    ctx.fillStyle = grad;
    ctx.fillRect(cx + 1, fluidTopY, cW - 2, this.fluidDepthM * pxPerM);

    /* Probe line */
    ctx.save();
    ctx.strokeStyle = COLORS.amber;
    ctx.lineWidth   = 1.5;
    ctx.setLineDash([6, 3]);
    ctx.beginPath();
    ctx.moveTo(cx + 4, probeY);
    ctx.lineTo(cx + cW - 4, probeY);
    ctx.stroke();
    ctx.setLineDash([]);

    /* Probe label */
    ctx.font      = '10px "JetBrains Mono", monospace';
    ctx.fillStyle = COLORS.amber;
    ctx.textAlign = 'center';
    ctx.fillText(`h = ${this.probeDepthM.toFixed(1)} m`, cx + cW / 2, probeY - 6);
    ctx.restore();

    /* Pressure value at probe */
    const P     = this.pressure;
    const P_atm = (P / 101325).toFixed(2);

    ctx.save();
    ctx.font      = '11px "JetBrains Mono", monospace';
    ctx.fillStyle = COLORS.cyan;
    ctx.textAlign = 'center';
    ctx.fillText(`P = ${(P / 1000).toFixed(2)} kPa`, cx + cW / 2, probeY + 16);
    ctx.fillStyle = COLORS.textMuted;
    ctx.fillText(`≈ ${P_atm} atm`, cx + cW / 2, probeY + 28);
    ctx.restore();

    /* HUD */
    drawReadout(ctx, 'ρ_f', this.fluidDensity, 'kg/m³', 14, 20, COLORS.cyan);
    drawReadout(ctx, 'h',   this.probeDepthM,  'm',     14, 36, COLORS.amber);
    drawReadout(ctx, 'P₀',  (this.p0 / 1000).toFixed(1), 'kPa', 14, 52, COLORS.textMuted);
    drawReadout(ctx, 'P',   (P / 1000).toFixed(2), 'kPa', 14, 68, COLORS.cyan);
  }
}

/* ─────────────────────────────────────────────────────────────────────────── *
 * Factory
 * ─────────────────────────────────────────────────────────────────────────── */

/**
 * @param {string} simId — 'buoyancy' | 'density' | 'pressure'
 * @param {HTMLCanvasElement} canvas
 * @param {HTMLCanvasElement|null} chartCanvas
 * @returns {SimBase}
 */
function createFluidsSimulation(simId, canvas, chartCanvas) {
  void chartCanvas; /* reserved for future use */
  switch (simId) {
    case 'buoyancy': return new BuoyancySimulation(canvas);
    case 'density':  return new DensitySimulation(canvas);
    case 'pressure': return new PressureSimulation(canvas);
    default:
      console.warn(`[fluids] Unknown simulation ID: ${simId}`);
      return new BuoyancySimulation(canvas);
  }
}

export { createFluidsSimulation, BuoyancySimulation, DensitySimulation, PressureSimulation };
