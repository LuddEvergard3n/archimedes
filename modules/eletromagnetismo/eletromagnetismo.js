/**
 * modules/eletromagnetismo/eletromagnetismo.js
 *
 * Simulações:
 *   coulomb        — Lei de Coulomb: força entre cargas puntiformes
 *   campo-eletrico — Campo elétrico vetorial: linhas de campo, dipolo
 *   circuito       — Lei de Ohm e circuitos: série, paralelo
 *   campo-magnetico — Campo magnético do fio longo e solenoide
 *   forca-lorentz  — Força de Lorentz: partícula em campo magnético
 *   inducao        — Indução de Faraday: fluxo e fem induzida
 */

import {
  clearCanvas, drawGrid, drawArrow, drawCircle,
  drawLabel, drawReadout, COLORS
} from '../../engine/renderer.js';
import { ChartEngine } from '../../engine/chart-engine.js';

/* ── Constantes físicas ──────────────────────────────────────────────────── */
const K_E   = 8.9875e9;   /* N·m²/C²  — constante de Coulomb               */
const MU_0  = 4*Math.PI*1e-7; /* T·m/A — permeabilidade do vácuo           */
const EPS_0 = 8.854e-12;  /* C²/(N·m²) — permissividade do vácuo           */
const C_LIGHT = 2.998e8;  /* m/s — velocidade da luz                        */
const E_CHARGE = 1.602e-19; /* C — carga do elétron                         */

/* Cor característica do módulo: ciano-elétrico */
const EM_COLOR    = '#4ab0d8';   /* fio elétrico, vetores elétricos */
const EM_DIM      = 'rgba(74,176,216,0.18)';
const MAG_COLOR   = '#c060c0';   /* vetores magnéticos — convenção magenta  */
const MAG_DIM     = 'rgba(192,96,192,0.18)';
const POS_COLOR   = '#c44040';   /* carga positiva                          */
const NEG_COLOR   = '#4472b0';   /* carga negativa                          */
const NEUTRAL_COLOR = '#b0a040'; /* carga neutra                            */

/* ── Base class (padrão do projeto) ─────────────────────────────────────── */

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
 *  1. CoulombSimulation — Lei de Coulomb
 *     F = k·|q1·q2| / r²
 *     Duas cargas puntiformes no canvas. O usuário controla q1, q2 e a
 *     separação r. Vetores de força são desenhados em tempo real.
 * ══════════════════════════════════════════════════════════════════════════ */

class CoulombSimulation extends SimBase {
  constructor(canvas) {
    super(canvas);
    this.q1 = 1e-6;   /* C */
    this.q2 = 1e-6;   /* C */
    this.r  = 0.30;   /* m */
    this.F  = 0;
  }

  _onReset() {
    this.q1 = this.params.q1 ?? 1e-6;
    this.q2 = this.params.q2 ?? 1e-6;
    this.r  = this.params.r  ?? 0.30;
    this._calc();
  }

  _onParamChange(key, value) {
    if (key === 'q1') this.q1 = value;
    if (key === 'q2') this.q2 = value;
    if (key === 'r')  this.r  = value;
    this._calc();
  }

  _calc() {
    /* F = k·|q1·q2| / r²  (sempre positivo — sinal indica atração/repulsão) */
    this.F = K_E * Math.abs(this.q1 * this.q2) / (this.r * this.r);
    this._attractive = (this.q1 * this.q2) < 0;
  }

  _render() {
    const { ctx, canvas } = this;
    const cw = canvas.width, ch = canvas.height;
    clearCanvas(ctx);
    drawGrid(ctx);

    const cx = cw / 2, cy = ch / 2;
    const scale = 300; /* px por metro — para visualização */
    const rPx   = Math.min(this.r * scale, cw * 0.42);

    const x1 = cx - rPx / 2;
    const x2 = cx + rPx / 2;

    /* Escala de força para seta — normalizada para o canvas */
    const Fmax  = K_E * (10e-6) * (10e-6) / (0.05 * 0.05);
    const arrowLen = Math.min(60, 20 + (this.F / Fmax) * 50);
    const arrowColor = this._attractive ? NEG_COLOR : POS_COLOR;

    /* Setas de força */
    if (this._attractive) {
      /* atração: setas apontam um para o outro */
      drawArrow(ctx, x1 - 10, cy, arrowLen, 0, arrowColor, '');
      drawArrow(ctx, x2 + 10, cy, -arrowLen, 0, arrowColor, '');
    } else {
      /* repulsão: setas apontam para fora */
      drawArrow(ctx, x1 - 10, cy, -arrowLen, 0, arrowColor, '');
      drawArrow(ctx, x2 + 10, cy,  arrowLen, 0, arrowColor, '');
    }

    /* Linha de separação */
    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = 'rgba(180,140,60,0.25)';
    ctx.beginPath();
    ctx.moveTo(x1, cy);
    ctx.lineTo(x2, cy);
    ctx.stroke();
    ctx.setLineDash([]);

    /* Distância */
    ctx.strokeStyle = COLORS.textMuted;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x1, cy + 22); ctx.lineTo(x2, cy + 22); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x1, cy + 18); ctx.lineTo(x1, cy + 26); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x2, cy + 18); ctx.lineTo(x2, cy + 26); ctx.stroke();
    drawLabel(ctx, `r = ${this.r.toFixed(2)} m`, cx, cy + 36, COLORS.textMuted, 'center');
    ctx.restore();

    /* Cargas */
    this._drawCharge(ctx, x1, cy, this.q1, 'q₁');
    this._drawCharge(ctx, x2, cy, this.q2, 'q₂');

    /* Readouts */
    const Fmu = this.F * 1e3;
    drawReadout(ctx, 'F', Fmu.toFixed(3), 'mN', 12, 12);
    drawReadout(ctx, 'q₁', (this.q1 * 1e6).toFixed(1), 'μC', 12, 36);
    drawReadout(ctx, 'q₂', (this.q2 * 1e6).toFixed(1), 'μC', 12, 60);
    drawReadout(ctx, 'k', '8.99 × 10⁹', 'N·m²/C²', 12, 84);

    /* Tipo de interação */
    const tipoCor = this._attractive ? NEG_COLOR : POS_COLOR;
    const tipoTxt = this._attractive ? '← Atração →' : '→ Repulsão ←';
    drawLabel(ctx, tipoTxt, cx, cy - rPx / 2 - 16, tipoCor, 'center');
  }

  _drawCharge(ctx, x, y, q, label) {
    const r = 18;
    const color = q > 0 ? POS_COLOR : q < 0 ? NEG_COLOR : NEUTRAL_COLOR;
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = color + '33';
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();
    /* Sinal + ou - */
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x - 7, y); ctx.lineTo(x + 7, y); ctx.stroke();
    if (q > 0) { ctx.beginPath(); ctx.moveTo(x, y - 7); ctx.lineTo(x, y + 7); ctx.stroke(); }
    /* Label */
    drawLabel(ctx, label, x, y - r - 8, COLORS.textSecondary, 'center');
    drawLabel(ctx, `${(q * 1e6).toFixed(1)} μC`, x, y + r + 14, color, 'center');
    ctx.restore();
  }

  _update(dt) { this.time += dt; }
}

/* ══════════════════════════════════════════════════════════════════════════ *
 *  2. CampoEletricoSimulation — Campo elétrico e linhas de campo
 *     E = k·q / r²  (magnitude)
 *     Duas cargas geram um campo resultante. Linhas de campo desenhadas por
 *     integração numérica de trajetórias a partir de pontos-semente.
 * ══════════════════════════════════════════════════════════════════════════ */

class CampoEletricoSimulation extends SimBase {
  constructor(canvas) {
    super(canvas);
    this.q1  = +2e-9;  /* C */
    this.q2  = -2e-9;  /* C */
    this._charges = [];
    this._lines   = [];
  }

  _onReset() {
    this.q1 = this.params.q1 ?? +2e-9;
    this.q2 = this.params.q2 ?? -2e-9;
    this._build();
  }

  _onParamChange(key, value) {
    if (key === 'q1') this.q1 = value;
    if (key === 'q2') this.q2 = value;
    this._build();
  }

  _build() {
    const cw = this.canvas.width, ch = this.canvas.height;
    const cx = cw / 2, cy = ch / 2;
    const sep = cw * 0.22;

    this._charges = [
      { x: cx - sep, y: cy, q: this.q1 },
      { x: cx + sep, y: cy, q: this.q2 },
    ];

    /* Calcular linhas de campo por integração */
    this._lines = this._computeFieldLines(cw, ch);
  }

  /* Calcula o campo total em (x,y) em px */
  _field(x, y, pxPerM) {
    let Ex = 0, Ey = 0;
    for (const ch of this._charges) {
      const dx = (x - ch.x) / pxPerM;
      const dy = (y - ch.y) / pxPerM;
      const r2 = dx * dx + dy * dy;
      if (r2 < 1e-6) continue;
      const E  = K_E * Math.abs(ch.q) / r2;
      const r  = Math.sqrt(r2);
      const sign = ch.q > 0 ? 1 : -1;
      Ex += sign * E * dx / r;
      Ey += sign * E * dy / r;
    }
    return { Ex, Ey };
  }

  _computeFieldLines(cw, ch) {
    const pxPerM = 120;
    const step   = 3;   /* px por integração */
    const maxIter = 800;
    const lines  = [];

    /* Semear linhas nas cargas positivas */
    const nLines = 12;
    for (const ch of this._charges) {
      if (ch.q <= 0) continue;
      for (let i = 0; i < nLines; i++) {
        const angle = (2 * Math.PI * i) / nLines;
        const r0 = 22; /* px — raio do seed */
        let x = ch.x + r0 * Math.cos(angle);
        let y = ch.y + r0 * Math.sin(angle);
        const pts = [{ x, y }];

        for (let k = 0; k < maxIter; k++) {
          const { Ex, Ey } = this._field(x, y, pxPerM);
          const E = Math.sqrt(Ex * Ex + Ey * Ey);
          if (E < 1e-6) break;
          const dx = step * Ex / E;
          const dy = step * Ey / E;
          x += dx; y += dy;

          /* Parar se saiu do canvas ou chegou numa carga negativa */
          if (x < 0 || x > cw || y < 0 || y > ch) break;
          let hitNeg = false;
          for (const c of this._charges) {
            if (c.q < 0 && Math.hypot(x - c.x, y - c.y) < 18) { hitNeg = true; break; }
          }
          if (hitNeg) break;
          pts.push({ x, y });
        }
        lines.push(pts);
      }
    }
    return lines;
  }

  _render() {
    const { ctx, canvas } = this;
    const cw = canvas.width, ch = canvas.height;
    clearCanvas(ctx);
    drawGrid(ctx);

    if (!this._charges.length) this._build();

    /* Linhas de campo */
    ctx.save();
    for (const pts of this._lines) {
      if (pts.length < 2) continue;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.strokeStyle = EM_COLOR + '60';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      /* Setas de direção a cada ~80px */
      for (let i = 40; i < pts.length - 1; i += 80) {
        const dx = pts[i + 1].x - pts[i].x;
        const dy = pts[i + 1].y - pts[i].y;
        const len = Math.hypot(dx, dy) || 1;
        drawArrow(ctx, pts[i].x, pts[i].y, dx / len * 10, dy / len * 10, EM_COLOR, '', 1.5);
      }
    }
    ctx.restore();

    /* Cargas */
    for (const ch of this._charges) {
      const color = ch.q > 0 ? POS_COLOR : NEG_COLOR;
      ctx.beginPath();
      ctx.arc(ch.x, ch.y, 16, 0, Math.PI * 2);
      ctx.fillStyle = color + '33';
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.stroke();
      /* Sinal */
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(ch.x - 6, ch.y); ctx.lineTo(ch.x + 6, ch.y); ctx.stroke();
      if (ch.q > 0) { ctx.beginPath(); ctx.moveTo(ch.x, ch.y - 6); ctx.lineTo(ch.x, ch.y + 6); ctx.stroke(); }
      drawLabel(ctx, `${(ch.q * 1e9).toFixed(0)} nC`, ch.x, ch.y + 26, color, 'center');
    }

    /* Readouts */
    drawReadout(ctx, 'q₁', (this.q1 * 1e9).toFixed(0), 'nC', 12, 12);
    drawReadout(ctx, 'q₂', (this.q2 * 1e9).toFixed(0), 'nC', 12, 36);
    drawLabel(ctx, 'E = k·|q| / r²', cw - 8, ch - 10, COLORS.textMuted, 'right');
  }

  _update(dt) { this.time += dt; }
}

/* ══════════════════════════════════════════════════════════════════════════ *
 *  3. CircuitoSimulation — Lei de Ohm e circuitos
 *     V = R·I,  P = V·I = V²/R = I²·R
 *     Dois modos: série (R_total = R1 + R2) e paralelo (1/R = 1/R1 + 1/R2)
 *     O canvas anima o fluxo de elétrons proporcional à corrente.
 * ══════════════════════════════════════════════════════════════════════════ */

class CircuitoSimulation extends SimBase {
  constructor(canvas) {
    super(canvas);
    this.V    = 12;    /* V */
    this.R1   = 4;     /* Ω */
    this.R2   = 8;     /* Ω */
    this.modo = 'serie'; /* 'serie' | 'paralelo' */
    this._electrons = [];
    this._Rtotal = 0;
    this._I = 0;
    this._I1 = 0;
    this._I2 = 0;
    this._P  = 0;
  }

  _onReset() {
    this.V    = this.params.V    ?? 12;
    this.R1   = this.params.R1   ?? 4;
    this.R2   = this.params.R2   ?? 8;
    this.modo = this.params.modo ?? 'serie';
    this._calc();
    this._initElectrons();
  }

  _onParamChange(key, value) {
    if (key === 'V')    this.V    = value;
    if (key === 'R1')   this.R1   = value;
    if (key === 'R2')   this.R2   = value;
    if (key === 'modo') this.modo = value;
    this._calc();
    this._initElectrons();
  }

  _calc() {
    if (this.modo === 'serie') {
      this._Rtotal = this.R1 + this.R2;
      this._I  = this.V / this._Rtotal;
      this._I1 = this._I;
      this._I2 = this._I;
    } else {
      /* paralelo */
      this._Rtotal = 1 / (1 / this.R1 + 1 / this.R2);
      this._I  = this.V / this._Rtotal;
      this._I1 = this.V / this.R1;
      this._I2 = this.V / this.R2;
    }
    this._P = this.V * this._I;
  }

  /* Elétrons animados ao longo de um caminho retangular */
  _initElectrons() {
    this._electrons = [];
    const n = Math.round(6 + this._I * 2);
    for (let i = 0; i < Math.min(n, 16); i++) {
      this._electrons.push({ t: i / n }); /* t ∈ [0,1] — posição no circuito */
    }
  }

  _update(dt) {
    /* Velocidade proporcional à corrente */
    const speed = 0.12 * Math.min(this._I / 3, 1) + 0.04;
    for (const e of this._electrons) {
      e.t = (e.t + speed * dt) % 1;
    }
    this.time += dt;
  }

  /* Converter t∈[0,1] para posição (x,y) no circuito retangular */
  _electronPos(t, cw, ch) {
    const M  = 28;
    const x0 = M, y0 = M, x1 = cw - M, y1 = ch - M;
    const perimeter = 2 * ((x1 - x0) + (y1 - y0));
    const d = t * perimeter;
    const top = x1 - x0, right = y1 - y0, bottom = x1 - x0, left = y1 - y0;
    if (d < top)                        return { x: x0 + d,        y: y0 };
    if (d < top + right)                return { x: x1,            y: y0 + (d - top) };
    if (d < top + right + bottom)       return { x: x1 - (d - top - right), y: y1 };
    return { x: x0, y: y1 - (d - top - right - bottom) };
  }

  _render() {
    const { ctx, canvas } = this;
    const cw = canvas.width, ch = canvas.height;
    clearCanvas(ctx);
    drawGrid(ctx);

    const M  = 28;
    const x0 = M, y0 = M + 10, x1 = cw - M, y1 = ch - M - 10;
    const midX = (x0 + x1) / 2;

    /* Fios externos */
    ctx.save();
    ctx.strokeStyle = EM_COLOR + 'aa';
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';

    if (this.modo === 'serie') {
      /* Circuito retangular simples */
      ctx.beginPath();
      ctx.moveTo(x0, y0); ctx.lineTo(x1, y0);
      ctx.lineTo(x1, y1); ctx.lineTo(x0, y1); ctx.lineTo(x0, y0);
      ctx.stroke();

      /* R1 no lado superior esquerdo */
      this._drawResistor(ctx, x0 + (midX - x0) * 0.2, y0, x0 + (midX - x0) * 0.8, y0, this.R1, 'R₁');
      /* R2 no lado superior direito */
      this._drawResistor(ctx, midX + (x1 - midX) * 0.2, y0, midX + (x1 - midX) * 0.8, y0, this.R2, 'R₂');

    } else {
      /* Paralelo — ramos superior e inferior */
      const ymid = (y0 + y1) / 2;
      const xR0  = x0 + 60, xR1 = x1 - 60;
      /* Ramos externos */
      ctx.beginPath();
      ctx.moveTo(x0, ymid); ctx.lineTo(xR0, ymid);
      ctx.moveTo(xR1, ymid); ctx.lineTo(x1, ymid);
      ctx.moveTo(x1, ymid); ctx.lineTo(x1, y0); ctx.lineTo(x0, y0); ctx.lineTo(x0, ymid);
      ctx.moveTo(x1, ymid); ctx.lineTo(x1, y1); ctx.lineTo(x0, y1); ctx.lineTo(x0, ymid);
      /* Ramos R1 e R2 */
      ctx.moveTo(xR0, y0 + 8); ctx.lineTo(xR0, ymid - 20);
      ctx.moveTo(xR0, ymid + 20); ctx.lineTo(xR0, y1 - 8);
      ctx.moveTo(xR1, y0 + 8); ctx.lineTo(xR1, ymid - 20);
      ctx.moveTo(xR1, ymid + 20); ctx.lineTo(xR1, y1 - 8);
      ctx.moveTo(xR0, y0 + 8); ctx.lineTo(xR1, y0 + 8);
      ctx.moveTo(xR0, y1 - 8); ctx.lineTo(xR1, y1 - 8);
      ctx.stroke();

      this._drawResistor(ctx, xR0 + 10, y0 + 8, xR1 - 10, y0 + 8, this.R1, 'R₁');
      this._drawResistor(ctx, xR0 + 10, y1 - 8, xR1 - 10, y1 - 8, this.R2, 'R₂');
    }
    ctx.restore();

    /* Bateria no lado esquerdo */
    this._drawBattery(ctx, x0, (y0 + y1) / 2, this.V);

    /* Elétrons */
    for (const e of this._electrons) {
      const { x, y } = this._electronPos(e.t, cw, ch);
      ctx.beginPath();
      ctx.arc(x, y, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = EM_COLOR;
      ctx.fill();
    }

    /* Readouts */
    drawReadout(ctx, 'V',  this.V.toFixed(1),           'V',  cw - 150, 12);
    drawReadout(ctx, 'R',  this._Rtotal.toFixed(2),      'Ω',  cw - 150, 36);
    drawReadout(ctx, 'I',  this._I.toFixed(3),           'A',  cw - 150, 60);
    if (this.modo === 'paralelo') {
      drawReadout(ctx, 'I₁', this._I1.toFixed(3), 'A', cw - 150, 84);
      drawReadout(ctx, 'I₂', this._I2.toFixed(3), 'A', cw - 150, 108);
    }
    drawReadout(ctx, 'P',  this._P.toFixed(2),           'W',  12, 12);
  }

  _drawResistor(ctx, x0, y0, x1, y1, R, label) {
    /* Símbolo de resistor como zigue-zague */
    ctx.save();
    ctx.strokeStyle = COLORS.amber;
    ctx.lineWidth = 2;
    const n = 6, dx = (x1 - x0) / (n + 2), h = 8;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x0 + dx, y0);
    for (let i = 0; i < n; i++) {
      ctx.lineTo(x0 + dx + i * dx + dx / 2, y0 + (i % 2 === 0 ? -h : h));
      ctx.lineTo(x0 + dx + (i + 1) * dx, y0);
    }
    ctx.lineTo(x1, y1);
    ctx.stroke();

    /* Label */
    const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
    drawLabel(ctx, `${label} = ${R}Ω`, mx, my - 14, COLORS.amber, 'center');
    ctx.restore();
  }

  _drawBattery(ctx, x, y, V) {
    ctx.save();
    ctx.strokeStyle = COLORS.textSecondary;
    ctx.lineWidth = 2;
    /* Símbolo de bateria vertical */
    const half = 12;
    ctx.beginPath();
    ctx.moveTo(x - half, y - 6); ctx.lineTo(x + half, y - 6);
    ctx.moveTo(x - half * 0.6, y + 6); ctx.lineTo(x + half * 0.6, y + 6);
    ctx.stroke();
    drawLabel(ctx, `${V} V`, x, y + 24, COLORS.textSecondary, 'center');
    drawLabel(ctx, '+', x, y - 20, POS_COLOR, 'center');
    drawLabel(ctx, '−', x, y + 36, NEG_COLOR, 'center');
    ctx.restore();
  }
}

/* ══════════════════════════════════════════════════════════════════════════ *
 *  4. CampoMagneticoSimulation — Campo magnético: fio longo e solenoide
 *     Fio: B = μ₀·I / (2π·r)  — campo circular ao redor do fio
 *     Solenoide: B = μ₀·n·I   — campo uniforme no interior
 * ══════════════════════════════════════════════════════════════════════════ */

class CampoMagneticoSimulation extends SimBase {
  constructor(canvas) {
    super(canvas);
    this.I    = 5;      /* A */
    this.modo = 'fio';  /* 'fio' | 'solenoide' */
    this.n    = 500;    /* espiras/m — para solenoide */
    this._animT = 0;
  }

  _onReset() {
    this.I    = this.params.I    ?? 5;
    this.modo = this.params.modo ?? 'fio';
    this.n    = this.params.n    ?? 500;
  }

  _onParamChange(key, value) {
    if (key === 'I')    this.I    = value;
    if (key === 'modo') this.modo = value;
    if (key === 'n')    this.n    = value;
  }

  _update(dt) {
    this._animT += dt;
    this.time   += dt;
  }

  _render() {
    if (this.modo === 'fio') this._renderFio();
    else                     this._renderSolenoide();
  }

  _renderFio() {
    const { ctx, canvas } = this;
    const cw = canvas.width, ch = canvas.height;
    clearCanvas(ctx);
    drawGrid(ctx);

    const cx = cw / 2, cy = ch / 2;
    const maxR = Math.min(cw, ch) * 0.45;

    /* Círculos de campo magnético — animados (rotação lenta de pontilhado) */
    const nRings = 5;
    for (let i = 1; i <= nRings; i++) {
      const r = (i / nRings) * maxR;
      /* B = μ₀I/(2πr) */
      const B = (MU_0 * this.I) / (2 * Math.PI * r / 120); /* /120 = px→m */
      const alpha = Math.min(0.8, 0.15 + 0.6 / i);

      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(192,96,192,${alpha})`;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([8, 4]);
      ctx.lineDashOffset = -this._animT * 30 * (this.I / 5);
      ctx.stroke();
      ctx.setLineDash([]);

      /* Seta de direção (regra da mão direita — corrente para fora da tela) */
      const angle = Math.PI / 4 + this._animT * 0.3 / i;
      const ax = cx + r * Math.cos(angle);
      const ay = cy + r * Math.sin(angle);
      const tangX = -Math.sin(angle) * 12;
      const tangY =  Math.cos(angle) * 12;
      drawArrow(ctx, ax, ay, tangX, tangY, MAG_COLOR, '', 1.5);

      /* Label B */
      if (i <= 3) {
        drawLabel(ctx,
          `B = ${(B * 1e5).toFixed(1)} μT`,
          cx + r * 0.72, cy - r * 0.72,
          MAG_COLOR + 'bb', 'center'
        );
      }
      ctx.restore();
    }

    /* Fio (círculo com ponto = corrente saindo) */
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, 10, 0, Math.PI * 2);
    ctx.fillStyle = EM_COLOR + '33';
    ctx.fill();
    ctx.strokeStyle = EM_COLOR; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = EM_COLOR;
    ctx.beginPath(); ctx.arc(cx, cy, 3, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    drawLabel(ctx, 'I (saindo)', cx + 16, cy + 4, EM_COLOR, 'left');

    const B1 = (MU_0 * this.I) / (2 * Math.PI * 0.01);
    drawReadout(ctx, 'I',  this.I.toFixed(1),           'A',   12, 12);
    drawReadout(ctx, 'B₁cm', (B1 * 1e6).toFixed(1),    'μT',  12, 36);
    drawLabel(ctx, 'B = μ₀·I / (2π·r)', cw - 8, ch - 10, COLORS.textMuted, 'right');
  }

  _renderSolenoide() {
    const { ctx, canvas } = this;
    const cw = canvas.width, ch = canvas.height;
    clearCanvas(ctx);
    drawGrid(ctx);

    const cx = cw / 2, cy = ch / 2;
    const Lx = cw * 0.70, Ly = ch * 0.30;
    const x0 = cx - Lx / 2, y0 = cy - Ly / 2;

    /* Campo interno uniforme — linhas horizontais animadas */
    const B = MU_0 * this.n * this.I;
    const nLines = 5;
    for (let i = 0; i < nLines; i++) {
      const y = y0 + Ly * (i + 1) / (nLines + 1);
      const offset = ((this._animT * 40 * (this.I / 5)) % (Lx / nLines));
      ctx.save();
      ctx.strokeStyle = `rgba(192,96,192,0.55)`;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([12, 6]);
      ctx.lineDashOffset = -offset;
      ctx.beginPath(); ctx.moveTo(x0 + 6, y); ctx.lineTo(x0 + Lx - 6, y);
      ctx.stroke();
      ctx.setLineDash([]);
      /* Seta no meio */
      drawArrow(ctx, cx - 15, y, 30, 0, MAG_COLOR, '', 1.5);
      ctx.restore();
    }

    /* Espiras do solenoide (elipses) */
    const nCoils = 14;
    ctx.save();
    for (let i = 0; i <= nCoils; i++) {
      const x = x0 + (i / nCoils) * Lx;
      ctx.beginPath();
      ctx.ellipse(x, cy, 5, Ly / 2, 0, 0, Math.PI * 2);
      ctx.strokeStyle = COLORS.amber + 'cc';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    /* Caixa do solenoide */
    ctx.strokeStyle = COLORS.amber + '44';
    ctx.lineWidth = 1;
    ctx.strokeRect(x0, y0, Lx, Ly);
    ctx.restore();

    /* Campo externo fraco */
    const nExt = 4;
    for (let i = 0; i < nExt; i++) {
      const y = y0 - 15 - i * 8;
      const alpha = 0.15 - i * 0.03;
      if (alpha <= 0) break;
      ctx.save();
      ctx.strokeStyle = `rgba(192,96,192,${alpha})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x0 + 20, y);
      ctx.bezierCurveTo(x0 - 40, y - 20, x0 + Lx + 40, y - 20, x0 + Lx - 20, y);
      ctx.stroke();
      ctx.restore();
    }

    /* Readouts */
    drawReadout(ctx, 'I',  this.I.toFixed(1),            'A',       12, 12);
    drawReadout(ctx, 'n',  this.n.toFixed(0),            'esp/m',   12, 36);
    drawReadout(ctx, 'B',  (B * 1e3).toFixed(2),         'mT',      12, 60);
    drawLabel(ctx, 'B = μ₀·n·I', cw - 8, ch - 10, COLORS.textMuted, 'right');
  }
}

/* ══════════════════════════════════════════════════════════════════════════ *
 *  5. ForcaLorentzSimulation — Força de Lorentz
 *     F = q·(E + v × B)
 *     Uma partícula carregada entra num campo magnético uniforme e descreve
 *     movimento circular. Raio: r = m·v / (|q|·B)
 * ══════════════════════════════════════════════════════════════════════════ */

class ForcaLorentzSimulation extends SimBase {
  constructor(canvas) {
    super(canvas);
    this.q  = E_CHARGE;   /* C — carga do elétron */
    this.m  = 9.109e-31;  /* kg — massa do elétron */
    this.v0 = 5e6;        /* m/s */
    this.B  = 0.10;       /* T */
    /* Estado da partícula */
    this._x  = 0; this._y = 0;
    this._vx = 0; this._vy = 0;
    this._trail = [];
    this._radius = 0;
    this._period = 0;
  }

  _onReset() {
    this.v0 = this.params.v0 ?? 5e6;
    this.B  = this.params.B  ?? 0.10;
    this._initParticle();
  }

  _onParamChange(key, value) {
    if (key === 'v0') this.v0 = value;
    if (key === 'B')  this.B  = value;
    this._initParticle();
  }

  _initParticle() {
    const cw = this.canvas.width, ch = this.canvas.height;
    this._x  = cw * 0.15;
    this._y  = ch * 0.5;
    this._vx = this.v0;
    this._vy = 0;
    this._trail = [{ x: this._x, y: this._y }];

    /* Raio de ciclotron r = m·v / (|q|·B) */
    this._radius = (this.m * this.v0) / (this.q * this.B);
    /* Período T = 2π·m / (|q|·B) */
    this._period = (2 * Math.PI * this.m) / (this.q * this.B);
  }

  _update(dt) {
    /* Escala: 1m = 200/radius px → partícula cabe sempre */
    const cw = this.canvas.width, ch = this.canvas.height;
    const scale = Math.min(cw, ch) * 0.35 / this._radius; /* px/m */
    const dtSim = dt * 1e-9; /* comprimir tempo para visualização */

    /* F = q·v × B — B perpendicular à tela (ẑ) */
    /* ax = q·vy·B / m,   ay = -q·vx·B / m */
    const ax =  (this.q * this._vy * this.B) / this.m;
    const ay = -(this.q * this._vx * this.B) / this.m;

    /* Velocity Verlet */
    const vxh = this._vx + ax * dtSim / 2;
    const vyh = this._vy + ay * dtSim / 2;
    /* Posição em metros → converter para px */
    const dxM = vxh * dtSim;
    const dyM = vyh * dtSim;
    this._x += dxM * scale;
    this._y += dyM * scale;

    const ax2 =  (this.q * vyh * this.B) / this.m;
    const ay2 = -(this.q * vxh * this.B) / this.m;
    this._vx = vxh + ax2 * dtSim / 2;
    this._vy = vyh + ay2 * dtSim / 2;

    this._trail.push({ x: this._x, y: this._y });
    if (this._trail.length > 400) this._trail.shift();

    /* Reiniciar quando sair do canvas */
    if (this._x < -50 || this._x > cw + 50 || this._y < -50 || this._y > ch + 50) {
      this._initParticle();
    }
    this.time += dt;
  }

  _render() {
    const { ctx, canvas } = this;
    const cw = canvas.width, ch = canvas.height;
    clearCanvas(ctx);
    drawGrid(ctx);

    /* Região do campo B (fundo) */
    ctx.save();
    ctx.fillStyle = MAG_DIM;
    ctx.fillRect(0, 0, cw, ch);

    /* Símbolos × × × (campo entrando na tela) */
    for (let xi = 40; xi < cw; xi += 55) {
      for (let yi = 30; yi < ch; yi += 45) {
        ctx.fillStyle = MAG_COLOR + '40';
        ctx.font = '14px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('×', xi, yi);
      }
    }
    ctx.restore();

    /* Trilha */
    if (this._trail.length > 1) {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(this._trail[0].x, this._trail[0].y);
      for (let i = 1; i < this._trail.length; i++) ctx.lineTo(this._trail[i].x, this._trail[i].y);
      ctx.strokeStyle = EM_COLOR + '80';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
    }

    /* Partícula */
    ctx.save();
    ctx.beginPath();
    ctx.arc(this._x, this._y, 6, 0, Math.PI * 2);
    ctx.fillStyle = EM_COLOR;
    ctx.fill();
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();

    /* Vetor velocidade */
    const vScale = 30 / this.v0;
    drawArrow(ctx, this._x, this._y, this._vx * vScale, this._vy * vScale, COLORS.velocity, 'v', 2);

    /* Readouts */
    drawReadout(ctx, 'B',  this.B.toFixed(2),               'T',   12, 12);
    drawReadout(ctx, 'v',  (this.v0 / 1e6).toFixed(2),      'Mm/s',12, 36);
    drawReadout(ctx, 'r',  (this._radius * 100).toFixed(2),  'cm',  12, 60);
    drawReadout(ctx, 'T',  (this._period * 1e9).toFixed(2),  'ns',  12, 84);
    drawLabel(ctx, 'r = m·v / (|q|·B)', cw - 8, ch - 10, COLORS.textMuted, 'right');
    drawLabel(ctx, 'B entrando (×)', cw - 8, 16, MAG_COLOR, 'right');
  }
}

/* ══════════════════════════════════════════════════════════════════════════ *
 *  6. InducaoSimulation — Lei de Faraday e Lei de Lenz
 *     ε = −dΦ/dt  onde  Φ = B·A·cos(θ)
 *     Uma espira gira num campo B uniforme. A fem induzida varia como seno.
 *     Demonstra o princípio do gerador elétrico.
 * ══════════════════════════════════════════════════════════════════════════ */

class InducaoSimulation extends SimBase {
  constructor(canvas, chartCanvas) {
    super(canvas);
    this.B     = 0.5;   /* T */
    this.A     = 0.01;  /* m² */
    this.omega = Math.PI; /* rad/s — 0.5 Hz */
    this.theta = 0;     /* rad — ângulo da espira */
    this._chart = chartCanvas ? new ChartEngine(chartCanvas) : null;
    this._history = [];
  }

  _onReset() {
    this.B     = this.params.B     ?? 0.5;
    this.A     = this.params.A     ?? 0.01;
    this.omega = this.params.omega ?? Math.PI;
    this.theta = 0;
    this._history = [];
    if (this._chart) this._chart.clear();
  }

  _onParamChange(key, value) {
    if (key === 'B')     this.B     = value;
    if (key === 'A')     this.A     = value;
    if (key === 'omega') this.omega = value;
    this.theta = 0;
    this._history = [];
  }

  _update(dt) {
    this.theta = (this.theta + this.omega * dt) % (2 * Math.PI);
    const Phi = this.B * this.A * Math.cos(this.theta);
    const emf = this.B * this.A * this.omega * Math.sin(this.theta);
    this._Phi = Phi;
    this._emf = emf;

    this._history.push({ t: this.time, emf });
    if (this._history.length > 200) this._history.shift();

    if (this._chart) {
      this._chart.addPoint(this.time, emf);
    }
    this.time += dt;
  }

  _render() {
    const { ctx, canvas } = this;
    const cw = canvas.width, ch = canvas.height;
    clearCanvas(ctx);
    drawGrid(ctx);

    const cx = cw * 0.38, cy = ch / 2;

    /* Campo B — flechas horizontais */
    ctx.save();
    ctx.strokeStyle = MAG_COLOR + '40';
    ctx.lineWidth = 1;
    for (let y = 30; y < ch; y += 35) {
      drawArrow(ctx, 20, y, 60, 0, MAG_COLOR + '55', '', 1);
    }
    ctx.restore();

    /* Espira — vista como elipse proporcional ao cosseno do ângulo */
    const W = 80, H = 55;
    const projection = Math.cos(this.theta); /* −1 a 1 */
    const ellipseW   = Math.abs(projection) * W;

    ctx.save();
    /* Sombra da espira (fluxo) */
    if (ellipseW > 2) {
      ctx.beginPath();
      ctx.ellipse(cx, cy, ellipseW, H, 0, 0, Math.PI * 2);
      const alpha = Math.abs(projection) * 0.18;
      ctx.fillStyle = `rgba(200,146,10,${alpha})`;
      ctx.fill();
    }
    /* Borda da espira */
    ctx.beginPath();
    ctx.rect(cx - W, cy - H, W * 2, H * 2);
    ctx.strokeStyle = COLORS.amber;
    ctx.lineWidth = 2.5;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(Math.abs(projection), 1);
    ctx.beginPath();
    ctx.rect(-W, -H, W * 2, H * 2);
    ctx.strokeStyle = COLORS.amber;
    ctx.stroke();
    ctx.restore();
    ctx.restore();

    /* Normal da espira */
    const nx = Math.sin(this.theta) * 50;
    const ny = -Math.cos(this.theta) * 30;
    drawArrow(ctx, cx, cy, nx, ny, COLORS.textSecondary, 'n̂', 1.5);

    /* Linha de ângulo */
    drawLabel(ctx, `θ = ${((this.theta * 180 / Math.PI) % 360).toFixed(0)}°`, cx, cy + H + 22, COLORS.textMuted, 'center');

    /* Gráfico de ε(t) no painel direito */
    const gx = cw * 0.60, gy = cy - 60, gw = cw * 0.37, gh = 120;
    this._drawEMFGraph(ctx, gx, gy, gw, gh);

    /* Readouts */
    const emfMax = this.B * this.A * this.omega;
    drawReadout(ctx, 'B',    this.B.toFixed(2),             'T',        12, 12);
    drawReadout(ctx, 'A',    (this.A * 1e4).toFixed(1),     'cm²',      12, 36);
    drawReadout(ctx, 'ω',    this.omega.toFixed(2),          'rad/s',    12, 60);
    drawReadout(ctx, 'Φ',    (this._Phi * 1000).toFixed(2),  'mWb',     12, 84);
    drawReadout(ctx, 'ε',    (this._emf * 1000).toFixed(2),  'mV',      12, 108);
    drawReadout(ctx, 'ε_max',(emfMax * 1000).toFixed(2),    'mV',      12, 132);
    drawLabel(ctx, 'ε = −dΦ/dt = B·A·ω·sin(θ)', cw - 8, ch - 10, COLORS.textMuted, 'right');
  }

  _drawEMFGraph(ctx, gx, gy, gw, gh) {
    if (!this._history.length) return;
    const emfMax = this.B * this.A * this.omega || 1;

    ctx.save();
    /* Fundo */
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(gx, gy, gw, gh);
    ctx.strokeStyle = COLORS.textMuted + '40';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(gx, gy, gw, gh);

    /* Linha zero */
    const midY = gy + gh / 2;
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = COLORS.textMuted + '60';
    ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(gx, midY); ctx.lineTo(gx + gw, midY); ctx.stroke();
    ctx.setLineDash([]);

    /* Curva ε(t) */
    const n = this._history.length;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const x = gx + (i / (n - 1)) * gw;
      const y = midY - (this._history[i].emf / emfMax) * (gh / 2) * 0.85;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = EM_COLOR;
    ctx.lineWidth = 1.8;
    ctx.stroke();

    /* Label */
    drawLabel(ctx, 'ε(t)', gx + 5, gy + 12, EM_COLOR, 'left');
    ctx.restore();
  }
}

/* ── Factory ─────────────────────────────────────────────────────────────── */

export function createEletromagnetismoSimulation(simId, canvas, chartCanvas) {
  switch (simId) {
    case 'coulomb':         return new CoulombSimulation(canvas);
    case 'campo-eletrico':  return new CampoEletricoSimulation(canvas);
    case 'circuito':        return new CircuitoSimulation(canvas);
    case 'campo-magnetico': return new CampoMagneticoSimulation(canvas);
    case 'forca-lorentz':   return new ForcaLorentzSimulation(canvas);
    case 'inducao':         return new InducaoSimulation(canvas, chartCanvas);
    default:
      throw new Error(`[eletromagnetismo] simulação desconhecida: "${simId}"`);
  }
}
