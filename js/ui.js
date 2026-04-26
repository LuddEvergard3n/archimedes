/**
 * ui.js — View renderer
 *
 * Builds and tears down DOM for each route:
 *   renderHome()           — module selector grid
 *   renderModule(id)       — experiment list for a module
 *   renderExperiment(id)   — full lab view with simulation
 *
 * Each render function returns a disposer function that cleans up
 * any active simulation, event listeners, and DOM mutations.
 */

import {
  getState, setState, getModule, getExperiment,
  getExperimentsByModule, getLesson, getExercisesByExperiment,
  getEquationsByExperiment,
} from './state.js';
import { navigate } from './router.js';
import { renderLatex } from './eq-renderer.js';
import {
  markExperimentVisited, markExerciseSolved,
  isExperimentVisited, moduleProgress, experimentExerciseProgress,
} from './progress.js';

/* ── Module color mapping (matches theme.css --color-* vars) ────── */
const MODULE_COLORS = {
  intro:         '#4472b0',
  motion:        '#3d7a55',
  forces:        '#b54a28',
  energy:        '#7a4a96',
  fluids:        '#2a6080',
  ondas:         '#5a7a40',
  termodinamica: '#8a4a1a',
  eletromagnetismo: '#4ab0d8',
};

/* ─────────────────────────────────────────────────────────────────────────── *
 * renderHome — Module selector
 * ─────────────────────────────────────────────────────────────────────────── */

function renderHome(container) {
  const modules = getState('modules');

  container.innerHTML = `
    <div class="page-header">
      <span class="page-header__eyebrow">Laboratório de Física</span>
      <h1 class="page-header__title">Archimedes</h1>
      <p class="page-header__subtitle">
        Física aprendida através do fenômeno, não da fórmula.
        Escolha um módulo para começar.
      </p>
    </div>

    <div class="home-grid" id="module-grid"></div>
  `;

  const grid = container.querySelector('#module-grid');

  for (const mod of modules) {
  const color = MODULE_COLORS[mod.id] ?? '#c8920a';
    const card  = document.createElement('a');
    card.className        = 'module-card';
    card.href             = `#/module/${mod.id}`;
    card.style.setProperty('--card-color', color);
    card.setAttribute('aria-label', `Módulo ${mod.title}`);

    const prog  = moduleProgress(mod.experiments);
    const pct   = prog.total > 0 ? Math.round((prog.visited / prog.total) * 100) : 0;
    const progHtml = `
      <div class="module-card__progress" aria-label="${prog.visited} de ${prog.total} experimentos visitados">
        <div class="module-card__progress-bar" style="width:${pct}%"></div>
      </div>
      <span class="module-card__count">${prog.visited}/${prog.total} experimento${prog.total !== 1 ? 's' : ''}</span>
    `;

    card.innerHTML = `
      <span class="module-card__label">${mod.order + 1}. ${mod.id.toUpperCase()}</span>
      <h2 class="module-card__title">${mod.title}</h2>
      <p class="module-card__desc">${mod.description}</p>
      ${progHtml}
    `;

    grid.appendChild(card);
  }

  return () => {}; /* No cleanup needed for static view */
}

/* ─────────────────────────────────────────────────────────────────────────── *
 * renderModule — Experiment list
 * ─────────────────────────────────────────────────────────────────────────── */

function renderModule(container, moduleId) {
  const mod         = getModule(moduleId);
  const experiments = getExperimentsByModule(moduleId);

  if (!mod) {
    container.innerHTML = `<p class="text-muted">Módulo não encontrado: ${moduleId}</p>`;
    return () => {};
  }

  const color = MODULE_COLORS[moduleId] ?? '#c8920a';

  container.innerHTML = `
    <div class="module-header">
      <div class="module-header__color-bar" style="background:${color}"></div>
      <div class="module-header__info">
        <div class="module-header__label">${mod.id.toUpperCase()}</div>
        <h1 class="module-header__title">${mod.title}</h1>
        <p class="module-header__desc">${mod.description}</p>
      </div>
    </div>

    <div class="experiment-grid" id="exp-grid"></div>
  `;

  const grid = container.querySelector('#exp-grid');

  for (const exp of experiments) {
    const card = document.createElement('a');
    const visited    = isExperimentVisited(exp.id);
    const exerProg   = experimentExerciseProgress(exp.exercises ?? []);
    card.className   = 'exp-card' + (visited ? ' exp-card--visited' : '');
    card.href        = `#/module/${moduleId}/${exp.id}`;
    card.setAttribute('aria-label', `Experimento: ${exp.title}`);

    const varTags = (exp.variables ?? [])
      .map(v => `<span class="var-tag">${typeof v === 'object' ? (v.label ?? v.key) : v}</span>`)
      .join('');

    const visitedBadge = visited
      ? `<span class="exp-card__badge exp-card__badge--done" title="Visitado">✓</span>`
      : `<span class="exp-card__badge exp-card__badge--new" title="Não visitado"></span>`;

    const exerBadge = exerProg.total > 0
      ? `<span class="exp-card__exer" title="${exerProg.solved}/${exerProg.total} exercícios respondidos">${exerProg.solved}/${exerProg.total}</span>`
      : '';

    card.innerHTML = `
      <div class="exp-card__header">
        <span class="exp-card__tag">${_difficultyLabel(exp.difficulty)} · ${exp.duration_min ?? '?'} min</span>
        ${visitedBadge}
      </div>
      <h3 class="exp-card__title">${exp.title}</h3>
      <p class="exp-card__desc">${exp.phenomenon}</p>
      <div class="exp-card__footer">
        <div class="exp-card__variables">${varTags}</div>
        ${exerBadge}
      </div>
    `;

    grid.appendChild(card);
  }

  return () => {};
}

/* ─────────────────────────────────────────────────────────────────────────── *
 * renderExperiment — Full lab view
 * ─────────────────────────────────────────────────────────────────────────── */

async function renderExperiment(container, moduleId, experimentId) {
  const exp  = getExperiment(experimentId);
  const mod  = getModule(moduleId);

  if (!exp || !mod) {
    container.innerHTML = `<p class="text-muted">Experimento não encontrado.</p>`;
    return () => {};
  }

  const color     = MODULE_COLORS[moduleId] ?? '#c8920a';
  const equations = getEquationsByExperiment(experimentId);
  const exercises = getExercisesByExperiment(experimentId);

  /* Record visit immediately — before async sim load */
  markExperimentVisited(experimentId);

  /* Build HTML */
  container.innerHTML = `
    <div class="page-header">
      <span class="page-header__eyebrow">${mod.title} — Experimento</span>
      <h1 class="page-header__title">${exp.title}</h1>
      <div class="page-header__meta">
        <span>${_difficultyLabel(exp.difficulty)}</span>
        <span>·</span>
        <span>${exp.duration_min ?? '?'} min</span>
        <span>·</span>
        <span id="sim-time-display">t = 0.00 s</span>
      </div>
    </div>

    <div class="phenomenon-block" style="border-left-color:${color}">
      <span class="phenomenon-block__label" style="color:${color}">Fenômeno</span>
      <p class="phenomenon-block__text">${exp.phenomenon}</p>
    </div>

    <div class="lab-view">
      <!-- Canvas area -->
      <div class="lab-view__canvas-area">
        <div class="panel">
          <div class="panel__header">
            <span class="panel__title">
              <span class="panel__title-dot" style="background:${color}"></span>
              Laboratório
            </span>
            <div class="btn-group" id="sim-btn-group">
              <button class="sim-btn" id="btn-play"  aria-label="Iniciar simulação">
                ${_svgPlay()}
              </button>
              <button class="sim-btn" id="btn-pause" aria-label="Pausar simulação">
                ${_svgPause()}
              </button>
              <button class="sim-btn" id="btn-reset" aria-label="Reiniciar simulação">
                ${_svgReset()}
              </button>
            </div>
          </div>
          <div class="canvas-wrapper">
            <canvas id="sim-canvas" width="720" height="340"
              aria-label="Simulação de ${exp.title}"></canvas>
          </div>
          <div class="canvas-wrapper" id="chart-wrapper" style="margin-top:4px;height:120px;">
            <canvas id="chart-canvas" width="720" height="120"
              aria-label="Gráfico da simulação"></canvas>
          </div>
        </div>
      </div>

      <!-- Controls panel -->
      <div class="lab-view__controls">
        <div class="panel" id="controls-panel">
          <div class="panel__header">
            <span class="panel__title">
              <span class="panel__title-dot"></span>
              Parâmetros
            </span>
          </div>
          <div class="panel__body" id="controls-body">
            <!-- populated by simulation module -->
          </div>
        </div>
      </div>

      <!-- Info panel -->
      <div class="lab-view__info">
        ${_buildQuestionHTML(exp)}
        ${_buildEquationsHTML(equations)}
        ${exercises.length > 0 ? `<div id="exercise-container">${_buildExerciseHTML(exercises[0])}</div>` : ''}
        ${getState('teacherMode') ? _buildTeacherHTML(exp) : ''}
      </div>
    </div>
  `;

  /* ── Load and start simulation ──────────────────── */
  const simCanvas   = container.querySelector('#sim-canvas');
  const chartCanvas = container.querySelector('#chart-canvas');

  let simulation = null;
  const cleanups  = [];

  try {
    simulation = await _loadSimulation(exp.simulation, moduleId, simCanvas, chartCanvas);
  } catch (err) {
    console.error('[ui] Failed to load simulation:', err);
    simCanvas.parentElement.insertAdjacentHTML('beforeend',
      `<p class="text-muted" style="padding:8px">Simulação indisponível: ${err.message}</p>`);
  }

  if (simulation) {
    /* Populate controls */
    _buildControls(
      container.querySelector('#controls-body'),
      exp, simulation
    );

    /* Wire buttons */
    const btnPlay  = container.querySelector('#btn-play');
    const btnPause = container.querySelector('#btn-pause');
    const btnReset = container.querySelector('#btn-reset');
    const timeDisplay = container.querySelector('#sim-time-display');

    const onPlay  = () => { simulation.start(); btnPlay.classList.add('active'); btnPause.classList.remove('active'); };
    const onPause = () => { simulation.pause(); btnPause.classList.add('active'); btnPlay.classList.remove('active'); };
    const onReset = () => { simulation.reset(); btnPlay.classList.remove('active'); btnPause.classList.remove('active'); };

    btnPlay.addEventListener('click',  onPlay);
    btnPause.addEventListener('click', onPause);
    btnReset.addEventListener('click', onReset);

    simulation.onTimeUpdate(t => {
      if (timeDisplay) timeDisplay.textContent = `t = ${t.toFixed(2)} s`;
    });

    /* Initial render */
    simulation.reset();

    cleanups.push(() => {
      btnPlay.removeEventListener('click',  onPlay);
      btnPause.removeEventListener('click', onPause);
      btnReset.removeEventListener('click', onReset);
    });
  }

  /* ── Exercise interaction ───────────────────────── */
  if (exercises.length > 0) {
    cleanups.push(_attachExerciseHandlers(container, exercises[0]));
  }

  return () => {
    if (simulation) simulation.dispose();
    for (const fn of cleanups) fn();
  };
}

/* ─────────────────────────────────────────────────────────────────────────── *
 * Simulation loader — dynamic import by module
 * ─────────────────────────────────────────────────────────────────────────── */

async function _loadSimulation(simId, moduleId, canvas, chartCanvas) {
  /* Map module IDs to import paths */
  const loaders = {
    motion:         () => import('../modules/motion/motion.js').then(m => m.createMotionSimulation(simId, canvas, chartCanvas)),
    forces:         () => import('../modules/forces/forces.js').then(m => m.createForcesSimulation(simId, canvas, chartCanvas)),
    energy:         () => import('../modules/energy/energy.js').then(m => m.createEnergySimulation(simId, canvas, chartCanvas)),
    fluids:         () => import('../modules/fluids/fluids.js').then(m => m.createFluidsSimulation(simId, canvas, chartCanvas)),
    intro:          () => import('../modules/intro/intro.js').then(m => m.createIntroSimulation(simId, canvas, chartCanvas)),
    ondas:          () => import('../modules/ondas/ondas.js').then(m => m.createOndasSimulation(simId, canvas)),
    termodinamica:      () => import('../modules/termodinamica/termodinamica.js').then(m => m.createTermodinamicaSimulation(simId, canvas)),
    eletromagnetismo:   () => import('../modules/eletromagnetismo/eletromagnetismo.js').then(m => m.createEletromagnetismoSimulation(simId, canvas, chartCanvas)),
  };

  const loader = loaders[moduleId];
  if (!loader) throw new Error(`No loader for module: ${moduleId}`);
  return loader();
}

/* ─────────────────────────────────────────────────────────────────────────── *
 * Control builders — per-experiment sliders and toggles
 * ─────────────────────────────────────────────────────────────────────────── */

function _buildControls(container, exp, simulation) {
  /* Control definitions keyed by simulation ID */
  const controlDefs = {
    'mru': [
      { key: 'v0',      label: 'Velocidade',   unit: 'm/s', min: -20, max: 20, step: 0.5, default: 5 },
      { key: 'x0',      label: 'Pos. inicial', unit: 'm',   min: 0,   max: 80, step: 1,   default: 0 },
      { key: 'compare', label: 'Comparar dois corpos', type: 'toggle', default: false },
      { key: 'v02',     label: 'Velocidade 2', unit: 'm/s', min: -20, max: 20, step: 0.5, default: 2,
        showWhen: 'compare' },
    ],
    'mruv': [
      { key: 'v0', label: 'Vel. inicial', unit: 'm/s',  min: -10, max: 10, step: 0.5, default: 0 },
      { key: 'a',  label: 'Aceleração',  unit: 'm/s²', min: -10, max: 10, step: 0.5, default: 3 },
      { key: 'x0', label: 'Pos. inicial',unit: 'm',    min: 0,   max: 80, step: 1,   default: 0 },
    ],
    'free-fall': [
      { key: 'h0',           label: 'Altura inicial', unit: 'm',  min: 5, max: 100, step: 5, default: 50 },
      { key: 'showCompare',  label: 'Mostrar 2ª massa', type: 'toggle', default: false },
    ],
    'inertia': [
      { key: 'v', label: 'Velocidade', unit: 'm/s', min: 0, max: 20, step: 0.5, default: 4 },
    ],
    'newton2': [
      { key: 'force', label: 'Força',  unit: 'N',  min: 0, max: 100, step: 2,   default: 20 },
      { key: 'mass',  label: 'Massa',  unit: 'kg', min: 1, max: 20,  step: 0.5, default: 5  },
    ],
    'friction': [
      { key: 'force',    label: 'Força aplicada', unit: 'N',  min: 0,   max: 80,  step: 2,    default: 20  },
      { key: 'mass',     label: 'Massa',          unit: 'kg', min: 1,   max: 20,  step: 0.5,  default: 4   },
      { key: 'mu_k',     label: 'Coef. atrito',   unit: '',   min: 0,   max: 1,   step: 0.05, default: 0.3 },
      { key: 'friction', label: 'Ativar atrito',  type: 'toggle', default: true },
    ],
    'resultant': [
      { key: 'f1',   label: 'Força 1 →', unit: 'N',  min: 0, max: 80, step: 2, default: 30 },
      { key: 'f2',   label: 'Força 2 ←', unit: 'N',  min: 0, max: 80, step: 2, default: 10 },
      { key: 'mass', label: 'Massa',     unit: 'kg', min: 1, max: 20, step: 0.5, default: 5 },
    ],
    'kinetic': [
      { key: 'v',    label: 'Velocidade', unit: 'm/s', min: 0, max: 30, step: 0.5, default: 5 },
      { key: 'mass', label: 'Massa',      unit: 'kg',  min: 1, max: 20, step: 0.5, default: 2 },
    ],
    'ramp-energy': [
      { key: 'mass',     label: 'Massa',    unit: 'kg',   min: 1, max: 20, step: 0.5, default: 2  },
      { key: 'angle',    label: 'Ângulo',   unit: '°',    min: 10, max: 60, step: 5,  default: 30 },
      { key: 'friction', label: 'Atrito',   type: 'toggle', default: false },
      { key: 'mu_k',     label: 'Coef. μk', unit: '',    min: 0, max: 0.8, step: 0.05, default: 0.2 },
    ],
    'conservation': [
      { key: 'mass',  label: 'Massa',    unit: 'kg', min: 1,  max: 20, step: 0.5, default: 2  },
      { key: 'angle', label: 'Ângulo',   unit: '°',  min: 10, max: 60, step: 5,   default: 30 },
      { key: 'mu_k',  label: 'Coef. μk', unit: '',  min: 0,  max: 0.8, step: 0.05,default: 0.25 },
    ],
    'buoyancy': [
      { key: 'objDensity',   label: 'Dens. objeto', unit: 'kg/m³', min: 100, max: 2500, step: 50, default: 600 },
      { key: 'fluidDensity', label: 'Dens. fluido', unit: 'kg/m³', min: 700, max: 1500, step: 50, default: 1000 },
    ],
    'density': [
      { key: 'objDensity',   label: 'Dens. objeto', unit: 'kg/m³', min: 100, max: 3000, step: 50, default: 700 },
      { key: 'fluidDensity', label: 'Dens. fluido', unit: 'kg/m³', min: 700, max: 1500, step: 50, default: 1000 },
    ],
    'pressure': [
      { key: 'fluidDensity', label: 'Dens. fluido', unit: 'kg/m³', min: 700, max: 1500, step: 50, default: 1000 },
      { key: 'probeDepth',   label: 'Profundidade', unit: 'm',     min: 0,   max: 3,    step: 0.1, default: 1.5 },
    ],
    /* ── Ondas ──────────────────────────────────── */
    'mhs': [
      { key: 'mass',      label: 'Massa (m)',       unit: 'kg',  min: 0.1,  max: 5.0,  step: 0.1,  default: 1.0  },
      { key: 'springK',   label: 'Constante (k)',   unit: 'N/m', min: 1.0,  max: 50.0, step: 0.5,  default: 10.0 },
      { key: 'amplitude', label: 'Amplitude (A)',   unit: 'm',   min: 0.05, max: 0.30, step: 0.01, default: 0.15 },
    ],
    'wave': [
      { key: 'amplitude',  label: 'Amplitude (A)', unit: 'm',  min: 0.01, max: 0.20, step: 0.01, default: 0.08 },
      { key: 'frequency',  label: 'Frequência (f)',unit: 'Hz', min: 0.2,  max: 4.0,  step: 0.1,  default: 1.0  },
      { key: 'wavelength', label: 'Comprimento (λ)',unit: 'm', min: 0.1,  max: 1.5,  step: 0.05, default: 0.50 },
    ],
    'superposition': [
      { key: 'A1',  label: 'Amplitude 1 (A₁)', unit: 'm',   min: 0.01, max: 0.12, step: 0.01, default: 0.06 },
      { key: 'f1',  label: 'Frequência 1 (f₁)',unit: 'Hz',  min: 0.5,  max: 5.0,  step: 0.1,  default: 1.0  },
      { key: 'A2',  label: 'Amplitude 2 (A₂)', unit: 'm',   min: 0.01, max: 0.12, step: 0.01, default: 0.06 },
      { key: 'f2',  label: 'Frequência 2 (f₂)',unit: 'Hz',  min: 0.5,  max: 5.0,  step: 0.1,  default: 1.2  },
      { key: 'phi', label: 'Fase (φ)',          unit: 'rad', min: 0,    max: 6.28, step: 0.1,  default: 0    },
    ],
    'pendulum-wave': [
      { key: 'length', label: 'Comprimento (L)',    unit: 'm',   min: 0.1, max: 2.5,  step: 0.1,  default: 1.0  },
      { key: 'theta0', label: 'Ângulo inicial (θ₀)',unit: 'rad', min: 0.05,max: 0.60, step: 0.05, default: 0.30 },
    ],
    /* ── Termodinâmica ──────────────────────────── */
    'gas-ideal': [
      { key: 'n', label: 'Quantidade (n)', unit: 'mol', min: 0.1, max: 5.0, step: 0.1, default: 1.0 },
      { key: 'T', label: 'Temperatura (T)',unit: 'K',   min: 200, max: 800, step: 10,  default: 300 },
      { key: 'V', label: 'Volume (V)',     unit: 'L',   min: 0.2, max: 3.0, step: 0.1, default: 1.0 },
    ],
    'processos': [
      { key: 'n',  label: 'Quantidade (n)',    unit: 'mol', min: 0.1, max: 3.0, step: 0.1, default: 1.0 },
      { key: 'T0', label: 'Temperatura (T₀)',  unit: 'K',   min: 200, max: 600, step: 10,  default: 300 },
      { key: 'V0', label: 'Vol. inicial (V₀)', unit: 'L',   min: 0.2, max: 2.0, step: 0.1, default: 1.0 },
    ],
    'calor': [
      { key: 'mass', label: 'Massa (m)',       unit: 'kg', min: 0.1, max: 2.0, step: 0.1, default: 0.5  },
      { key: 'dQdt', label: 'Potência (P)',    unit: 'W',  min: 10,  max: 500, step: 10,  default: 100  },
      { key: 'T0',   label: 'T inicial (T₀)',  unit: '°C', min: 0,   max: 50,  step: 1,   default: 20   },
    ],
    'pendulum-observe': [
      { key: 'length', label: 'Comprimento (L)', unit: 'm',   min: 0.2, max: 2.0, step: 0.1,  default: 1.0 },
      { key: 'angle',  label: 'Ângulo inicial',  unit: 'rad', min: 0.1, max: 0.8, step: 0.05, default: 0.6 },
    ],
    'units-demo': [],
  };

  const defs = controlDefs[exp.simulation] ?? [];
  if (defs.length === 0) {
    container.innerHTML = '<p class="text-muted" style="font-size:0.8rem">Observe a simulação.</p>';
    return;
  }

  container.innerHTML = '';

  /* Track toggle state for conditional controls */
  const toggleState = {};

  for (const def of defs) {
    if (def.type === 'toggle') {
      toggleState[def.key] = def.default ?? false;
    }
  }

  function refreshConditionals() {
    container.querySelectorAll('[data-show-when]').forEach(el => {
      const key = el.dataset.showWhen;
      el.style.display = toggleState[key] ? '' : 'none';
    });
  }

  for (const def of defs) {
    const wrapper = document.createElement('div');
    wrapper.className = 'control-group';
    wrapper.style.marginBottom = '12px';
    if (def.showWhen) wrapper.dataset.showWhen = def.showWhen;

    if (def.type === 'toggle') {
      const checked = (def.default ?? false) ? 'checked' : '';
      wrapper.innerHTML = `
        <div class="toggle-group">
          <label class="toggle-label" for="ctrl-${def.key}">${def.label}</label>
          <label class="toggle" aria-label="${def.label}">
            <input type="checkbox" id="ctrl-${def.key}" ${checked}>
            <span class="toggle__track"></span>
          </label>
        </div>
      `;
      const input = wrapper.querySelector('input');
      input.addEventListener('change', () => {
        const val = input.checked;
        toggleState[def.key] = val;
        simulation.setParam(def.key, val);
        refreshConditionals();
      });
    } else {
      const val = def.default ?? (def.min + def.max) / 2;
      wrapper.innerHTML = `
        <div class="control-label">
          <span class="control-label__name">${def.label}</span>
          <span>
            <span class="control-label__value" id="val-${def.key}">${val}</span>
            <span class="control-label__unit">${def.unit ?? ''}</span>
          </span>
        </div>
        <input type="range"
          id="ctrl-${def.key}"
          min="${def.min}" max="${def.max}" step="${def.step ?? 1}"
          value="${val}"
          aria-label="${def.label}">
      `;
      const input  = wrapper.querySelector('input');
      const valEl  = wrapper.querySelector(`#val-${def.key}`);
      input.addEventListener('input', () => {
        const v = parseFloat(input.value);
        valEl.textContent = v;
        simulation.setParam(def.key, v);
      });
    }

    container.appendChild(wrapper);
  }

  refreshConditionals();
}

/* ─────────────────────────────────────────────────────────────────────────── *
 * HTML builders for info panel
 * ─────────────────────────────────────────────────────────────────────────── */

function _buildQuestionHTML(exp) {
  const text = exp.guidingQuestion ?? exp.question;
  if (!text) return '';
  return `
    <div class="question-block">
      <span class="question-block__label">Pergunta orientadora</span>
      <p class="question-block__text">${text}</p>
    </div>
  `;
}

function _buildEquationsHTML(equations) {
  if (!equations || equations.length === 0) return '';

  const itemsHtml = equations.map(eq => {
    /* Render the equation body — prefer latex, fall back to display */
    const mathHtml = eq.latex
      ? renderLatex(eq.latex)
      : (eq.display ?? '');

    /* Variable legend rows */
    const varsHtml = Object.entries(eq.variables ?? {}).map(([sym, v]) => `
      <div class="eq-var">
        <span class="eq-var__sym">${renderLatex(sym)}</span>
        <span class="eq-var__name">${v.name}</span>
        ${v.unit ? `<span class="eq-var__unit">[${v.unit}]</span>` : ''}
      </div>
    `).join('');

    /* Contextual metadata */
    const metaHtml = (eq.when_to_use || eq.restriction) ? `
      <div class="eq-meta">
        ${eq.when_to_use  ? `<span class="eq-meta__when">Usar quando: ${eq.when_to_use}</span>` : ''}
        ${eq.restriction  ? `<span class="eq-meta__restrict">Restrição: ${eq.restriction}</span>` : ''}
      </div>
    ` : '';

    return `
      <div class="eq-panel__item">
        <div class="equation">${mathHtml}</div>
        ${varsHtml ? `<div class="eq-panel__vars">${varsHtml}</div>` : ''}
        ${metaHtml}
      </div>
    `;
  }).join('');

  return `
    <div class="eq-panel">
      <div class="eq-panel__title">Equações</div>
      ${itemsHtml}
    </div>
  `;
}

function _buildExerciseHTML(ex) {
  if (!ex) return '';
  const optionsHtml = ex.options
    ? ex.options.map((opt, i) => `
        <button class="exercise-option" data-index="${i}" data-value="${opt}">
          <span>${opt}</span>
        </button>
      `).join('')
    : '';

  return `
    <div class="exercise-block">
      <div class="exercise-block__header">
        <span class="exercise-block__num">Exercício</span>
        <span class="exercise-block__type">${ex.type ?? 'aplicação'}</span>
      </div>
      <div class="exercise-block__body">
        <p class="exercise-block__question">${ex.question}</p>
        ${optionsHtml ? `<div class="exercise-options">${optionsHtml}</div>` : ''}
        <div class="btn-group" style="flex-wrap:wrap;gap:8px">
          <button class="exercise-hint-btn" id="ex-hint-btn">Ver dica</button>
          ${!ex.options ? `<button class="btn btn--primary btn--sm" id="ex-check-btn">Ver resposta</button>` : ''}
        </div>
        <div id="ex-hint" class="exercise-hint hidden">${ex.hint ?? ''}</div>
        <div id="ex-explanation" class="exercise-explanation hidden"></div>
      </div>
    </div>
  `;
}

function _buildTeacherHTML(exp) {
  /* variables is an array of objects {key, label, unit, …} */
  const vars = Array.isArray(exp.variables) ? exp.variables : [];
  const mainVar  = vars[0]?.label ?? '—';
  const allVars  = vars.map(v => v.label ?? v.key ?? '?').join(', ') || '—';

  return `
    <div class="teacher-panel">
      <div class="teacher-panel__header">Modo Professor</div>
      <div class="teacher-panel__row">
        <span class="teacher-panel__key">Variável principal</span>
        <span class="teacher-panel__val">${mainVar}</span>
      </div>
      <div class="teacher-panel__row">
        <span class="teacher-panel__key">Grandezas</span>
        <span class="teacher-panel__val">${allVars}</span>
      </div>
      <div class="teacher-panel__row">
        <span class="teacher-panel__key">Duração estimada</span>
        <span class="teacher-panel__val">${exp.duration_min ?? '?'} min</span>
      </div>
    </div>
  `;
}

/* ─────────────────────────────────────────────────────────────────────────── *
 * Exercise interaction handlers
 * ─────────────────────────────────────────────────────────────────────────── */

function _attachExerciseHandlers(container, ex) {
  const hintBtn  = container.querySelector('#ex-hint-btn');
  const checkBtn = container.querySelector('#ex-check-btn');
  const hintEl   = container.querySelector('#ex-hint');
  const explEl   = container.querySelector('#ex-explanation');
  const options  = container.querySelectorAll('.exercise-option');

  const listeners = [];

  if (hintBtn && hintEl) {
    const fn = () => hintEl.classList.toggle('hidden');
    hintBtn.addEventListener('click', fn);
    listeners.push(() => hintBtn.removeEventListener('click', fn));
  }

  if (checkBtn && explEl) {
    const fn = () => {
      explEl.textContent = ex.explanation ?? 'Ver resolução no material.';
      explEl.classList.remove('hidden');
      markExerciseSolved(ex.id);
    };
    checkBtn.addEventListener('click', fn);
    listeners.push(() => checkBtn.removeEventListener('click', fn));
  }

  options.forEach(btn => {
    const fn = () => {
      options.forEach(b => b.classList.remove('selected', 'correct', 'wrong'));
      const val = btn.dataset.value;
      if (val === ex.answer) {
        btn.classList.add('correct');
        markExerciseSolved(ex.id);
        if (explEl) {
          explEl.textContent = ex.explanation ?? '';
          explEl.classList.remove('hidden');
        }
      } else {
        btn.classList.add('wrong');
      }
    };
    btn.addEventListener('click', fn);
    listeners.push(() => btn.removeEventListener('click', fn));
  });

  return () => listeners.forEach(fn => fn());
}

/* ─────────────────────────────────────────────────────────────────────────── *
 * SVG icons
 * ─────────────────────────────────────────────────────────────────────────── */

function _svgPlay()  { return `<svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor"><polygon points="2,1 11,6 2,11"/></svg>`; }
function _svgPause() { return `<svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor"><rect x="2" y="1" width="3" height="10"/><rect x="7" y="1" width="3" height="10"/></svg>`; }
function _svgReset() { return `<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M10 6A4 4 0 1 1 6 2"/><polyline points="6,0 8,2 6,4"/></svg>`; }

/* ─────────────────────────────────────────────────────────────────────────── *
 * Helpers
 * ─────────────────────────────────────────────────────────────────────────── */

function _difficultyLabel(d) {
  return d === 1 ? 'Introdutório' : d === 2 ? 'Intermediário' : 'Avançado';
}

export { renderHome, renderModule, renderExperiment };
