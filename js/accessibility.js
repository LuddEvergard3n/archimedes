/**
 * accessibility.js — Keyboard navigation and accessibility enhancements
 *
 * - Tab navigation through interactive elements
 * - High contrast toggle
 * - Font size adjustment
 * - Keyboard shortcuts for simulation controls
 * - ARIA live region for simulation readouts
 */

import { getState, setState } from './state.js';

/* ── High contrast ───────────────────────────────── */

function initHighContrast() {
  const btn = document.getElementById('btn-high-contrast');
  if (!btn) return;

  const apply = (active) => {
    document.documentElement.classList.toggle('high-contrast', active);
    btn.setAttribute('aria-pressed', String(active));
    btn.textContent = active ? 'Contraste padrão' : 'Alto contraste';
    try { localStorage.setItem('archimedes-high-contrast', active ? '1' : '0'); }
    catch (_) {}
  };

  /* Restore preference */
  try {
    const saved = localStorage.getItem('archimedes-high-contrast');
    if (saved === '1') apply(true);
  } catch (_) {}

  btn.addEventListener('click', () => apply(!getState('highContrast') ));
}

/* ── Font size ───────────────────────────────────── */

function initFontSize() {
  const increase = document.getElementById('btn-font-increase');
  const decrease = document.getElementById('btn-font-decrease');
  if (!increase || !decrease) return;

  const sizes  = ['sm', 'base', 'lg'];
  let current  = 1; /* 'base' */

  const apply = (idx) => {
    current = Math.max(0, Math.min(sizes.length - 1, idx));
    const sizeMap = { sm: '14px', base: '16px', lg: '18px' };
    document.documentElement.style.fontSize = sizeMap[sizes[current]];
    setState('fontSize', sizes[current]);
    try { localStorage.setItem('archimedes-font-size', current); }
    catch (_) {}
  };

  /* Restore */
  try {
    const saved = parseInt(localStorage.getItem('archimedes-font-size') ?? '1', 10);
    if (!isNaN(saved)) apply(saved);
  } catch (_) {}

  increase.addEventListener('click', () => apply(current + 1));
  decrease.addEventListener('click', () => apply(current - 1));
}

/* ── Keyboard shortcuts ──────────────────────────── */

function initKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    /* Don't fire shortcuts when typing in inputs */
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    switch (e.key) {
      case ' ':
      case 'k': {
        /* Toggle play/pause */
        e.preventDefault();
        const playing = document.getElementById('btn-pause')?.classList.contains('active');
        if (playing) {
          document.getElementById('btn-pause')?.click();
        } else {
          document.getElementById('btn-play')?.click();
        }
        break;
      }
      case 'r':
      case 'R': {
        /* Reset simulation */
        document.getElementById('btn-reset')?.click();
        break;
      }
      case 'h':
      case 'H': {
        /* Home */
        if (!e.ctrlKey && !e.metaKey) {
          window.location.hash = '#/';
        }
        break;
      }
      case 'Escape': {
        /* Close sidebar on mobile */
        document.getElementById('app-sidebar')?.classList.remove('open');
        document.getElementById('sidebar-overlay')?.classList.remove('visible');
        break;
      }
    }
  });
}

/* ── ARIA live region for simulation values ──────── */

function initAriaLive() {
  /* Create live region if absent */
  if (!document.getElementById('sim-live-region')) {
    const el = document.createElement('div');
    el.id              = 'sim-live-region';
    el.className       = 'sr-only';
    el.setAttribute('aria-live',   'polite');
    el.setAttribute('aria-atomic', 'false');
    document.body.appendChild(el);
  }
}

/**
 * Announce a simulation value change to screen readers.
 * Call sparingly — only on meaningful changes.
 * @param {string} text
 */
function announceToScreenReader(text) {
  const el = document.getElementById('sim-live-region');
  if (el) el.textContent = text;
}

/* ── Skip link ───────────────────────────────────── */

function initSkipLink() {
  const link = document.getElementById('skip-to-main');
  if (!link) return;
  link.addEventListener('click', (e) => {
    e.preventDefault();
    const main = document.getElementById('main-content');
    if (main) {
      main.setAttribute('tabindex', '-1');
      main.focus();
    }
  });
}

/* ── Focus trap for mobile sidebar ──────────────── */

function initFocusTrap() {
  const sidebar = document.getElementById('app-sidebar');
  if (!sidebar) return;

  sidebar.addEventListener('keydown', (e) => {
    if (!sidebar.classList.contains('open')) return;
    if (e.key !== 'Tab') return;

    const focusable = sidebar.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    if (focusable.length === 0) return;

    const first = focusable[0];
    const last  = focusable[focusable.length - 1];

    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  });
}

/* ─────────────────────────────────────────────────────────────────────────── *
 * Initialize all accessibility features
 * ─────────────────────────────────────────────────────────────────────────── */

function initAccessibility() {
  initHighContrast();
  initFontSize();
  initKeyboardShortcuts();
  initAriaLive();
  initSkipLink();
  initFocusTrap();
}

export { initAccessibility, announceToScreenReader };
