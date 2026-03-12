/**
 * chart-engine.js — Live rolling-window graph renderer
 *
 * Renders up to 2 y-series against a shared x-axis (typically time).
 * Draws directly to a Canvas 2D context, no external libraries.
 *
 * Usage:
 *   const chart = new ChartEngine(canvas, { label: 'x vs t', xUnit: 's', yUnit: 'm' });
 *   chart.addPoint(t, position);
 *   chart.render();  // call each frame
 */

/* Pixels reserved for axis labels */
const MARGIN = { top: 16, right: 16, bottom: 32, left: 50 };
const MAX_POINTS = 300;

class ChartEngine {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {Object} opts
   * @param {string}  opts.label   — chart title
   * @param {string}  opts.xUnit   — x-axis unit label
   * @param {string}  opts.yUnit   — y-axis unit label
   * @param {string}  [opts.color] — line color
   * @param {boolean} [opts.fillArea] — fill under curve
   * @param {number}  [opts.yMin]  — fixed y min (auto if undefined)
   * @param {number}  [opts.yMax]  — fixed y max (auto if undefined)
   */
  constructor(canvas, opts = {}) {
    this.canvas   = canvas;
    this.ctx      = canvas.getContext('2d');
    this.label    = opts.label   ?? '';
    this.xUnit    = opts.xUnit   ?? '';
    this.yUnit    = opts.yUnit   ?? '';
    this.color    = opts.color   ?? '#c8920a';
    this.fillArea = opts.fillArea ?? false;
    this.yMinFixed = opts.yMin;
    this.yMaxFixed = opts.yMax;

    /** @type {{ x: number, y: number }[]} */
    this.points   = [];

    this._animFrame = null;
    this._dirty     = true;
  }

  /**
   * Add a data point.
   * @param {number} x
   * @param {number} y
   */
  addPoint(x, y) {
    this.points.push({ x, y });
    if (this.points.length > MAX_POINTS) {
      this.points.shift();
    }
    this._dirty = true;
  }

  /** Clear all data. */
  clear() {
    this.points = [];
    this._dirty = true;
  }

  /** Force a full render. */
  render() {
    if (!this._dirty) return;
    this._draw();
    this._dirty = false;
  }

  /** Compute axis bounds from current data. */
  _bounds() {
    if (this.points.length === 0) {
      return { xMin: 0, xMax: 10, yMin: -10, yMax: 10 };
    }
    let xMin = Infinity, xMax = -Infinity;
    let yMin = Infinity, yMax = -Infinity;
    for (const p of this.points) {
      if (p.x < xMin) xMin = p.x;
      if (p.x > xMax) xMax = p.x;
      if (p.y < yMin) yMin = p.y;
      if (p.y > yMax) yMax = p.y;
    }
    /* Add padding */
    const xPad = (xMax - xMin) * 0.05 || 1;
    const yPad = (yMax - yMin) * 0.10 || 1;

    return {
      xMin: xMin - xPad,
      xMax: xMax + xPad,
      yMin: this.yMinFixed ?? yMin - yPad,
      yMax: this.yMaxFixed ?? yMax + yPad,
    };
  }

  /** Map data coordinates to canvas pixel coordinates. */
  _toPixel(x, y, bounds, cw, ch) {
    const plotW = cw - MARGIN.left - MARGIN.right;
    const plotH = ch - MARGIN.top  - MARGIN.bottom;
    const px = MARGIN.left + (x - bounds.xMin) / (bounds.xMax - bounds.xMin) * plotW;
    const py = MARGIN.top  + (1 - (y - bounds.yMin) / (bounds.yMax - bounds.yMin)) * plotH;
    return { px, py };
  }

  _draw() {
    const ctx  = this.ctx;
    const cw   = this.canvas.width;
    const ch   = this.canvas.height;

    /* Background */
    ctx.fillStyle = '#161410';
    ctx.fillRect(0, 0, cw, ch);

    const bounds = this._bounds();
    const plotW  = cw - MARGIN.left - MARGIN.right;
    const plotH  = ch - MARGIN.top  - MARGIN.bottom;

    /* Grid */
    ctx.save();
    ctx.strokeStyle = 'rgba(180, 140, 60, 0.09)';
    ctx.lineWidth   = 0.5;
    const xTicks = 5;
    const yTicks = 4;
    for (let i = 0; i <= xTicks; i++) {
      const px = MARGIN.left + (i / xTicks) * plotW;
      ctx.beginPath();
      ctx.moveTo(px, MARGIN.top);
      ctx.lineTo(px, MARGIN.top + plotH);
      ctx.stroke();
    }
    for (let i = 0; i <= yTicks; i++) {
      const py = MARGIN.top + (i / yTicks) * plotH;
      ctx.beginPath();
      ctx.moveTo(MARGIN.left, py);
      ctx.lineTo(MARGIN.left + plotW, py);
      ctx.stroke();
    }
    ctx.restore();

    /* Zero line if in range */
    if (bounds.yMin < 0 && bounds.yMax > 0) {
      const { py } = this._toPixel(0, 0, bounds, cw, ch);
      ctx.save();
      ctx.strokeStyle = 'rgba(200, 146, 10, 0.20)';
      ctx.lineWidth   = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(MARGIN.left, py);
      ctx.lineTo(MARGIN.left + plotW, py);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    /* Axis lines */
    ctx.save();
    ctx.strokeStyle = 'rgba(200, 146, 10, 0.25)';
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.moveTo(MARGIN.left, MARGIN.top);
    ctx.lineTo(MARGIN.left, MARGIN.top + plotH);
    ctx.lineTo(MARGIN.left + plotW, MARGIN.top + plotH);
    ctx.stroke();
    ctx.restore();

    /* Axis labels */
    ctx.save();
    ctx.font      = '9px "Share Tech Mono", monospace';
    ctx.fillStyle = 'rgba(122, 112, 96, 0.90)';

    /* Y axis tick labels */
    ctx.textAlign = 'right';
    for (let i = 0; i <= yTicks; i++) {
      const v  = bounds.yMin + (bounds.yMax - bounds.yMin) * (1 - i / yTicks);
      const py = MARGIN.top + (i / yTicks) * plotH;
      ctx.fillText(_fmt(v), MARGIN.left - 4, py + 3);
    }

    /* X axis tick labels */
    ctx.textAlign = 'center';
    for (let i = 0; i <= xTicks; i++) {
      const v  = bounds.xMin + (bounds.xMax - bounds.xMin) * (i / xTicks);
      const px = MARGIN.left + (i / xTicks) * plotW;
      ctx.fillText(_fmt(v), px, MARGIN.top + plotH + 14);
    }

    /* Axis unit labels */
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(122, 112, 96, 0.70)';
    ctx.fillText(this.xUnit, MARGIN.left + plotW / 2, ch - 4);

    ctx.save();
    ctx.translate(10, MARGIN.top + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(this.yUnit, 0, 0);
    ctx.restore();

    ctx.restore();

    /* Data line */
    if (this.points.length < 2) {
      /* Draw chart label and return */
      _drawChartLabel(ctx, this.label, cw, MARGIN);
      return;
    }

    ctx.save();
    ctx.beginPath();
    let first = true;
    for (const p of this.points) {
      const { px, py } = this._toPixel(p.x, p.y, bounds, cw, ch);
      if (first) { ctx.moveTo(px, py); first = false; }
      else        { ctx.lineTo(px, py); }
    }

    if (this.fillArea) {
      /* Close path to x-axis for area fill */
      const lastPt = this.points[this.points.length - 1];
      const { px: lastPx } = this._toPixel(lastPt.x, 0, bounds, cw, ch);
      const { px: firstPx } = this._toPixel(this.points[0].x, 0, bounds, cw, ch);
      const { py: zeroPy } = this._toPixel(0, 0, bounds, cw, ch);
      ctx.lineTo(lastPx, zeroPy);
      ctx.lineTo(firstPx, zeroPy);
      ctx.closePath();

      const grad = ctx.createLinearGradient(0, MARGIN.top, 0, MARGIN.top + plotH);
      grad.addColorStop(0, this.color + '30');
      grad.addColorStop(1, this.color + '05');
      ctx.fillStyle = grad;
      ctx.fill();
    }

    ctx.strokeStyle = this.color;
    ctx.lineWidth   = 1.5;
    ctx.lineJoin    = 'round';
    ctx.lineCap     = 'round';
    /* Redraw just the line (not the fill path) */
    ctx.beginPath();
    first = true;
    for (const p of this.points) {
      const { px, py } = this._toPixel(p.x, p.y, bounds, cw, ch);
      if (first) { ctx.moveTo(px, py); first = false; }
      else        { ctx.lineTo(px, py); }
    }
    ctx.stroke();

    /* Current value dot */
    const last = this.points[this.points.length - 1];
    const { px, py } = this._toPixel(last.x, last.y, bounds, cw, ch);
    ctx.beginPath();
    ctx.arc(px, py, 3, 0, Math.PI * 2);
    ctx.fillStyle = this.color;
    ctx.fill();

    ctx.restore();

    _drawChartLabel(ctx, this.label, cw, MARGIN);
  }
}

/* ── Dual chart (two y-series, same x-axis) ──────── */

class DualChartEngine {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {Object} opts1 — options for first series
   * @param {Object} opts2 — options for second series
   */
  constructor(canvas, opts1, opts2) {
    this.canvas = canvas;
    this.ctx    = canvas.getContext('2d');
    this.series = [
      { ...opts1, points: [] },
      { ...opts2, points: [] },
    ];
    this._dirty = true;
  }

  /**
   * @param {number} seriesIdx — 0 or 1
   * @param {number} x
   * @param {number} y
   */
  addPoint(seriesIdx, x, y) {
    const s = this.series[seriesIdx];
    s.points.push({ x, y });
    if (s.points.length > MAX_POINTS) s.points.shift();
    this._dirty = true;
  }

  clear() {
    for (const s of this.series) s.points = [];
    this._dirty = true;
  }

  render() {
    if (!this._dirty) return;
    this._draw();
    this._dirty = false;
  }

  _draw() {
    const ctx = this.ctx;
    const cw  = this.canvas.width;
    const ch  = this.canvas.height;

    ctx.fillStyle = '#161410';
    ctx.fillRect(0, 0, cw, ch);

    /* Split canvas vertically: top half = series[0], bottom half = series[1] */
    const halfH = ch / 2 - 2;

    for (let si = 0; si < 2; si++) {
      const s       = this.series[si];
      const offsetY = si * (halfH + 4);
      this._drawSeries(ctx, s, cw, halfH, offsetY);
    }
  }

  _drawSeries(ctx, s, cw, ch, offsetY) {
    ctx.save();
    ctx.translate(0, offsetY);

    const bounds = _computeBounds(s.points);
    const plotW  = cw - MARGIN.left - MARGIN.right;
    const plotH  = ch - MARGIN.top  - MARGIN.bottom;

    /* Axes */
    ctx.strokeStyle = 'rgba(200, 146, 10, 0.20)';
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.moveTo(MARGIN.left, MARGIN.top);
    ctx.lineTo(MARGIN.left, MARGIN.top + plotH);
    ctx.lineTo(MARGIN.left + plotW, MARGIN.top + plotH);
    ctx.stroke();

    /* Labels */
    ctx.font      = '9px "Share Tech Mono", monospace';
    ctx.fillStyle = 'rgba(122, 112, 96, 0.80)';
    ctx.textAlign = 'center';
    ctx.fillText(`${s.xUnit || ''}`, MARGIN.left + plotW / 2, MARGIN.top + plotH + 24);

    ctx.save();
    ctx.translate(10, MARGIN.top + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(`${s.yUnit || ''}`, 0, 0);
    ctx.restore();

    /* Line */
    if (s.points.length >= 2) {
      ctx.beginPath();
      let first = true;
      for (const p of s.points) {
        const px = MARGIN.left + (p.x - bounds.xMin) / (bounds.xMax - bounds.xMin) * plotW;
        const py = MARGIN.top  + (1 - (p.y - bounds.yMin) / (bounds.yMax - bounds.yMin)) * plotH;
        if (first) { ctx.moveTo(px, py); first = false; }
        else        { ctx.lineTo(px, py); }
      }
      ctx.strokeStyle = s.color ?? '#c8920a';
      ctx.lineWidth   = 1.5;
      ctx.stroke();
    }

    _drawChartLabel(ctx, s.label ?? '', cw, MARGIN);
    ctx.restore();
  }
}

/* ── Helpers ─────────────────────────────────────── */

function _computeBounds(points) {
  if (points.length === 0) return { xMin: 0, xMax: 10, yMin: -5, yMax: 5 };
  let xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity;
  for (const p of points) {
    if (p.x < xMin) xMin = p.x;
    if (p.x > xMax) xMax = p.x;
    if (p.y < yMin) yMin = p.y;
    if (p.y > yMax) yMax = p.y;
  }
  const xPad = (xMax - xMin) * 0.05 || 1;
  const yPad = (yMax - yMin) * 0.10 || 1;
  return { xMin: xMin - xPad, xMax: xMax + xPad, yMin: yMin - yPad, yMax: yMax + yPad };
}

function _fmt(n) {
  if (Math.abs(n) >= 1000) return n.toExponential(1);
  if (Math.abs(n) >= 10)   return n.toFixed(1);
  return n.toFixed(2);
}

function _drawChartLabel(ctx, label, cw, margin) {
  if (!label) return;
  ctx.save();
  ctx.font      = 'italic 11px "EB Garamond", Georgia, serif';
  ctx.fillStyle = 'rgba(176, 168, 136, 0.55)';
  ctx.textAlign = 'right';
  ctx.fillText(label, cw - margin.right, margin.top + 11);
  ctx.restore();
}

export { ChartEngine, DualChartEngine };
