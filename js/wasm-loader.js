/**
 * wasm-loader.js — Load C/WASM physics engine with pure-JS fallback
 *
 * Architecture:
 *   1. Attempt to load wasm/physics_engine.wasm via WebAssembly.instantiateStreaming
 *   2. If WASM fails (file absent, browser incompatible), use PhysicsFallback
 *   3. Export a single `Physics` interface identical in both cases
 *
 * The JS fallback implements the same mathematical functions as the C engine,
 * ensuring identical numerical results for all standard simulations.
 *
 * WASM export conventions (from physics_engine.c):
 *   All exported functions are prefixed by module: motion_, forces_, energy_, fluids_
 */

import { setState } from './state.js';

/* ─────────────────────────────────────────────────────────────────────────── *
 * Pure-JS fallback — mirrors the C WASM exports exactly.
 * ─────────────────────────────────────────────────────────────────────────── */

const PhysicsFallback = {
  /* ── Motion ─────────────────────────────────────── */

  /**
   * Position under constant acceleration.
   * x(t) = x₀ + v₀·t + ½·a·t²
   */
  motion_position(x0, v0, a, t) {
    return x0 + v0 * t + 0.5 * a * t * t;
  },

  /**
   * Velocity under constant acceleration.
   * v(t) = v₀ + a·t
   */
  motion_velocity(v0, a, t) {
    return v0 + a * t;
  },

  /**
   * Single integration step (Euler).
   * Updates x and v in-place via returned object.
   * @returns {{ x: number, v: number }}
   */
  motion_step(x, v, a, dt) {
    return {
      x: x + v * dt,
      v: v + a * dt,
    };
  },

  /* ── Forces ─────────────────────────────────────── */

  /**
   * Acceleration from net force and mass.
   * a = F / m
   */
  forces_acceleration(net_force, mass) {
    if (mass <= 0) return 0;
    return net_force / mass;
  },

  /**
   * Kinetic friction force magnitude.
   * f = μk · N
   */
  forces_friction(normal_force, mu_k) {
    return mu_k * Math.abs(normal_force);
  },

  /**
   * Weight force.
   * P = m · g
   */
  forces_weight(mass, g) {
    return mass * g;
  },

  /**
   * Single step for a body on a horizontal surface with applied force and friction.
   * @returns {{ x: number, v: number }}
   */
  forces_step(x, v, applied_force, mass, mu_k, normal, has_friction, dt) {
    /* Friction acts opposite to velocity direction; zero when stationary */
    let friction = 0;
    if (has_friction) {
      const f_mag = mu_k * normal;
      if (Math.abs(v) > 1e-4) {
        friction = -Math.sign(v) * f_mag;
      } else {
        /* Static: friction cancels applied force up to static limit */
        const f_static = mu_k * 1.2 * normal; /* approximate μs ≈ 1.2·μk */
        if (Math.abs(applied_force) <= f_static) {
          return { x, v: 0 };
        }
        friction = -Math.sign(applied_force) * f_mag;
      }
    }
    const net = applied_force + friction;
    const a   = net / mass;
    const vn  = v + a * dt;
    const xn  = x + v * dt;
    return { x: xn, v: vn };
  },

  /* ── Energy ─────────────────────────────────────── */

  /**
   * Kinetic energy.
   * Ec = ½·m·v²
   */
  energy_kinetic(mass, velocity) {
    return 0.5 * mass * velocity * velocity;
  },

  /**
   * Gravitational potential energy.
   * Ep = m·g·h
   */
  energy_potential(mass, g, height) {
    return mass * g * Math.max(0, height);
  },

  /**
   * Work done by a force.
   * W = F·d·cos(θ)
   */
  energy_work(force, displacement, cos_theta) {
    return force * displacement * cos_theta;
  },

  /**
   * Ramp simulation step.
   * Body slides down inclined plane, optionally with kinetic friction.
   * @param {number} s   — distance along ramp from start (m)
   * @param {number} v   — speed along ramp (m/s)
   * @param {number} angle_rad — ramp angle (radians)
   * @param {number} mass — kg
   * @param {number} mu_k — kinetic friction coefficient
   * @param {boolean} has_friction
   * @param {number} g
   * @param {number} dt
   * @returns {{ s: number, v: number, height: number }}
   */
  energy_ramp_step(s, v, max_s, angle_rad, mass, mu_k, has_friction, g, dt) {
    const sin_a = Math.sin(angle_rad);
    const cos_a = Math.cos(angle_rad);

    /* Gravity component along ramp (positive = downward) */
    const g_component = g * sin_a;

    /* Friction component along ramp */
    const friction = has_friction ? mu_k * g * cos_a : 0;

    /* Net acceleration along ramp (positive = downward) */
    const a = g_component - friction;

    let vn = v + a * dt;
    let sn = s + v * dt;

    /* Clamp at bottom (s = max_s) */
    if (sn >= max_s) {
      sn = max_s;
      vn = Math.max(0, vn);
    }
    /* Clamp at top (s = 0) */
    if (sn < 0) {
      sn = 0;
      vn = 0;
    }

    const height = (max_s - sn) * sin_a;
    return { s: sn, v: vn, height };
  },

  /* ── Fluids ─────────────────────────────────────── */

  /**
   * Buoyancy (Archimedes' principle).
   * E = ρf · g · V_sub
   */
  fluids_buoyancy(fluid_density, g, volume_submerged) {
    return fluid_density * g * volume_submerged;
  },

  /**
   * Net vertical force on submerged/floating object.
   * F_net = E - P  (positive = upward)
   */
  fluids_net_force(buoyancy, weight) {
    return buoyancy - weight;
  },

  /**
   * Hydrostatic pressure.
   * P = P0 + ρ·g·h
   */
  fluids_pressure(p0, fluid_density, g, depth) {
    return p0 + fluid_density * g * depth;
  },

  /**
   * Equilibrium submersion fraction for a floating object.
   * If ρ_obj > ρ_fluid → fully submerged (returns 1.0, net force < 0 → sinks)
   * If ρ_obj < ρ_fluid → partially submerged (returns ρ_obj/ρ_fluid)
   * If ρ_obj = ρ_fluid → neutrally buoyant (returns 1.0, net force = 0)
   *
   * @returns {number} fraction of object submerged at equilibrium [0, 1]
   */
  fluids_equilibrium_fraction(obj_density, fluid_density) {
    if (fluid_density <= 0) return 1.0;
    const ratio = obj_density / fluid_density;
    return Math.min(ratio, 1.0);
  },

  /**
   * Dynamic step for an object in fluid (vertical motion).
   * @param {number} y         — y position of object center (m), 0 = fluid surface
   * @param {number} v         — vertical velocity (m/s, positive = up)
   * @param {number} obj_density
   * @param {number} obj_height — object height (m)
   * @param {number} obj_volume — m³
   * @param {number} fluid_density
   * @param {number} g
   * @param {number} dt
   * @param {number} fluid_top  — y coordinate of fluid surface
   * @param {number} container_bottom — y coordinate of container bottom
   * @returns {{ y: number, v: number, submerged_fraction: number }}
   */
  fluids_object_step(y, v, obj_density, obj_height, obj_volume, fluid_density, g, dt, fluid_top, container_bottom) {
    const obj_mass = obj_density * obj_volume;
    const weight = obj_mass * g;

    /* Compute submerged volume */
    const obj_bottom = y - obj_height / 2;
    const obj_top    = y + obj_height / 2;
    const sub_bottom = Math.min(obj_bottom, fluid_top);
    const sub_top    = Math.min(obj_top, fluid_top);
    const sub_height = Math.max(0, sub_top - sub_bottom);
    const sub_fraction = sub_height / obj_height;
    const sub_volume = sub_fraction * obj_volume;

    const buoyancy = fluid_density * g * sub_volume;
    const f_net    = buoyancy - weight;
    const a        = f_net / obj_mass;

    let vn = v + a * dt;
    let yn = y + v * dt;

    /* Clamp: object cannot sink below container floor */
    const floor = container_bottom + obj_height / 2;
    if (yn < floor) { yn = floor; vn = 0; }

    /* Damping to prevent infinite oscillation (simulates water resistance) */
    vn *= 0.97;

    return { y: yn, v: vn, submerged_fraction: sub_fraction };
  },
};

/* ─────────────────────────────────────────────────────────────────────────── *
 * WASM wrapper — wraps emscripten-compiled exports in the same API.
 * ─────────────────────────────────────────────────────────────────────────── */

/**
 * Build a Physics interface from WASM instance exports.
 * @param {Object} exports — WebAssembly instance exports
 * @returns {Object} Physics interface
 */
function _buildWasmInterface(exports) {
  /* Direct passthrough for pure-math functions that match signature */
  return {
    motion_position:        exports.motion_position,
    motion_velocity:        exports.motion_velocity,
    forces_acceleration:    exports.forces_acceleration,
    forces_friction:        exports.forces_friction,
    forces_weight:          exports.forces_weight,
    energy_kinetic:         exports.energy_kinetic,
    energy_potential:       exports.energy_potential,
    energy_work:            exports.energy_work,
    fluids_buoyancy:        exports.fluids_buoyancy,
    fluids_net_force:       exports.fluids_net_force,
    fluids_pressure:        exports.fluids_pressure,
    fluids_equilibrium_fraction: exports.fluids_equilibrium_fraction,

    /* Step functions return objects in JS; C returns via out-pointer.
     * These wrappers bridge the gap. */
    motion_step(x, v, a, dt) {
      /* C: void motion_step(double *x, double *v, double a, double dt)
       * Encoded as two f64 values in a shared memory buffer */
      if (exports.motion_step_packed) {
        const result_f64 = exports.motion_step_packed(x, v, a, dt);
        /* packed: returns ptr to 2×f64 */
        const mem = new Float64Array(exports.memory.buffer);
        const base = result_f64 / 8;
        return { x: mem[base], v: mem[base + 1] };
      }
      return PhysicsFallback.motion_step(x, v, a, dt);
    },

    forces_step(x, v, applied_force, mass, mu_k, normal, has_friction, dt) {
      if (exports.forces_step_packed) {
        const result = exports.forces_step_packed(x, v, applied_force, mass, mu_k, normal, has_friction ? 1 : 0, dt);
        const mem = new Float64Array(exports.memory.buffer);
        const base = result / 8;
        return { x: mem[base], v: mem[base + 1] };
      }
      return PhysicsFallback.forces_step(x, v, applied_force, mass, mu_k, normal, has_friction, dt);
    },

    energy_ramp_step(s, v, max_s, angle_rad, mass, mu_k, has_friction, g, dt) {
      if (exports.energy_ramp_step_packed) {
        const result = exports.energy_ramp_step_packed(s, v, max_s, angle_rad, mass, mu_k, has_friction ? 1 : 0, g, dt);
        const mem = new Float64Array(exports.memory.buffer);
        const base = result / 8;
        return { s: mem[base], v: mem[base + 1], height: mem[base + 2] };
      }
      return PhysicsFallback.energy_ramp_step(s, v, max_s, angle_rad, mass, mu_k, has_friction, g, dt);
    },

    fluids_object_step(y, v, obj_density, obj_height, obj_volume, fluid_density, g, dt, fluid_top, container_bottom) {
      if (exports.fluids_object_step_packed) {
        const result = exports.fluids_object_step_packed(y, v, obj_density, obj_height, obj_volume, fluid_density, g, dt, fluid_top, container_bottom);
        const mem = new Float64Array(exports.memory.buffer);
        const base = result / 8;
        return { y: mem[base], v: mem[base + 1], submerged_fraction: mem[base + 2] };
      }
      return PhysicsFallback.fluids_object_step(y, v, obj_density, obj_height, obj_volume, fluid_density, g, dt, fluid_top, container_bottom);
    },
  };
}

/* ─────────────────────────────────────────────────────────────────────────── *
 * Public API
 * ─────────────────────────────────────────────────────────────────────────── */

/** @type {Object} — Active physics interface (WASM or fallback) */
let Physics = PhysicsFallback;

/**
 * Initialize the physics engine.
 * Tries WASM; falls back to pure-JS silently.
 * @returns {Promise<boolean>} true if WASM loaded, false if using fallback
 */
async function initPhysics() {
  if (!('WebAssembly' in window)) {
    console.info('[wasm-loader] WebAssembly not supported. Using JS fallback.');
    setState('wasmLoaded', false);
    setState('wasmError', 'WebAssembly not supported');
    return false;
  }

  try {
    const wasmPath = 'wasm/physics_engine.wasm';
    const response = await fetch(wasmPath);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const { instance } = await WebAssembly.instantiateStreaming(response, {
      /* env imports for the C runtime */
      env: {
        memory: new WebAssembly.Memory({ initial: 4 }), /* 256 KB */
        abort: (msg, file, line, col) => {
          console.error(`[wasm] Abort: ${msg} at ${file}:${line}:${col}`);
        },
      },
    });

    Physics = _buildWasmInterface(instance.exports);
    setState('wasmLoaded', true);
    console.info('[wasm-loader] WASM physics engine loaded.');
    return true;

  } catch (err) {
    console.info(`[wasm-loader] WASM unavailable (${err.message}). Using JS fallback.`);
    Physics = PhysicsFallback;
    setState('wasmLoaded', false);
    setState('wasmError', err.message);
    return false;
  }
}

export { initPhysics, Physics, PhysicsFallback };
