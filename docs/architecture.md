# Arquitetura — Archimedes

## Visão geral

Archimedes é uma aplicação web estática de página única (SPA) sem framework.  
Toda a lógica é distribuída em módulos ES2022 nativos que o navegador importa diretamente.

```
┌─────────────────────────────────────────────────────────────┐
│                        Navegador                            │
│                                                             │
│  index.html                                                 │
│  └─ js/main.js  (entry point)                               │
│      ├─ js/router.js        hash-based routing              │
│      ├─ js/state.js         observable store                │
│      ├─ js/ui.js            view renderers                  │
│      ├─ js/wasm-loader.js   physics engine                  │
│      └─ js/accessibility.js keyboard / a11y                 │
│                                                             │
│  engine/                                                    │
│  ├─ renderer.js    Canvas 2D primitives                     │
│  └─ chart-engine.js live rolling graphs                     │
│                                                             │
│  modules/                                                   │
│  ├─ intro/intro.js                                          │
│  ├─ motion/motion.js                                        │
│  ├─ forces/forces.js                                        │
│  ├─ energy/energy.js                                        │
│  └─ fluids/fluids.js                                        │
│                                                             │
│  wasm/physics_engine.wasm  (opcional; fallback em JS)       │
│                                                             │
│  data/*.json                                                │
└─────────────────────────────────────────────────────────────┘
```

## Fluxo de dados

```
URL hash change
    → router.js dispatch
    → ui.js renderExperiment()
    → dynamic import module (motion.js, forces.js ...)
    → createXxxSimulation(id, canvas, chartCanvas)
    → simulation.reset() / .start()
    → RAF loop: update (Physics.*) → render (Canvas)
    → controls via setParam(key, value) → immediate update
```

## Motor físico: WASM + fallback

`wasm-loader.js` expõe um único objeto `Physics` com funções matemáticas puras.  
Na inicialização, tenta carregar `wasm/physics_engine.wasm`.  
Se falhar por qualquer motivo, `Physics` aponta para `PhysicsFallback` — JS puro com resultados numericamente idênticos.

**As simulações não sabem qual motor está ativo.** Chamam `Physics.motion_step(...)` e recebem o resultado. A troca é transparente.

## Estado global

`state.js` implementa um store pub/sub minimalista:

```js
setState('simulation.running', true)   // grava
getState('simulation.running')          // lê
subscribe('simulation.running', fn)     // observa
mergeState('simulation.params', {...})  // merge parcial
```

Nenhum componente modifica estado de outro diretamente. Toda comunicação passa pelo store.

## Roteamento

Hash-based, sem history API:

```
#/                          → renderHome
#/module/:id                → renderModule(id)
#/module/:id/:expId         → renderExperiment(id, expId)
```

O router despacha handlers registrados por `register(pattern, fn)`.  
Cada handler chama `_mountView(rendererFn)` que descarta a view anterior antes de montar a nova.

## Responsividade

- CSS Grid adapta o layout de lab (2 colunas → 1 coluna no mobile)
- Sidebar vira drawer no mobile (transform translateX)
- Canvas redimensiona proporcionalmente via CSS
- Touch devices recebem thumbs maiores nos sliders
