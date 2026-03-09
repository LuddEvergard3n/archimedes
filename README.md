# Archimedes

**Laboratório interativo de Física.**  
Parte do ecossistema educacional: Heródoto · Euclides · Quintiliano · Johnson English · Lavoisier · Humboldt · Aristóteles · **Archimedes**

---

## Visão Geral

Archimedes é um sistema para ensinar Física através do fenômeno, não da fórmula. O aluno observa, manipula e conclui antes de ver qualquer equação. A formalização matemática é consequência da experiência, não pré-requisito.

**Problema que resolve:**
- Fórmulas ensinadas como símbolos mortos
- Ausência de laboratório nas escolas
- Separação artificial entre teoria e fenômeno
- Exercícios mecânicos sem compreensão causal

**Abordagem:**
1. Fenômeno → 2. Experimento → 3. Manipulação → 4. Observação → 5. Formalização → 6. Exercício

---

## Módulos (v1.0)

| Módulo        | Conteúdo                                       | Experimentos |
|---------------|------------------------------------------------|-------------|
| Introdução    | Observação, medida, grandezas, unidades        | 2           |
| Movimento     | MRU, MRUV, queda livre                         | 3           |
| Forças        | Newton I, II, atrito, resultante               | 4           |
| Energia       | Ec, Ep, conservação, rampa                     | 3           |
| Fluidos       | Empuxo, densidade, pressão                     | 3           |

---

## Stack

```
Interface         HTML5 + CSS3 + JavaScript ES2022 (módulos nativos)
Simulação física  C compilado para WebAssembly
Gráficos          Canvas 2D (sem engine externa)
Roteamento        Hash-based (sem framework)
Estado            Observable store (pub/sub, sem biblioteca)
Deploy            GitHub Pages (estático, sem backend)
```

**Dependências externas:** Zero em runtime. Fontes via Google Fonts (opcional, degrada graciosamente).

---

## Arquitetura

```
archimedes/
├── index.html                  Ponto de entrada
├── css/
│   ├── theme.css               Design system (variáveis CSS)
│   ├── base.css                Reset + tipografia
│   ├── layout.css              Shell: header, sidebar, main
│   ├── components.css          Botões, sliders, cards, HUD, gráficos
│   └── mobile.css              Responsividade e media queries
├── js/
│   ├── main.js                 Bootstrap, roteamento, sidebar
│   ├── router.js               Roteador hash-based
│   ├── state.js                Store observável (get/set/subscribe)
│   ├── ui.js                   Renderizadores de views
│   ├── wasm-loader.js          Carrega WASM; fallback JS puro
│   └── accessibility.js        Teclado, alto contraste, tamanho de fonte
├── engine/
│   ├── renderer.js             Primitivos Canvas 2D (grid, setas, corpos)
│   └── chart-engine.js         Gráficos ao vivo (ChartEngine, DualChartEngine)
├── modules/
│   ├── intro/intro.js          Pêndulo, unidades
│   ├── motion/motion.js        MRU, MRUV, queda livre
│   ├── forces/forces.js        Inércia, Newton II, atrito, resultante
│   ├── energy/energy.js        Cinética, rampa, conservação
│   └── fluids/fluids.js        Empuxo, densidade, pressão
├── wasm/
│   └── physics_engine.c        Núcleo físico em C (compila para WASM)
├── data/
│   ├── modules.json
│   ├── experiments.json
│   ├── lessons.json
│   ├── exercises.json
│   └── equations.json
├── tests/
│   ├── test-runner.js          Suite de testes
│   └── test-runner.html        Página de execução de testes
└── docs/
    ├── architecture.md
    ├── pedagogy.md
    ├── simulation-model.md
    ├── module-system.md
    └── development-guide.md
```

---

## Motor Físico (WASM / JS)

O módulo `js/wasm-loader.js` tenta carregar `wasm/physics_engine.wasm`.  
Se o carregamento falhar (arquivo ausente, navegador incompatível), ele usa `PhysicsFallback` automaticamente — um objeto JS com as mesmas funções e resultados numéricos idênticos.

**A aplicação funciona completamente sem compilação WASM.**

### Compilar o motor C (opcional)

Requer [emscripten](https://emscripten.org/):

```bash
cd wasm
emcc physics_engine.c -O2 -s WASM=1 \
  -s EXPORTED_FUNCTIONS='["_motion_position","_motion_velocity","_forces_acceleration","_forces_friction","_forces_weight","_energy_kinetic","_energy_potential","_energy_work","_fluids_buoyancy","_fluids_net_force","_fluids_pressure","_fluids_equilibrium_fraction"]' \
  -s EXPORTED_RUNTIME_METHODS='[]' \
  --no-entry \
  -o physics_engine.wasm
```

Após compilar, mova `physics_engine.wasm` para `wasm/`.

---

## Executar Localmente

O projeto é estático. Qualquer servidor HTTP funciona:

```bash
# Python 3
python3 -m http.server 8080

# Node.js (npx)
npx serve .

# Caddy / nginx / Apache — sirva o diretório raiz
```

Abra `http://localhost:8080` no navegador.

**Atenção:** ES modules não funcionam via `file://`. É necessário um servidor HTTP.

---

## Rodar Testes

```
http://localhost:8080/tests/test-runner.html
```

O relatório exibe cada asserção com PASS/FAIL. Testes cobrem:

- Correção numérica das funções físicas (JS fallback)
- Conservação de energia na rampa (integração numérica)
- Store de estado (get, set, merge, subscribe)
- Integridade dos dados JSON (campos obrigatórios, referências válidas)

---

## Deploy no GitHub Pages

1. Faça push do repositório para o GitHub
2. Vá em **Settings → Pages → Source: Deploy from branch → main / root**
3. O projeto estará disponível em `https://<usuario>.github.io/archimedes/`

---

## API de Simulação

Cada módulo exporta uma factory:

```js
createMotionSimulation(simId, canvas, chartCanvas)
createForcesSimulation(simId, canvas, chartCanvas)
createEnergySimulation(simId, canvas, chartCanvas)
createFluidsSimulation(simId, canvas, chartCanvas)
createIntroSimulation(simId, canvas)
```

Cada instância retornada expõe:

```js
simulation.start()           // inicia/retoma loop RAF
simulation.pause()           // pausa
simulation.reset()           // volta ao estado inicial
simulation.setParam(k, v)    // altera parâmetro ao vivo
simulation.onTimeUpdate(fn)  // callback: (t: number) => void
simulation.dispose()         // limpa recursos
```

---

## Convenções de Código

- **Nenhum framework** — HTML, CSS, JS puros
- **Módulos ES2022** — `import/export` nativos
- **Sem transpilação** — código executa diretamente no navegador
- **Separação de responsabilidades** — física em WASM/C, UI em JS, estilos em CSS
- **Fallback explícito** — nada quebra se o WASM não carregar
- **Comentários de contrato** — cada função documenta parâmetros e pré-condições

---

## Acessibilidade

- Navegação completa por teclado (`Space`/`k` = play/pause, `r` = reset, `h` = home)
- Alto contraste (botão no cabeçalho)
- Tamanho de fonte ajustável
- Atributos ARIA em todos os elementos interativos
- Live region para leitores de tela
- Skip link para conteúdo principal

---

## Licença

MIT — veja `LICENSE`.
