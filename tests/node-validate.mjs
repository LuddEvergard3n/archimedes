/** Minimal deterministic validation for data and the JavaScript physics fallback. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const nativeFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = String(input);
  if (url.startsWith('file:')) return new Response(await readFile(new URL(url)), { status: 200 });
  return nativeFetch(input, init);
};

const { PhysicsFallback } = await import('../js/wasm-loader.js');
const state = await import('../js/state.js');
await state.loadData();

const modules = state.getState('modules');
const experiments = state.getState('experiments');
const lessons = state.getState('lessons');
const exercises = state.getState('exercises');
const moduleIds = new Set(modules.map(module => module.id));
const experimentIds = experiments.map(experiment => experiment.id);
const expanded = experiments.filter(experiment => ['gravitation', 'tecnologia', 'nuclear', 'ambiente'].includes(experiment.module));

assert.equal(modules.length, 14, 'catalogue must contain fourteen modules');
assert.equal(experiments.length, 57, 'catalogue must contain fifty-seven experiences');
assert.equal(lessons.length, 56, 'every added experience must have a lesson');
assert.equal(exercises.length, 97, 'every added experience must have guided practice');
assert.equal(new Set(experimentIds).size, experimentIds.length, 'experiment IDs must be unique');
assert.equal(expanded.length, 16, 'four modules must add sixteen experiences');
assert.ok(experiments.every(experiment => moduleIds.has(experiment.module)), 'experiments must reference a module');
assert.ok(exercises.every(exercise => exercise.module && exercise.answer !== undefined), 'exercises must preserve module and answer contracts');
assert.ok(expanded.every(experiment => experiment.sources?.length && experiment.lastReviewed), 'added experiences need sources and review dates');
assert.equal(PhysicsFallback.energy_kinetic(2, 3), 9, 'kinetic-energy fallback must remain correct');
assert.equal(PhysicsFallback.fluids_buoyancy(1000, 9.8, 0.001), 9.8, 'buoyancy fallback must remain correct');
const serviceWorker = await readFile(new URL('../sw.js', import.meta.url), 'utf8');
for (const asset of ['./js/progress.js', './js/eq-renderer.js', './modules/contemporary/contemporary.js', './data/v5-content.json']) {
  assert.ok(serviceWorker.includes(asset), `offline shell must include ${asset}`);
}
const theme = await readFile(new URL('../css/theme.css', import.meta.url), 'utf8');
assert.ok(theme.includes('--electric-blue:        #1d4e9e'), 'theme must retain the field-notebook palette');
const manifest = JSON.parse(await readFile(new URL('../manifest.json', import.meta.url), 'utf8'));
assert.equal(manifest.theme_color, '#18304f', 'PWA must use the field-notebook theme color');

console.log(`Validated ${modules.length} modules, ${experiments.length} experiences, ${lessons.length} lessons, and ${exercises.length} exercises.`);
