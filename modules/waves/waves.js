/**
 * waves.js — Módulo de Ondas e Oscilações
 *
 * Simulações:
 *   - TransverseWaveSimulation  : onda transversal propagando em corda
 *   - SuperpositionSimulation   : superposição de dois modos (interferência/batimento)
 *   - PendulumWaveSimulation    : pêndulo simples com fase e período real
 *   - SpringMassSimulation      : oscilador massa-mola com gráfico de posição
 *
 * Todas implementam a interface padrão:
 *   start(), pause(), reset(), setParam(key, value),
 *   onTimeUpdate(fn), dispose()
 *
 * Importam Physics de wasm-loader — WASM preferido, fallback JS automático.
 */

import { Physics } from '../../js/wasm-loader.js';
import {
  clearCanvas, drawGrid, drawArrow, drawCircle, drawLabel,
  drawSurface, COLORS,
} from '../../engine/renderer.js';
import { ChartEngine, DualChartEngine } from '../../engine/chart-engine.js';

const TWO_PI = 2 * Math.PI;

/* ─────────────────────────────────────────────────────────────────────────── *
 * TransverseWaveSimulation
 *
 * Renderiza y(x,t) = A·sin(kx − ωt) numa corda estendida horizontalmente.
 * Parâmetros: amplitude (m), frequência (Hz), comprimento de onda (m).
 * ─────────────────────────────────────────────────────────────────────────── */

export class TransverseWaveSimulation {
  /**
   * @param {HTMLCanvasElement} canvas
   */
  constructor(canvas) {
    this._canvas  = canvas;
    this._ctx     = canvas.getContext('2d');
    this._running = false;
    this._t       = 0;
    this._raf     = null;
    this._cb      = null;
    this._last    = null;

    /* Parâmetros físicos */
    this._A   = 0.4;   /* amplitude normalizada 0..1 */
    this._f   = 1.0;   /* Hz */
    this._lam = 2.0;   /* comprimento de onda (unidade: largura do canvas) */

    this._draw(0);
  }

  setParam(key, value) {
    if (key === 'amplitude')   this._A   = Math.max(0.05, Math.min(0.95, value));
    if (key === 'frequency')   this._f   = Math.max(0.1, Math.min(5, value));
    if (key === 'wavelength')  this._lam = Math.max(0.5, Math.min(4, value));
  }

  start() {
    if (this._running) return;
    this._running = true;
    this._last    = performance.now();
    this._loop();
  }

  pause() {
    this._running = false;
    if (this._raf) { cancelAnimationFrame(this._raf); this._raf = null; }
  }

  reset() {
    this.pause();
    this._t = 0;
    this._draw(0);
    if (this._cb) this._cb(0);
  }

  onTimeUpdate(fn) { this._cb = fn; }

  dispose() { this.pause(); }

  _loop() {
    if (!this._running) return;
    const now = performance.now();
    const dt  = Math.min((now - this._last) / 1000, 0.033);
    this._last = now;
    this._t   += dt;
    this._draw(this._t);
    if (this._cb) this._cb(this._t);
    this._raf = requestAnimationFrame(() => this._loop());
  }

  _draw(t) {
    const ctx = this._ctx;
    const W   = this._canvas.width;
    const H   = this._canvas.height;
    clearCanvas(ctx);
    drawGrid(ctx, 30, 5);

    const midY  = H / 2;
    const ampPx = this._A * (H / 2 - 20);   /* pixels */
    const omega  = TWO_PI * this._f;
    const k      = TWO_PI / (this._lam * W); /* rad/px */

    /* Corda */
    ctx.save();
    ctx.beginPath();
    ctx.strokeStyle = COLORS.velocity;
    ctx.lineWidth   = 2;
    ctx.lineJoin    = 'round';
    for (let x = 0; x <= W; x += 2) {
      const y = midY - ampPx * Math.sin(k * x - omega * t);
      x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.restore();

    /* Linha de equilíbrio */
    ctx.save();
    ctx.strokeStyle = 'rgba(200,146,10,0.18)';
    ctx.lineWidth   = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(0, midY); ctx.lineTo(W, midY);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    /* Marcador de amplitude */
    const xMark = W * 0.15;
    const yMark = midY - ampPx;
    drawArrow(ctx, xMark, midY, 0, -ampPx, COLORS.amber, null, 1.5);
    drawLabel(ctx, `A = ${(this._A * 100).toFixed(0)} %`, xMark + 8, yMark + 14, COLORS.amber);

    /* λ indicator */
    const lamPx = this._lam * W;
    if (lamPx < W * 1.5) {
      const x1 = W * 0.5;
      ctx.save();
      ctx.strokeStyle = COLORS.textMuted;
      ctx.lineWidth   = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(x1, midY - ampPx - 12);
      ctx.lineTo(x1 + lamPx, midY - ampPx - 12);
      ctx.stroke();
      ctx.setLineDash([]);
      drawLabel(ctx, 'λ', x1 + lamPx / 2 - 4, midY - ampPx - 16, COLORS.textMuted);
      ctx.restore();
    }

    /* Leituras */
    const period = Physics.waves_period(this._f);
    const speed  = Physics.waves_speed(this._f, this._lam);
    drawLabel(ctx, `f = ${this._f.toFixed(2)} Hz`, 8, 18, COLORS.amber);
    drawLabel(ctx, `T = ${period.toFixed(3)} s`,   8, 34, COLORS.amber);
    drawLabel(ctx, `v = ${speed.toFixed(2)} m/s`,  8, 50, COLORS.amber);
    drawLabel(ctx, `t = ${t.toFixed(2)} s`,         8, 66, COLORS.textMuted);
  }
}

/* ─────────────────────────────────────────────────────────────────────────── *
 * SuperpositionSimulation
 *
 * Duas ondas sobrepostas. Permite visualizar:
 *   - interferência construtiva/destrutiva (mesma f, diferente φ)
 *   - batimento (frequências ligeiramente diferentes)
 * ─────────────────────────────────────────────────────────────────────────── */

export class SuperpositionSimulation {
  constructor(canvas) {
    this._canvas  = canvas;
    this._ctx     = canvas.getContext('2d');
    this._running = false;
    this._t       = 0;
    this._raf     = null;
    this._cb      = null;
    this._last    = null;

    this._A1  = 0.35;   /* amplitude onda 1 */
    this._f1  = 1.0;    /* Hz onda 1 */
    this._A2  = 0.35;   /* amplitude onda 2 */
    this._f2  = 1.2;    /* Hz onda 2 (diferente → batimento) */
    this._phi = 0;      /* defasagem φ (rad) */

    this._draw(0);
  }

  setParam(key, value) {
    if (key === 'A1')  this._A1  = Math.max(0.05, Math.min(0.9, value));
    if (key === 'f1')  this._f1  = Math.max(0.1,  Math.min(5,   value));
    if (key === 'A2')  this._A2  = Math.max(0.05, Math.min(0.9, value));
    if (key === 'f2')  this._f2  = Math.max(0.1,  Math.min(5,   value));
    if (key === 'phi') this._phi = value;
  }

  start() {
    if (this._running) return;
    this._running = true;
    this._last    = performance.now();
    this._loop();
  }

  pause() {
    this._running = false;
    if (this._raf) { cancelAnimationFrame(this._raf); this._raf = null; }
  }

  reset() {
    this.pause();
    this._t = 0;
    this._draw(0);
    if (this._cb) this._cb(0);
  }

  onTimeUpdate(fn) { this._cb = fn; }
  dispose()        { this.pause(); }

  _loop() {
    if (!this._running) return;
    const now = performance.now();
    const dt  = Math.min((now - this._last) / 1000, 0.033);
    this._last = now;
    this._t   += dt;
    this._draw(this._t);
    if (this._cb) this._cb(this._t);
    this._raf = requestAnimationFrame(() => this._loop());
  }

  _draw(t) {
    const ctx  = this._ctx;
    const W    = this._canvas.width;
    const H    = this._canvas.height;
    clearCanvas(ctx);
    drawGrid(ctx, 30, 5);

    const midY   = H / 2;
    const halfH  = H / 2 - 16;
    const maxA   = Math.max(this._A1, this._A2, 0.01);
    const scale  = halfH / (maxA * 2); /* mapeia amp norm para pixels */
    const k      = TWO_PI / W;

    const w1 = TWO_PI * this._f1;
    const w2 = TWO_PI * this._f2;

    /* ── Onda 1 */
    ctx.save();
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(68,114,176,0.60)';
    ctx.lineWidth   = 1.5;
    for (let x = 0; x <= W; x += 2) {
      const y = midY - Physics.waves_displacement(this._A1, k, x, w1, t, 0) * scale;
      x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.restore();

    /* ── Onda 2 */
    ctx.save();
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(192,120,40,0.60)';
    ctx.lineWidth   = 1.5;
    for (let x = 0; x <= W; x += 2) {
      const y = midY - Physics.waves_displacement(this._A2, k, x, w2, t, this._phi) * scale;
      x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.restore();

    /* ── Resultante (superposição) */
    ctx.save();
    ctx.beginPath();
    ctx.strokeStyle = COLORS.textPrimary;
    ctx.lineWidth   = 2.5;
    for (let x = 0; x <= W; x += 2) {
      const y = midY - Physics.waves_superposition(
        this._A1, k, w1, this._A2, k, w2, this._phi, x, t
      ) * scale;
      x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.restore();

    /* Linha zero */
    ctx.save();
    ctx.strokeStyle = 'rgba(200,146,10,0.15)';
    ctx.lineWidth   = 1; ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(0, midY); ctx.lineTo(W, midY);
    ctx.stroke(); ctx.setLineDash([]);
    ctx.restore();

    /* Legenda */
    const df = Math.abs(this._f1 - this._f2);
    drawLabel(ctx, `f₁ = ${this._f1.toFixed(2)} Hz`, 8, 18, COLORS.velocity);
    drawLabel(ctx, `f₂ = ${this._f2.toFixed(2)} Hz`, 8, 34, COLORS.accel);
    if (df > 0.01) {
      drawLabel(ctx, `batimento = ${df.toFixed(2)} Hz`, 8, 50, COLORS.textMuted);
    }
    drawLabel(ctx, `t = ${t.toFixed(2)} s`, 8, 66, COLORS.textMuted);
  }
}

/* ─────────────────────────────────────────────────────────────────────────── *
 * PendulumWaveSimulation
 *
 * Pêndulo simples. Integração exata pelo período analítico quando ângulo
 * pequeno; Euler para ângulos grandes (θ'' = -(g/L)·sin(θ)).
 * ─────────────────────────────────────────────────────────────────────────── */

export class PendulumWaveSimulation {
  constructor(canvas) {
    this._canvas  = canvas;
    this._ctx     = canvas.getContext('2d');
    this._running = false;
    this._raf     = null;
    this._cb      = null;
    this._last    = null;

    this._L       = 1.5;    /* comprimento (m) */
    this._theta0  = 0.6;    /* ângulo inicial (rad) */
    this._theta   = 0.6;
    this._omega   = 0;      /* velocidade angular */
    this._g       = 9.8;
    this._t       = 0;

    this._trail   = [];
    this._chart   = null;

    this._draw();
  }

  setParam(key, value) {
    if (key === 'length') {
      this._L = Math.max(0.3, Math.min(3, value));
      this.reset();
    }
    if (key === 'angle') {
      this._theta0 = Math.max(0.05, Math.min(Math.PI * 0.8, value));
      this.reset();
    }
    if (key === 'g') {
      this._g = Math.max(1, Math.min(25, value));
      this.reset();
    }
  }

  attachChart(chartCanvas) {
    this._chart = new ChartEngine(chartCanvas, {
      label: 'θ vs t', xUnit: 't (s)', yUnit: 'θ (rad)',
      color: COLORS.velocity, fillArea: false,
    });
  }

  start() {
    if (this._running) return;
    this._running = true;
    this._last    = performance.now();
    this._loop();
  }

  pause() {
    this._running = false;
    if (this._raf) { cancelAnimationFrame(this._raf); this._raf = null; }
  }

  reset() {
    this.pause();
    this._theta = this._theta0;
    this._omega = 0;
    this._t     = 0;
    this._trail = [];
    if (this._chart) this._chart.clear();
    this._draw();
    if (this._cb) this._cb(0);
  }

  onTimeUpdate(fn) { this._cb = fn; }
  dispose()        { this.pause(); }

  _loop() {
    if (!this._running) return;
    const now = performance.now();
    const raw = Math.min((now - this._last) / 1000, 0.033);
    this._last = now;

    /* Sub-steps para maior precisão */
    const steps = 8;
    const dt    = raw / steps;
    for (let i = 0; i < steps; i++) {
      const alpha    = -(this._g / this._L) * Math.sin(this._theta);
      this._omega   += alpha * dt;
      this._theta   += this._omega * dt;
    }
    this._t += raw;

    const W = this._canvas.width;
    const H = this._canvas.height;
    const pivotX = W / 2;
    const pivotY = H * 0.18;
    const Lpx    = Math.min(H * 0.55, 220);
    const bobX   = pivotX + Lpx * Math.sin(this._theta);
    const bobY   = pivotY + Lpx * Math.cos(this._theta);

    /* Trail */
    this._trail.push({ x: bobX, y: bobY });
    if (this._trail.length > 140) this._trail.shift();

    if (this._chart) {
      this._chart.addPoint(this._t, this._theta);
      this._chart.render();
    }

    this._draw();
    if (this._cb) this._cb(this._t);
    this._raf = requestAnimationFrame(() => this._loop());
  }

  _draw() {
    const ctx = this._ctx;
    const W   = this._canvas.width;
    const H   = this._canvas.height;
    clearCanvas(ctx);
    drawGrid(ctx, 30, 5);

    const pivotX = W / 2;
    const pivotY = H * 0.18;
    const Lpx    = Math.min(H * 0.55, 220);
    const bobX   = pivotX + Lpx * Math.sin(this._theta);
    const bobY   = pivotY + Lpx * Math.cos(this._theta);

    /* Trail */
    const n = this._trail.length;
    for (let i = 0; i < n; i++) {
      const alpha = (i / n) * 0.35;
      const p     = this._trail[i];
      ctx.save();
      ctx.fillStyle = `rgba(68,114,176,${alpha})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2, 0, TWO_PI);
      ctx.fill();
      ctx.restore();
    }

    /* Haste */
    ctx.save();
    ctx.strokeStyle = COLORS.surface;
    ctx.lineWidth   = 2;
    ctx.beginPath();
    ctx.moveTo(pivotX, pivotY);
    ctx.lineTo(bobX, bobY);
    ctx.stroke();
    ctx.restore();

    /* Pivô */
    drawSurface(ctx, pivotX - 18, pivotX + 18, pivotY);
    drawCircle(ctx, pivotX, pivotY, 4, COLORS.bodyFill, COLORS.bodyStroke);

    /* Bob */
    drawCircle(ctx, bobX, bobY, 14, COLORS.bodyFill, COLORS.bodyStroke);

    /* Período */
    const T = Physics.waves_pendulum_period(this._L, this._g);
    drawLabel(ctx, `L = ${this._L.toFixed(2)} m`,   8, 18, COLORS.amber);
    drawLabel(ctx, `T = ${T.toFixed(3)} s`,          8, 34, COLORS.amber);
    drawLabel(ctx, `θ = ${this._theta.toFixed(3)} rad`, 8, 50, COLORS.amber);
    drawLabel(ctx, `t = ${this._t.toFixed(2)} s`,    8, 66, COLORS.textMuted);
  }
}

/* ─────────────────────────────────────────────────────────────────────────── *
 * SpringMassSimulation
 *
 * Oscilador massa-mola horizontal. x'' = -(k/m)·x
 * Com opção de amortecimento: x'' = -(k/m)·x - (b/m)·v
 * ─────────────────────────────────────────────────────────────────────────── */

export class SpringMassSimulation {
  constructor(canvas) {
    this._canvas   = canvas;
    this._ctx      = canvas.getContext('2d');
    this._running  = false;
    this._raf      = null;
    this._cb       = null;
    this._last     = null;

    this._mass     = 1.0;    /* kg */
    this._k        = 10.0;   /* N/m */
    this._b        = 0.0;    /* coeficiente de amortecimento */
    this._x0       = 0.8;    /* deslocamento inicial (unidade relativa) */
    this._x        = 0.8;
    this._v        = 0;
    this._t        = 0;

    this._chart    = null;
    this._draw();
  }

  setParam(key, value) {
    if (key === 'mass')    { this._mass  = Math.max(0.1, Math.min(10, value)); this.reset(); }
    if (key === 'k')       { this._k     = Math.max(1,   Math.min(50, value)); this.reset(); }
    if (key === 'damping') { this._b     = Math.max(0,   Math.min(5,  value)); this.reset(); }
    if (key === 'x0')      { this._x0    = Math.max(0.1, Math.min(1,  value)); this.reset(); }
  }

  attachChart(chartCanvas) {
    this._chart = new ChartEngine(chartCanvas, {
      label: 'x vs t', xUnit: 't (s)', yUnit: 'x (m)',
      color: COLORS.kinetic, fillArea: false,
    });
  }

  start() {
    if (this._running) return;
    this._running = true;
    this._last    = performance.now();
    this._loop();
  }

  pause() {
    this._running = false;
    if (this._raf) { cancelAnimationFrame(this._raf); this._raf = null; }
  }

  reset() {
    this.pause();
    this._x = this._x0;
    this._v = 0;
    this._t = 0;
    if (this._chart) this._chart.clear();
    this._draw();
    if (this._cb) this._cb(0);
  }

  onTimeUpdate(fn) { this._cb = fn; }
  dispose()        { this.pause(); }

  _loop() {
    if (!this._running) return;
    const now = performance.now();
    const raw = Math.min((now - this._last) / 1000, 0.033);
    this._last = now;

    const steps = 8;
    const dt    = raw / steps;
    for (let i = 0; i < steps; i++) {
      const a    = -(this._k / this._mass) * this._x
                   -(this._b / this._mass) * this._v;
      this._v   += a * dt;
      this._x   += this._v * dt;
    }
    this._t += raw;

    if (this._chart) {
      this._chart.addPoint(this._t, this._x);
      this._chart.render();
    }

    this._draw();
    if (this._cb) this._cb(this._t);
    this._raf = requestAnimationFrame(() => this._loop());
  }

  _draw() {
    const ctx   = this._ctx;
    const W     = this._canvas.width;
    const H     = this._canvas.height;
    clearCanvas(ctx);
    drawGrid(ctx, 30, 5);

    const midY  = H / 2;
    const wallX = 30;
    const eqX   = W / 2;           /* posição de equilíbrio */
    const scale = (W * 0.35);      /* pixels por unidade x */
    const massX = eqX + this._x * scale;
    const massW = 40; const massH = 40;

    /* Parede */
    drawSurface(ctx, wallX - 10, wallX + 10, midY - 60);
    ctx.save();
    ctx.strokeStyle = COLORS.surface;
    ctx.lineWidth   = 3;
    ctx.beginPath();
    ctx.moveTo(wallX, midY - 50);
    ctx.lineTo(wallX, midY + 20);
    ctx.stroke();
    ctx.restore();

    /* Mola (zigzag) */
    _drawSpring(ctx, wallX, midY, massX - massW / 2, midY, 12);

    /* Bloco */
    ctx.save();
    ctx.fillStyle   = COLORS.bodyFill;
    ctx.strokeStyle = COLORS.bodyStroke;
    ctx.lineWidth   = 1.5;
    ctx.fillRect(massX - massW / 2, midY - massH / 2, massW, massH);
    ctx.strokeRect(massX - massW / 2, midY - massH / 2, massW, massH);
    ctx.restore();

    /* Piso */
    drawSurface(ctx, 0, W, midY + massH / 2);

    /* Posição de equilíbrio */
    ctx.save();
    ctx.strokeStyle = 'rgba(200,146,10,0.20)';
    ctx.lineWidth   = 1; ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(eqX, midY - massH / 2 - 8);
    ctx.lineTo(eqX, midY + massH / 2 + 12);
    ctx.stroke(); ctx.setLineDash([]);
    ctx.restore();

    /* Leituras */
    const T = Physics.waves_spring_period(this._mass, this._k);
    drawLabel(ctx, `m = ${this._mass.toFixed(2)} kg`,  8, 18, COLORS.amber);
    drawLabel(ctx, `k = ${this._k.toFixed(1)} N/m`,    8, 34, COLORS.amber);
    drawLabel(ctx, `T = ${T.toFixed(3)} s`,             8, 50, COLORS.amber);
    drawLabel(ctx, `x = ${this._x.toFixed(3)}`,         8, 66, COLORS.amber);
    drawLabel(ctx, `t = ${this._t.toFixed(2)} s`,        8, 82, COLORS.textMuted);
  }
}

/* ─────────────────────────────────────────────────────────────────────────── *
 * Utilidade local: desenho de mola (zigzag)
 * ─────────────────────────────────────────────────────────────────────────── */

function _drawSpring(ctx, x1, y1, x2, y2, coils) {
  const len    = x2 - x1;
  if (len < 4) return;
  const coilW  = len / coils;
  const amp    = 10;

  ctx.save();
  ctx.strokeStyle = COLORS.surface;
  ctx.lineWidth   = 1.5;
  ctx.beginPath();
  ctx.moveTo(x1, y1);

  for (let i = 0; i < coils; i++) {
    const cx = x1 + (i + 0.25) * coilW;
    const dx = coilW * 0.5;
    ctx.lineTo(cx, y1 - amp);
    ctx.lineTo(cx + dx, y1 + amp);
  }
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.restore();
}

/* ─────────────────────────────────────────────────────────────────────────── *
 * Factory
 * ─────────────────────────────────────────────────────────────────────────── */

/**
 * @param {string} simulationId
 * @param {HTMLCanvasElement} canvas
 * @returns {TransverseWaveSimulation|SuperpositionSimulation|PendulumWaveSimulation|SpringMassSimulation|null}
 */
export function createWavesSimulation(simulationId, canvas) {
  switch (simulationId) {
    case 'wave-transverse-01':   return new TransverseWaveSimulation(canvas);
    case 'wave-superposition-01':return new SuperpositionSimulation(canvas);
    case 'pendulum-01':          return new PendulumWaveSimulation(canvas);
    case 'spring-mass-01':       return new SpringMassSimulation(canvas);
    default:
      console.warn(`[waves] Simulação desconhecida: ${simulationId}`);
      return null;
  }
}
