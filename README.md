# Archimedes

**Laboratório interativo de Física.**  
Parte do [ecossistema educacional LuddEvergard3n](#ecossistema).

---

## O que é

Archimedes ensina Física através do fenômeno, não da fórmula. O aluno vê
primeiro uma situação real — o ônibus que freia bruscamente, o pneu que
endurece no calor, a areia que queima os pés enquanto o mar continua
agradável — manipula a simulação, observa o padrão, e só então vê a equação
que o descreve.

A equação é consequência de observações acumuladas. Não ponto de partida.

---

## Módulos (v1.2)

| Módulo | Fenômeno âncora | Experimentos |
|---|---|---|
| Introdução | A sonda Mars Climate Orbiter perdida por erro de unidades | 2 |
| Movimento | Avião Recife→Porto Alegre; Porsche 0–100 km/h; pena e martelo na Lua | 3 |
| Forças | Carrinho vazio vs. cheio; escaladores e magnésio; barco na correnteza | 4 |
| Energia | 60 km/h vs. 40 km/h — distância de frenagem; skatista na rampa; pêndulo de Newton | 3 |
| Fluidos | Mar Morto × piscina; porta-aviões de 100.000 t flutuando; ouvidos do mergulhador | 3 |
| Ondas | Metrônomo; violão; dois violinistas desafinados produzindo batimentos | 4 |
| Termodinâmica | Pneu da bicicleta no calor; panela de pressão; areia vs. mar na praia | 3 |

**Total:** 23 experimentos interativos, 22 lições, 45 exercícios com contexto real.

---

## Stack

```
Interface         HTML5 + CSS3 + JavaScript ES2022 (módulos nativos)
Simulação física  C compilado para WebAssembly (clang --target=wasm32)
Gráficos          Canvas 2D (sem engine externa)
Roteamento        Hash-based (sem framework)
Estado            Observable store pub/sub (sem biblioteca)
Deploy            GitHub Pages (estático, sem backend)
PWA               Service Worker + manifest.json (funciona offline)
```

**Dependências externas em runtime:** nenhuma. Fontes via Google Fonts
(opcional — degrada para Georgia/serif sem perda funcional).

---

## Arquitetura

```
archimedes/
├── index.html                  Ponto de entrada + registro do Service Worker
├── manifest.json               PWA manifest
├── sw.js                       Service Worker (Cache First / Network First)
├── css/
│   ├── theme.css               Design system — variáveis CSS, paleta dual
│   ├── base.css                Reset + tipografia (EB Garamond + Share Tech Mono)
│   ├── layout.css              Shell: header, sidebar, main, lab view
│   ├── components.css          Sliders, botões, HUD, cards de exercício
│   └── mobile.css              Responsividade, portrait, touch targets
├── js/
│   ├── main.js                 Bootstrap: WASM → dados → sidebar → router
│   ├── router.js               Roteador hash-based com :params
│   ├── state.js                Store observável (getState/setState/subscribe)
│   ├── ui.js                   Views: home, módulo, experimento
│   ├── wasm-loader.js          Carrega WASM; fallback JS puro idêntico
│   └── accessibility.js        Teclado, alto contraste, tamanho de fonte, ARIA
├── engine/
│   ├── renderer.js             Primitivos Canvas 2D: grid, setas, corpos, HUD
│   └── chart-engine.js         Gráficos ao vivo (rolling 300 pontos)
├── modules/
│   ├── intro/intro.js          Pêndulo, demonstração de unidades
│   ├── motion/motion.js        MRU, MRUV, queda livre
│   ├── forces/forces.js        Inércia, Newton II, atrito, resultante
│   ├── energy/energy.js        Ec, Ep, rampa com/sem atrito, conservação
│   ├── fluids/fluids.js        Empuxo, densidade, pressão hidrostática
│   ├── ondas/ondas.js          MHS, onda transversal, superposição, pêndulo
│   └── termodinamica/          Gás ideal, processos P×V, capacidade calorífica
│       termodinamica.js
├── wasm/
│   ├── physics_engine_wasm.c   Núcleo físico em C (sem libc, sem WASI)
│   └── physics_engine.wasm     Binário compilado (3,1 KB, 31 exports)
├── data/
│   ├── modules.json            Definição dos 7 módulos
│   ├── experiments.json        22 experimentos com fenômeno e pergunta guiada
│   ├── lessons.json            13 lições com fases: fenômeno → formalização
│   ├── exercises.json          26 exercícios contextualizados com solução
│   └── equations.json          Banco de equações renderizáveis
├── tests/
│   ├── test-runner.js          Suite de testes (física + store + dados)
│   └── test-runner.html        Página de execução
└── docs/
    ├── architecture.md         Decisões de design e estrutura de módulos
    ├── pedagogy.md             Fundamentação pedagógica e critérios de conteúdo
    ├── simulation-model.md     Modelo físico por experimento (fenômenos reais)
    ├── module-system.md        Como criar novos módulos
    └── development-guide.md    Setup, build, convenções de código
```

---

## Motor Físico (WASM)

O módulo `js/wasm-loader.js` carrega `wasm/physics_engine.wasm` — compilado
com `clang --target=wasm32`, sem Emscripten, sem WASI. Funções matemáticas
(`sin`, `cos`, `sqrt`, `fabs`) são fornecidas pelo host JS via `env.*`.

Se o carregamento falhar, `PhysicsFallback` assume automaticamente: um objeto
JS com API idêntica e resultados numericamente equivalentes. **A aplicação
funciona completamente sem o arquivo `.wasm`.**

O status do motor aparece no cabeçalho: `WASM` (motor C ativo) ou `JS`
(fallback ativo).

### Compilar o motor C

Requer apenas `clang` com suporte a `wasm32` (padrão no Ubuntu 22+ e macOS
com Xcode CLT):

```bash
cd wasm
clang --target=wasm32 -nostdlib \
  -Wl,--no-entry -Wl,--export-all -Wl,--allow-undefined \
  -O2 -ffast-math \
  -o physics_engine.wasm physics_engine_wasm.c
```

Sem Emscripten. Sem Node.js. Sem dependências além do clang.

**Verificar exports após compilar:**

```bash
# Python puro — sem wasm-objdump
python3 -c "
import struct
with open('physics_engine.wasm','rb') as f: d=f.read()
print(f'{len(d)} bytes, magic: {d[:4].hex()}')
"
```

---

## Executar Localmente

O projeto é estático. Qualquer servidor HTTP funciona:

```bash
# Python 3 (sem instalação)
cd archimedes
python3 -m http.server 8080

# Node.js
npx serve .
```

Acesse `http://localhost:8080`.

**Atenção:** ES modules não funcionam via `file://`. Servidor HTTP é
obrigatório.

### Testes

```
http://localhost:8080/tests/test-runner.html
```

Cobertura: funções físicas (valores numéricos), store de estado, integridade
dos JSONs (campos obrigatórios, referências cruzadas válidas),
conservação de energia na integração numérica.

v1.2: suite de correctude adicional (Node.js) — 28 checks cobrindo todos os
22 simuladores: lifecycle, NaN/Infinity, testes quantitativos (F=ma, PV=nRT,
estabilidade de amplitude do MHS em 60 s com Velocity Verlet).

---

## PWA — Uso Offline

Após a primeira visita, o Archimedes funciona completamente offline:

- Service Worker pré-cacheia todos os assets no install
- Módulos JS, dados JSON, binário WASM e CSS ficam em cache local
- Network First para JSONs (atualiza automaticamente quando online)
- Cache First para assets estáticos (serve instantaneamente)

Para instalar como app no celular ou desktop: botão "Instalar" na barra do
navegador (Chrome/Edge) ou "Adicionar à tela inicial" (Safari iOS).

---

## Deploy no GitHub Pages

```bash
git init
git add .
git commit -m "v1.2.0"
git remote add origin https://github.com/LuddEvergard3n/archimedes.git
git push -u origin main
```

No repositório: **Settings → Pages → Source: Deploy from branch → main /
root**.

URL resultante: `https://luddevergard3n.github.io/archimedes/`

O Service Worker funciona em GitHub Pages sem configuração adicional.

---

## API de Simulação

Cada módulo exporta uma factory que retorna uma instância de simulação:

```js
// Ondas e Termodinâmica não usam chartCanvas
createOndasSimulation(simId, canvas)
createTermodinamicaSimulation(simId, canvas)

// Demais módulos
createMotionSimulation(simId, canvas, chartCanvas)
createForcesSimulation(simId, canvas, chartCanvas)
createEnergySimulation(simId, canvas, chartCanvas)
createFluidsSimulation(simId, canvas, chartCanvas)
createIntroSimulation(simId, canvas)
```

Interface de cada instância:

```js
simulation.start()            // inicia / retoma loop RAF
simulation.pause()            // pausa sem resetar estado
simulation.reset()            // volta ao estado inicial
simulation.setParam(key, val) // altera parâmetro ao vivo
simulation.onTimeUpdate(fn)   // callback: (t, readings) => void
simulation.dispose()          // cancela RAF, libera recursos
```

---

## Convenções de Código

- Nenhum framework — HTML, CSS, JS puros, sem transpilação
- ES2022 modules nativos — `import/export` direto no navegador
- Sem build step — o código-fonte é o código que executa
- Física em C/WASM, rendering em Canvas 2D, UI em JS de módulos
- Fallback explícito para WASM — nada quebra se o binário não carregar
- Comentários de contrato em todas as funções exportadas
- Constantes físicas declaradas no topo do módulo, nunca magic numbers

---

## Acessibilidade

- Navegação completa por teclado (`Space`/`k` = play/pause, `r` = reset, `h` = home)
- Alto contraste (botão no cabeçalho)
- Tamanho de fonte ajustável (A– / A+)
- Atributos ARIA em todos os elementos interativos
- Live region para leitores de tela
- Skip link para conteúdo principal
- Touch targets ≥ 44 px em mobile

---

## Licença

MIT — veja `LICENSE`.

---

## Ecossistema

O Archimedes faz parte de um conjunto de laboratórios educacionais estáticos,
todos hospedados no GitHub Pages, sem backend, sem framework.

| Projeto | Disciplina | Repositório | Site |
|---|---|---|---|
| **Archimedes** | Física | [github.com/LuddEvergard3n/archimedes](https://github.com/LuddEvergard3n/archimedes) | [luddevergard3n.github.io/archimedes/](https://luddevergard3n.github.io/archimedes/) |
| Euclides | Matemática | [github.com/LuddEvergard3n/euclides](https://github.com/LuddEvergard3n/euclides) | [luddevergard3n.github.io/euclides/](https://luddevergard3n.github.io/euclides/) |
| Heródoto | História | [github.com/LuddEvergard3n/Herodoto](https://github.com/LuddEvergard3n/Herodoto) | [luddevergard3n.github.io/Herodoto/](https://luddevergard3n.github.io/Herodoto/) |
| Quintiliano | Português e Literatura | [github.com/LuddEvergard3n/quintiliano](https://github.com/LuddEvergard3n/quintiliano) | [luddevergard3n.github.io/quintiliano/](https://luddevergard3n.github.io/quintiliano/) |
| Lavoisier | Química | [github.com/LuddEvergard3n/lavoisier](https://github.com/LuddEvergard3n/lavoisier) | [luddevergard3n.github.io/lavoisier/](https://luddevergard3n.github.io/lavoisier/) |
| Humboldt | Geografia | [github.com/LuddEvergard3n/humboldt](https://github.com/LuddEvergard3n/humboldt) | [luddevergard3n.github.io/humboldt/](https://luddevergard3n.github.io/humboldt/) |
| Johnson | Inglês | [github.com/LuddEvergard3n/johnson-english](https://github.com/LuddEvergard3n/johnson-english) | [luddevergard3n.github.io/johnson-english/](https://luddevergard3n.github.io/johnson-english/) |

