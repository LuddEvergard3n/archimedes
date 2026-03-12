/**
 * test-runner.js — Archimedes automated test suite
 *
 * Tests:
 *   - JSON data integrity
 *   - Physics fallback functions (numerical correctness)
 *   - Module loader
 *   - State store
 *
 * Run in browser: open tests/test-runner.html
 * Run in Node.js: not supported (browser ES module)
 *
 * Output: DOM-based test report with pass/fail per assertion.
 */

import { PhysicsFallback } from '../js/wasm-loader.js';
import { getState, setState, subscribe, mergeState } from '../js/state.js';

/* ── Minimal test framework ──────────────────────── */

let _passed = 0;
let _failed = 0;
const _results = [];

/**
 * Assert two values are approximately equal.
 * @param {string} label
 * @param {number} actual
 * @param {number} expected
 * @param {number} [tolerance=1e-9]
 */
function assertApprox(label, actual, expected, tolerance = 1e-9) {
  const diff = Math.abs(actual - expected);
  const ok   = diff <= tolerance;
  _record(label, ok, `expected ≈${expected}, got ${actual} (diff=${diff})`);
}

/**
 * Assert a boolean condition.
 * @param {string} label
 * @param {boolean} condition
 * @param {string} [note]
 */
function assertTrue(label, condition, note = '') {
  _record(label, !!condition, note);
}

function assertEqual(label, actual, expected) {
  _record(label, actual === expected, `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

function _record(label, ok, note) {
  if (ok) _passed++; else _failed++;
  _results.push({ label, ok, note });
}

/* ─────────────────────────────────────────────────────────────────────────── *
 * Physics fallback tests
 * ─────────────────────────────────────────────────────────────────────────── */

function testMotion() {
  /* motion_position */
  assertApprox('motion_position: x=0,v=5,a=0,t=2 → 10',
    PhysicsFallback.motion_position(0, 5, 0, 2), 10);

  assertApprox('motion_position: x=0,v=0,a=2,t=3 → 9',
    PhysicsFallback.motion_position(0, 0, 2, 3), 9);

  assertApprox('motion_position: x=5,v=3,a=0,t=4 → 17',
    PhysicsFallback.motion_position(5, 3, 0, 4), 17);

  /* motion_velocity */
  assertApprox('motion_velocity: v0=0,a=9.8,t=2 → 19.6',
    PhysicsFallback.motion_velocity(0, 9.8, 2), 19.6);

  assertApprox('motion_velocity: v0=10,a=-2,t=5 → 0',
    PhysicsFallback.motion_velocity(10, -2, 5), 0);

  /* motion_step */
  const step = PhysicsFallback.motion_step(0, 5, 0, 1);
  assertApprox('motion_step: x=0,v=5,a=0,dt=1 → x=5', step.x, 5);
  assertApprox('motion_step: x=0,v=5,a=0,dt=1 → v=5', step.v, 5);

  const step2 = PhysicsFallback.motion_step(0, 0, 2, 1);
  assertApprox('motion_step: x=0,v=0,a=2,dt=1 → v=2', step2.v, 2);
}

function testForces() {
  /* acceleration */
  assertApprox('forces_acceleration: F=30,m=5 → 6',
    PhysicsFallback.forces_acceleration(30, 5), 6);

  assertApprox('forces_acceleration: m=0 → 0 (guard)',
    PhysicsFallback.forces_acceleration(100, 0), 0);

  /* friction */
  assertApprox('forces_friction: N=40,μk=0.3 → 12',
    PhysicsFallback.forces_friction(40, 0.3), 12);

  /* weight */
  assertApprox('forces_weight: m=4,g=10 → 40',
    PhysicsFallback.forces_weight(4, 10), 40);

  /* forces_step — frictionless */
  const s1 = PhysicsFallback.forces_step(0, 0, 20, 5, 0, 49, false, 0.1);
  assertApprox('forces_step frictionless: a=4, v after dt=0.1 → 0.4',
    s1.v, 0.4, 1e-6);

  /* forces_step — with friction, body stationary and force < static limit */
  const s2 = PhysicsFallback.forces_step(0, 0, 5, 4, 0.3, 40, true, 0.1);
  assertEqual('forces_step static equilibrium: v stays 0', s2.v, 0);
}

function testEnergy() {
  assertApprox('energy_kinetic: m=1000,v=20 → 200000',
    PhysicsFallback.energy_kinetic(1000, 20), 200000);

  assertApprox('energy_kinetic: v=0 → 0',
    PhysicsFallback.energy_kinetic(5, 0), 0);

  assertApprox('energy_potential: m=2,g=9.8,h=5 → 98',
    PhysicsFallback.energy_potential(2, 9.8, 5), 98);

  assertApprox('energy_potential: h=-1 clamped to 0',
    PhysicsFallback.energy_potential(2, 9.8, -1), 0);

  assertApprox('energy_work: F=10,d=5,cos=1 → 50',
    PhysicsFallback.energy_work(10, 5, 1), 50);

  /* Energy conservation on frictionless ramp */
  const g    = 9.8;
  const mass = 2;
  const h0   = 5;
  const ep0  = PhysicsFallback.energy_potential(mass, g, h0);

  /* Simulate full slide down */
  let s = 0, v = 0;
  const rampLen = 10;
  const angle   = 30 * Math.PI / 180;
  const dt      = 0.001;
  for (let i = 0; i < 5000; i++) {
    const r = PhysicsFallback.energy_ramp_step(s, v, rampLen, angle, mass, 0, false, g, dt);
    s = r.s; v = r.v;
    if (s >= rampLen) break;
  }
  const ecFinal = PhysicsFallback.energy_kinetic(mass, v);
  assertApprox('Energy conservation on frictionless ramp: Ec_final ≈ Ep0',
    ecFinal, ep0, ep0 * 0.02 /* 2% tolerance for integration error */);
}

function testFluids() {
  assertApprox('fluids_buoyancy: ρ=1000,g=9.8,V=0.001 → 9.8',
    PhysicsFallback.fluids_buoyancy(1000, 9.8, 0.001), 9.8);

  assertApprox('fluids_net_force: E=10,P=8 → 2',
    PhysicsFallback.fluids_net_force(10, 8), 2);

  assertApprox('fluids_pressure: P0=101325,ρ=1025,g=10,h=10 → 203825',
    PhysicsFallback.fluids_pressure(101325, 1025, 10, 10), 203825);

  assertApprox('fluids_equilibrium_fraction: ρ_obj=700,ρ_f=1000 → 0.7',
    PhysicsFallback.fluids_equilibrium_fraction(700, 1000), 0.7);

  assertApprox('fluids_equilibrium_fraction: ρ_obj=1500,ρ_f=1000 → 1.0 (sinks)',
    PhysicsFallback.fluids_equilibrium_fraction(1500, 1000), 1.0);

  assertApprox('fluids_equilibrium_fraction: ρ_f=0 guard → 1.0',
    PhysicsFallback.fluids_equilibrium_fraction(500, 0), 1.0);
}

/* ─────────────────────────────────────────────────────────────────────────── *
 * State store tests
 * ─────────────────────────────────────────────────────────────────────────── */

function testState() {
  /* Basic set/get */
  setState('_test.value', 42);
  assertEqual('state set/get', getState('_test.value'), 42);

  /* Nested path */
  setState('_test.nested.deep', 'hello');
  assertEqual('state nested path', getState('_test.nested.deep'), 'hello');

  /* mergeState */
  setState('_test.obj', { a: 1, b: 2 });
  mergeState('_test.obj', { b: 99, c: 3 });
  const merged = getState('_test.obj');
  assertEqual('mergeState: a preserved', merged.a, 1);
  assertEqual('mergeState: b updated',   merged.b, 99);
  assertEqual('mergeState: c added',     merged.c, 3);

  /* Subscribe */
  let callCount = 0;
  const unsub = subscribe('_test.counter', () => callCount++);
  setState('_test.counter', 1);
  setState('_test.counter', 2);
  assertEqual('subscribe: called on each change', callCount, 2);
  unsub();
  setState('_test.counter', 3);
  assertEqual('unsubscribe: not called after unsub', callCount, 2);
}

/* ─────────────────────────────────────────────────────────────────────────── *
 * JSON data integrity tests (run after loadData)
 * ─────────────────────────────────────────────────────────────────────────── */

function testDataIntegrity() {
  const modules     = getState('modules');
  const experiments = getState('experiments');
  const lessons     = getState('lessons');
  const exercises   = getState('exercises');
  const equations   = getState('equations');

  assertTrue('modules loaded', modules.length > 0);
  assertTrue('experiments loaded', experiments.length > 0);
  assertTrue('lessons loaded', lessons.length > 0);
  assertTrue('exercises loaded', exercises.length > 0);
  assertTrue('equations loaded', equations.length > 0);

  /* Every module has required fields */
  for (const mod of modules) {
    assertTrue(`module ${mod.id}: has title`, !!mod.title);
    assertTrue(`module ${mod.id}: has experiments array`, Array.isArray(mod.experiments));
  }

  /* Every experiment has required fields */
  for (const exp of experiments) {
    assertTrue(`exp ${exp.id}: has module`, !!exp.module);
    assertTrue(`exp ${exp.id}: has simulation`, !!exp.simulation);
    assertTrue(`exp ${exp.id}: has variables`, Array.isArray(exp.variables));
    /* Module referenced in experiment must exist */
    const mod = modules.find(m => m.id === exp.module);
    assertTrue(`exp ${exp.id}: module "${exp.module}" exists`, !!mod);
  }

  /* Every exercise has answer */
  for (const ex of exercises) {
    assertTrue(`exercise ${ex.id}: has answer`, ex.answer !== undefined);
    assertTrue(`exercise ${ex.id}: has module`, !!ex.module);
  }

  /* Every equation has display */
  for (const eq of equations) {
    assertTrue(`equation ${eq.id}: has display`, !!eq.display);
    assertTrue(`equation ${eq.id}: has experiment_ids`, Array.isArray(eq.experiment_ids));
  }
}

/* ─────────────────────────────────────────────────────────────────────────── *
 * Report renderer
 * ─────────────────────────────────────────────────────────────────────────── */

function renderReport(container) {
  const total = _passed + _failed;
  const pct   = total > 0 ? (((_passed / total) * 100).toFixed(1)) : '—';

  container.innerHTML = `
    <div style="font-family:'Share Tech Mono','Courier New',monospace;font-size:13px;padding:24px;color:#e8e0c8;background:#1c1a14;min-height:100vh">
      <h1 style="font-size:18px;font-weight:500;margin-bottom:4px;font-family:'EB Garamond',Georgia,serif;letter-spacing:0.04em">Archimedes — Test Report</h1>
      <p style="color:#7a7060;margin-bottom:24px">
        ${_passed}/${total} passaram (${pct}%) —
        <span style="color:${_failed > 0 ? '#b54a28' : '#3d7a55'}">${_failed} falhas</span>
      </p>
      <div>
        ${_results.map(r => `
          <div style="display:flex;gap:10px;align-items:baseline;padding:4px 0;
                      border-bottom:1px solid rgba(255,255,255,0.04)">
            <span style="color:${r.ok ? '#3d7a55' : '#b54a28'};flex-shrink:0">
              ${r.ok ? 'PASS' : 'FAIL'}
            </span>
            <span style="flex:1">${r.label}</span>
            ${!r.ok ? `<span style="color:#7a7060;font-size:11px">${r.note}</span>` : ''}
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

/* ─────────────────────────────────────────────────────────────────────────── *
 * Entry point
 * ─────────────────────────────────────────────────────────────────────────── */

async function runTests() {
  testMotion();
  testForces();
  testEnergy();
  testFluids();
  testState();

  /* Data tests require loaded data */
  try {
    const { loadData } = await import('../js/state.js');
    await loadData();
    testDataIntegrity();
  } catch (err) {
    _record('loadData', false, err.message);
  }

  const container = document.getElementById('test-output') ?? document.body;
  renderReport(container);

  console.log(`[tests] ${_passed}/${_passed + _failed} passed`);
  return _failed === 0;
}

/* Auto-run if this is the test page */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', runTests);
} else {
  runTests();
}

export { runTests };
