/**
 * physics_engine.c — Core physics engine (compiles to WebAssembly)
 *
 * Exports all functions used by wasm-loader.js.
 * This C file is the single compilation unit for the WASM build.
 *
 * Compile with emscripten:
 *   emcc physics_engine.c -O2 -s WASM=1 \
 *        -s EXPORTED_FUNCTIONS='[...]' \
 *        -s EXPORTED_RUNTIME_METHODS='[]' \
 *        -o physics_engine.wasm
 *
 * The JS fallback in wasm-loader.js mirrors these functions exactly.
 * If WASM is unavailable, the application falls back automatically.
 *
 * All functions use double precision (double) for physical accuracy.
 * Division-by-zero guards are included for all user-supplied denominators.
 */

#include <math.h>

/* ── Compiler export macro ──────────────────────── */
#ifdef __EMSCRIPTEN__
  #include <emscripten.h>
  #define EXPORT EMSCRIPTEN_KEEPALIVE
#else
  #define EXPORT
#endif

/* ─────────────────────────────────────────────────────────────────────────── *
 * Motion functions
 * ─────────────────────────────────────────────────────────────────────────── */

/**
 * Position under constant acceleration.
 * x(t) = x0 + v0·t + ½·a·t²
 */
EXPORT double motion_position(double x0, double v0, double a, double t) {
  return x0 + v0 * t + 0.5 * a * t * t;
}

/**
 * Velocity under constant acceleration.
 * v(t) = v0 + a·t
 */
EXPORT double motion_velocity(double v0, double a, double t) {
  return v0 + a * t;
}

/* ─────────────────────────────────────────────────────────────────────────── *
 * Forces functions
 * ─────────────────────────────────────────────────────────────────────────── */

/**
 * Acceleration from net force and mass.
 * a = F / m
 * Guard: mass must be > 0.
 */
EXPORT double forces_acceleration(double net_force, double mass) {
  if (mass <= 0.0) return 0.0;
  return net_force / mass;
}

/**
 * Kinetic friction force magnitude.
 * f = μk · N
 */
EXPORT double forces_friction(double normal_force, double mu_k) {
  return mu_k * fabs(normal_force);
}

/**
 * Weight force.
 * P = m · g
 */
EXPORT double forces_weight(double mass, double g) {
  return mass * g;
}

/* ─────────────────────────────────────────────────────────────────────────── *
 * Energy functions
 * ─────────────────────────────────────────────────────────────────────────── */

/**
 * Kinetic energy.
 * Ec = ½·m·v²
 */
EXPORT double energy_kinetic(double mass, double velocity) {
  return 0.5 * mass * velocity * velocity;
}

/**
 * Gravitational potential energy.
 * Ep = m·g·h
 * Height clamped to >= 0.
 */
EXPORT double energy_potential(double mass, double g, double height) {
  double h = height > 0.0 ? height : 0.0;
  return mass * g * h;
}

/**
 * Work done by a force.
 * W = F·d·cos(θ)
 */
EXPORT double energy_work(double force, double displacement, double cos_theta) {
  return force * displacement * cos_theta;
}

/* ─────────────────────────────────────────────────────────────────────────── *
 * Fluids functions
 * ─────────────────────────────────────────────────────────────────────────── */

/**
 * Buoyancy force (Archimedes' principle).
 * E = ρf · g · V_sub
 */
EXPORT double fluids_buoyancy(double fluid_density, double g, double volume_submerged) {
  return fluid_density * g * volume_submerged;
}

/**
 * Net vertical force on submerged/floating object.
 * F_net = E - P  (positive = upward)
 */
EXPORT double fluids_net_force(double buoyancy, double weight) {
  return buoyancy - weight;
}

/**
 * Hydrostatic pressure.
 * P = P0 + ρ·g·h
 */
EXPORT double fluids_pressure(double p0, double fluid_density, double g, double depth) {
  return p0 + fluid_density * g * depth;
}

/**
 * Equilibrium submersion fraction for a floating object.
 *   ρ_obj < ρ_fluid  →  fraction = ρ_obj / ρ_fluid  (partially submerged)
 *   ρ_obj >= ρ_fluid →  fraction = 1.0              (fully submerged / sinks)
 *
 * Guard: fluid_density must be > 0.
 */
EXPORT double fluids_equilibrium_fraction(double obj_density, double fluid_density) {
  if (fluid_density <= 0.0) return 1.0;
  double ratio = obj_density / fluid_density;
  return ratio < 1.0 ? ratio : 1.0;
}
