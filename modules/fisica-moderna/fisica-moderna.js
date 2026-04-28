/**
 * modules/fisica-moderna/fisica-moderna.js
 *
 * Simulações:
 *   fotoeletrico   — Efeito fotoelétrico: E = hf − φ
 *   radioatividade — Decaimento radioativo: N(t) = N₀·e^(−λt)
 *   modelo-atomico — Modelos atômicos e espectros de emissão do hidrogênio
 */

import {
  clearCanvas, drawGrid, drawArrow, drawLabel, drawReadout, drawCircle, COLORS
} from '../../engine/renderer.js';
import { ChartEngine } from '../../engine/chart-engine.js';

/* ── Constantes ──────────────────────────────────────────────────────────── */
const H_PLANCK  = 6.626e-34;  /* J·s */
const H_EV      = 4.136e-15;  /* eV·s */
const C_LIGHT   = 2.998e8;    /* m/s */
const E_CHARGE  = 1.602e-19;  /* C */

/* Funções de trabalho (eV) de metais comuns */
const METALS = {
  'Césio':   2.10,
  'Potássio':2.29,
  'Sódio':   2.36,
  'Cálcio':  2.87,
  'Alumínio':4.06,
  'Cobre':   4.70,
  'Ouro':    5.10,
};

/* Espectro de emissão do hidrogênio — série de Balmer (visível) */
const BALMER = [
  { n: 3, nm: 656.3, name: 'Hα', r: 220, g: 20,  b: 20  }, /* vermelho */
  { n: 4, nm: 486.1, name: 'Hβ', r: 60,  g: 80,  b: 255 }, /* azul-verde */
  { n: 5, nm: 434.0, name: 'Hγ', r: 80,  g: 40,  b: 240 }, /* violeta */
  { n: 6, nm: 410.2, name: 'Hδ', r: 100, g: 20,  b: 200 }, /* violeta */
];

/* Níveis de energia do hidrogênio: Eₙ = −13.6/n² eV */
const E_H = n => -13.6 / (n * n);

/* ── Base ────────────────────────────────────────────────────────────────── */

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

  reset() { this.pause(); this.time = 0; this._onReset(); this._render(); }

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

/* ══════════════════════════════════════════════════════════════════════════ *
 *  1. FotoEletricoSimulation — Efeito Fotoelétrico
 *     E_cin = hf − φ    (Einstein, 1905)
 *     Frequência de corte: f_c = φ/h
 *     Abaixo de f_c: nenhum elétron emitido, independente da intensidade
 * ══════════════════════════════════════════════════════════════════════════ */

class FotoEletricoSimulation extends SimBase {
  constructor(canvas, chartCanvas) {
    super(canvas);
    this.metal    = 'Potássio'; /* φ = 2.29 eV */
    this.lambda   = 400;        /* nm — comprimento de onda */
    this.intensidade = 3;       /* 1–5 — controla nº de fótons */
    this._electrons  = [];
    this._photons    = [];
    this._animT      = 0;
    this._chart      = chartCanvas ? new ChartEngine(chartCanvas) : null;
  }

  _onReset() {
    this.metal       = this.params.metal       ?? 'Potássio';
    this.lambda      = this.params.lambda      ?? 400;
    this.intensidade = this.params.intensidade ?? 3;
    this._electrons  = [];
    this._photons    = [];
    this._calc();
    if (this._chart) this._chart.clear();
  }

  _onParamChange(k, v) {
    if (k === 'metal')       this.metal       = v;
    if (k === 'lambda')      this.lambda      = v;
    if (k === 'intensidade') this.intensidade = v;
    this._calc();
    this._electrons = [];
    this._photons   = [];
  }

  _calc() {
    const phi    = METALS[this.metal] ?? 2.29; /* eV */
    const f      = C_LIGHT / (this.lambda * 1e-9); /* Hz */
    const E_fot  = H_EV * f;  /* eV */
    this._phi    = phi;
    this._E_fot  = E_fot;
    this._f      = f;
    this._f_c    = phi / H_EV;
    this._lambda_c = C_LIGHT / this._f_c * 1e9; /* nm */
    this._Ecin   = Math.max(0, E_fot - phi);
    this._emite  = E_fot >= phi;
  }

  _update(dt) {
    this._animT += dt;
    this.time   += dt;

    /* Emitir fótons periodicamente */
    const period = 0.4 / this.intensidade;
    if (this._animT % period < dt) {
      this._photons.push({ x: 60, y: 120 + Math.random() * 60, vx: 180, vy: 0, t: 0 });
    }

    /* Atualizar fótons */
    for (const p of this._photons) {
      p.x += p.vx * dt;
      p.t += dt;
    }

    /* Fóton atinge o metal → emitir elétron se E > φ */
    for (let i = this._photons.length - 1; i >= 0; i--) {
      const p = this._photons[i];
      if (p.x >= 280) {
        this._photons.splice(i, 1);
        if (this._emite) {
          const angle = (Math.random() - 0.5) * Math.PI * 0.6;
          const v = 80 + this._Ecin * 40;
          this._electrons.push({
            x: 280, y: 130 + Math.random() * 60,
            vx: v * Math.cos(angle),
            vy: v * Math.sin(angle),
            t: 0
          });
        }
      }
    }

    /* Atualizar elétrons */
    for (const e of this._electrons) {
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      e.t += dt;
    }
    this._electrons = this._electrons.filter(e => e.x < this.canvas.width + 10 && e.t < 2.5);
  }

  _render() {
    const { ctx, canvas } = this;
    const cw = canvas.width, ch = canvas.height;
    clearCanvas(ctx);

    /* Metal */
    ctx.save();
    ctx.fillStyle = '#3a3020';
    ctx.strokeStyle = COLORS.amber + 'aa';
    ctx.lineWidth = 2;
    ctx.fillRect(260, 100, 60, ch - 120);
    ctx.strokeRect(260, 100, 60, ch - 120);
    drawLabel(ctx, this.metal, 290, 90, COLORS.amber, 'center');
    drawLabel(ctx, `φ = ${this._phi.toFixed(2)} eV`, 290, ch - 30, COLORS.amber, 'center');
    ctx.restore();

    /* Fótons */
    for (const p of this._photons) {
      const nm  = this.lambda;
      const col = this._nmToRGB(nm);
      ctx.save();
      ctx.strokeStyle = col;
      ctx.lineWidth   = 2;
      /* Onda senoidal */
      ctx.beginPath();
      for (let dx = 0; dx < 30; dx++) {
        const x = p.x - 30 + dx;
        const y = p.y + Math.sin((dx / 30) * Math.PI * 4) * 8;
        dx === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.restore();
    }

    /* Elétrons */
    for (const e of this._electrons) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(e.x, e.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = this._emite ? '#4ab0d8' : '#555';
      ctx.fill();
      ctx.restore();
    }

    /* Sem emissão */
    if (!this._emite) {
      drawLabel(ctx, '✗ Sem emissão', cw * 0.6, ch * 0.45, '#c44040', 'center');
      drawLabel(ctx, 'hf < φ', cw * 0.6, ch * 0.55, '#c44040', 'center');
    }

    /* Painel de gráfico: Ecin vs λ */
    this._drawGraph(ctx, cw * 0.58, 30, cw * 0.40, ch * 0.55);

    /* Readouts */
    drawReadout(ctx, 'λ',     this.lambda.toFixed(0),       'nm',  12, 12);
    drawReadout(ctx, 'f',     (this._f / 1e14).toFixed(2),  '×10¹⁴Hz', 12, 36);
    drawReadout(ctx, 'E_fot', this._E_fot.toFixed(2),       'eV',  12, 60);
    drawReadout(ctx, 'φ',     this._phi.toFixed(2),          'eV',  12, 84);
    drawReadout(ctx, 'Ec',    this._Ecin.toFixed(3),         'eV',  12, 108);
    drawReadout(ctx, 'λ_c',   this._lambda_c.toFixed(0),     'nm',  12, 132);
    drawLabel(ctx, 'Ec = hf − φ', cw - 8, ch - 10, COLORS.textMuted, 'right');
  }

  _drawGraph(ctx, gx, gy, gw, gh) {
    /* Ec vs λ — reta com corte em λ_c */
    ctx.save();
    ctx.fillStyle   = 'rgba(0,0,0,0.3)';
    ctx.fillRect(gx, gy, gw, gh);
    ctx.strokeStyle = COLORS.textMuted + '40';
    ctx.lineWidth   = 0.5;
    ctx.strokeRect(gx, gy, gw, gh);

    /* Eixos */
    drawLabel(ctx, 'Ec (eV)', gx + 4, gy + 14, COLORS.textMuted, 'left');
    drawLabel(ctx, 'λ (nm)', gx + gw - 4, gy + gh - 4, COLORS.textMuted, 'right');

    /* Curva: de 200 nm a 800 nm */
    const phi = this._phi;
    const toX = nm => gx + ((nm - 200) / 600) * gw;
    const toY = ec => gy + gh - (Math.max(0, ec) / 6) * gh * 0.85 - 10;

    ctx.beginPath();
    let started = false;
    for (let nm = 200; nm <= 800; nm += 5) {
      const f  = C_LIGHT / (nm * 1e-9);
      const ec = H_EV * f - phi;
      if (ec < 0 && !started) continue;
      const x  = toX(nm), y = toY(ec);
      if (!started) { ctx.moveTo(x, y); started = true; }
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = '#4ab0d8aa';
    ctx.lineWidth   = 1.5;
    ctx.stroke();

    /* Ponto atual */
    const curX = toX(this.lambda);
    const curY = toY(this._Ecin);
    ctx.beginPath();
    ctx.arc(curX, curY, 5, 0, Math.PI * 2);
    ctx.fillStyle = this._emite ? '#4ab0d8' : '#c44040';
    ctx.fill();

    /* Linha de corte λ_c */
    const lcX = toX(this._lambda_c);
    if (lcX > gx && lcX < gx + gw) {
      ctx.strokeStyle = COLORS.amber + '80';
      ctx.lineWidth   = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.moveTo(lcX, gy); ctx.lineTo(lcX, gy + gh); ctx.stroke();
      ctx.setLineDash([]);
      drawLabel(ctx, `λ_c`, lcX + 2, gy + 20, COLORS.amber, 'left');
    }
    ctx.restore();
  }

  _nmToRGB(nm) {
    if (nm < 380) return 'rgb(100,0,160)';
    if (nm > 700) return 'rgb(160,0,0)';
    for (let i = 0; i < SPECTRUM_OPT.length - 1; i++) {
      const a = SPECTRUM_OPT[i], b = SPECTRUM_OPT[i + 1];
      if (nm >= a.nm && nm <= b.nm) {
        const t = (nm - a.nm) / (b.nm - a.nm);
        const r = Math.round(a.r + t * (b.r - a.r));
        const g = Math.round(a.g + t * (b.g - a.g));
        const bl = Math.round(a.b + t * (b.b - a.b));
        return `rgb(${r},${g},${bl})`;
      }
    }
    return 'white';
  }
}

/* Espectro simplificado para conversão nm→RGB */
const SPECTRUM_OPT = [
  { nm: 380, r: 100, g:  0, b: 160 },
  { nm: 440, r:  40, g:  0, b: 220 },
  { nm: 490, r:   0, g: 80, b: 255 },
  { nm: 510, r:   0, g:200, b:  80 },
  { nm: 560, r: 160, g:220, b:   0 },
  { nm: 590, r: 240, g:160, b:   0 },
  { nm: 630, r: 255, g: 40, b:   0 },
  { nm: 700, r: 180, g:  0, b:   0 },
];

/* ══════════════════════════════════════════════════════════════════════════ *
 *  2. RadioatividadeSimulation — Decaimento radioativo
 *     N(t) = N₀·e^(−λ·t)   t½ = ln2/λ ≈ 0,693/λ
 *     Atividade: A(t) = λ·N(t)
 * ══════════════════════════════════════════════════════════════════════════ */

class RadioatividadeSimulation extends SimBase {
  constructor(canvas, chartCanvas) {
    super(canvas);
    this.N0      = 200;  /* número inicial de núcleos */
    this.lambda  = 0.3;  /* constante de decaimento (1/s — escala visual) */
    this._N      = 200;
    this._nuclei = [];
    this._chart  = chartCanvas ? new ChartEngine(chartCanvas) : null;
  }

  _onReset() {
    this.N0     = this.params.N0     ?? 200;
    this.lambda = this.params.lambda ?? 0.3;
    this._N     = this.N0;
    this._initNuclei();
    if (this._chart) this._chart.clear();
  }

  _onParamChange(k, v) {
    if (k === 'N0')     this.N0     = v;
    if (k === 'lambda') this.lambda = v;
    this._N = this.N0;
    this._initNuclei();
    if (this._chart) this._chart.clear();
  }

  _initNuclei() {
    const cw = this.canvas.width, ch = this.canvas.height;
    this._nuclei = [];
    const cols = Math.ceil(Math.sqrt(this.N0 * 1.6));
    const rows = Math.ceil(this.N0 / cols);
    const dx   = Math.min((cw * 0.5) / cols, 18);
    const dy   = Math.min((ch * 0.75) / rows, 18);
    const ox   = 30, oy = 30;
    for (let i = 0; i < this.N0; i++) {
      this._nuclei.push({
        x:      ox + (i % cols) * dx + Math.random() * 4,
        y:      oy + Math.floor(i / cols) * dy + Math.random() * 4,
        decayed: false,
        decayT:  -Math.log(Math.random()) / this.lambda, /* tempo de decaimento aleatório */
      });
    }
  }

  _update(dt) {
    this.time += dt;

    /* Decaimento estocástico individual */
    let active = 0;
    for (const n of this._nuclei) {
      if (!n.decayed && this.time >= n.decayT) n.decayed = true;
      if (!n.decayed) active++;
    }
    this._N = active;

    if (this._chart) this._chart.addPoint(this.time, this._N);
  }

  _render() {
    const { ctx, canvas } = this;
    const cw = canvas.width, ch = canvas.height;
    clearCanvas(ctx);
    drawGrid(ctx);

    /* Núcleos */
    for (const n of this._nuclei) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(n.x, n.y, 5, 0, Math.PI * 2);
      if (n.decayed) {
        ctx.fillStyle   = '#c0404040';
        ctx.strokeStyle = '#c0404060';
      } else {
        ctx.fillStyle   = '#3d7a5540';
        ctx.strokeStyle = '#3d7a55cc';
      }
      ctx.lineWidth = 1;
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    /* Curva analítica N(t) no painel direito */
    this._drawDecayCurve(ctx, cw * 0.56, 20, cw * 0.42, ch * 0.65);

    /* Meia-vida */
    const t_half = Math.LN2 / this.lambda;
    const N_teoria = this.N0 * Math.exp(-this.lambda * this.time);

    /* Legenda dos núcleos */
    ctx.save();
    ctx.beginPath(); ctx.arc(30, ch - 45, 5, 0, Math.PI*2);
    ctx.fillStyle='#3d7a5580'; ctx.fill(); ctx.strokeStyle='#3d7a55'; ctx.lineWidth=1; ctx.stroke();
    drawLabel(ctx, 'Estável', 44, ch - 41, '#3d7a55', 'left');
    ctx.beginPath(); ctx.arc(30, ch - 25, 5, 0, Math.PI*2);
    ctx.fillStyle='#c0404040'; ctx.fill(); ctx.strokeStyle='#c04040'; ctx.lineWidth=1; ctx.stroke();
    drawLabel(ctx, 'Decaído', 44, ch - 21, '#c04040', 'left');
    ctx.restore();

    /* Readouts */
    const A = this.lambda * this._N;
    drawReadout(ctx, 'N(t)',   this._N.toFixed(0),          '',    12, 12);
    drawReadout(ctx, 'N₀',    this.N0.toFixed(0),           '',    12, 36);
    drawReadout(ctx, 't½',    t_half.toFixed(2),            's',   12, 60);
    drawReadout(ctx, 'λ',     this.lambda.toFixed(2),       '1/s', 12, 84);
    drawReadout(ctx, 'A(t)',  A.toFixed(1),                 'dec/s',12, 108);
    drawLabel(ctx, 'N(t) = N₀·e^(−λt)', cw - 8, ch - 10, COLORS.textMuted, 'right');
  }

  _drawDecayCurve(ctx, gx, gy, gw, gh) {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(gx, gy, gw, gh);
    ctx.strokeStyle = COLORS.textMuted + '40';
    ctx.lineWidth   = 0.5;
    ctx.strokeRect(gx, gy, gw, gh);

    drawLabel(ctx, 'N(t)', gx + 4, gy + 14, COLORS.textMuted, 'left');
    drawLabel(ctx, 't (s)', gx + gw - 4, gy + gh - 4, COLORS.textMuted, 'right');

    const tMax = 12 / this.lambda;
    const toX  = t  => gx + (t / tMax) * gw;
    const toY  = n  => gy + gh - (n / this.N0) * (gh - 16) - 8;

    /* Curva teórica */
    ctx.beginPath();
    for (let i = 0; i <= 100; i++) {
      const t = (i / 100) * tMax;
      const n = this.N0 * Math.exp(-this.lambda * t);
      const x = toX(t), y = toY(n);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.strokeStyle = '#3d7a55aa';
    ctx.lineWidth   = 1.5;
    ctx.stroke();

    /* Ponto atual */
    const cx = toX(this.time), cy2 = toY(this._N);
    if (cx >= gx && cx <= gx + gw) {
      ctx.beginPath(); ctx.arc(cx, cy2, 4, 0, Math.PI * 2);
      ctx.fillStyle = COLORS.amber; ctx.fill();
    }

    /* Linhas de meia-vida */
    const t_half = Math.LN2 / this.lambda;
    for (let k = 1; k * t_half <= tMax; k++) {
      const lx = toX(k * t_half);
      if (lx > gx && lx < gx + gw) {
        ctx.strokeStyle = COLORS.amber + '40';
        ctx.lineWidth   = 0.8;
        ctx.setLineDash([3, 3]);
        ctx.beginPath(); ctx.moveTo(lx, gy); ctx.lineTo(lx, gy + gh); ctx.stroke();
        ctx.setLineDash([]);
        drawLabel(ctx, `${k}t½`, lx + 2, gy + 20, COLORS.amber + '80', 'left');
      }
    }
    ctx.restore();
  }
}

/* ══════════════════════════════════════════════════════════════════════════ *
 *  3. ModeloAtomicoSimulation — Modelos atômicos e espectros
 *     Modelo de Bohr: Eₙ = −13.6/n² eV
 *     Transições eletrônicas → fótons de comprimento de onda definido
 *     1/λ = R_H·(1/n₁² − 1/n₂²)    (fórmula de Rydberg)
 * ══════════════════════════════════════════════════════════════════════════ */

class ModeloAtomicoSimulation extends SimBase {
  constructor(canvas) {
    super(canvas);
    this.modelo = 'bohr'; /* 'thomson' | 'rutherford' | 'bohr' */
    this.n_from = 4;      /* nível de transição (emissão) */
    this.n_to   = 2;      /* nível destino */
    this._phi   = 0;      /* fase de animação dos elétrons */
    this._flash = 0;      /* flash de fóton emitido */
  }

  _onReset() {
    this.modelo = this.params.modelo ?? 'bohr';
    this.n_from = this.params.n_from ?? 4;
    this.n_to   = this.params.n_to   ?? 2;
    this._phi   = 0;
    this._flash = 0;
  }

  _onParamChange(k, v) {
    if (k === 'modelo') this.modelo = v;
    if (k === 'n_from') this.n_from = Math.max(v, this.n_to + 1);
    if (k === 'n_to')   this.n_to   = Math.min(v, this.n_from - 1);
    this._flash = 0;
  }

  _update(dt) {
    this._phi   += dt * 1.2;
    this._flash  = Math.max(0, this._flash - dt * 3);
    /* Emitir flash periódico */
    if (Math.floor(this._phi / (Math.PI * 2)) > Math.floor((this._phi - dt * 1.2) / (Math.PI * 2))) {
      this._flash = 1;
    }
    this.time += dt;
  }

  _render() {
    if (this.modelo === 'thomson')      this._renderThomson();
    else if (this.modelo === 'rutherford') this._renderRutherford();
    else                                   this._renderBohr();
  }

  _renderThomson() {
    const { ctx, canvas } = this;
    const cw = canvas.width, ch = canvas.height;
    clearCanvas(ctx);

    const cx = cw * 0.35, cy = ch / 2, R = 90;

    /* Nuvem positiva */
    ctx.save();
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
    grad.addColorStop(0, 'rgba(200,80,40,0.30)');
    grad.addColorStop(1, 'rgba(200,80,40,0.04)');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#c05028aa'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
    drawLabel(ctx, 'Carga + distribuída', cx, cy + R + 16, '#c05028aa', 'center');
    ctx.restore();

    /* Elétrons embutidos (pudim de ameixa) */
    const pos = [
      {r:30, a:0}, {r:55, a:2.1}, {r:55, a:4.2},
      {r:75, a:0.8}, {r:75, a:3.0}, {r:75, a:5.2},
    ];
    for (const p of pos) {
      const x = cx + p.r * Math.cos(p.a + this._phi * 0.3);
      const y = cy + p.r * Math.sin(p.a + this._phi * 0.3);
      ctx.save();
      ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fillStyle = '#4ab0d8'; ctx.fill();
      ctx.restore();
    }

    /* Texto histórico */
    this._drawHistorico(ctx, cw * 0.56, 20,
      'Modelo de Thomson (1904)',
      '"Pudim de ameixa" — elétrons embutidos\nem uma nuvem positiva uniforme.\n\nRefutado por Rutherford em 1909.');

    drawLabel(ctx, 'e⁻', cx, cy - R - 14, '#4ab0d8', 'center');
  }

  _renderRutherford() {
    const { ctx, canvas } = this;
    const cw = canvas.width, ch = canvas.height;
    clearCanvas(ctx);

    const cx = cw * 0.35, cy = ch / 2;

    /* Núcleo */
    ctx.save();
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 10);
    grad.addColorStop(0, '#ffaa40');
    grad.addColorStop(1, '#c05028');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(cx, cy, 10, 0, Math.PI * 2); ctx.fill();
    drawLabel(ctx, 'Núcleo\n(+)', cx, cy + 16, '#c05028', 'center');
    ctx.restore();

    /* Elétrons em órbitas (sem quantização — qualquer raio) */
    const orbits = [60, 100, 145];
    for (let i = 0; i < orbits.length; i++) {
      const r = orbits[i];
      ctx.save();
      ctx.strokeStyle = COLORS.textMuted + '30';
      ctx.lineWidth   = 0.8;
      ctx.setLineDash([3, 6]);
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);

      const phi = this._phi * (1 - i * 0.2);
      const ex  = cx + r * Math.cos(phi);
      const ey  = cy + r * Math.sin(phi);
      ctx.beginPath(); ctx.arc(ex, ey, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#4ab0d8'; ctx.fill();
      ctx.restore();
    }

    this._drawHistorico(ctx, cw * 0.56, 20,
      'Modelo de Rutherford (1911)',
      'Núcleo denso e positivo no centro.\nElétrons em órbitas (raio indefinido).\n\nProblema: elétron em aceleração irradia\nenergy → espiral e colapso em ~10⁻¹¹ s.');
  }

  _renderBohr() {
    const { ctx, canvas } = this;
    const cw = canvas.width, ch = canvas.height;
    clearCanvas(ctx);

    const cx = cw * 0.35, cy = ch / 2;
    const nMax = 5;
    const scale = 22; /* px por n */

    /* Núcleo */
    ctx.save();
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 8);
    grad.addColorStop(0, '#ffaa40');
    grad.addColorStop(1, '#c05028');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(cx, cy, 8, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    /* Órbitas quantizadas */
    for (let n = 1; n <= nMax; n++) {
      const r = n * n * scale;
      ctx.save();
      ctx.strokeStyle = n === this.n_to || n === this.n_from
        ? COLORS.amber + '80' : COLORS.textMuted + '25';
      ctx.lineWidth = n === this.n_to || n === this.n_from ? 1.5 : 0.8;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
      drawLabel(ctx, `n=${n}`, cx + r + 4, cy, COLORS.textMuted, 'left');
      ctx.restore();
    }

    /* Elétron no nível n_from */
    {
      const r   = this.n_from * this.n_from * scale;
      const ex  = cx + r * Math.cos(this._phi);
      const ey  = cy + r * Math.sin(this._phi);
      ctx.save();
      ctx.beginPath(); ctx.arc(ex, ey, 6, 0, Math.PI * 2);
      ctx.fillStyle = '#4ab0d8'; ctx.fill();
      ctx.restore();
    }

    /* Seta de transição */
    {
      const r1 = this.n_from * this.n_from * scale;
      const r2 = this.n_to   * this.n_to   * scale;
      ctx.save();
      ctx.strokeStyle = '#c060c0aa';
      ctx.lineWidth   = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx + r1 * 0.72, cy);
      ctx.lineTo(cx + r2 * 0.72, cy);
      ctx.stroke();
      /* Seta */
      ctx.fillStyle = '#c060c0';
      ctx.beginPath();
      ctx.moveTo(cx + r2 * 0.72, cy - 5);
      ctx.lineTo(cx + r2 * 0.72 - 10, cy);
      ctx.lineTo(cx + r2 * 0.72, cy + 5);
      ctx.fill();
      ctx.restore();
    }

    /* Fóton emitido (flash) */
    if (this._flash > 0.1) {
      const r2   = this.n_to * this.n_to * scale;
      const pCol = this._transitionColor();
      ctx.save();
      ctx.globalAlpha = this._flash * 0.9;
      ctx.strokeStyle = pCol;
      ctx.lineWidth   = 2;
      const px = cx + r2 * 0.72 - 20;
      for (let dx = 0; dx < 50; dx += 2) {
        const x = px - dx;
        const y = cy + Math.sin((dx / 8) * Math.PI * 2) * 8;
        if (dx === 0) { ctx.beginPath(); ctx.moveTo(x, y); }
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.restore();
    }

    /* Painel de espectro Balmer */
    this._drawSpectrum(ctx, cw * 0.56, 20, cw * 0.42, ch * 0.3);

    /* Níveis de energia */
    this._drawEnergyLevels(ctx, cw * 0.56, ch * 0.38, cw * 0.42, ch * 0.55);

    /* Cálculo da transição */
    const E1   = E_H(this.n_from);
    const E2   = E_H(this.n_to);
    const dE   = E2 - E1;          /* negativo = emissão */
    const R_H  = 1.097e7;          /* m⁻¹ */
    const invLambda = R_H * (1 / (this.n_to * this.n_to) - 1 / (this.n_from * this.n_from));
    const lambdaNm = 1 / invLambda * 1e9;

    drawReadout(ctx, 'n_from', this.n_from.toFixed(0), '',    12, 12);
    drawReadout(ctx, 'n_to',   this.n_to.toFixed(0),   '',    12, 36);
    drawReadout(ctx, 'ΔE',     Math.abs(dE).toFixed(3),'eV',  12, 60);
    drawReadout(ctx, 'λ',      lambdaNm.toFixed(1),    'nm',  12, 84);
    drawLabel(ctx, '1/λ = R_H·(1/n₁² − 1/n₂²)', cw - 8, ch - 10, COLORS.textMuted, 'right');
  }

  _transitionColor() {
    const R_H = 1.097e7;
    const inv = R_H * (1/(this.n_to*this.n_to) - 1/(this.n_from*this.n_from));
    if (inv <= 0) return 'white';
    const nm = 1/inv * 1e9;
    if (nm < 380 || nm > 700) return nm < 380 ? '#8040c0' : '#800000';
    const SPEC = SPECTRUM_OPT;
    for (let i = 0; i < SPEC.length - 1; i++) {
      if (nm >= SPEC[i].nm && nm <= SPEC[i+1].nm) {
        const t = (nm - SPEC[i].nm)/(SPEC[i+1].nm - SPEC[i].nm);
        const r = Math.round(SPEC[i].r + t*(SPEC[i+1].r - SPEC[i].r));
        const g = Math.round(SPEC[i].g + t*(SPEC[i+1].g - SPEC[i].g));
        const b = Math.round(SPEC[i].b + t*(SPEC[i+1].b - SPEC[i].b));
        return `rgb(${r},${g},${b})`;
      }
    }
    return 'white';
  }

  _drawSpectrum(ctx, gx, gy, gw, gh) {
    /* Espectro de emissão do hidrogênio — série de Balmer */
    ctx.save();
    ctx.fillStyle = '#000';
    ctx.fillRect(gx, gy, gw, gh);
    ctx.strokeStyle = COLORS.textMuted + '40';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(gx, gy, gw, gh);
    drawLabel(ctx, 'Série de Balmer (H)', gx + 4, gy + 12, COLORS.textMuted, 'left');

    const nm0 = 380, nm1 = 700;
    for (const line of BALMER) {
      const x = gx + ((line.nm - nm0) / (nm1 - nm0)) * gw;
      ctx.strokeStyle = `rgb(${line.r},${line.g},${line.b})`;
      ctx.lineWidth   = 2.5;
      ctx.beginPath(); ctx.moveTo(x, gy + 18); ctx.lineTo(x, gy + gh - 8); ctx.stroke();
      drawLabel(ctx, line.name, x, gy + 14, `rgb(${line.r},${line.g},${line.b})`, 'center');
    }

    /* Transição atual */
    if (this.n_to === 2 && this.n_from <= 6) {
      const R_H = 1.097e7;
      const inv = R_H * (1/4 - 1/(this.n_from*this.n_from));
      if (inv > 0) {
        const nm = 1/inv*1e9;
        if (nm >= nm0 && nm <= nm1) {
          const x = gx + ((nm - nm0)/(nm1-nm0))*gw;
          ctx.strokeStyle = this._transitionColor();
          ctx.lineWidth   = 3;
          ctx.globalAlpha = 0.5 + 0.5 * this._flash;
          ctx.beginPath(); ctx.moveTo(x, gy+18); ctx.lineTo(x, gy+gh-8); ctx.stroke();
          ctx.globalAlpha = 1;
        }
      }
    }
    ctx.restore();
  }

  _drawEnergyLevels(ctx, gx, gy, gw, gh) {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(gx, gy, gw, gh);
    drawLabel(ctx, 'Níveis de energia (eV)', gx + 4, gy + 12, COLORS.textMuted, 'left');

    const E_min = E_H(1), E_max = 0.5;
    const toY = E => gy + gh - ((E - E_min) / (E_max - E_min)) * (gh - 24) - 8;

    for (let n = 1; n <= 5; n++) {
      const E = E_H(n);
      const y = toY(E);
      ctx.strokeStyle = n === this.n_from || n === this.n_to
        ? COLORS.amber : COLORS.textMuted + '60';
      ctx.lineWidth = n === this.n_from || n === this.n_to ? 1.5 : 0.8;
      ctx.beginPath(); ctx.moveTo(gx + 8, y); ctx.lineTo(gx + gw - 8, y); ctx.stroke();
      drawLabel(ctx, `n=${n} (${E.toFixed(2)} eV)`, gx + 12, y - 4, COLORS.textMuted, 'left');
    }

    /* Seta de transição */
    const y1 = toY(E_H(this.n_from));
    const y2 = toY(E_H(this.n_to));
    ctx.strokeStyle = '#c060c0';
    ctx.lineWidth   = 1.5;
    ctx.beginPath();
    ctx.moveTo(gx + gw * 0.75, y1);
    ctx.lineTo(gx + gw * 0.75, y2);
    ctx.stroke();
    /* Seta */
    ctx.fillStyle = '#c060c0';
    ctx.beginPath();
    ctx.moveTo(gx + gw * 0.75 - 5, y2 + 8);
    ctx.lineTo(gx + gw * 0.75, y2);
    ctx.lineTo(gx + gw * 0.75 + 5, y2 + 8);
    ctx.fill();

    ctx.restore();
  }

  _drawHistorico(ctx, gx, gy, titulo, texto) {
    const cw = this.canvas.width;
    const gw = cw - gx - 10;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(gx, gy, gw, 140);
    drawLabel(ctx, titulo, gx + 10, gy + 18, COLORS.amber, 'left');
    const lines = texto.split('\n');
    lines.forEach((l, i) => drawLabel(ctx, l, gx + 10, gy + 36 + i * 18, COLORS.textSecondary, 'left'));
    ctx.restore();
  }
}

/* ── Factory ─────────────────────────────────────────────────────────────── */

export function createFisicaModernaSimulation(simId, canvas, chartCanvas) {
  switch (simId) {
    case 'fotoeletrico':   return new FotoEletricoSimulation(canvas, chartCanvas);
    case 'radioatividade': return new RadioatividadeSimulation(canvas, chartCanvas);
    case 'modelo-atomico': return new ModeloAtomicoSimulation(canvas);
    default:
      throw new Error(`[fisica-moderna] simulação desconhecida: "${simId}"`);
  }
}
