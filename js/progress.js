/**
 * js/progress.js — Student progress tracking via localStorage
 *
 * Tracks two events per student:
 *   - Experiment visited  (user opened the lab view)
 *   - Exercise solved     (user revealed the answer or selected correct option)
 *
 * Storage key: "archimedes_progress"
 * Schema:
 *   {
 *     visitedExperiments: string[],   -- experiment IDs
 *     solvedExercises:    string[],   -- exercise IDs
 *   }
 *
 * All functions are synchronous and pure-read or write-then-return.
 * No side effects beyond localStorage.
 */

const STORAGE_KEY = 'archimedes_progress';

/* ── Internal helpers ─────────────────────────────────────────────── */

/**
 * Read the full progress object from localStorage.
 * Always returns a valid object — never throws.
 * @returns {{ visitedExperiments: string[], solvedExercises: string[] }}
 */
function _load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return _empty();
    const parsed = JSON.parse(raw);
    /* Defensive: ensure expected arrays exist */
    return {
      visitedExperiments: Array.isArray(parsed.visitedExperiments) ? parsed.visitedExperiments : [],
      solvedExercises:    Array.isArray(parsed.solvedExercises)    ? parsed.solvedExercises    : [],
    };
  } catch {
    return _empty();
  }
}

function _empty() {
  return { visitedExperiments: [], solvedExercises: [] };
}

/**
 * Persist the progress object to localStorage.
 * @param {{ visitedExperiments: string[], solvedExercises: string[] }} data
 */
function _save(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* localStorage unavailable (private mode, quota exceeded) — fail silently */
  }
}

/* ── Public API ───────────────────────────────────────────────────── */

/**
 * Mark an experiment as visited. Idempotent.
 * @param {string} experimentId
 */
function markExperimentVisited(experimentId) {
  const data = _load();
  if (!data.visitedExperiments.includes(experimentId)) {
    data.visitedExperiments.push(experimentId);
    _save(data);
  }
}

/**
 * Mark an exercise as solved. Idempotent.
 * @param {string} exerciseId
 */
function markExerciseSolved(exerciseId) {
  const data = _load();
  if (!data.solvedExercises.includes(exerciseId)) {
    data.solvedExercises.push(exerciseId);
    _save(data);
  }
}

/**
 * Check if an experiment has been visited.
 * @param {string} experimentId
 * @returns {boolean}
 */
function isExperimentVisited(experimentId) {
  return _load().visitedExperiments.includes(experimentId);
}

/**
 * Check if an exercise has been solved.
 * @param {string} exerciseId
 * @returns {boolean}
 */
function isExerciseSolved(exerciseId) {
  return _load().solvedExercises.includes(exerciseId);
}

/**
 * Count visited experiments within a given list of experiment IDs.
 * @param {string[]} experimentIds
 * @returns {{ visited: number, total: number }}
 */
function moduleProgress(experimentIds) {
  const data = _load();
  const visited = experimentIds.filter(id => data.visitedExperiments.includes(id)).length;
  return { visited, total: experimentIds.length };
}

/**
 * Count solved exercises within a given list of exercise IDs.
 * @param {string[]} exerciseIds
 * @returns {{ solved: number, total: number }}
 */
function experimentExerciseProgress(exerciseIds) {
  const data = _load();
  const solved = exerciseIds.filter(id => data.solvedExercises.includes(id)).length;
  return { solved, total: exerciseIds.length };
}

/**
 * Return full progress snapshot — used for debug or a summary screen.
 * @returns {{ visitedExperiments: string[], solvedExercises: string[] }}
 */
function getProgress() {
  return _load();
}

/**
 * Wipe all stored progress. Asks for no confirmation — caller is responsible.
 */
function resetProgress() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch { /* ignore */ }
}

export {
  markExperimentVisited,
  markExerciseSolved,
  isExperimentVisited,
  isExerciseSolved,
  moduleProgress,
  experimentExerciseProgress,
  getProgress,
  resetProgress,
};
