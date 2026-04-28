/**
 * modules/optica/optica.js
 *
 * Simulações:
 *   reflexao  — Lei da reflexão: θᵢ = θᵣ, espelhos planos
 *   refracao  — Lei de Snell: n₁sinθ₁ = n₂sinθ₂, reflexão total interna
 *   lentes    — Lentes convergente/divergente: 1/f = 1/do + 1/di
 *   dispersao — Prisma e dispersão: índice n depende do λ (cor)
 */

import {
  clearCanvas, drawGrid, drawArrow, drawLabel, drawReadout, COLORS
} from '../../engine/renderer.js';
import { ChartEngine } from '../../engine/chart-engine.js';

/* ── Cores ópticas ────────────────────────────────────────────────────────── */
const LIGHT_COLOR   = '#f0e080';          /* feixe de luz — amarelo              */
const LIGHT_DIM     = 'rgba(240,224,128,0.18)';
const NORMAL_COLOR  = 'rgba(160,160,180,0.55)'; /* linha normal — cinza          */
const OPT_AMBER     = '#d09a18';

/* Comprimentos de onda visíveis → RGB aproximado */
const SPECTRUM = [
  { nm: 380, r: 100, g:   0, b: 160 }, /* violeta */
  { nm: 430, r:  60, g:   0, b: 220 },
  { nm: 470, r:   0, g:  80, b: 255 }, /* azul */
  { nm: 510, r:   0, g: 200, b: 100 }, /* verde */
  { nm: 550, r: 120, g: 230, b:   0 }, /* verde-amarelo */
  { nm: 590, r: 250, g: 180, b:   0 }, /* amarelo */
  { nm: 620, r: 255, g:  80, b:   0 }, /* laranja */
  { nm: 660, r: 220, g:   0, b:   0 }, /* vermelho */
  { nm: 700, r: 160, g:   0, b:   0 },
];

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

/* ── Helpers ─────────────────────────────────────────────────────────────── */

function drawRay(ctx, x1, y1, x2, y2, color = LIGHT_COLOR, width = 1.8, dashed = false) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth   = width;
  if (dashed) ctx.setLineDash([5, 4]);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.setLineDash([]);
  /* Seta no meio */
  if (!dashed) {
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
    const dx = x2 - x1, dy = y2 - y1;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len, uy = dy / len;
    const hs = 7;
    ctx.beginPath();
    ctx.moveTo(mx - ux * hs - uy * hs * 0.5, my - uy * hs + ux * hs * 0.5);
    ctx.lineTo(mx, my);
    ctx.lineTo(mx - ux * hs + uy * hs * 0.5, my - uy * hs - ux * hs * 0.5);
    ctx.stroke();
  }
  ctx.restore();
}

function drawNormal(ctx, x, y, dx, dy, len = 60) {
  ctx.save();
  ctx.strokeStyle = NORMAL_COLOR;
  ctx.lineWidth   = 1;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(x - dx * len, y - dy * len);
  ctx.lineTo(x + dx * len, y + dy * len);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

/* ══════════════════════════════════════════════════════════════════════════ *
 *  1. ReflexaoSimulation — Lei da reflexão
 *     θᵢ = θᵣ  (ângulos medidos em relação à normal)
 *     Espelho plano: imagem virtual, direita, mesmo tamanho
 * ══════════════════════════════════════════════════════════════════════════ */

class ReflexaoSimulation extends SimBase {
  constructor(canvas) {
    super(canvas);
    this.theta = 40; /* graus — ângulo de incidência */
  }

  _onReset() { this.theta = this.params.theta ?? 40; }
  _onParamChange(k, v) { if (k === 'theta') this.theta = v; }
  _update(dt) { this.time += dt; }

  _render() {
    const { ctx, canvas } = this;
    const cw = canvas.width, ch = canvas.height;
    clearCanvas(ctx);

    const cx = cw / 2, cy = ch * 0.62;
    const rayLen = Math.min(cw, ch) * 0.44;

    /* Espelho horizontal */
    ctx.save();
    ctx.strokeStyle = COLORS.amber + 'cc';
    ctx.lineWidth   = 3;
    ctx.beginPath();
    ctx.moveTo(cx - 160, cy);
    ctx.lineTo(cx + 160, cy);
    ctx.stroke();
    /* Hachura */
    ctx.strokeStyle = COLORS.amber + '33';
    ctx.lineWidth   = 1;
    for (let x = cx - 155; x < cx + 160; x += 14) {
      ctx.beginPath();
      ctx.moveTo(x, cy);
      ctx.lineTo(x - 10, cy + 10);
      ctx.stroke();
    }
    ctx.restore();

    /* Normal */
    drawNormal(ctx, cx, cy, 0, 1, 80);

    /* Raio incidente */
    const rad = this.theta * Math.PI / 180;
    const ix  = cx - rayLen * Math.sin(rad);
    const iy  = cy - rayLen * Math.cos(rad);
    drawRay(ctx, ix, iy, cx, cy, LIGHT_COLOR);

    /* Raio refletido */
    const rx = cx + rayLen * Math.sin(rad);
    const ry = cy - rayLen * Math.cos(rad);
    drawRay(ctx, cx, cy, rx, ry, LIGHT_COLOR);

    /* Raio virtual (tracejado, atrás do espelho) */
    drawRay(ctx, cx, cy, cx + rayLen * Math.sin(rad), cy + rayLen * Math.cos(rad), LIGHT_COLOR + '55', 1.2, true);

    /* Ângulos */
    this._drawAngle(ctx, cx, cy, Math.PI + rad, Math.PI * 1.5, '#4ab0d8', `θᵢ=${this.theta}°`);
    this._drawAngle(ctx, cx, cy, Math.PI * 1.5, Math.PI * 2 - rad, '#c060c0', `θᵣ=${this.theta}°`);

    /* Readouts */
    drawReadout(ctx, 'θᵢ', this.theta.toFixed(0), '°', 12, 12);
    drawReadout(ctx, 'θᵣ', this.theta.toFixed(0), '°', 12, 36);
    drawLabel(ctx, 'θᵢ = θᵣ', cw - 8, ch - 10, COLORS.textMuted, 'right');
    drawLabel(ctx, 'Normal', cx + 8, cy - 75, NORMAL_COLOR, 'left');
  }

  _drawAngle(ctx, cx, cy, a1, a2, color, label) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth   = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, 36, a1, a2);
    ctx.stroke();
    const mid = (a1 + a2) / 2;
    drawLabel(ctx, label, cx + 52 * Math.cos(mid), cy + 52 * Math.sin(mid), color, 'center');
    ctx.restore();
  }
}

/* ══════════════════════════════════════════════════════════════════════════ *
 *  2. RefracaoSimulation — Lei de Snell-Descartes
 *     n₁·sin(θ₁) = n₂·sin(θ₂)
 *     Reflexão total interna quando θ₁ > θ_c = arcsin(n₂/n₁)
 * ══════════════════════════════════════════════════════════════════════════ */

class RefracaoSimulation extends SimBase {
  constructor(canvas) {
    super(canvas);
    this.n1    = 1.00; /* ar */
    this.n2    = 1.50; /* vidro */
    this.theta1 = 35;  /* graus */
    this._theta2 = 0;
    this._tir    = false; /* reflexão total interna */
  }

  _onReset() {
    this.n1     = this.params.n1     ?? 1.00;
    this.n2     = this.params.n2     ?? 1.50;
    this.theta1 = this.params.theta1 ?? 35;
    this._calc();
  }

  _onParamChange(k, v) {
    if (k === 'n1')     this.n1     = v;
    if (k === 'n2')     this.n2     = v;
    if (k === 'theta1') this.theta1 = v;
    this._calc();
  }

  _calc() {
    const sin2 = (this.n1 / this.n2) * Math.sin(this.theta1 * Math.PI / 180);
    this._tir    = Math.abs(sin2) >= 1;
    this._theta2 = this._tir ? null : Math.asin(sin2) * 180 / Math.PI;
    /* Ângulo crítico: só quando n1 > n2 */
    this._thetaC = this.n1 > this.n2
      ? Math.asin(this.n2 / this.n1) * 180 / Math.PI
      : null;
  }

  _update(dt) { this.time += dt; }

  _render() {
    const { ctx, canvas } = this;
    const cw = canvas.width, ch = canvas.height;
    clearCanvas(ctx);

    const cy     = ch * 0.48;
    const cx     = cw / 2;
    const rayLen = Math.min(cw, ch) * 0.40;

    /* Meios */
    ctx.save();
    ctx.fillStyle = 'rgba(74,176,216,0.06)';
    ctx.fillRect(0, cy, cw, ch - cy); /* meio 2 */
    ctx.fillStyle = 'rgba(255,255,255,0.03)';
    ctx.fillRect(0, 0, cw, cy);       /* meio 1 */
    ctx.restore();

    /* Interface */
    ctx.save();
    ctx.strokeStyle = COLORS.amber + '60';
    ctx.lineWidth   = 1.5;
    ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(cw, cy); ctx.stroke();
    ctx.restore();

    /* Labels dos meios */
    drawLabel(ctx, `n₁ = ${this.n1.toFixed(2)} (${this._medioNome(this.n1)})`, cx - 140, cy - 16, COLORS.textMuted, 'left');
    drawLabel(ctx, `n₂ = ${this.n2.toFixed(2)} (${this._medioNome(this.n2)})`, cx - 140, cy + 18, COLORS.textMuted, 'left');

    /* Normal */
    drawNormal(ctx, cx, cy, 0, 1, 80);

    /* Raio incidente */
    const r1 = this.theta1 * Math.PI / 180;
    const ix  = cx - rayLen * Math.sin(r1);
    const iy  = cy - rayLen * Math.cos(r1);
    drawRay(ctx, ix, iy, cx, cy, LIGHT_COLOR);

    if (this._tir) {
      /* Reflexão total interna — raio refletido */
      const rx = cx + rayLen * Math.sin(r1);
      const ry = cy - rayLen * Math.cos(r1);
      drawRay(ctx, cx, cy, rx, ry, '#ff6040');
      drawLabel(ctx, 'REFLEXÃO TOTAL INTERNA', cx, cy - 90, '#ff6040', 'center');
    } else {
      /* Raio refratado */
      const r2  = this._theta2 * Math.PI / 180;
      const tx  = cx + rayLen * Math.sin(r2);
      const ty  = cy + rayLen * Math.cos(r2);
      drawRay(ctx, cx, cy, tx, ty, LIGHT_COLOR + 'cc');

      /* Raio refletido parcial (mais tênue) */
      const rx = cx + rayLen * Math.sin(r1) * 0.35;
      const ry = cy - rayLen * Math.cos(r1) * 0.35;
      drawRay(ctx, cx, cy, rx, ry, LIGHT_COLOR + '44', 1, false);
    }

    /* Ângulo crítico */
    if (this._thetaC !== null) {
      drawReadout(ctx, 'θ_c', this._thetaC.toFixed(1), '°', 12, 84);
    }

    /* Readouts */
    drawReadout(ctx, 'n₁', this.n1.toFixed(2), '', 12, 12);
    drawReadout(ctx, 'n₂', this.n2.toFixed(2), '', 12, 36);
    drawReadout(ctx, 'θ₁', this.theta1.toFixed(1), '°', 12, 60);
    if (!this._tir) drawReadout(ctx, 'θ₂', this._theta2.toFixed(1), '°', cw - 150, 12);
    drawLabel(ctx, 'n₁·sin θ₁ = n₂·sin θ₂', cw - 8, ch - 10, COLORS.textMuted, 'right');
  }

  _medioNome(n) {
    if (n <= 1.01)  return 'vácuo/ar';
    if (n <= 1.35)  return 'água';
    if (n <= 1.55)  return 'vidro';
    if (n <= 1.80)  return 'safira';
    if (n <= 2.50)  return 'diamante';
    return 'desconhecido';
  }
}

/* ══════════════════════════════════════════════════════════════════════════ *
 *  3. LentesSimulation — Lentes convergente e divergente
 *     1/f = 1/do + 1/di   M = −di/do
 *     Raios principais: paralelo, central, foco
 * ══════════════════════════════════════════════════════════════════════════ */

class LentesSimulation extends SimBase {
  constructor(canvas) {
    super(canvas);
    this.f    = 80;   /* px — distância focal (positivo=convergente) */
    this.do_  = 200;  /* px — distância objeto */
    this.hObj = 50;   /* px — altura do objeto */
  }

  _onReset() {
    this.f    = this.params.f   ?? 80;
    this.do_  = this.params.do_ ?? 200;
    this.hObj = this.params.hObj ?? 50;
    this._calc();
  }

  _onParamChange(k, v) {
    if (k === 'f')    this.f    = v;
    if (k === 'do_')  this.do_  = v;
    if (k === 'hObj') this.hObj = v;
    this._calc();
  }

  _calc() {
    /* 1/f = 1/do + 1/di → di = f·do/(do − f) */
    if (Math.abs(this.do_ - this.f) < 1) { this.di = Infinity; this.M = Infinity; return; }
    this.di = (this.f * this.do_) / (this.do_ - this.f);
    this.M  = -this.di / this.do_;
  }

  _update(dt) { this.time += dt; }

  _render() {
    const { ctx, canvas } = this;
    const cw = canvas.width, ch = canvas.height;
    clearCanvas(ctx);
    drawGrid(ctx);

    const cx = cw / 2, cy = ch / 2;
    const lh  = ch * 0.42; /* meia-altura da lente em px */
    const conv = this.f > 0;

    /* Eixo óptico */
    ctx.save();
    ctx.strokeStyle = COLORS.textMuted + '40';
    ctx.lineWidth   = 1;
    ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(cw, cy); ctx.stroke();
    ctx.restore();

    /* Lente */
    ctx.save();
    ctx.strokeStyle = COLORS.amber;
    ctx.lineWidth   = 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy - lh);
    ctx.lineTo(cx, cy + lh);
    ctx.stroke();
    /* Setas das extremidades */
    const arrow = conv ? 1 : -1;
    ctx.beginPath();
    ctx.moveTo(cx - 8, cy - lh + 12 * arrow); ctx.lineTo(cx, cy - lh); ctx.lineTo(cx + 8, cy - lh + 12 * arrow);
    ctx.moveTo(cx - 8, cy + lh - 12 * arrow); ctx.lineTo(cx, cy + lh); ctx.lineTo(cx + 8, cy + lh - 12 * arrow);
    ctx.stroke();
    ctx.restore();

    /* Focos */
    const fx1 = cx - this.f, fx2 = cx + this.f;
    ctx.save();
    ctx.fillStyle = COLORS.amber + 'aa';
    ctx.beginPath(); ctx.arc(fx1, cy, 4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(fx2, cy, 4, 0, Math.PI * 2); ctx.fill();
    drawLabel(ctx, 'F', fx1 - 8, cy - 10, COLORS.amber, 'right');
    drawLabel(ctx, 'F\'', fx2 + 6, cy - 10, COLORS.amber, 'left');
    ctx.restore();

    /* Objeto */
    const ox  = cx - this.do_;
    const oty = cy - this.hObj;
    ctx.save();
    ctx.strokeStyle = '#4ab0d8';
    ctx.lineWidth   = 2;
    ctx.beginPath(); ctx.moveTo(ox, cy); ctx.lineTo(ox, oty); ctx.stroke();
    /* Ponta */
    ctx.beginPath();
    ctx.moveTo(ox - 6, oty + 10); ctx.lineTo(ox, oty); ctx.lineTo(ox + 6, oty + 10);
    ctx.stroke();
    drawLabel(ctx, 'O', ox - 8, oty - 8, '#4ab0d8', 'right');
    ctx.restore();

    /* Raios principais */
    if (isFinite(this.di)) {
      const ix = cx + this.di;
      const iy = cy - this.hObj * this.M;

      /* Raio 1: paralelo ao eixo → passa pelo foco */
      drawRay(ctx, ox, oty, cx, oty, LIGHT_COLOR, 1.5);
      if (conv) {
        drawRay(ctx, cx, oty, ix, iy, LIGHT_COLOR, 1.5);
      } else {
        /* divergente: prolonga para o foco virtual */
        const extX = cx + 200, extY = oty + (oty - cy) * 200 / (fx2 - cx);
        drawRay(ctx, cx, oty, extX, extY, LIGHT_COLOR, 1.5);
        drawRay(ctx, cx, oty, ox - 50, oty, LIGHT_COLOR + '44', 1, true);
      }

      /* Raio 2: pelo centro óptico — não desvia */
      const slope = (oty - cy) / (ox - cx);
      const x2r   = ix, y2r = cy + slope * (ix - cx);
      drawRay(ctx, ox, oty, ix, iy, '#c060c0', 1.5);

      /* Raio 3: pelo foco principal → sai paralelo ao eixo */
      drawRay(ctx, ox, oty, cx, cy - this.hObj * this.do_ / (this.do_ - this.f) * 0, LIGHT_COLOR + '88', 1.2);

      /* Imagem */
      if (this.di > 0 && this.do_ > 0) {
        ctx.save();
        ctx.strokeStyle = '#c060c0';
        ctx.lineWidth   = 2;
        ctx.beginPath(); ctx.moveTo(ix, cy); ctx.lineTo(ix, iy); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(ix - 5, iy + (iy < cy ? 9 : -9)); ctx.lineTo(ix, iy); ctx.lineTo(ix + 5, iy + (iy < cy ? 9 : -9));
        ctx.stroke();
        drawLabel(ctx, 'I', ix + 8, iy - 8, '#c060c0', 'left');
        ctx.restore();
      } else if (this.di < 0) {
        /* Imagem virtual — tracejada no lado do objeto */
        const vx = cx + this.di, vy = cy - this.hObj * this.M;
        ctx.save();
        ctx.strokeStyle = '#c060c0';
        ctx.lineWidth   = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.beginPath(); ctx.moveTo(vx, cy); ctx.lineTo(vx, vy); ctx.stroke();
        ctx.setLineDash([]);
        drawLabel(ctx, 'I (virtual)', vx + 8, vy - 8, '#c060c0', 'left');
        ctx.restore();
      }
    }

    /* Readouts */
    const tipo   = this.f > 0 ? 'Convergente' : 'Divergente';
    const diM    = isFinite(this.di) ? this.di.toFixed(0) : '∞';
    const MStr   = isFinite(this.M)  ? this.M.toFixed(2)  : '∞';
    drawReadout(ctx, 'Tipo', tipo, '', 12, 12);
    drawReadout(ctx, 'f',    Math.abs(this.f).toFixed(0), 'px', 12, 36);
    drawReadout(ctx, 'do',   this.do_.toFixed(0),         'px', 12, 60);
    drawReadout(ctx, 'di',   diM,                          'px', 12, 84);
    drawReadout(ctx, 'M',    MStr,                         '×',  12, 108);
    const imgTipo = isFinite(this.di) ? (this.di > 0 ? 'Real, invertida' : 'Virtual, direita') : '(objeto no foco)';
    drawLabel(ctx, imgTipo, cw - 8, ch - 10, COLORS.textMuted, 'right');
    drawLabel(ctx, '1/f = 1/do + 1/di', cw - 8, ch - 26, COLORS.textMuted, 'right');
  }
}

/* ══════════════════════════════════════════════════════════════════════════ *
 *  4. DispersaoSimulation — Prisma e dispersão da luz
 *     n(λ) varia com o comprimento de onda → cada cor refrata diferente
 *     Equação de Cauchy: n ≈ A + B/λ²
 * ══════════════════════════════════════════════════════════════════════════ */

class DispersaoSimulation extends SimBase {
  constructor(canvas) {
    super(canvas);
    this.angle  = 60;  /* ângulo do prisma em graus */
    this.theta1 = 45;  /* ângulo de incidência */
    this._animT = 0;
  }

  _onReset() {
    this.angle  = this.params.angle  ?? 60;
    this.theta1 = this.params.theta1 ?? 45;
  }

  _onParamChange(k, v) {
    if (k === 'angle')  this.angle  = v;
    if (k === 'theta1') this.theta1 = v;
  }

  /* Índice de Cauchy para vidro borosilicato — n(λ) em nm */
  _nLambda(nm) {
    const A = 1.4580, B = 3.54e3; /* coeficientes em nm² */
    return A + B / (nm * nm);
  }

  _update(dt) { this._animT += dt; this.time += dt; }

  _render() {
    const { ctx, canvas } = this;
    const cw = canvas.width, ch = canvas.height;
    clearCanvas(ctx);

    const cx = cw * 0.38, cy = ch * 0.52;
    const side = Math.min(cw, ch) * 0.32;

    /* Prisma equilátero */
    const A  = this.angle * Math.PI / 180;
    const h  = side * Math.sin(Math.PI / 3);
    const p1 = { x: cx,           y: cy - h * 2 / 3 };
    const p2 = { x: cx - side / 2, y: cy + h / 3 };
    const p3 = { x: cx + side / 2, y: cy + h / 3 };

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.lineTo(p3.x, p3.y); ctx.closePath();
    ctx.fillStyle   = 'rgba(100,160,200,0.12)';
    ctx.fill();
    ctx.strokeStyle = COLORS.amber + 'aa';
    ctx.lineWidth   = 2;
    ctx.stroke();
    ctx.restore();

    /* Face de entrada — normal */
    const faceAngle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
    const normalAngle = faceAngle - Math.PI / 2;
    const entry = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };

    /* Raio branco incidente */
    const r1 = this.theta1 * Math.PI / 180;
    const inX  = entry.x + 140 * Math.cos(normalAngle + r1);
    const inY  = entry.y + 140 * Math.sin(normalAngle + r1);
    drawRay(ctx, inX, inY, entry.x, entry.y, LIGHT_COLOR, 2);

    /* Raios dispersos para cada cor */
    for (const sp of SPECTRUM) {
      const n  = this._nLambda(sp.nm);
      const sin2 = Math.sin(r1) / n;
      if (Math.abs(sin2) > 1) continue;
      const r2   = Math.asin(sin2);

      /* Ângulo de desvio mínimo aproximado */
      const devBase  = (n - 1) * this.angle * Math.PI / 180;
      const exitAngle = normalAngle + Math.PI + r2 + devBase * 0.5;

      const exitX = p3.x - 10;
      const exitY = p3.y - 40 + (sp.nm - 380) / (700 - 380) * 80 - 40;

      const color = `rgb(${sp.r},${sp.g},${sp.b})`;

      /* Raio dentro do prisma (de entry até exit) */
      ctx.save();
      ctx.strokeStyle = color + '80';
      ctx.lineWidth   = 1.2;
      ctx.beginPath(); ctx.moveTo(entry.x, entry.y); ctx.lineTo(exitX, exitY); ctx.stroke();
      ctx.restore();

      /* Raio emergente */
      const extLen = 160;
      const drift  = (sp.nm - 530) / 200; /* centraliza no verde */
      const outDx  = Math.cos(exitAngle + drift * 0.3) * extLen;
      const outDy  = Math.sin(exitAngle + drift * 0.3) * extLen;
      drawRay(ctx, exitX, exitY, exitX + outDx, exitY + outDy, color, 1.8);
    }

    /* Label cores */
    const specLabels = [
      { label: 'Violeta',  x: p3.x + 175, y: p3.y - 90,  c: `rgb(${SPECTRUM[0].r},${SPECTRUM[0].g},${SPECTRUM[0].b})` },
      { label: 'Vermelho', x: p3.x + 175, y: p3.y + 20,   c: `rgb(${SPECTRUM[7].r},${SPECTRUM[7].g},${SPECTRUM[7].b})` },
    ];
    for (const sl of specLabels) drawLabel(ctx, sl.label, sl.x, sl.y, sl.c, 'left');

    /* Readouts */
    const n_med = this._nLambda(550);
    drawReadout(ctx, 'Ângulo prisma', this.angle.toFixed(0),   '°', 12, 12);
    drawReadout(ctx, 'θ incidência', this.theta1.toFixed(0),  '°', 12, 36);
    drawReadout(ctx, 'n (550 nm)',   n_med.toFixed(4),         '',  12, 60);
    drawLabel(ctx, 'n(λ) = A + B/λ²  (Cauchy)', cw - 8, ch - 10, COLORS.textMuted, 'right');
  }
}

/* ── Factory ─────────────────────────────────────────────────────────────── */

export function createOpticaSimulation(simId, canvas, chartCanvas) {
  switch (simId) {
    case 'reflexao':  return new ReflexaoSimulation(canvas);
    case 'refracao':  return new RefracaoSimulation(canvas);
    case 'lentes':    return new LentesSimulation(canvas);
    case 'dispersao': return new DispersaoSimulation(canvas);
    default:
      throw new Error(`[optica] simulação desconhecida: "${simId}"`);
  }
}
