/**
 * js/eq-renderer.js — LaTeX → HTML renderer
 *
 * Handles the exact subset of LaTeX used in equations.json:
 *   \frac{a}{b}     — vertical fraction
 *   \sqrt{x}        — square root with vinculum
 *   _{x} or _x      — subscript (single char or group)
 *   ^{x} or ^x      — superscript (single char or group)
 *   \vec{x}         — vector arrow overhead
 *   \text{x}        — roman text inside math
 *   Greek: \alpha \beta \gamma \delta \Delta \theta \lambda
 *          \mu \pi \phi \rho \omega \Omega \sigma \Sigma \tau
 *   Ops:   \cdot \times \approx \implies \sim \neq \leq \geq
 *          \infty \partial \nabla \sum \int \pm
 *   Space: \quad \qquad (→ thin space)
 *   Misc:  \sin \cos \tan \ln \log \exp \lim \max \min
 *
 * Output: HTML string safe to set as innerHTML.
 * No external dependencies.
 */

/* ── Greek and symbol map ─────────────────────────────────────────── */

const SYMBOLS = {
  /* Greek lower */
  alpha:   'α', beta:    'β', gamma:   'γ', delta:   'δ',
  epsilon: 'ε', zeta:    'ζ', eta:     'η', theta:   'θ',
  iota:    'ι', kappa:   'κ', lambda:  'λ', mu:      'μ',
  nu:      'ν', xi:      'ξ', pi:      'π', rho:     'ρ',
  sigma:   'σ', tau:     'τ', upsilon: 'υ', phi:     'φ',
  chi:     'χ', psi:     'ψ', omega:   'ω',
  /* Greek upper */
  Alpha:   'Α', Beta:    'Β', Gamma:   'Γ', Delta:   'Δ',
  Epsilon: 'Ε', Zeta:    'Ζ', Eta:     'Η', Theta:   'Θ',
  Iota:    'Ι', Kappa:   'Κ', Lambda:  'Λ', Mu:      'Μ',
  Nu:      'Ν', Xi:      'Ξ', Pi:      'Π', Rho:     'Ρ',
  Sigma:   'Σ', Tau:     'Τ', Upsilon: 'Υ', Phi:     'Φ',
  Chi:     'Χ', Psi:     'Ψ', Omega:   'Ω',
  /* Operators */
  cdot:    '·', times:   '×', div:     '÷', pm:      '±',
  approx:  '≈', sim:     '∼', neq:     '≠', leq:     '≤',
  geq:     '≥', ll:      '≪', gg:      '≫',
  implies: '⟹', iff:     '⟺', to:      '→',
  infty:   '∞', partial: '∂', nabla:   '∇',
  sum:     'Σ', prod:    'Π', int:     '∫',
  /* Functions */
  sin: 'sin', cos: 'cos', tan: 'tan', cot: 'cot',
  ln:  'ln',  log: 'log', exp: 'exp', lim: 'lim',
  max: 'max', min: 'min', det: 'det',
  /* Spacing — map to thin space */
  quad: '\u2009', qquad: '\u2009\u2009',
  /* Misc */
  ldots: '…', cdots: '⋯', vdots: '⋮', ddots: '⋱',
};

/* ── Balanced-brace extractor ─────────────────────────────────────── */

/**
 * Starting at src[pos] which must be '{', find the matching '}'.
 * Returns { content, end } where end is the index after '}'.
 * @param {string} src
 * @param {number} pos  — index of '{'
 * @returns {{ content: string, end: number }}
 */
function extractGroup(src, pos) {
  if (src[pos] !== '{') {
    /* Single character group — no braces */
    return { content: src[pos] ?? '', end: pos + 1 };
  }
  let depth = 0;
  let i = pos;
  while (i < src.length) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) return { content: src.slice(pos + 1, i), end: i + 1 }; }
    i++;
  }
  /* Unbalanced — return rest */
  return { content: src.slice(pos + 1), end: src.length };
}

/* ── Core renderer — recursive ────────────────────────────────────── */

/**
 * Render a LaTeX string to an HTML string.
 * @param {string} src
 * @returns {string} HTML
 */
function renderLatex(src) {
  if (!src || typeof src !== 'string') return '';
  return _render(src.trim());
}

function _render(src) {
  let out = '';
  let i   = 0;

  while (i < src.length) {
    const ch = src[i];

    /* ── Backslash command ──────────────────────────── */
    if (ch === '\\') {
      i++;

      /* Read command name: letters only */
      let cmd = '';
      while (i < src.length && /[a-zA-Z]/.test(src[i])) { cmd += src[i]; i++; }

      /* ── Escaped special characters (cmd is empty — no letters followed \) ── */
      if (cmd === '') {
        const sp = src[i];
        if (sp === '{') { out += '{'; i++; continue; }
        if (sp === '}') { out += '}'; i++; continue; }
        if (sp === '\\') { out += '\\'; i++; continue; }
        if (sp === ',') { out += '\u2009'; i++; continue; }
        if (sp === ';') { out += '\u2009'; i++; continue; }
        if (sp === '!') { i++; continue; }
        if (sp === ' ') { out += '\u00a0'; i++; continue; }
        out += '\\';
        continue;
      }

      /* Skip optional trailing space after alphabetic command name */
      if (src[i] === ' ') i++;
      if (cmd === 'frac') {
        const num = extractGroup(src, i); i = num.end;
        const den = extractGroup(src, i); i = den.end;
        out += `<span class="eq-frac"><span class="eq-num">${_render(num.content)}</span><span class="eq-den">${_render(den.content)}</span></span>`;
        continue;
      }

      /* ── \sqrt{x} ── */
      if (cmd === 'sqrt') {
        const arg = extractGroup(src, i); i = arg.end;
        out += `<span class="eq-sqrt"><span class="eq-sqrt__rad">√</span><span class="eq-sqrt__arg">${_render(arg.content)}</span></span>`;
        continue;
      }

      /* ── \vec{x} ── */
      if (cmd === 'vec') {
        const arg = extractGroup(src, i); i = arg.end;
        out += `<span class="eq-vec">${_render(arg.content)}</span>`;
        continue;
      }

      /* ── \text{x} ── */
      if (cmd === 'text') {
        const arg = extractGroup(src, i); i = arg.end;
        /* Inside \text, render as plain text (escape HTML) */
        out += `<span class="eq-text">${_escHtml(arg.content)}</span>`;
        continue;
      }

      /* ── \overline{x} ── */
      if (cmd === 'overline') {
        const arg = extractGroup(src, i); i = arg.end;
        out += `<span class="eq-overline">${_render(arg.content)}</span>`;
        continue;
      }

      /* ── Known symbol or function ── */
      if (SYMBOLS[cmd] !== undefined) {
        const sym = SYMBOLS[cmd];
        /* Function names (sin, cos…) get roman class */
        const isFunc = /^(sin|cos|tan|cot|ln|log|exp|lim|max|min|det)$/.test(cmd);
        out += isFunc
          ? `<span class="eq-func">${sym}</span>`
          : sym;
        continue;
      }

      /* ── Unknown command — output as-is with backslash ── */
      out += `\\${cmd}`;
      continue;
    }

    /* ── Superscript ^ ─────────────────────────────── */
    if (ch === '^') {
      i++;
      const arg = extractGroup(src, i); i = arg.end;
      out += `<sup>${_render(arg.content)}</sup>`;
      continue;
    }

    /* ── Subscript _ ───────────────────────────────── */
    if (ch === '_') {
      i++;
      const arg = extractGroup(src, i); i = arg.end;
      out += `<sub>${_render(arg.content)}</sub>`;
      continue;
    }

    /* ── Grouped expression {…} ────────────────────── */
    if (ch === '{') {
      const grp = extractGroup(src, i); i = grp.end;
      out += _render(grp.content);
      continue;
    }

    /* ── Skip closing brace (already consumed by extractGroup) ── */
    if (ch === '}') { i++; continue; }

    /* ── Tilde = non-breaking space ─────────────────── */
    if (ch === '~') { out += '\u00a0'; i++; continue; }

    /* ── Ampersand (alignment) — treat as thin space ── */
    if (ch === '&') { out += '\u2009'; i++; continue; }

    /* ── Plain character — escape HTML ─────────────── */
    out += _escHtml(ch);
    i++;
  }

  return out;
}

/* ── HTML escape ──────────────────────────────────────────────────── */

function _escHtml(s) {
  return s
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;');
}

export { renderLatex };
