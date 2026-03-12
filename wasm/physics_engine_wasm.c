/**
 * physics_engine_wasm.c — Versão para compilação wasm32 via clang nativo
 *
 * Não usa headers de libc. Declara os intrínsecos matemáticos diretamente.
 * As funções sin/cos/sqrt/fabs são fornecidas pelo host JS via importObject.
 *
 * Compile:
 *   clang --target=wasm32 -nostdlib -Wl,--no-entry -Wl,--export-all \
 *         -Wl,--allow-undefined -O2 -ffast-math \
 *         -o physics_engine.wasm physics_engine_wasm.c
 */

/* ── Declara funções matemáticas importadas do host ── */
extern double sin(double);
extern double cos(double);
extern double sqrt(double);
extern double fabs(double);

/* ── Macro de exportação ─────────────────────────── */
#define EXPORT __attribute__((visibility("default")))

/* constante π */
#define M_PI 3.14159265358979323846

/* ─────────────────────────────────────────────────── *
 * Motion
 * ─────────────────────────────────────────────────── */

EXPORT double motion_position(double x0, double v0, double a, double t) {
    return x0 + v0 * t + 0.5 * a * t * t;
}

EXPORT double motion_velocity(double v0, double a, double t) {
    return v0 + a * t;
}

/* ─────────────────────────────────────────────────── *
 * Forces
 * ─────────────────────────────────────────────────── */

EXPORT double forces_acceleration(double net_force, double mass) {
    if (mass <= 0.0) return 0.0;
    return net_force / mass;
}

EXPORT double forces_friction(double normal_force, double mu_k) {
    return mu_k * fabs(normal_force);
}

EXPORT double forces_weight(double mass, double g) {
    return mass * g;
}

/* ─────────────────────────────────────────────────── *
 * Energy
 * ─────────────────────────────────────────────────── */

EXPORT double energy_kinetic(double mass, double velocity) {
    return 0.5 * mass * velocity * velocity;
}

EXPORT double energy_potential(double mass, double g, double height) {
    double h = height > 0.0 ? height : 0.0;
    return mass * g * h;
}

EXPORT double energy_work(double force, double displacement, double cos_theta) {
    return force * displacement * cos_theta;
}

/* ─────────────────────────────────────────────────── *
 * Fluids
 * ─────────────────────────────────────────────────── */

EXPORT double fluids_buoyancy(double fluid_density, double g, double volume_submerged) {
    return fluid_density * g * volume_submerged;
}

EXPORT double fluids_net_force(double buoyancy, double weight) {
    return buoyancy - weight;
}

EXPORT double fluids_pressure(double p0, double fluid_density, double g, double depth) {
    return p0 + fluid_density * g * depth;
}

EXPORT double fluids_equilibrium_fraction(double obj_density, double fluid_density) {
    if (fluid_density <= 0.0) return 1.0;
    double ratio = obj_density / fluid_density;
    return ratio < 1.0 ? ratio : 1.0;
}

/* ─────────────────────────────────────────────────── *
 * Waves
 * ─────────────────────────────────────────────────── */

EXPORT double waves_displacement(double A, double k, double x, double omega, double t, double phi) {
    return A * sin(k * x - omega * t + phi);
}

EXPORT double waves_speed(double frequency, double wavelength) {
    return frequency * wavelength;
}

EXPORT double waves_period(double frequency) {
    if (frequency <= 0.0) return 0.0;
    return 1.0 / frequency;
}

EXPORT double waves_pendulum_period(double length, double g) {
    if (length <= 0.0 || g <= 0.0) return 0.0;
    return 2.0 * M_PI * sqrt(length / g);
}

EXPORT double waves_spring_period(double mass, double spring_k) {
    if (mass <= 0.0 || spring_k <= 0.0) return 0.0;
    return 2.0 * M_PI * sqrt(mass / spring_k);
}

EXPORT double waves_superposition(
    double A1, double k1, double omega1,
    double A2, double k2, double omega2,
    double phi, double x, double t
) {
    return A1 * sin(k1 * x - omega1 * t) +
           A2 * sin(k2 * x - omega2 * t + phi);
}

/* ─────────────────────────────────────────────────── *
 * Thermodynamics
 * ─────────────────────────────────────────────────── */

EXPORT double thermo_pressure(double V, double n, double T) {
    if (V <= 0.0) return 0.0;
    return (n * 8.314 * T) / V;
}

EXPORT double thermo_gay_lussac(double P1, double T1, double T2) {
    if (T1 <= 0.0) return 0.0;
    return P1 * T2 / T1;
}

EXPORT double thermo_boyle(double P1, double V1, double P2) {
    if (P2 <= 0.0) return 0.0;
    return (P1 * V1) / P2;
}

EXPORT double thermo_charles(double V1, double T1, double T2) {
    if (T1 <= 0.0) return 0.0;
    return V1 * T2 / T1;
}

EXPORT double thermo_heat(double mass, double specific_heat, double delta_T) {
    return mass * specific_heat * delta_T;
}

EXPORT double thermo_celsius_to_kelvin(double celsius) {
    return celsius + 273.15;
}

/* ─────────────────────────────────────────────────── *
 * Step functions — output via ponteiros (WASM-safe)
 * ─────────────────────────────────────────────────── */

EXPORT void motion_step(double x, double v, double a, double dt, double *out) {
    out[0] = x + v * dt;
    out[1] = v + a * dt;
}

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
                out[0] = x; out[1] = 0.0; return;
            }
            friction = (applied_force > 0 ? -1.0 : 1.0) * f_mag;
        }
    }
    if (mass <= 0.0) { out[0] = x; out[1] = v; return; }
    double net = applied_force + friction;
    double a   = net / mass;
    out[0] = x + v * dt;
    out[1] = v + a * dt;
}

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
    double vn     = v + a * dt;
    double sn     = s + v * dt;
    if (sn >= max_s) { sn = max_s; if (vn < 0) vn = 0.0; }
    if (sn < 0.0)    { sn = 0.0;  vn = 0.0; }
    out[0] = sn;
    out[1] = vn;
    out[2] = (max_s - sn) * sin_a;
}

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
    double vn = (v + a * dt) * 0.97;
    double yn = y + v * dt;
    double floor_y = container_bottom + obj_height / 2.0;
    if (yn < floor_y) { yn = floor_y; vn = 0.0; }
    out[0] = yn;
    out[1] = vn;
    out[2] = sub_frac;
}

/**
 * MHS step — massa-mola (Euler simples).
 * Equação: θ'' = -(ω²)·x  →  x'' = -(k/m)·x
 * out[0] = x_new
 * out[1] = v_new
 */
EXPORT void waves_mhs_step(
    double x, double v, double omega, double dt, double *out
) {
    /* Velocity Verlet — symplectically stable, conserves energy.
     * Euler explícito diverge em ~60s com dt=1/60. */
    double a0     = -(omega * omega) * x;
    double v_half = v + a0 * dt * 0.5;
    double x_new  = x + v_half * dt;
    double a1     = -(omega * omega) * x_new;
    double v_new  = v_half + a1 * dt * 0.5;
    out[0] = x_new;
    out[1] = v_new;
}

/**
 * Pêndulo simples — Velocity Verlet com ângulo real.
 * θ'' = -(g/L)·sin(θ)
 * out[0] = theta_new
 * out[1] = omega_new (velocidade angular)
 */
EXPORT void waves_pendulum_step(
    double theta, double omega_ang, double L, double g, double dt, double *out
) {
    if (L <= 0.0) { out[0] = theta; out[1] = omega_ang; return; }
    double alpha0   = -(g / L) * sin(theta);
    double om_half  = omega_ang + alpha0 * dt * 0.5;
    double th_new   = theta + om_half * dt;
    double alpha1   = -(g / L) * sin(th_new);
    double om_new   = om_half + alpha1 * dt * 0.5;
    out[0] = th_new;
    out[1] = om_new;
}
