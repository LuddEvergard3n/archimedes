/**
 * ondas.js — Módulo de Ondas e Movimento Harmônico Simples
 *
 * Simulações:
 *   MHSSimulation         — massa-mola, MHS puro
 *   WavePropagation       — onda transversal progressiva
 *   SuperpositionSimulation — superposição de duas ondas (interferência)
 *   PendulumWaveSimulation — pêndulo com ângulo real (já existe no intro,
 *                            aqui com parâmetros expostos e leitura de T)
 *
 * Todas implementam a interface padrão:
 *   start(), pause(), reset(), setParam(key, value),
 *   onTimeUpdate(fn), dispose()
 *
 * Usa Physics do wasm-loader (WASM ou fallback JS).
 * Renderização via renderer.js (Canvas 2D).
 */

import { Physics }      from '../../js/wasm-loader.js';
import { COLORS, clearCanvas, drawGrid, drawArrow, drawCircle,
         drawRect, drawSurface, drawLabel }  from '../../engine/renderer.js';

const G    = 9.8;           /* m/s² */
const DT   = 1 / 60;        /* timestep cap */

/* ── Helpers ─────────────────────────────────────────────────────────────── */

function _clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

/* ─────────────────────────────────────────────────────────────────────────── *
 * MHSSimulation — massa-mola
 *
 * Fenômeno: bloco preso a uma mola horizontal oscila indefinidamente.
 * Equação: x'' = -(k/m)·x  →  ω = √(k/m)
 * Canvas: vista lateral com mola desenhada e gráfico x(t).
 * ─────────────────────────────────────────────────────────────────────────── */

class MHSSimulation {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx    = canvas.getContext('2d');
    this._params = { mass: 1.0, springK: 10.0, amplitude: 0.15 };
    this._running = false;
    this._raf     = null;
    this._t       = 0;
    this._callbacks = [];
    this._trail   = []; /* { x, y } canvas */
    this._reset();
  }

  _reset() {
    const { amplitude } = this._params;
    this._x  = amplitude;  /* posição inicial = amplitude */
    this._v  = 0;
    this._t  = 0;
    this._trail = [];
  }

  _omega() {
    const { mass, springK } = this._params;
    return Math.sqrt(springK / Math.max(mass, 0.01));
  }

  start()  { if (!this._running) { this._running = true;  this._loop(); } }
  pause()  { this._running = false; if (this._raf) { cancelAnimationFrame(this._raf); this._raf = null; } }
  reset()  { this.pause(); this._reset(); this._draw(); }
  dispose(){ this.pause(); }

  setParam(key, value) {
    if (!(key in this._params)) return;
    this._params[key] = value;
    /* ao mudar amplitude, reinicia com nova amplitude */
    if (key === 'amplitude') this._reset();
    else { this._v = this._omega() * Math.sqrt(Math.max(this._params.amplitude**2 - this._x**2, 0)); }
    if (!this._running) this._draw();
  }

  onTimeUpdate(fn) { this._callbacks.push(fn); }

  _loop() {
    if (!this._running) return;
    this._raf = requestAnimationFrame(() => {
      const dt = Math.min(DT, 1/30);
      const r  = Physics.waves_mhs_step(this._x, this._v, this._omega(), dt);
      this._x  = r.x;
      this._v  = r.v;
      this._t += dt;
      this._draw();
      this._callbacks.forEach(fn => fn(this._t, {
        x:       this._x.toFixed(3),
        v:       this._v.toFixed(3),
        T:       (2*Math.PI/this._omega()).toFixed(3),
        omega:   this._omega().toFixed(3),
      }));
      this._loop();
    });
  }

  _draw() {
    const ctx = this.ctx;
    const W = this.canvas.width, H = this.canvas.height;
    clearCanvas(ctx);
    drawGrid(ctx, 20, 5);

    /* Geometria */
    const cy     = H * 0.45;
    const wall   = W * 0.12;
    const eq     = W * 0.55; /* posição de equilíbrio no canvas */
    const scale  = (W * 0.30) / Math.max(this._params.amplitude, 0.01);
    const bx     = eq + this._x * scale;
    const bSize  = 28;

    /* Parede */
    ctx.save();
    ctx.fillStyle = COLORS.surface;
    ctx.fillRect(wall - 8, cy - 30, 8, 60);
    ctx.restore();

    /* Mola — aproximação com segmentos em zigzag */
    const springX1 = wall;
    const springX2 = bx - bSize/2;
    const coils    = 8;
    const amp      = 10;
    ctx.save();
    ctx.strokeStyle = COLORS.amber;
    ctx.lineWidth   = 1.5;
    ctx.beginPath();
    ctx.moveTo(springX1, cy);
    const steps = coils * 2;
    for (let k = 0; k <= steps; k++) {
      const px = springX1 + (springX2 - springX1) * (k / steps);
      const py = cy + (k % 2 === 0 ? amp : -amp) * (k > 0 && k < steps ? 1 : 0);
      ctx.lineTo(px, py);
    }
    ctx.lineTo(springX2, cy);
    ctx.stroke();
    ctx.restore();

    /* Ponto de equilíbrio */
    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = COLORS.textMuted;
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.moveTo(eq, cy - 50);
    ctx.lineTo(eq, cy + 50);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    /* Trilha */
    const trailY = H * 0.78;
    const trailW = W * 0.70;
    const trailX = W * 0.15;
    const trailScale = trailW / (4 * Math.PI / this._omega());
    const now = this._t;

    /* Eixo de tempo */
    ctx.save();
    ctx.strokeStyle = COLORS.axis;
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.moveTo(trailX, trailY);
    ctx.lineTo(trailX + trailW, trailY);
    ctx.stroke();
    drawLabel(ctx, 't', trailX + trailW + 4, trailY + 3, COLORS.textMuted, 'left');
    drawLabel(ctx, 'x(t)', trailX - 4, trailY - 50, COLORS.velocity, 'right');
    ctx.restore();

    /* Registro x(t) acumulado — últimos 300 pontos */
    this._trail.push({ t: now, x: this._x });
    if (this._trail.length > 300) this._trail.shift();

    const A = this._params.amplitude;
    if (this._trail.length > 1) {
      ctx.save();
      ctx.strokeStyle = COLORS.velocity;
      ctx.lineWidth   = 1.5;
      ctx.beginPath();
      const tMin = this._trail[0].t;
      const tMax = now;
      const tRange = Math.max(tMax - tMin, 0.01);
      this._trail.forEach((pt, idx) => {
        const px = trailX + (pt.t - tMin) / tRange * trailW;
        const py = trailY - (pt.x / A) * 45;
        idx === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      });
      ctx.stroke();
      ctx.restore();
    }

    /* Massa */
    drawRect(ctx, bx, cy, bSize, bSize, COLORS.bodyFill, COLORS.amber);

    /* Leituras */
    drawLabel(ctx, `x = ${this._x.toFixed(3)} m`, W*0.04, H*0.92, COLORS.amber);
    drawLabel(ctx, `v = ${this._v.toFixed(3)} m/s`, W*0.04, H*0.96, COLORS.velocity);
    drawLabel(ctx, `T = ${(2*Math.PI/this._omega()).toFixed(3)} s`, W*0.60, H*0.92, COLORS.textSecondary);
    drawLabel(ctx, `ω = ${this._omega().toFixed(3)} rad/s`, W*0.60, H*0.96, COLORS.textSecondary);
  }
}

/* ─────────────────────────────────────────────────────────────────────────── *
 * WavePropagation — onda transversal progressiva
 *
 * Fenômeno: perturbação se propaga ao longo de um cordão.
 * Equação: y(x,t) = A·sin(kx − ωt)
 * Canvas: cordão com N pontos, seta de propagação.
 * ─────────────────────────────────────────────────────────────────────────── */

class WavePropagation {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx    = canvas.getContext('2d');
    this._params = {
      amplitude:   0.08,   /* m  */
      frequency:   1.0,    /* Hz */
      wavelength:  0.50,   /* m  */
    };
    this._running  = false;
    this._raf      = null;
    this._t        = 0;
    this._callbacks = [];
  }

  start()  { if (!this._running) { this._running = true; this._loop(); } }
  pause()  { this._running = false; if (this._raf) { cancelAnimationFrame(this._raf); this._raf = null; } }
  reset()  { this.pause(); this._t = 0; this._draw(); }
  dispose(){ this.pause(); }
  setParam(key, value) { if (key in this._params) { this._params[key] = value; if (!this._running) this._draw(); } }
  onTimeUpdate(fn) { this._callbacks.push(fn); }

  _loop() {
    if (!this._running) return;
    this._raf = requestAnimationFrame(() => {
      this._t += Math.min(DT, 1/30);
      this._draw();
      const { amplitude, frequency, wavelength } = this._params;
      const speed = Physics.waves_speed(frequency, wavelength);
      this._callbacks.forEach(fn => fn(this._t, {
        v: speed.toFixed(3),
        T: Physics.waves_period(frequency).toFixed(3),
        k: (2*Math.PI/wavelength).toFixed(3),
        f: frequency.toFixed(2),
      }));
      this._loop();
    });
  }

  _draw() {
    const ctx = this.ctx;
    const W = this.canvas.width, H = this.canvas.height;
    clearCanvas(ctx);
    drawGrid(ctx, 20, 5);

    const { amplitude, frequency, wavelength } = this._params;
    const k      = 2 * Math.PI / wavelength;
    const omega  = 2 * Math.PI * frequency;
    const cy     = H / 2;
    const scaleX = W / 1.0; /* 1 metro visível */
    const scaleY = (H * 0.35) / Math.max(amplitude, 0.001);
    const N      = 200;

    /* Cordão */
    ctx.save();
    ctx.strokeStyle = COLORS.velocity;
    ctx.lineWidth   = 2;
    ctx.beginPath();
    for (let j = 0; j <= N; j++) {
      const xm  = j / N;          /* posição em metros */
      const px  = xm * scaleX;
      const ym  = Physics.waves_displacement(amplitude, k, xm, omega, this._t, 0);
      const py  = cy - ym * scaleY;
      j === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.restore();

    /* Eixo de equilíbrio */
    ctx.save();
    ctx.strokeStyle = COLORS.axis;
    ctx.lineWidth   = 0.5;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(0, cy);
    ctx.lineTo(W, cy);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    /* Seta de propagação */
    const arrowY = H * 0.15;
    drawArrow(ctx, W*0.35, arrowY, 80, 0, COLORS.accel, 'v');

    /* Amplitude */
    ctx.save();
    ctx.strokeStyle = COLORS.amber;
    ctx.lineWidth   = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(0, cy - amplitude * scaleY);
    ctx.lineTo(W * 0.3, cy - amplitude * scaleY);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
    drawLabel(ctx, `A = ${amplitude.toFixed(3)} m`, W*0.02, cy - amplitude*scaleY - 6, COLORS.amber);

    /* Comprimento de onda */
    const lambdaPx = wavelength * scaleX;
    if (lambdaPx < W) {
      ctx.save();
      ctx.strokeStyle = COLORS.kinetic;
      ctx.lineWidth   = 1;
      ctx.beginPath();
      ctx.moveTo(W*0.05, cy + 20);
      ctx.lineTo(W*0.05 + lambdaPx, cy + 20);
      ctx.stroke();
      ctx.restore();
      drawLabel(ctx, `λ = ${wavelength.toFixed(2)} m`, W*0.05 + lambdaPx/2, cy + 32, COLORS.kinetic, 'center');
    }

    /* Leituras */
    const speed = Physics.waves_speed(frequency, wavelength);
    drawLabel(ctx, `v = ${speed.toFixed(2)} m/s`, W*0.04, H*0.92, COLORS.accel);
    drawLabel(ctx, `T = ${Physics.waves_period(frequency).toFixed(3)} s`, W*0.04, H*0.96, COLORS.textSecondary);
    drawLabel(ctx, `f = ${frequency.toFixed(2)} Hz`, W*0.60, H*0.92, COLORS.textSecondary);
    drawLabel(ctx, `k = ${(2*Math.PI/wavelength).toFixed(2)} rad/m`, W*0.60, H*0.96, COLORS.textSecondary);
  }
}

/* ─────────────────────────────────────────────────────────────────────────── *
 * SuperpositionSimulation — interferência de duas ondas
 *
 * Fenômeno: duas ondas se somam ponto a ponto.
 *   interferência construtiva (Δφ=0), destrutiva (Δφ=π), batimentos (Δf≠0).
 * Canvas: onda 1 (azul), onda 2 (laranja), resultante (âmbar).
 * ─────────────────────────────────────────────────────────────────────────── */

class SuperpositionSimulation {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx    = canvas.getContext('2d');
    this._params = {
      A1: 0.06, f1: 1.0, lam1: 0.50,
      A2: 0.06, f2: 1.2, lam2: 0.50,
      phi: 0,
    };
    this._running  = false;
    this._raf      = null;
    this._t        = 0;
    this._callbacks = [];
  }

  start()  { if (!this._running) { this._running = true; this._loop(); } }
  pause()  { this._running = false; if (this._raf) { cancelAnimationFrame(this._raf); this._raf = null; } }
  reset()  { this.pause(); this._t = 0; this._draw(); }
  dispose(){ this.pause(); }
  setParam(key, value) { if (key in this._params) { this._params[key] = value; if (!this._running) this._draw(); } }
  onTimeUpdate(fn) { this._callbacks.push(fn); }

  _loop() {
    if (!this._running) return;
    this._raf = requestAnimationFrame(() => {
      this._t += Math.min(DT, 1/30);
      this._draw();
      const p = this._params;
      const Amax = p.A1 + p.A2;
      this._callbacks.forEach(fn => fn(this._t, {
        Amax: Amax.toFixed(3),
        phi:  p.phi.toFixed(2),
        df:   Math.abs(p.f1 - p.f2).toFixed(3),
      }));
      this._loop();
    });
  }

  _draw() {
    const ctx = this.ctx;
    const W = this.canvas.width, H = this.canvas.height;
    clearCanvas(ctx);
    drawGrid(ctx, 20, 5);

    const { A1, f1, lam1, A2, f2, lam2, phi } = this._params;
    const k1 = 2*Math.PI/lam1, w1 = 2*Math.PI*f1;
    const k2 = 2*Math.PI/lam2, w2 = 2*Math.PI*f2;
    const cy  = H / 2;
    const Amax = Math.max(A1+A2, 0.001);
    const scaleY = (H * 0.22) / Amax;
    const N = 200;

    const drawWave = (colorStr, fn, lineW = 1.2) => {
      ctx.save();
      ctx.strokeStyle = colorStr;
      ctx.lineWidth   = lineW;
      ctx.globalAlpha = lineW < 2 ? 0.55 : 1.0;
      ctx.beginPath();
      for (let j = 0; j <= N; j++) {
        const xm = j/N;
        const px = xm * W;
        const py = cy - fn(xm) * scaleY;
        j === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.restore();
    };

    /* Onda 1, onda 2 */
    drawWave(COLORS.velocity, xm => Physics.waves_displacement(A1, k1, xm, w1, this._t, 0));
    drawWave(COLORS.accel,    xm => Physics.waves_displacement(A2, k2, xm, w2, this._t, phi));

    /* Resultante */
    drawWave(COLORS.amber, xm =>
      Physics.waves_superposition(A1, k1, w1, A2, k2, w2, phi, xm, this._t),
      2.0
    );

    /* Eixo */
    ctx.save();
    ctx.strokeStyle = COLORS.axis;
    ctx.lineWidth = 0.5;
    ctx.setLineDash([4,4]);
    ctx.beginPath(); ctx.moveTo(0,cy); ctx.lineTo(W,cy); ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    /* Legenda */
    drawLabel(ctx, 'onda 1', W*0.04, H*0.10, COLORS.velocity);
    drawLabel(ctx, 'onda 2', W*0.04, H*0.14, COLORS.accel);
    drawLabel(ctx, 'resultante', W*0.04, H*0.18, COLORS.amber);

    const Ar = A1 + A2;
    drawLabel(ctx, `Δf = ${Math.abs(f1-f2).toFixed(3)} Hz`, W*0.04, H*0.92, COLORS.textSecondary);
    drawLabel(ctx, `Δφ = ${phi.toFixed(2)} rad`, W*0.04, H*0.96, COLORS.textSecondary);
    drawLabel(ctx, `A_max = ${Ar.toFixed(3)} m`, W*0.60, H*0.92, COLORS.amber);
  }
}

/* ─────────────────────────────────────────────────────────────────────────── *
 * PendulumWaveSimulation — pêndulo com parâmetros expostos
 *
 * Fenômeno: período depende apenas de L, não de m nem de A (pequenos ângulos).
 * Usa waves_pendulum_step do motor C (ângulo real, não aproximação).
 * Canvas: pêndulo com trilha angular e gráfico θ(t).
 * ─────────────────────────────────────────────────────────────────────────── */

class PendulumWaveSimulation {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx    = canvas.getContext('2d');
    this._params = { length: 1.0, theta0: 0.30 }; /* ângulo inicial rad */
    this._running  = false;
    this._raf      = null;
    this._t        = 0;
    this._callbacks = [];
    this._trail  = [];
    this._reset();
  }

  _reset() {
    this._theta = this._params.theta0;
    this._omega = 0;
    this._t     = 0;
    this._trail = [];
  }

  start()  { if (!this._running) { this._running = true; this._loop(); } }
  pause()  { this._running = false; if (this._raf) { cancelAnimationFrame(this._raf); this._raf = null; } }
  reset()  { this.pause(); this._reset(); this._draw(); }
  dispose(){ this.pause(); }
  setParam(key, value) {
    if (!(key in this._params)) return;
    this._params[key] = value;
    if (key === 'theta0') this._reset();
    if (!this._running) this._draw();
  }
  onTimeUpdate(fn) { this._callbacks.push(fn); }

  _loop() {
    if (!this._running) return;
    this._raf = requestAnimationFrame(() => {
      const dt = Math.min(DT, 1/30);
      /* Sub-stepping para precisão */
      const steps = 4;
      for (let s = 0; s < steps; s++) {
        const r = Physics.waves_pendulum_step(this._theta, this._omega, this._params.length, G, dt/steps);
        this._theta = r.theta;
        this._omega = r.omega;
      }
      this._t += dt;
      this._draw();
      const T = Physics.waves_pendulum_period(this._params.length, G);
      this._callbacks.forEach(fn => fn(this._t, {
        theta:  (this._theta * 180/Math.PI).toFixed(2),
        omega:  this._omega.toFixed(3),
        T:      T.toFixed(3),
      }));
      this._loop();
    });
  }

  _draw() {
    const ctx = this.ctx;
    const W = this.canvas.width, H = this.canvas.height;
    clearCanvas(ctx);
    drawGrid(ctx, 20, 5);

    const px  = W / 2;
    const py  = H * 0.15;
    const L   = this._params.length;
    const Lpx = Math.min(H * 0.55, 200) * (L / 2.0);
    const bx  = px + Math.sin(this._theta) * Lpx;
    const by  = py + Math.cos(this._theta) * Lpx;

    /* Trilha */
    this._trail.push({ x: bx, y: by });
    if (this._trail.length > 120) this._trail.shift();
    ctx.save();
    this._trail.forEach((pt, idx) => {
      const alpha = (idx / this._trail.length) * 0.40;
      ctx.fillStyle = `rgba(68, 114, 176, ${alpha})`;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 2, 0, Math.PI*2);
      ctx.fill();
    });
    ctx.restore();

    /* Ponto de suspensão */
    drawCircle(ctx, px, py, 4, COLORS.surface, COLORS.surface);

    /* Fio */
    ctx.save();
    ctx.strokeStyle = COLORS.textSecondary;
    ctx.lineWidth   = 1.5;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(bx, by);
    ctx.stroke();
    ctx.restore();

    /* Massa */
    drawCircle(ctx, bx, by, 14, COLORS.bodyFill, COLORS.amber);

    /* Ângulo de equilíbrio (vertical) */
    ctx.save();
    ctx.strokeStyle = COLORS.axis;
    ctx.lineWidth   = 0.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px, py + Lpx + 10);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    /* Leituras */
    const T = Physics.waves_pendulum_period(this._params.length, G);
    drawLabel(ctx, `θ = ${(this._theta*180/Math.PI).toFixed(1)}°`, W*0.04, H*0.92, COLORS.amber);
    drawLabel(ctx, `ω = ${this._omega.toFixed(3)} rad/s`, W*0.04, H*0.96, COLORS.velocity);
    drawLabel(ctx, `T = ${T.toFixed(3)} s`, W*0.60, H*0.92, COLORS.textSecondary);
    drawLabel(ctx, `L = ${this._params.length.toFixed(2)} m`, W*0.60, H*0.96, COLORS.textSecondary);
  }
}

/* ─────────────────────────────────────────────────────────────────────────── *
 * Factory
 * ─────────────────────────────────────────────────────────────────────────── */

/**
 * Cria a simulação correta pelo ID.
 * @param {string} id — ID do experimento em experiments.json
 * @param {HTMLCanvasElement} canvas
 * @returns {object} instância da simulação
 */
function createOndasSimulation(id, canvas) {
  switch (id) {
    case 'mhs':           return new MHSSimulation(canvas);
    case 'wave':          return new WavePropagation(canvas);
    case 'superposition': return new SuperpositionSimulation(canvas);
    case 'pendulum-wave': return new PendulumWaveSimulation(canvas);
    default:              return new WavePropagation(canvas);
  }
}

export { createOndasSimulation, MHSSimulation, WavePropagation,
         SuperpositionSimulation, PendulumWaveSimulation };
