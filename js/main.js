/**
 * main.js — Archimedes application entry point
 *
 * Responsibilities:
 *   1. Initialize physics engine (WASM or fallback)
 *   2. Load JSON data into state
 *   3. Set up router
 *   4. Mount initial view
 *   5. Handle sidebar interactions
 */

import { initPhysics }            from './wasm-loader.js';
import { loadData, getState, setState, subscribe, getModule } from './state.js';
import { register, onNotFound, start as startRouter, navigate } from './router.js';
import { renderHome, renderModule, renderExperiment }            from './ui.js';

/* ── Active view disposer ────────────────────────── */
let _disposeCurrentView = null;

/**
 * Mount a new view into #main-content.
 * Disposes the previous view first.
 * @param {Function} rendererFn — async (container) => disposer
 */
async function _mountView(rendererFn) {
  const container = document.getElementById('main-content');
  if (!container) return;

  /* Dispose previous */
  if (_disposeCurrentView) {
    _disposeCurrentView();
    _disposeCurrentView = null;
  }

  /* Scroll to top on navigation */
  window.scrollTo({ top: 0, behavior: 'instant' });

  try {
    _disposeCurrentView = await rendererFn(container) ?? (() => {});
  } catch (err) {
    console.error('[main] View render error:', err);
    container.innerHTML = `<p class="text-muted">Erro ao carregar a página: ${err.message}</p>`;
  }
}

/* ── Routes ──────────────────────────────────────── */

function _registerRoutes() {
  /* Home */
  register('/', () => {
    _mountView(c => renderHome(c));
    _setBreadcrumb(['Início']);
    _setActiveSidebarItem('home');
  });

  /* Module overview */
  register('/module/:id', ({ id }) => {
    const mod = getModule(id);
    _mountView(c => renderModule(c, id));
    _setBreadcrumb(['Início', mod?.title ?? id]);
    _setActiveSidebarItem(id);
  });

  /* Experiment lab */
  register('/module/:moduleId/:expId', ({ moduleId, expId }) => {
    const mod = getModule(moduleId);
    _mountView(c => renderExperiment(c, moduleId, expId));
    _setBreadcrumb(['Início', mod?.title ?? moduleId, expId]);
    _setActiveSidebarItem(moduleId);
  });

  /* 404 */
  onNotFound(() => {
    _mountView(c => {
      c.innerHTML = `
        <div style="padding:40px">
          <p class="text-muted">Página não encontrada.</p>
          <a href="#/" class="btn btn--secondary" style="margin-top:16px;display:inline-flex">
            Voltar ao início
          </a>
        </div>
      `;
      return () => {};
    });
  });
}

/* ── Sidebar ─────────────────────────────────────── */

function _buildSidebar() {
  const nav    = document.getElementById('sidebar-nav');
  const modules = getState('modules');

  if (!nav || modules.length === 0) return;

  nav.innerHTML = `
    <span class="sidebar-section-label">Módulos</span>
  `;

  /* Home link */
  const homeItem = document.createElement('a');
  homeItem.className        = 'sidebar-item';
  homeItem.href             = '#/';
  homeItem.dataset.moduleId = 'home';
  homeItem.innerHTML = `
    <span class="sidebar-item__dot"></span>
    <span class="sidebar-item__label">Início</span>
  `;
  nav.appendChild(homeItem);

  /* Module links */
  for (const mod of modules) {
    const item = document.createElement('a');
    item.className        = 'sidebar-item';
    item.href             = `#/module/${mod.id}`;
    item.dataset.moduleId = mod.id;
    item.style.setProperty('--item-color', mod.color ?? '#00d4ff');
    item.innerHTML = `
      <span class="sidebar-item__dot" style="border-color:${mod.color ?? '#00d4ff'}"></span>
      <span class="sidebar-item__label">${mod.title}</span>
      <span class="sidebar-item__badge">${mod.experiments.length}</span>
    `;
    nav.appendChild(item);
  }
}

function _setActiveSidebarItem(moduleId) {
  document.querySelectorAll('.sidebar-item').forEach(el => {
    el.classList.toggle('active', el.dataset.moduleId === moduleId);
  });
}

/* ── Breadcrumb ──────────────────────────────────── */

function _setBreadcrumb(parts) {
  const el = document.getElementById('breadcrumb');
  if (!el) return;
  el.innerHTML = parts.map((p, i) => {
    const isLast = i === parts.length - 1;
    return isLast
      ? `<span class="header-breadcrumb__item active">${p}</span>`
      : `<span class="header-breadcrumb__item">${p}</span>
         <span class="header-breadcrumb__sep">/</span>`;
  }).join('');
}

/* ── Teacher mode button ─────────────────────────── */

function _initTeacherMode() {
  const btn = document.getElementById('btn-teacher-mode');
  if (!btn) return;

  const update = () => {
    const active = getState('teacherMode');
    btn.textContent = active ? 'Modo Aluno' : 'Modo Professor';
    btn.classList.toggle('header-btn--teacher', !active);
  };

  btn.addEventListener('click', () => {
    setState('teacherMode', !getState('teacherMode'));
    update();
    /* Re-render current view to show/hide teacher panel */
    const route = getState('route');
    if (route.params) {
      /* Re-trigger route by dispatching hashchange manually */
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    }
  });

  update();
}

/* ── Mobile sidebar toggle ───────────────────────── */

function _initMobileSidebar() {
  const menuBtn   = document.getElementById('btn-menu');
  const sidebar   = document.getElementById('app-sidebar');
  const overlay   = document.getElementById('sidebar-overlay');

  if (!menuBtn || !sidebar) return;

  const open  = () => { sidebar.classList.add('open');    overlay?.classList.add('visible'); };
  const close = () => { sidebar.classList.remove('open'); overlay?.classList.remove('visible'); };

  menuBtn.addEventListener('click', () => sidebar.classList.contains('open') ? close() : open());
  overlay?.addEventListener('click', close);

  /* Close on navigation */
  window.addEventListener('hashchange', close);
}

/* ── WASM status display ─────────────────────────── */

function _initWasmStatus() {
  subscribe('wasmLoaded', (loaded) => {
    const el = document.getElementById('wasm-status');
    if (!el) return;
    el.textContent = loaded ? 'WASM' : 'JS';
    el.title       = loaded ? 'Motor físico em WebAssembly' : 'Motor físico em JavaScript (fallback)';
    el.style.color = loaded ? 'var(--accent-green)' : 'var(--text-muted)';
  });
}

/* ─────────────────────────────────────────────────────────────────────────── *
 * Bootstrap
 * ─────────────────────────────────────────────────────────────────────────── */

async function init() {
  /* 1. Start physics engine */
  await initPhysics();

  /* 2. Load all JSON data */
  await loadData();

  /* 3. Build sidebar once data is loaded */
  _buildSidebar();

  /* 4. Wire UI interactions */
  _initTeacherMode();
  _initMobileSidebar();
  _initWasmStatus();

  /* 5. Register routes and start router */
  _registerRoutes();
  startRouter();
}

/* Kick off when DOM is ready */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
