/**
 * renderer.js — Canvas 2D drawing utilities
 *
 * Provides primitives used by all physics simulations:
 *   - Grid / axes
 *   - Arrows (force vectors)
 *   - Bodies (circle, rectangle)
 *   - Labels (text with background)
 *   - Trajectories
 *   - Background
 *
 * All functions receive a CanvasRenderingContext2D as first argument.
 * No global state. Pure functions.
 */

/* ── Constants ───────────────────────────────────── */

/*
 * Paleta de renderização — espelha theme.css
 *
 * INSTRUMENTO: fundo escuro quente, grid âmbar, leituras âmbar
 * VETORES: convenção estabelecida em livros de Física
 *   velocidade = azul, força = vermelho, normal = cinza,
 *   peso = cinza escuro, atrito = vermelho escuro,
 *   empuxo = azul oceano, aceleração = laranja
 */
const COLORS = {
  /* Grid e fundo */
  bg:          '#161410',
  grid:        'rgba(180, 140, 60, 0.06)',
  gridMajor:   'rgba(180, 140, 60, 0.13)',
  axis:        'rgba(200, 146, 10, 0.30)',

  /* Instrumento */
  amber:       '#c8920a',
  amberBright: '#e0a80e',
  amberDim:    'rgba(200, 146, 10, 0.14)',

  /* Texto */
  textPrimary:   '#e8e0c8',
  textSecondary: '#b0a888',
  textMuted:     '#7a7060',

  /* Corpos físicos */
  bodyFill:    '#2a2720',
  bodyStroke:  '#c8920a',
  surface:     '#3d3828',

  /* Vetores — convenção de livro */
  velocity:   '#4472b0',   /* azul */
  accel:      '#c07828',   /* laranja */
  force:      '#c44040',   /* vermelho */
  normal:     '#6a7a6a',   /* cinza médio */
  weight:     '#4a4040',   /* cinza escuro */
  friction:   '#8a4040',   /* vermelho escuro */
  buoyancy:   '#2a6080',   /* azul oceano */
  kinetic:    '#3d7a55',   /* verde */
  potential:  '#c07828',   /* laranja */

  /* Módulos */
  intro:  '#4472b0',
  motion: '#3d7a55',
  forces: '#b54a28',
  energy: '#7a4a96',
  fluids: '#2a6080',
  ondas:  '#5a7a40',
  thermo: '#8a4a1a',
  eletromagnetismo: '#4ab0d8',

  /* Fluido */
  fluid:       'rgba(42, 96, 128, 0.28)',
  fluidStroke: 'rgba(42, 96, 128, 0.55)',

  /* Aliases mantidos por compatibilidade com módulos existentes */
  cyan:   '#4472b0',
  green:  '#3d7a55',
  red:    '#c44040',
  purple: '#7a4a96',
};

/* ── Background and grid ─────────────────────────── */

/**
 * Fill canvas with the lab background color.
 * @param {CanvasRenderingContext2D} ctx
 */
function clearCanvas(ctx) {
  const { width, height } = ctx.canvas;
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, width, height);
}

/**
 * Draw a fine grid across the entire canvas.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} cellSize — pixels per cell
 * @param {number} [majorEvery=5] — draw heavier line every N cells
 */
function drawGrid(ctx, cellSize = 30, majorEvery = 5) {
  const { width, height } = ctx.canvas;
  ctx.save();

  for (let x = 0; x <= width; x += cellSize) {
    const isMajor = (x / cellSize) % majorEvery === 0;
    ctx.strokeStyle = isMajor ? COLORS.gridMajor : COLORS.grid;
    ctx.lineWidth   = isMajor ? 1 : 0.5;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }

  for (let y = 0; y <= height; y += cellSize) {
    const isMajor = (y / cellSize) % majorEvery === 0;
    ctx.strokeStyle = isMajor ? COLORS.gridMajor : COLORS.grid;
    ctx.lineWidth   = isMajor ? 1 : 0.5;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  ctx.restore();
}

/* ── Arrows (force vectors) ──────────────────────── */

/**
 * Draw an arrow from (x,y) with direction and length (dx, dy).
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x      — tail x
 * @param {number} y      — tail y
 * @param {number} dx     — x component
 * @param {number} dy     — y component (positive = downward in canvas space)
 * @param {string} color
 * @param {string} [label]
 * @param {number} [lineWidth=2]
 */
function drawArrow(ctx, x, y, dx, dy, color, label, lineWidth = 2) {
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 2) return;

  const headLen   = Math.min(12, len * 0.35);
  const headAngle = 0.45; /* radians */
  const angle     = Math.atan2(dy, dx);

  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle   = color;
  ctx.lineWidth   = lineWidth;
  ctx.lineCap     = 'round';

  /* Shaft */
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + dx, y + dy);
  ctx.stroke();

  /* Arrowhead */
  const tipX = x + dx;
  const tipY = y + dy;
  ctx.beginPath();
  ctx.moveTo(tipX, tipY);
  ctx.lineTo(
    tipX - headLen * Math.cos(angle - headAngle),
    tipY - headLen * Math.sin(angle - headAngle)
  );
  ctx.lineTo(
    tipX - headLen * Math.cos(angle + headAngle),
    tipY - headLen * Math.sin(angle + headAngle)
  );
  ctx.closePath();
  ctx.fill();

  /* Label — EB Garamond itálico, como em livro de Física */
  if (label) {
    ctx.font      = 'italic 12px "EB Garamond", Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = color;
    const midX = x + dx * 0.5;
    const midY = y + dy * 0.5;
    /* Offset perpendicular to arrow direction */
    const perpX = -Math.sin(angle) * 14;
    const perpY =  Math.cos(angle) * 14;
    ctx.fillText(label, midX + perpX, midY + perpY);
  }

  ctx.restore();
}

/**
 * Draw a double-headed arrow between two points.
 * Used for displacement / measurement annotations.
 */
function drawMeasure(ctx, x1, y1, x2, y2, color, label) {
  drawArrow(ctx, x1, y1, x2 - x1, y2 - y1, color, null);
  drawArrow(ctx, x2, y2, x1 - x2, y1 - y2, color, null);
  if (label) {
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;
    ctx.save();
    ctx.font      = 'italic 11px "EB Garamond", Georgia, serif';
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.fillText(label, mx, my - 8);
    ctx.restore();
  }
}

/* ── Bodies ──────────────────────────────────────── */

/**
 * Draw a circular body.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} cx — center x
 * @param {number} cy — center y
 * @param {number} r  — radius
 * @param {string} [fillColor]
 * @param {string} [strokeColor]
 */
function drawCircle(ctx, cx, cy, r, fillColor = COLORS.bodyFill, strokeColor = COLORS.bodyStroke) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle   = fillColor;
  ctx.fill();
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth   = 1.5;
  ctx.stroke();
  ctx.restore();
}

/**
 * Draw a rectangle body.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} cx — center x
 * @param {number} cy — center y
 * @param {number} w  — width
 * @param {number} h  — height
 * @param {string} [fillColor]
 * @param {string} [strokeColor]
 */
function drawRect(ctx, cx, cy, w, h, fillColor = COLORS.bodyFill, strokeColor = COLORS.bodyStroke) {
  ctx.save();
  ctx.fillStyle   = fillColor;
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth   = 1.5;
  ctx.fillRect(cx - w / 2, cy - h / 2, w, h);
  ctx.strokeRect(cx - w / 2, cy - h / 2, w, h);
  ctx.restore();
}

/* ── Surfaces ────────────────────────────────────── */

/**
 * Draw a horizontal surface (platform) with hatch marks.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x1
 * @param {number} x2
 * @param {number} y
 */
function drawSurface(ctx, x1, x2, y) {
  ctx.save();
  ctx.strokeStyle = COLORS.surface;
  ctx.lineWidth   = 2;
  ctx.beginPath();
  ctx.moveTo(x1, y);
  ctx.lineTo(x2, y);
  ctx.stroke();

  /* Hatch marks below the line */
  ctx.strokeStyle = 'rgba(42, 39, 30, 0.90)';
  ctx.lineWidth   = 1;
  const spacing = 12;
  for (let x = x1; x <= x2; x += spacing) {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - 8, y + 8);
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Draw an inclined ramp.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} baseX  — bottom-right x
 * @param {number} baseY  — bottom y
 * @param {number} length — ramp length (pixels)
 * @param {number} angle  — angle in radians
 */
function drawRamp(ctx, baseX, baseY, length, angle) {
  const topX = baseX - length * Math.cos(angle);
  const topY = baseY - length * Math.sin(angle);

  ctx.save();
  ctx.strokeStyle = COLORS.surface;
  ctx.lineWidth   = 2.5;
  ctx.beginPath();
  ctx.moveTo(topX, topY);
  ctx.lineTo(baseX, baseY);
  ctx.lineTo(baseX - length * Math.cos(angle), baseY);
  ctx.closePath();
  ctx.strokeStyle = COLORS.surface;
  ctx.fillStyle   = 'rgba(42, 39, 30, 0.70)';
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

/* ── Fluid container ─────────────────────────────── */

/**
 * Draw a fluid-filled container.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y        — top-left of container
 * @param {number} w
 * @param {number} h
 * @param {number} fillFrac — 0..1 how full the container is
 * @param {string} [fluidColor]
 */
function drawFluidContainer(ctx, x, y, w, h, fillFrac = 0.8, fluidColor = COLORS.fluid) {
  ctx.save();

  /* Container walls */
  ctx.strokeStyle = COLORS.surface;
  ctx.lineWidth   = 2;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x, y + h);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x + w, y);
  ctx.stroke();

  /* Fluid fill */
  const fluidH  = h * fillFrac;
  const fluidY  = y + h - fluidH;
  ctx.fillStyle = fluidColor;
  ctx.fillRect(x + 1, fluidY, w - 2, fluidH);

  /* Fluid surface line */
  ctx.strokeStyle = COLORS.fluidStroke;
  ctx.lineWidth   = 1;
  ctx.beginPath();
  ctx.moveTo(x + 1, fluidY);
  ctx.lineTo(x + w - 1, fluidY);
  ctx.stroke();

  ctx.restore();
}

/* ── Text labels ─────────────────────────────────── */

/**
 * Draw a label with a semi-transparent background pill.
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} text
 * @param {number} x
 * @param {number} y
 * @param {string} [color]
 * @param {string} [align] — 'left' | 'center' | 'right'
 */
function drawLabel(ctx, text, x, y, color = COLORS.textPrimary, align = 'left') {
  ctx.save();
  /* Símbolo em Garamond itálico, valor em Share Tech Mono */
  ctx.font      = '11px "Share Tech Mono", monospace';
  ctx.textAlign = align;

  const metrics = ctx.measureText(text);
  const pad     = 4;
  const bx      = align === 'center' ? x - metrics.width / 2 - pad :
                  align === 'right'  ? x - metrics.width - pad : x - pad;
  ctx.fillStyle = 'rgba(22, 20, 16, 0.82)';
  ctx.fillRect(bx, y - 12, metrics.width + pad * 2, 16);

  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  ctx.restore();
}

/**
 * Draw a value readout (symbol + value + unit) at position.
 * Symbol in italic, value in mono.
 */
function drawReadout(ctx, label, value, unit, x, y, color = COLORS.amber) {
  const numStr  = typeof value === 'number' ? value.toFixed(2) : value;
  const text    = `${label}: ${numStr} ${unit}`;
  drawLabel(ctx, text, x, y, color, 'left');
}

/* ── Trajectory trail ────────────────────────────── */

/**
 * Draw a fading dot trail.
 * @param {CanvasRenderingContext2D} ctx
 * @param {{ x: number, y: number }[]} points
 * @param {string} [color]
 */
function drawTrail(ctx, points, color = COLORS.velocity) {
  if (points.length === 0) return;
  ctx.save();
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const alpha = (i / n) * 0.5;
    ctx.fillStyle = color.startsWith('#') ? _hexWithAlpha(color, alpha) : color;
    ctx.beginPath();
    ctx.arc(points[i].x, points[i].y, 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/**
 * Convert hex color to rgba string with given alpha.
 * @param {string} hex — e.g. '#4472b0'
 * @param {number} alpha — 0..1
 * @returns {string}
 */
function _hexWithAlpha(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/* ── Time scale ──────────────────────────────────── */

/**
 * Format a simulation time value for display.
 * @param {number} t — seconds
 * @returns {string}
 */
function formatTime(t) {
  if (t < 60) return `${t.toFixed(2)} s`;
  const m = Math.floor(t / 60);
  const s = (t % 60).toFixed(1);
  return `${m}m ${s}s`;
}

export {
  COLORS,
  clearCanvas,
  drawGrid,
  drawArrow,
  drawMeasure,
  drawCircle,
  drawRect,
  drawSurface,
  drawRamp,
  drawFluidContainer,
  drawLabel,
  drawReadout,
  drawTrail,
  formatTime,
};
