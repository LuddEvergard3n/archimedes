/**
 * state.js — Observable state store for Archimedes
 *
 * Simple pub/sub pattern. No framework dependency.
 * All application state lives here; modules read and write through this API.
 */

/** @type {Map<string, Set<Function>>} */
const _listeners = new Map();

/** @type {Object} Application state */
const _state = {
  /* Navigation */
  route: { module: null, experiment: null },
  sidebarOpen: false,

  /* UI mode */
  teacherMode: false,
  fontSize: 'base',       /* 'sm' | 'base' | 'lg' */
  highContrast: false,

  /* WASM status */
  wasmLoaded: false,
  wasmError: null,

  /* Data cache */
  modules: [],
  experiments: [],
  lessons: [],
  exercises: [],
  equations: [],

  /* Active simulation state (per-module, ephemeral) */
  simulation: {
    running: false,
    time: 0,
    params: {},
  },

  /* Active lesson progress */
  lessonPhase: 'phenomenon',  /* phenomenon | experiment | observation | formalization | exercise */
  exerciseState: {
    id: null,
    answered: false,
    correct: null,
    selectedOption: null,
    showHint: false,
  },
};

/**
 * Get a deep clone of a state path.
 * @param {string} [path] — dot-separated path, or empty for full state
 * @returns {*}
 */
function getState(path) {
  if (!path) return structuredClone(_state);
  const keys = path.split('.');
  let val = _state;
  for (const k of keys) {
    if (val == null) return undefined;
    val = val[k];
  }
  /* Return a shallow copy of objects to prevent direct mutation. */
  if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
    return { ...val };
  }
  return val;
}

/**
 * Update state and notify subscribers.
 * @param {string} path — dot-separated path to updated property
 * @param {*} value — new value
 */
function setState(path, value) {
  const keys = path.split('.');
  let target = _state;
  for (let i = 0; i < keys.length - 1; i++) {
    if (target[keys[i]] == null || typeof target[keys[i]] !== 'object') {
      target[keys[i]] = {};
    }
    target = target[keys[i]];
  }
  const lastKey = keys[keys.length - 1];
  const prev = target[lastKey];
  target[lastKey] = value;

  _notify(path, value, prev);

  /* Notify parent paths for cascading subscriptions */
  const parts = path.split('.');
  for (let i = parts.length - 1; i > 0; i--) {
    _notify(parts.slice(0, i).join('.'), null, null);
  }
}

/**
 * Merge a partial object into a state path.
 * @param {string} path
 * @param {Object} partial
 */
function mergeState(path, partial) {
  const current = getState(path);
  setState(path, { ...current, ...partial });
}

/**
 * Subscribe to changes on a state path.
 * @param {string} path
 * @param {Function} callback — (newValue, prevValue) => void
 * @returns {Function} unsubscribe function
 */
function subscribe(path, callback) {
  if (!_listeners.has(path)) {
    _listeners.set(path, new Set());
  }
  _listeners.get(path).add(callback);
  return () => {
    const set = _listeners.get(path);
    if (set) set.delete(callback);
  };
}

/**
 * @param {string} path
 * @param {*} newValue
 * @param {*} prevValue
 */
function _notify(path, newValue, prevValue) {
  const set = _listeners.get(path);
  if (!set || set.size === 0) return;
  for (const fn of set) {
    try {
      fn(newValue, prevValue);
    } catch (err) {
      console.error(`[state] Listener error on path "${path}":`, err);
    }
  }
}

/**
 * Load JSON data files into state.
 * @returns {Promise<void>}
 */
async function loadData() {
  const files = [
    ['modules',     'data/modules.json'],
    ['experiments', 'data/experiments.json'],
    ['lessons',     'data/lessons.json'],
    ['exercises',   'data/exercises.json'],
    ['equations',   'data/equations.json'],
  ];

  const results = await Promise.allSettled(
    files.map(([, path]) => fetch(path).then(r => {
      if (!r.ok) throw new Error(`HTTP ${r.status} fetching ${path}`);
      return r.json();
    }))
  );

  for (let i = 0; i < files.length; i++) {
    const [key] = files[i];
    const result = results[i];
    if (result.status === 'fulfilled') {
      /* Each JSON file has a top-level key matching the filename */
      const data = result.value;
      const topKey = Object.keys(data)[0]; /* e.g. "modules", "experiments" */
      setState(key, data[topKey] ?? []);
    } else {
      console.error(`[state] Failed to load ${files[i][1]}:`, result.reason);
      setState(key, []);
    }
  }
}

/**
 * Shorthand: get a module by ID
 * @param {string} id
 * @returns {Object|undefined}
 */
function getModule(id) {
  return _state.modules.find(m => m.id === id);
}

/**
 * Shorthand: get an experiment by ID
 * @param {string} id
 * @returns {Object|undefined}
 */
function getExperiment(id) {
  return _state.experiments.find(e => e.id === id);
}

/**
 * Shorthand: get experiments by module ID
 * @param {string} moduleId
 * @returns {Object[]}
 */
function getExperimentsByModule(moduleId) {
  return _state.experiments.filter(e => e.module === moduleId);
}

/**
 * Shorthand: get a lesson by ID
 * @param {string} id
 * @returns {Object|undefined}
 */
function getLesson(id) {
  return _state.lessons.find(l => l.id === id);
}

/**
 * Shorthand: get exercises for an experiment
 * @param {string} experimentId
 * @returns {Object[]}
 */
function getExercisesByExperiment(experimentId) {
  return _state.exercises.filter(ex => ex.experiment_id === experimentId);
}

/**
 * Shorthand: get equations for an experiment
 * @param {string} experimentId
 * @returns {Object[]}
 */
function getEquationsByExperiment(experimentId) {
  return _state.equations.filter(eq =>
    eq.experiment_ids && eq.experiment_ids.includes(experimentId)
  );
}

export {
  getState,
  setState,
  mergeState,
  subscribe,
  loadData,
  getModule,
  getExperiment,
  getExperimentsByModule,
  getLesson,
  getExercisesByExperiment,
  getEquationsByExperiment,
};
