/**
 * physics_engine.c — Core physics engine (compiles to WebAssembly)
 *
 * Step functions use output pointers to return multiple values,
 * avoiding struct-return ABI issues across the WASM boundary.
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

/* ─────────────────────────────────────────────────────────────────────────── *
 * Step functions — return via output pointers (WASM-safe)
 *
 * All *_step functions write results to caller-allocated double arrays.
 * This avoids struct-return ABI issues and is callable directly from JS
 * via WebAssembly.Memory / Float64Array.
 * ─────────────────────────────────────────────────────────────────────────── */

/**
 * Euler integration step for constant-acceleration motion.
 * out[0] = x_new, out[1] = v_new
 */
EXPORT void motion_step(double x, double v, double a, double dt, double *out) {
  out[0] = x + v * dt;
  out[1] = v + a * dt;
}

/**
 * Step for a body on a horizontal surface with applied force and friction.
 * Applies simple kinetic/static friction model.
 * out[0] = x_new, out[1] = v_new
 */
EXPORT void forces_step(
  double x, double v,
  double applied_force, double mass,
  double mu_k, double normal,
  int has_friction, double dt,
  double *out
) {
  double friction = 0.0;
  if (has_friction) {
    double f_mag = mu_k * fabs(normal);
    if (fabs(v) > 1e-4) {
      friction = (v > 0 ? -1.0 : 1.0) * f_mag;
    } else {
      double f_static = mu_k * 1.2 * normal;
      if (fabs(applied_force) <= f_static) {
        out[0] = x;
        out[1] = 0.0;
        return;
      }
      friction = (applied_force > 0 ? -1.0 : 1.0) * f_mag;
    }
  }
  if (mass <= 0.0) { out[0] = x; out[1] = v; return; }
  double net = applied_force + friction;
  double a   = net / mass;
  out[0] = x + v  * dt;
  out[1] = v + a  * dt;
}

/**
 * Ramp energy step — body slides down inclined plane.
 * out[0] = s_new (distance along ramp)
 * out[1] = v_new
 * out[2] = height (m above base)
 */
EXPORT void energy_ramp_step(
  double s, double v, double max_s,
  double angle_rad, double mass, double mu_k,
  int has_friction, double g, double dt,
  double *out
) {
  double sin_a = sin(angle_rad);
  double cos_a = cos(angle_rad);
  double g_comp = g * sin_a;
  double fric   = has_friction ? mu_k * g * cos_a : 0.0;
  double a      = g_comp - fric;
  double vn     = v  + a * dt;
  double sn     = s  + v * dt;
  if (sn >= max_s) { sn = max_s; if (vn < 0) vn = 0.0; }
  if (sn < 0.0)    { sn = 0.0;  vn = 0.0; }
  out[0] = sn;
  out[1] = vn;
  out[2] = (max_s - sn) * sin_a;
}

/**
 * Fluid object step — vertical motion of object in fluid.
 * out[0] = y_new
 * out[1] = v_new (vertical)
 * out[2] = submerged_fraction [0..1]
 */
EXPORT void fluids_object_step(
  double y, double v,
  double obj_density, double obj_height, double obj_volume,
  double fluid_density, double g, double dt,
  double fluid_top, double container_bottom,
  double *out
) {
  double obj_mass   = obj_density * obj_volume;
  double weight     = obj_mass * g;
  double obj_bottom = y - obj_height / 2.0;
  double obj_top    = y + obj_height / 2.0;
  double sub_bottom = obj_bottom < fluid_top ? obj_bottom : fluid_top;
  double sub_top    = obj_top    < fluid_top ? obj_top    : fluid_top;
  double sub_h      = sub_top - sub_bottom;
  if (sub_h < 0.0) sub_h = 0.0;
  double sub_frac   = sub_h / obj_height;
  double sub_vol    = sub_frac * obj_volume;
  double buoyancy   = fluid_density * g * sub_vol;
  double f_net      = buoyancy - weight;
  if (obj_mass <= 0.0) { out[0] = y; out[1] = 0.0; out[2] = 0.0; return; }
  double a  = f_net / obj_mass;
  double vn = (v + a * dt) * 0.97; /* viscous damping */
  double yn = y + v * dt;
  double floor = container_bottom + obj_height / 2.0;
  if (yn < floor) { yn = floor; vn = 0.0; }
  out[0] = yn;
  out[1] = vn;
  out[2] = sub_frac;
}

/* ─────────────────────────────────────────────────────────────────────────── *
 * Waves functions
 * ─────────────────────────────────────────────────────────────────────────── */

/**
 * Transverse wave displacement at position x and time t.
 * y(x,t) = A·sin(kx − ωt + φ)
 * @param A     amplitude (m)
 * @param k     wave number = 2π/λ (rad/m)
 * @param omega angular frequency = 2πf (rad/s)
 * @param phi   initial phase (rad)
 */
EXPORT double waves_displacement(double A, double k, double x, double omega, double t, double phi) {
  return A * sin(k * x - omega * t + phi);
}

/**
 * Wave speed from frequency and wavelength.
 * v = f · λ
 */
EXPORT double waves_speed(double frequency, double wavelength) {
  return frequency * wavelength;
}

/**
 * Wave period from frequency.
 * T = 1/f
 */
EXPORT double waves_period(double frequency) {
  if (frequency <= 0.0) return 0.0;
  return 1.0 / frequency;
}

/**
 * Simple pendulum period (small angle approximation).
 * T = 2π·√(L/g)
 */
EXPORT double waves_pendulum_period(double length, double g) {
  if (length <= 0.0 || g <= 0.0) return 0.0;
  return 2.0 * 3.14159265358979323846 * sqrt(length / g);
}

/**
 * Spring-mass oscillator period.
 * T = 2π·√(m/k)
 */
EXPORT double waves_spring_period(double mass, double spring_k) {
  if (mass <= 0.0 || spring_k <= 0.0) return 0.0;
  return 2.0 * 3.14159265358979323846 * sqrt(mass / spring_k);
}

/**
 * Superposition of two waves at position x, time t.
 * y = A1·sin(k1·x − ω1·t) + A2·sin(k2·x − ω2·t + φ)
 */
EXPORT double waves_superposition(
  double A1, double k1, double omega1,
  double A2, double k2, double omega2,
  double phi, double x, double t
) {
  return A1 * sin(k1 * x - omega1 * t) +
         A2 * sin(k2 * x - omega2 * t + phi);
}

/* ─────────────────────────────────────────────────────────────────────────── *
 * Thermodynamics functions
 * ─────────────────────────────────────────────────────────────────────────── */

/**
 * Ideal gas law: P·V = n·R·T
 * Returns pressure given V, n, T.
 * R = 8.314 J/(mol·K)
 */
EXPORT double thermo_pressure(double V, double n, double T) {
  if (V <= 0.0) return 0.0;
  return (n * 8.314 * T) / V;
}

/**
 * Gay-Lussac's law: P1/T1 = P2/T2 → returns P2
 */
EXPORT double thermo_gay_lussac(double P1, double T1, double T2) {
  if (T1 <= 0.0) return 0.0;
  return P1 * T2 / T1;
}

/**
 * Boyle's law: P1·V1 = P2·V2 → returns V2
 */
EXPORT double thermo_boyle(double P1, double V1, double P2) {
  if (P2 <= 0.0) return 0.0;
  return (P1 * V1) / P2;
}

/**
 * Charles's law: V1/T1 = V2/T2 → returns V2
 */
EXPORT double thermo_charles(double V1, double T1, double T2) {
  if (T1 <= 0.0) return 0.0;
  return V1 * T2 / T1;
}

/**
 * Heat transfer: Q = m·c·ΔT
 */
EXPORT double thermo_heat(double mass, double specific_heat, double delta_T) {
  return mass * specific_heat * delta_T;
}

/**
 * Celsius to Kelvin conversion.
 */
EXPORT double thermo_celsius_to_kelvin(double celsius) {
  return celsius + 273.15;
}
