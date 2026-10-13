# Archimedes

![JavaScript](https://img.shields.io/badge/JavaScript-ES2022-F7DF1E?logo=javascript&logoColor=111111)
![WebAssembly](https://img.shields.io/badge/WebAssembly-C_Engine-654FF0?logo=webassembly&logoColor=white)
![Canvas](https://img.shields.io/badge/Canvas-2D-0F766E)
![PWA](https://img.shields.io/badge/PWA-Offline-5A0FC8?logo=pwa&logoColor=white)

Interactive physics laboratory for Brazilian secondary education. It introduces equations through observable phenomena, guided reading, practice, and manipulable simulations.

## Scope

Version 5.0 contains 57 interactive experiences across fourteen modules. The primary path is secondary education; foundational and advanced content remains available as enrichment.

- Measurement and units.
- Motion.
- Forces.
- Energy.
- Fluids.
- Waves.
- Thermodynamics.
- Electromagnetism, optics, and modern physics.
- Gravitation and astronomy.
- Electricity and technology.
- Nuclear physics and radiation.
- Energy, environment, and climate.

Lessons begin with real situations, let the learner manipulate a model, and then connect the observed pattern to its mathematical representation.

## Technology

| Layer | Implementation |
|---|---|
| Interface | HTML5, CSS3, native JavaScript modules |
| Physics | C compiled to WebAssembly with a JavaScript fallback |
| Rendering | Canvas 2D |
| State | Observable publish/subscribe store |
| Navigation | Hash-based routing |
| Offline support | Service Worker and web app manifest |

There are no required runtime dependencies or backend services.

## Run locally

```bash
node -e "const http=require('http'),fs=require('fs'),path=require('path');const root=process.cwd();http.createServer((req,res)=>{let file=path.join(root,decodeURIComponent(req.url.split('?')[0]||'/index.html'));if(file.endsWith(path.sep))file+= 'index.html';fs.readFile(file,(error,data)=>{res.writeHead(error?404:200);res.end(error?'Not found':data)})}).listen(8080)"
```

Open `http://localhost:8080`. Direct `file://` access is unsupported because the application loads ES modules and JSON resources.

## Tests

Open `http://localhost:8080/tests/test-runner.html` for browser checks. The suite covers numerical physics functions, state behavior, data integrity, cross-references, and selected conservation properties. The project deliberately has no `npm test` script because its integration suite exercises browser APIs directly.

## Optional WebAssembly build

```bash
cd wasm
clang --target=wasm32 -nostdlib \
  -Wl,--no-entry -Wl,--export-all -Wl,--allow-undefined \
  -O2 -ffast-math \
  -o physics_engine.wasm physics_engine_wasm.c
```

The application remains functional when the WASM binary is unavailable because `PhysicsFallback` implements the same public API in JavaScript.

## Structure

```text
css/          Theme, layout, components, and mobile behavior
js/           Bootstrap, router, state, UI, WASM loader, accessibility
engine/       Canvas renderer and live chart engine
modules/      Physics simulations grouped by subject
wasm/         C source and compiled physics engine
data/         Modules, experiments, lessons, exercises, equations
tests/        Physics, state, and data checks
docs/         Architecture, pedagogy, simulation, and development notes
```

## Accessibility

- Keyboard controls for simulation playback, reset, and navigation.
- High-contrast and adjustable-font modes.
- ARIA annotations, a live region, and a skip link.
- Mobile touch targets of at least 44 pixels.
- A mobile bottom navigation and responsive Canvas panels.

## Editorial limits

Each new experience includes a source, a revision date, and a statement of the model's limitation. Simulations are learning models: they do not replace laboratory measurement, engineering design, medical advice, or radiation-safety guidance.

## Live version

[luddevergard3n.github.io/archimedes](https://luddevergard3n.github.io/archimedes/)

## License

MIT License. See [LICENSE](LICENSE).
