/**
 * termodinamica.js — Módulo de Termodinâmica
 *
 * Simulações:
 *   IdealGasSimulation   — gás ideal PV=nRT, pistão animado
 *   ProcessosSimulation  — processos isotérmico / isobárico / isocórico
 *   DiagramaPVSimulation — diagrama P×V interativo com ciclo
 *   CalorSimulation      — Q = m·c·ΔT com dois materiais
 *
 * Todas implementam a interface padrão:
 *   start(), pause(), reset(), setParam(key, value),
 *   onTimeUpdate(fn), dispose()
 */

import { Physics }      from '../../js/wasm-loader.js';
import { COLORS, clearCanvas, drawGrid, drawArrow, drawCircle,
         drawRect, drawLabel }  from '../../engine/renderer.js';

const R    = 8.314;
const DT   = 1 / 60;

function _clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
function _lerp(a, b, t)    { return a + (b - a) * t; }

/* ─────────────────────────────────────────────────────────────────────────── *
 * IdealGasSimulation — pistão animado
 *
 * Fenômeno: ao comprimir o gás, a pressão aumenta (Boyle).
 *           ao aquecer, o volume aumenta (Charles) ou a pressão sobe.
 * Canvas: cilindro com pistão, indicadores P, V, T.
 * ─────────────────────────────────────────────────────────────────────────── */

class IdealGasSimulation {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx    = canvas.getContext('2d');
    /* n fixo em 1 mol; usuário controla V e T */
    this._params = { n: 1.0, V: 1.0, T: 300 }; /* V em L, T em K */
    this._running = false;
    this._raf     = null;
    this._t       = 0;
    this._callbacks = [];
    this._animV   = this._params.V; /* V animado (transição suave) */
  }

  start()  { if (!this._running) { this._running = true; this._loop(); } }
  pause()  { this._running = false; if (this._raf) { cancelAnimationFrame(this._raf); this._raf = null; } }
  reset()  { this.pause(); this._params.V = 1.0; this._params.T = 300; this._animV = 1.0; this._t = 0; this._draw(); }
  dispose(){ this.pause(); }
  setParam(key, value) { if (key in this._params) { this._params[key] = value; if (!this._running) this._draw(); } }
  onTimeUpdate(fn) { this._callbacks.push(fn); }

  _loop() {
    if (!this._running) return;
    this._raf = requestAnimationFrame(() => {
      /* Anima V suavemente */
      this._animV = _lerp(this._animV, this._params.V, 0.08);
      this._t += Math.min(DT, 1/30);
      this._draw();
      const P = Physics.thermo_pressure(this._params.V * 0.001, this._params.n, this._params.T);
      this._callbacks.forEach(fn => fn(this._t, {
        P: (P/1000).toFixed(2),
        V: this._params.V.toFixed(2),
        T: this._params.T.toFixed(1),
        n: this._params.n.toFixed(2),
      }));
      this._loop();
    });
  }

  _draw() {
    const ctx = this.ctx;
    const W = this.canvas.width, H = this.canvas.height;
    clearCanvas(ctx);
    drawGrid(ctx, 20, 5);

    const { n, T } = this._params;
    const V    = this._animV * 0.001;   /* L → m³ */
    const Vmax = 3.0 * 0.001;
    const P    = Physics.thermo_pressure(V, n, T);

    /* Geometria do cilindro */
    const cX   = W * 0.25;
    const cY   = H * 0.25;
    const cW   = W * 0.20;
    const cH   = H * 0.55;
    const fillH = cH * (V / Vmax);
    const pistonY = cY + cH - fillH;

    /* Cilindro */
    ctx.save();
    ctx.strokeStyle = COLORS.surface;
    ctx.lineWidth   = 2.5;
    ctx.beginPath();
    ctx.moveTo(cX, cY);
    ctx.lineTo(cX, cY + cH);
    ctx.lineTo(cX + cW, cY + cH);
    ctx.lineTo(cX + cW, cY);
    ctx.stroke();
    ctx.restore();

    /* Gás — cor muda com temperatura */
    const tNorm = _clamp((T - 200) / 600, 0, 1);
    const gasR  = Math.round(42 + 180 * tNorm);
    const gasG  = Math.round(96 - 60 * tNorm);
    const gasB  = Math.round(128 - 80 * tNorm);
    ctx.save();
    ctx.fillStyle = `rgba(${gasR},${gasG},${gasB},0.22)`;
    ctx.fillRect(cX + 1, pistonY + 14, cW - 2, cH - (pistonY - cY) - 14);
    ctx.restore();

    /* Pistão */
    ctx.save();
    ctx.fillStyle   = COLORS.bodyFill;
    ctx.strokeStyle = COLORS.amber;
    ctx.lineWidth   = 2;
    ctx.fillRect(cX, pistonY, cW, 14);
    ctx.strokeRect(cX, pistonY, cW, 14);
    ctx.restore();

    /* Seta de pressão */
    if (P > 0) {
      const pArrow = _clamp(P / 500000 * 50, 10, 60);
      drawArrow(ctx, cX + cW*0.5, pistonY + 6, 0, pArrow, COLORS.force, 'P');
    }

    /* Diagrama P-V simplificado à direita */
    const dvX = W*0.55, dvY = H*0.20, dvW = W*0.38, dvH = H*0.55;

    /* Eixos */
    ctx.save();
    ctx.strokeStyle = COLORS.axis;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(dvX, dvY);
    ctx.lineTo(dvX, dvY + dvH);
    ctx.lineTo(dvX + dvW, dvY + dvH);
    ctx.stroke();
    ctx.restore();
    drawLabel(ctx, 'V (L)', dvX + dvW*0.5, dvY + dvH + 16, COLORS.textMuted, 'center');
    drawLabel(ctx, 'P (kPa)', dvX - 10, dvY, COLORS.textMuted, 'right');

    /* Curva isotérmica para a temperatura atual */
    const Tiso  = T;
    const nMol  = n;
    ctx.save();
    ctx.strokeStyle = COLORS.amber;
    ctx.lineWidth   = 1;
    ctx.globalAlpha = 0.50;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    for (let vi = 0.2; vi <= 3.0; vi += 0.05) {
      const pi = Physics.thermo_pressure(vi*0.001, nMol, Tiso) / 1000;
      const px = dvX + (vi/3.0) * dvW;
      const py = dvY + dvH - _clamp(pi/500, 0, 1) * dvH;
      vi <= 0.25 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    /* Ponto atual */
    const cpx = dvX + (this._animV/3.0) * dvW;
    const cpy = dvY + dvH - _clamp((P/1000)/500, 0, 1)*dvH;
    drawCircle(ctx, cpx, cpy, 5, COLORS.amber, COLORS.amber);

    /* Leituras */
    drawLabel(ctx, `P = ${(P/1000).toFixed(2)} kPa`, W*0.04, H*0.92, COLORS.force);
    drawLabel(ctx, `V = ${this._animV.toFixed(2)} L`,  W*0.04, H*0.96, COLORS.velocity);
    drawLabel(ctx, `T = ${T.toFixed(0)} K`,            W*0.60, H*0.92, COLORS.accel);
    drawLabel(ctx, `n = ${n.toFixed(2)} mol`,           W*0.60, H*0.96, COLORS.textSecondary);
  }
}

/* ─────────────────────────────────────────────────────────────────────────── *
 * ProcessosSimulation — comparação de três processos
 *
 * Fenômeno: mesmo gás, mesma quantidade, diferentes condições.
 *   Isotérmico: T constante, P·V = const (Boyle)
 *   Isobárico:  P constante, V/T = const (Charles)
 *   Isocórico:  V constante, P/T = const (Gay-Lussac)
 * Canvas: diagrama P×V com as três curvas.
 * ─────────────────────────────────────────────────────────────────────────── */

class ProcessosSimulation {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx    = canvas.getContext('2d');
    this._params = { n: 1.0, T0: 300, V0: 1.0 }; /* estado inicial */
    this._t       = 0;
    this._running = false;
    this._raf     = null;
    this._anim    = 0; /* 0→1 para animar as curvas */
    this._callbacks = [];
  }

  start()  { if (!this._running) { this._running = true; this._anim = 0; this._loop(); } }
  pause()  { this._running = false; if (this._raf) { cancelAnimationFrame(this._raf); this._raf = null; } }
  reset()  { this.pause(); this._anim = 0; this._t = 0; this._draw(); }
  dispose(){ this.pause(); }
  setParam(key, value) { if (key in this._params) { this._params[key] = value; if (!this._running) this._draw(); } }
  onTimeUpdate(fn) { this._callbacks.push(fn); }

  _loop() {
    if (!this._running) return;
    this._raf = requestAnimationFrame(() => {
      this._t += Math.min(DT, 1/30);
      this._anim = Math.min(this._anim + 0.015, 1.0);
      this._draw();
      this._callbacks.forEach(fn => fn(this._t, {}));
      this._loop();
    });
  }

  _draw() {
    const ctx = this.ctx;
    const W = this.canvas.width, H = this.canvas.height;
    clearCanvas(ctx);
    drawGrid(ctx, 20, 5);

    const { n, T0, V0 } = this._params;
    const P0 = Physics.thermo_pressure(V0*0.001, n, T0);
    const Vmax = 4.0, Pmax = P0 * 3.5 / 1000;

    const dvX = W*0.12, dvY = H*0.10, dvW = W*0.78, dvH = H*0.72;
    const vToX = v => dvX + (v/Vmax)*dvW;
    const pToY = p => dvY + dvH - _clamp(p/Pmax,0,1)*dvH;

    /* Eixos */
    ctx.save();
    ctx.strokeStyle = COLORS.axis;
    ctx.lineWidth   = 1.5;
    ctx.beginPath();
    ctx.moveTo(dvX, dvY);
    ctx.lineTo(dvX, dvY + dvH);
    ctx.lineTo(dvX + dvW, dvY + dvH);
    ctx.stroke();
    ctx.restore();
    drawLabel(ctx, 'V (L)',   dvX + dvW/2, dvY+dvH+16, COLORS.textMuted, 'center');
    drawLabel(ctx, 'P (kPa)', dvX - 8,     dvY,        COLORS.textMuted, 'right');

    /* Ponto inicial */
    const ix = vToX(V0), iy = pToY(P0/1000);
    drawCircle(ctx, ix, iy, 6, COLORS.amber, COLORS.amber);

    const nSteps = Math.round(100 * this._anim);

    /* Isotérmico T=T0: P·V = const → P2 = P0·V0/V2 */
    ctx.save();
    ctx.strokeStyle = COLORS.velocity;
    ctx.lineWidth   = 2;
    ctx.beginPath();
    for (let s = 0; s <= nSteps; s++) {
      const V2 = V0 + (Vmax*0.9 - V0) * (s/100);
      const P2 = Physics.thermo_boyle(P0, V0, Physics.thermo_pressure(V2*0.001, n, T0)) / 1000;
      /* Mais simples: P2 = P0*V0/V2 */
      const P2b = (P0/1000) * V0 / V2;
      s===0 ? ctx.moveTo(vToX(V2), pToY(P2b)) : ctx.lineTo(vToX(V2), pToY(P2b));
    }
    ctx.stroke();
    ctx.restore();
    if (this._anim > 0.1) drawLabel(ctx, 'Isotérmico', vToX(Vmax*0.7), pToY(P0/1000*V0/(Vmax*0.7))-14, COLORS.velocity, 'center');

    /* Isobárico P=P0: V/T = const → V2 = V0·T2/T0 */
    const T2_max = T0 * 2.5;
    ctx.save();
    ctx.strokeStyle = COLORS.kinetic;
    ctx.lineWidth   = 2;
    ctx.beginPath();
    for (let s = 0; s <= nSteps; s++) {
      const T2 = T0 + (T2_max - T0) * (s/100);
      const V2 = Physics.thermo_charles(V0, T0, T2);
      s===0 ? ctx.moveTo(vToX(V2), pToY(P0/1000)) : ctx.lineTo(vToX(V2), pToY(P0/1000));
    }
    ctx.stroke();
    ctx.restore();
    if (this._anim > 0.1) drawLabel(ctx, 'Isobárico', vToX(V0*2.1), pToY(P0/1000)+12, COLORS.kinetic, 'left');

    /* Isocórico V=V0: P/T = const → P2 = P0·T2/T0 */
    ctx.save();
    ctx.strokeStyle = COLORS.force;
    ctx.lineWidth   = 2;
    ctx.beginPath();
    for (let s = 0; s <= nSteps; s++) {
      const T2 = T0 + (T2_max - T0) * (s/100);
      const P2 = Physics.thermo_gay_lussac(P0, T0, T2) / 1000;
      s===0 ? ctx.moveTo(vToX(V0), pToY(P2)) : ctx.lineTo(vToX(V0), pToY(P2));
    }
    ctx.stroke();
    ctx.restore();
    if (this._anim > 0.1) drawLabel(ctx, 'Isocórico', vToX(V0)+8, pToY(P0*2.0/1000), COLORS.force, 'left');

    /* Legenda */
    drawLabel(ctx, `T₀ = ${T0} K`, W*0.04, H*0.92, COLORS.textSecondary);
    drawLabel(ctx, `P₀ = ${(P0/1000).toFixed(1)} kPa`, W*0.04, H*0.96, COLORS.textSecondary);
    drawLabel(ctx, `V₀ = ${V0} L`, W*0.60, H*0.92, COLORS.textSecondary);
    drawLabel(ctx, `n = ${n} mol`, W*0.60, H*0.96, COLORS.textSecondary);
  }
}

/* ─────────────────────────────────────────────────────────────────────────── *
 * CalorSimulation — Q = m·c·ΔT
 *
 * Fenômeno: dois materiais com mesma massa e mesma fonte de calor
 *   atingem temperaturas diferentes — a capacidade térmica determina ΔT.
 * Canvas: dois blocos com barras de temperatura, gráfico T(Q).
 * ─────────────────────────────────────────────────────────────────────────── */

/* Capacidades caloríficas específicas [J/(kg·K)] */
const MATERIALS = {
  agua:   { name: 'Água',      c: 4186 },
  ferro:  { name: 'Ferro',     c: 449  },
  alumin: { name: 'Alumínio',  c: 900  },
  cobre:  { name: 'Cobre',     c: 385  },
  vidro:  { name: 'Vidro',     c: 840  },
};

class CalorSimulation {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx    = canvas.getContext('2d');
    this._params = {
      mass:  0.5,        /* kg */
      mat1: 'agua',
      mat2: 'ferro',
      T0:    20,         /* °C */
      dQdt:  100,        /* W — taxa de aquecimento */
    };
    this._running  = false;
    this._raf      = null;
    this._t        = 0;
    this._Q        = 0;    /* calor total absorvido (J) */
    this._T1       = this._params.T0;
    this._T2       = this._params.T0;
    this._trail1   = [];
    this._trail2   = [];
    this._callbacks = [];
  }

  start()  { if (!this._running) { this._running = true; this._loop(); } }
  pause()  { this._running = false; if (this._raf) { cancelAnimationFrame(this._raf); this._raf = null; } }
  reset()  {
    this.pause();
    this._t = this._Q = 0;
    this._T1 = this._T2 = this._params.T0;
    this._trail1 = []; this._trail2 = [];
    this._draw();
  }
  dispose(){ this.pause(); }
  setParam(key, value) { if (key in this._params) { this._params[key] = value; if (!this._running) this._draw(); } }
  onTimeUpdate(fn) { this._callbacks.push(fn); }

  _loop() {
    if (!this._running) return;
    this._raf = requestAnimationFrame(() => {
      const dt  = Math.min(DT, 1/30);
      const dQ  = this._params.dQdt * dt;
      const m   = this._params.mass;
      const c1  = MATERIALS[this._params.mat1]?.c ?? 4186;
      const c2  = MATERIALS[this._params.mat2]?.c ?? 449;
      this._T1 += Physics.thermo_heat(m, c1, 1) > 0 ? dQ/(m*c1) : 0;
      this._T2 += Physics.thermo_heat(m, c2, 1) > 0 ? dQ/(m*c2) : 0;
      this._Q  += dQ;
      this._t  += dt;
      this._trail1.push({ Q: this._Q, T: this._T1 });
      this._trail2.push({ Q: this._Q, T: this._T2 });
      if (this._trail1.length > 300) { this._trail1.shift(); this._trail2.shift(); }
      this._draw();
      this._callbacks.forEach(fn => fn(this._t, {
        T1: this._T1.toFixed(1), T2: this._T2.toFixed(1),
        Q:  this._Q.toFixed(0),
        c1: c1.toFixed(0), c2: c2.toFixed(0),
      }));
      this._loop();
    });
  }

  _draw() {
    const ctx = this.ctx;
    const W = this.canvas.width, H = this.canvas.height;
    clearCanvas(ctx);
    drawGrid(ctx, 20, 5);

    const m1 = MATERIALS[this._params.mat1] ?? MATERIALS.agua;
    const m2 = MATERIALS[this._params.mat2] ?? MATERIALS.ferro;
    const Tmax = Math.max(this._T1, this._T2, this._params.T0 + 20, 100);
    const T0   = this._params.T0;

    /* Blocos */
    const b1X = W*0.10, b2X = W*0.35;
    const bW  = W*0.18, bH  = H*0.38, bY = H*0.25;

    const drawBlock = (bx, T, label, clr) => {
      const frac  = _clamp((T - T0) / (Tmax - T0), 0, 1);
      const fillH = bH * frac;
      ctx.save();
      ctx.fillStyle = `rgba(181,74,40,${0.08 + frac*0.30})`;
      ctx.fillRect(bx, bY + bH - fillH, bW, fillH);
      ctx.strokeStyle = COLORS.surface;
      ctx.lineWidth   = 2;
      ctx.strokeRect(bx, bY, bW, bH);
      ctx.restore();
      drawLabel(ctx, label, bx + bW/2, bY - 14, clr, 'center');
      drawLabel(ctx, `${T.toFixed(1)} °C`, bx + bW/2, bY + bH + 14, COLORS.amber, 'center');
    };

    drawBlock(b1X, this._T1, m1.name, COLORS.velocity);
    drawBlock(b2X, this._T2, m2.name, COLORS.kinetic);

    /* Gráfico T(Q) */
    const gX = W*0.60, gY = H*0.12, gW = W*0.34, gH = H*0.65;
    ctx.save();
    ctx.strokeStyle = COLORS.axis;
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.moveTo(gX, gY);
    ctx.lineTo(gX, gY+gH);
    ctx.lineTo(gX+gW, gY+gH);
    ctx.stroke();
    ctx.restore();
    drawLabel(ctx, 'Q (J)',   gX+gW/2, gY+gH+14, COLORS.textMuted, 'center');
    drawLabel(ctx, 'T (°C)',  gX-8,    gY,        COLORS.textMuted, 'right');

    if (this._trail1.length > 1) {
      const Qmax = this._trail1[this._trail1.length-1].Q || 1;
      const drawTrailG = (trail, clr) => {
        ctx.save();
        ctx.strokeStyle = clr;
        ctx.lineWidth   = 1.5;
        ctx.beginPath();
        trail.forEach((pt, idx) => {
          const px = gX + (pt.Q/Qmax)*gW;
          const py = gY + gH - _clamp((pt.T-T0)/(Tmax-T0),0,1)*gH;
          idx===0 ? ctx.moveTo(px,py) : ctx.lineTo(px,py);
        });
        ctx.stroke();
        ctx.restore();
      };
      drawTrailG(this._trail1, COLORS.velocity);
      drawTrailG(this._trail2, COLORS.kinetic);
    }

    /* Inclinação: Δ(1/c) */
    const c1 = m1.c, c2 = m2.c;
    drawLabel(ctx, `c₁ = ${c1} J/(kg·K)`, W*0.04, H*0.90, COLORS.velocity);
    drawLabel(ctx, `c₂ = ${c2} J/(kg·K)`, W*0.04, H*0.94, COLORS.kinetic);
    drawLabel(ctx, `Q = ${this._Q.toFixed(0)} J`, W*0.04, H*0.98, COLORS.amber);
  }
}

/* ─────────────────────────────────────────────────────────────────────────── *
 * Factory
 * ─────────────────────────────────────────────────────────────────────────── */

/**
 * @param {string} id
 * @param {HTMLCanvasElement} canvas
 */
function createTermodinamicaSimulation(id, canvas) {
  switch (id) {
    case 'gas-ideal':   return new IdealGasSimulation(canvas);
    case 'processos':   return new ProcessosSimulation(canvas);
    case 'calor':       return new CalorSimulation(canvas);
    default:            return new IdealGasSimulation(canvas);
  }
}

export { createTermodinamicaSimulation, IdealGasSimulation,
         ProcessosSimulation, CalorSimulation, MATERIALS };
