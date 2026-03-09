# Sistema de Módulos — Archimedes

## Estrutura de dados

Cada módulo é composto por quatro entidades relacionadas:

```
Module
  └─ has many Experiments
       └─ has many Equations
       └─ has many Exercises

Module
  └─ has many Lessons
       └─ has many Phases
       └─ references Experiments
       └─ references Exercises
```

## Module

```json
{
  "id": "motion",
  "title": "Movimento",
  "subtitle": "Posição, velocidade e aceleração",
  "description": "...",
  "color": "#00c878",
  "order": 1,
  "experiments": ["mru-01", "mruv-01", "free-fall-01"],
  "lessons": ["motion-mru-01", "motion-mruv-01"]
}
```

## Experiment

```json
{
  "id": "newton2-01",
  "module": "forces",
  "title": "Força, massa e aceleração",
  "phenomenon": "...",
  "variables": ["força", "massa", "aceleração"],
  "equations": ["F = m·a"],
  "question": "O que acontece com a aceleração quando a massa dobra?",
  "simulation": "newton2",
  "phase": "phenomenon",
  "difficulty": 2,
  "duration_min": 20
}
```

O campo `simulation` referencia o ID da simulação na factory do módulo.

## Lesson

```json
{
  "id": "forces-newton2-01",
  "module": "forces",
  "title": "Segunda Lei de Newton",
  "concepts": ["força resultante", "massa", "aceleração"],
  "experiment_ids": ["newton2-01"],
  "exercise_ids": ["forces-ex-02", "forces-ex-03"],
  "phases": [
    { "id": "phenomenon",     "title": "Fenômeno",     "content": "..." },
    { "id": "experiment",     "title": "Experimento",  "content": "..." },
    { "id": "formalization",  "title": "F = m·a",      "content": "..." }
  ]
}
```

## Equation

```json
{
  "id": "eq-newton2",
  "module": "forces",
  "experiment_ids": ["newton2-01", "friction-01"],
  "display": "F = m·a",
  "variables": {
    "F": { "name": "força resultante", "unit": "N" },
    "m": { "name": "massa",            "unit": "kg" },
    "a": { "name": "aceleração",       "unit": "m/s²" }
  },
  "when_to_use": "Sempre que há força resultante não nula",
  "restriction": "F e a são vetoriais."
}
```

## Exercise

```json
{
  "id": "forces-ex-02",
  "module": "forces",
  "experiment_id": "newton2-01",
  "type": "prediction",
  "title": "Calcule a aceleração",
  "question": "Uma força de 30 N age sobre 5 kg. Qual a aceleração?",
  "hint": "Use a = F/m.",
  "answer": { "value": 6, "unit": "m/s²" },
  "explanation": "a = 30/5 = 6 m/s²"
}
```

Tipos de exercício:
- `prediction` — calculou um valor numérico
- `interpretation` — múltipla escolha sobre o fenômeno observado
- `comparison` — compara dois cenários

## IDs de simulação por módulo

| Módulo | simulation IDs                                  |
|--------|-------------------------------------------------|
| intro  | `pendulum-observe`, `units-demo`                |
| motion | `mru`, `mruv`, `free-fall`                      |
| forces | `inertia`, `newton2`, `friction`, `resultant`   |
| energy | `kinetic`, `ramp-energy`, `conservation`        |
| fluids | `buoyancy`, `density`, `pressure`               |
