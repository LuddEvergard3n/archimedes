/**
 * wasm-loader.js — Carrega motor físico C/WASM com fallback JS puro.
 *
 * Compilado com clang --target=wasm32 (sem libc/WASI).
 * O módulo importa sin/cos/sqrt/fabs do host JS via env.*.
 *
 * Step functions escrevem resultados em ponteiro de saída na memória linear
 * WASM; JS lê via Float64Array sobre memory.buffer.
 *
 * PhysicsFallback — JS puro, API idêntica ao WASM.
 * Ativado automaticamente quando WASM falha ou não está disponível.
 */

import { setState } from './state.js';

/* ─────────────────────────────────────────────────────────────────────────── *
 * Pure-JS fallback
 * ─────────────────────────────────────────────────────────────────────────── */

const PhysicsFallback = {
  /* Movimento */
  motion_position(x0, v0, a, t)  { return x0 + v0*t + 0.5*a*t*t; },
  motion_velocity(v0, a, t)      { return v0 + a*t; },
  motion_step(x, v, a, dt)       { return { x: x+v*dt, v: v+a*dt }; },

  /* Forças */
  forces_acceleration(F, m)      { return m<=0 ? 0 : F/m; },
  forces_friction(N, mu_k)       { return mu_k*Math.abs(N); },
  forces_weight(m, g)            { return m*g; },
  forces_step(x, v, F, m, mu_k, N, hasFric, dt) {
    let f = 0;
    if (hasFric) {
      const fmag = mu_k*Math.abs(N);
      if (Math.abs(v) > 1e-4) {
        f = -Math.sign(v)*fmag;
      } else {
        if (Math.abs(F) <= mu_k*1.2*Math.abs(N)) return { x, v:0 };
        f = -Math.sign(F)*fmag;
      }
    }
    if (m<=0) return { x, v };
    const a = (F+f)/m;
    return { x: x+v*dt, v: v+a*dt };
  },

  /* Energia */
  energy_kinetic(m, v)           { return 0.5*m*v*v; },
  energy_potential(m, g, h)      { return m*g*Math.max(0,h); },
  energy_work(F, d, cosT)        { return F*d*cosT; },
  energy_ramp_step(s, v, maxS, ang, m, mu_k, hasFric, g, dt) {
    const sinA = Math.sin(ang), cosA = Math.cos(ang);
    const a    = g*sinA - (hasFric ? mu_k*g*cosA : 0);
    let vn = v+a*dt, sn = s+v*dt;
    if (sn>=maxS) { sn=maxS; vn=Math.max(0,vn); }
    if (sn<0)     { sn=0;    vn=0; }
    return { s:sn, v:vn, height:(maxS-sn)*sinA };
  },

  /* Fluidos */
  fluids_buoyancy(rhoF, g, V)    { return rhoF*g*V; },
  fluids_net_force(E, P)         { return E-P; },
  fluids_pressure(P0, rho, g, h) { return P0+rho*g*h; },
  fluids_equilibrium_fraction(rhoObj, rhoF) {
    return rhoF<=0 ? 1 : Math.min(rhoObj/rhoF, 1);
  },
  fluids_object_step(y, v, rhoObj, h, vol, rhoF, g, dt, fluidTop, cBottom) {
    const mass = rhoObj*vol;
    if (mass<=0) return { y, v:0, submerged_fraction:0 };
    const subFrac = Math.min(Math.max((fluidTop-(y-h/2))/h, 0), 1);
    const E  = rhoF*g*subFrac*vol;
    const P  = mass*g;
    const a  = (E-P)/mass;
    let vn = (v+a*dt)*0.97;
    let yn = y+v*dt;
    if (yn < cBottom+h/2) { yn = cBottom+h/2; vn=0; }
    return { y:yn, v:vn, submerged_fraction:subFrac };
  },

  /* Ondas */
  waves_displacement(A, k, x, w, t, phi) { return A*Math.sin(k*x - w*t + phi); },
  waves_speed(f, lam)            { return f*lam; },
  waves_period(f)                { return f>0 ? 1/f : 0; },
  waves_pendulum_period(L, g)    { return L>0&&g>0 ? 2*Math.PI*Math.sqrt(L/g) : 0; },
  waves_spring_period(m, k)      { return m>0&&k>0 ? 2*Math.PI*Math.sqrt(m/k) : 0; },
  waves_superposition(A1,k1,w1,A2,k2,w2,phi,x,t) {
    return A1*Math.sin(k1*x-w1*t) + A2*Math.sin(k2*x-w2*t+phi);
  },
  waves_mhs_step(x, v, omega, dt) {
    /* Velocity Verlet — symplectically stable, conserves energy exactly.
     * Euler explícito diverge em ~60s com dt=1/60. */
    const a0 = -(omega * omega) * x;
    const v_half = v + a0 * dt * 0.5;
    const x_new  = x + v_half * dt;
    const a1 = -(omega * omega) * x_new;
    const v_new  = v_half + a1 * dt * 0.5;
    return { x: x_new, v: v_new };
  },
  waves_pendulum_step(theta, omegaAng, L, g, dt) {
    if (L<=0) return { theta, omega: omegaAng };
    /* Velocity Verlet — symplectically stable for nonlinear pendulum */
    const alpha0  = -(g/L)*Math.sin(theta);
    const om_half = omegaAng + alpha0*dt*0.5;
    const th_new  = theta + om_half*dt;
    const alpha1  = -(g/L)*Math.sin(th_new);
    const om_new  = om_half + alpha1*dt*0.5;
    return { theta: th_new, omega: om_new };
  },

  /* Termodinâmica */
  thermo_pressure(V, n, T)           { return V>0 ? (n*8.314*T)/V : 0; },
  thermo_gay_lussac(P1, T1, T2)      { return T1>0 ? P1*T2/T1 : 0; },
  thermo_boyle(P1, V1, P2)           { return P2>0 ? (P1*V1)/P2 : 0; },
  thermo_charles(V1, T1, T2)         { return T1>0 ? V1*T2/T1 : 0; },
  thermo_heat(m, c, dT)              { return m*c*dT; },
  thermo_celsius_to_kelvin(C)        { return C+273.15; },
};

/* ─────────────────────────────────────────────────────────────────────────── *
 * Import object para o módulo WASM compilado com clang --allow-undefined
 *
 * O módulo C declara extern double sin/cos/sqrt/fabs e recebe-as via env.*.
 * ─────────────────────────────────────────────────────────────────────────── */

function _importObject() {
  return {
    env: {
      sin:  (x) => Math.sin(x),
      cos:  (x) => Math.cos(x),
      sqrt: (x) => Math.sqrt(x),
      fabs: (x) => Math.abs(x),
    },
  };
}

/* ─────────────────────────────────────────────────────────────────────────── *
 * WASM interface builder
 * ─────────────────────────────────────────────────────────────────────────── */

const OUT = 65536; /* offset fixo: acima do stack de 64 KB */

function _buildWasmInterface(e) {
  const m64 = () => new Float64Array(e.memory.buffer);
  const i   = OUT / 8;

  return {
    /* Escalares — passagem direta */
    motion_position:             e.motion_position,
    motion_velocity:             e.motion_velocity,
    forces_acceleration:         e.forces_acceleration,
    forces_friction:             e.forces_friction,
    forces_weight:               e.forces_weight,
    energy_kinetic:              e.energy_kinetic,
    energy_potential:            e.energy_potential,
    energy_work:                 e.energy_work,
    fluids_buoyancy:             e.fluids_buoyancy,
    fluids_net_force:            e.fluids_net_force,
    fluids_pressure:             e.fluids_pressure,
    fluids_equilibrium_fraction: e.fluids_equilibrium_fraction,
    waves_displacement:          e.waves_displacement,
    waves_speed:                 e.waves_speed,
    waves_period:                e.waves_period,
    waves_pendulum_period:       e.waves_pendulum_period,
    waves_spring_period:         e.waves_spring_period,
    waves_superposition:         e.waves_superposition,
    thermo_pressure:             e.thermo_pressure,
    thermo_gay_lussac:           e.thermo_gay_lussac,
    thermo_boyle:                e.thermo_boyle,
    thermo_charles:              e.thermo_charles,
    thermo_heat:                 e.thermo_heat,
    thermo_celsius_to_kelvin:    e.thermo_celsius_to_kelvin,

    /* Step functions — via ponteiro de saída */
    motion_step(x, v, a, dt) {
      e.motion_step(x, v, a, dt, OUT);
      const m = m64(); return { x:m[i], v:m[i+1] };
    },
    forces_step(x, v, F, mass, mu_k, N, hasFric, dt) {
      e.forces_step(x, v, F, mass, mu_k, N, hasFric?1:0, dt, OUT);
      const m = m64(); return { x:m[i], v:m[i+1] };
    },
    energy_ramp_step(s, v, maxS, ang, mass, mu_k, hasFric, g, dt) {
      e.energy_ramp_step(s, v, maxS, ang, mass, mu_k, hasFric?1:0, g, dt, OUT);
      const m = m64(); return { s:m[i], v:m[i+1], height:m[i+2] };
    },
    fluids_object_step(y, v, rhoObj, h, vol, rhoF, g, dt, fluidTop, cBottom) {
      e.fluids_object_step(y, v, rhoObj, h, vol, rhoF, g, dt, fluidTop, cBottom, OUT);
      const m = m64(); return { y:m[i], v:m[i+1], submerged_fraction:m[i+2] };
    },
    waves_mhs_step(x, v, omega, dt) {
      e.waves_mhs_step(x, v, omega, dt, OUT);
      const m = m64(); return { x:m[i], v:m[i+1] };
    },
    waves_pendulum_step(theta, omegaAng, L, g, dt) {
      e.waves_pendulum_step(theta, omegaAng, L, g, dt, OUT);
      const m = m64(); return { theta:m[i], omega:m[i+1] };
    },
  };
}

/* ─────────────────────────────────────────────────────────────────────────── *
 * API pública
 * ─────────────────────────────────────────────────────────────────────────── */

let Physics = PhysicsFallback;

/**
 * Inicializa o motor físico.
 * Tenta carregar physics_engine.wasm; usa PhysicsFallback automaticamente.
 * @returns {Promise<boolean>} true se WASM carregou com sucesso.
 */
async function initPhysics() {
  if (typeof WebAssembly === 'undefined') {
    setState('wasmLoaded', false);
    return false;
  }
  try {
    const url  = new URL('../wasm/physics_engine.wasm', import.meta.url);
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

    const bytes = await resp.arrayBuffer();
    const { instance } = await WebAssembly.instantiate(bytes, _importObject());

    /* Inicializar globals do módulo emitidos pelo clang */
    if (typeof instance.exports.__wasm_call_ctors === 'function') {
      instance.exports.__wasm_call_ctors();
    }

    Physics = _buildWasmInterface(instance.exports);
    setState('wasmLoaded', true);
    console.info('[wasm] Motor físico WASM ativo.');
    return true;
  } catch (err) {
    console.info(`[wasm] Fallback JS (${err.message}).`);
    setState('wasmLoaded', false);
    return false;
  }
}

export { initPhysics, Physics, PhysicsFallback };
