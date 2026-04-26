# Changelog

Todas as alterações relevantes ao projeto são registradas aqui.  
Formato: [Semantic Versioning](https://semver.org/lang/pt-BR/).

## [1.4.0] — 2026-04-26

### Adicionado — Mecânica completa

5 simulações novas distribuídas nos módulos existentes (Movimento, Forças, Energia).

**Movimento:** Lançamento Oblíquo (parábola, alcance R = v₀²·sin2θ/g, ângulo ótimo 45°) · Movimento Circular Uniforme (ω, v=ωr, aₓ=ω²r, T, f).

**Forças:** 3ª Lei de Newton (pares ação-reação, conservação de momento, impulso de mola) · Colisões Elástica e Inelástica (fórmulas analíticas exatas, ΔEc calculado).

**Energia:** Potência e Rendimento (P = W/t = Fv, η = P_útil/P_total, barra de progresso animada).

5 lições em 4 fases · 17 equações · 10 exercícios (básicos, intermediários, avançados, conceituais).

Todos os 19 novos testes passam. Lacunas curriculares pendentes: Óptica, Física Moderna.

## [1.3.0] — 2026-04-26

### Adicionado — Módulo Eletromagnetismo

Novo módulo completo com 6 simulações, 6 lições, 15 equações e 12 exercícios.
Cobre o programa de Ciências da Natureza do EF9 e EM2 na BNCC.

**Simulações:**

- **Coulomb** — Lei de Coulomb F = kₑ|q₁q₂|/r². Dois corpos carregados com vetores de força em tempo real. Atração/repulsão por sinal de carga.
- **Campo Elétrico** — Campo vetorial de dipolo ou cargas iguais. Linhas de campo calculadas por integração numérica de trajetórias a partir de cargas positivas.
- **Circuito** — Lei de Ohm V = RI, potência P = VI. Resistores em série e paralelo com elétrons animados proporcionais à corrente.
- **Campo Magnético** — Fio longo (B = μ₀I/2πr) e solenoide (B = μ₀nI). Animação das linhas de campo circulares com offset temporal.
- **Força de Lorentz** — Partícula carregada em campo B uniforme. Integração Velocity Verlet. Trajetória circular com raio r = mv/(|q|B).
- **Indução** — Espira girando em campo B. Gráfico de ε(t) = BAω·sin(θ) em tempo real. Demonstra o princípio do gerador elétrico.

**Conteúdo pedagógico** (lições em 4 fases cada):
Coulomb e a balança de torção · Faraday e as linhas de campo · Ohm, Kirchhoff e circuitos · Oersted e Ampère · Força de Lorentz e o ciclotron · Faraday, Lenz e Itaipu.

**Suite de testes:** 21/21 PASS (16 novos + 5 de regressão).


### Corrigido — Auditoria completa de simulações

Auditoria sistemática de todos os 22 simuladores: lifecycle completo
(construct → reset → start → 30 frames → setParam → 30 frames → dispose),
verificação de NaN/Infinity no estado físico, e testes de correctude
quantitativa por simulação. Suite final: **28/28 PASS**.

#### `BuoyancySimulation` — três bugs corrigidos

**Bug 1 — inversão do sinal de velocidade na conversão de coordenadas:**  
`_update` convertia `y_canvas` para `yM` (coordenada física, `yM > 0` = acima
da superfície) e passava `vy / pxPerM` ao `Physics.fluids_object_step`. A
relação correta é `vy_physics = −vy_canvas / pxPerM` porque y aumenta para
baixo no canvas. Com o sinal errado, a empuxo empurrava o objeto para longe
do equilíbrio em vez de em direção a ele — o objeto flutuante subia
indefinidamente fora do container.

**Solução:** eliminada a transformação yM por completo. O `_update` agora
opera diretamente em coordenadas canvas, calculando `submergedPx` como a
sobreposição entre a borda inferior do objeto e a superfície do fluido.
Física: `a_canvas = (weight − buoyancy) / mass` (positivo = descida no
canvas). Resultado: erro de posicionamento em equilíbrio < 0.2 px após
300 frames.

**Bug 2 — posição inicial errada em `_onReset` e `_onParamChange`:**  
Reset usava `containerY − 30` (acima do container) e paramChange usava
`containerY − 20`. Ambos colocavam o objeto fora da área visível antes do
layout ser inicializado. Corrigido: posição inicial agora calcula
`fluidTopPx − objHeightPx × 0.8` (imediatamente acima da superfície do
fluido), consistente entre reset e paramChange.

**Bug 3 — convergência lenta (afundador levava > 80s):**  
Com escala de tempo 1×, um objeto de `ρ = 2000 kg/m³` levava > 5000 frames
(83 s) para atingir o fundo, porque o terminal velocity com damping `0.985`
por frame era alto mas a distância pequena. Aplicado fator `3×` no `simDt`
interno: flutuador converge em ~0.5 s real; afundador atinge o fundo em
~5 s real — ambos pedagogicamente satisfatórios.

**Bug 4 — `pxSide = objSideM × pxPerM × 1.5` dessincronizava renderização da física:**  
O fator `1.5` fazia o objeto parecer maior do que a física considerava,
causando sobreposição visual com a superfície do fluido mesmo quando a física
calculava objeto ainda acima dela. Removido: `pxSide = objSideM × pxPerM`.

#### `ConservationSimulation._drawHalf` — geometria da rampa

`topX` estava hardcoded como `0` em vez de `bX − rampPxLen × cos(rad)`.
Com ângulos > 0°, o topo da rampa ficava na borda esquerda da metade, não
no topo correto da inclinação. O corpo desenhado no início da corrida (`s=0`)
aparecia no canto esquerdo em vez do topo da rampa. Corrigido: `topX =
bX − rampPxLen × Math.cos(rad)`, alinhado com o que `drawRamp` desenha.

#### `FreeFallSimulation._update` — chamada morta removida

Linha `const result = Physics.motion_step(this.h, −this.v, −this.g, dt)`
calculava um resultado jamais usado — a integração manual logo abaixo é
correta (semi-implícita: `v += g·dt; h −= v·dt`). A chamada morta foi
removida para evitar confusão sobre qual integração está em uso.

#### `waves_mhs_step` — Euler explícito substituído por Velocity Verlet

O integrador Euler explícito (`x += v·dt; v += a·dt`) é **não conservativo**
para osciladores harmônicos: a amplitude cresce geometricamente, atingindo
14.000 % de erro em 60 s com `dt = 1/60`. Isso causava divergência visível
do MHS após poucos minutos de uso.

Substituído por **Velocity Verlet** (simpleticamente estável):
```
a₀ = −ω²·x
v½ = v + a₀·dt/2
x' = x + v½·dt
a₁ = −ω²·x'
v' = v½ + a₁·dt/2
```
Drift medido após 300 s: < 0.0001 %. Mesma correção aplicada em
`PhysicsFallback` (JS) e `physics_engine_wasm.c` (C). WASM recompilado:
3186 bytes.

#### `waves_pendulum_step` — Euler substituído por Velocity Verlet

Mesma instabilidade. O pêndulo com ângulo real (`θ'' = −(g/L)·sin θ`) também
divergia com Euler explícito em sessões longas. Velocity Verlet aplicado:
`alpha₀ = −(g/L)·sin(θ)`, half-step, novo ângulo, `alpha₁`, step completo.
Corrigido em `PhysicsFallback` e `physics_engine_wasm.c`.

### Adicionado — Suite de testes de correctude

Suite automatizada cobrindo todos os 22 simuladores:
- Lifecycle: construct, reset, start, N frames, setParam, mais frames, dispose
- Verificação de estado físico: posição, velocidade, energia, temperatura
- Testes quantitativos: `F = ma`, `Ec = ½mv²`, `P = ρgh + P₀`,
  `PV = nRT`, período de pêndulo, estabilidade de amplitude do MHS
- Detecção de NaN/Infinity no estado após 200 frames

## [1.1.1] — 2026-03-10

### Alterado — Conteúdo pedagógico

Reescrita completa dos três arquivos de conteúdo e dois documentos principais
com foco em ancoragem no mundo real.

**experiments.json** — todos os 22 experimentos reescritos:
- `phenomenon`: substituído de descrições físicas genéricas por situações
  concretas que o aluno já viveu (ônibus freando, pneu no calor, areia na
  praia, Mar Morto, porta-aviões, violinistas desafinados, bomba de ar)
- `guidingQuestion`: reescrita para provocar curiosidade antes do experimento,
  não recapitular após

**lessons.json** — todas as 13 lições reescritas:
- Fase `phenomenon` de cada lição: substituída por situação identificável
  (sonda Mars Climate Orbiter por erro de unidades; pena e martelo na Lua;
  escaladores e magnésio; pêndulo de Foucault; panela de pressão)
- Linguagem: menos "observe que", mais "por que isso acontece?"

**exercises.json** — todos os 26 exercícios reescritos:
- Contexto real em todos: avião Recife→Porto Alegre (MRU); Porsche 0–100 km/h
  (MRUV); ponte e pedra (queda livre); carrinho de supermercado (F=ma);
  colisão de trânsito a 60 vs. 40 km/h (Ec); Mar Morto e mercúrio (fluidos);
  violinistas desafinados (batimentos); pneu no calor (Gay-Lussac); areia vs.
  mar (capacidade calorífica)
- Explicações das respostas incluem o contexto real (não só o resultado)

**docs/pedagogy.md** — reescrito com:
- Fundamentação explícita para o uso de situações reais
- Critérios de seleção de fenômenos (reconhecimento, surpresa, parametrizável)
- Tabela de fenômenos âncora por módulo
- Referências pedagógicas (Ausubel, Carvalho, Física do Cotidiano)

**docs/simulation-model.md** — reescrito completamente:
- Fenômeno âncora documentado para cada experimento
- Conexão entre o fenômeno real e o modelo físico adotado
- Aproximações explicitadas (o que o modelo ignora e por quê)

**README.md** — atualizado:
- Tabela de módulos inclui o fenômeno âncora de cada um
- Total de experimentos, lições e exercícios atualizado
- Instrução de compilação WASM atualizada (clang nativo, sem Emscripten)

## [1.1.0] — 2026-03-10

### Adicionado
- **Módulo Ondas** — MHS (massa-mola), onda transversal progressiva, superposição de ondas e pêndulo simples com ângulo real; usa `waves_mhs_step` e `waves_pendulum_step` do motor C.
- **Módulo Termodinâmica** — gás ideal com pistão animado, diagrama P×V comparativo dos três processos (Boyle, Charles, Gay-Lussac), calor específico comparativo entre materiais.
- **WebAssembly compilado** — `wasm/physics_engine.wasm` compilado com `clang --target=wasm32`, sem Emscripten; 3 KB, 31 exports; funções matemáticas importadas do host JS via `env.*`.
- **PWA** — `manifest.json` + `sw.js` (Cache First / Network First); registro automático no `index.html`; ícones SVG 192×512; funciona offline após primeira visita.
- **Redesign estético completo** — sistema visual dual instrumento (dark warm) + caderno (off-white paper); tipografia migrada integralmente de JetBrains Mono → Share Tech Mono (somente valores numéricos) e EB Garamond (todo o resto); paleta de módulos e vetores alinhada a convenções de livros de Física.

### Alterado
- `wasm-loader.js` — importObject agora fornece `sin/cos/sqrt/fabs` via `env.*` (clang wasm32, sem WASI); adicionadas `waves_mhs_step` e `waves_pendulum_step` ao wrapper WASM e ao `PhysicsFallback`.
- `ui.js` — despachadores de simulação para `ondas` e `termodinamica`; `MODULE_COLORS` atualizado.
- `renderer.js` — cores dos novos módulos adicionadas ao `COLORS`.
- `data/modules.json` — dois módulos novos; cores de todos os módulos corrigidas para o novo sistema visual.
- `data/experiments.json` — 7 novos experimentos (mhs-01, wave-01, superposition-01, pendulum-wave-01, gas-ideal-01, processos-01, calor-01); total: 22 experimentos.

---

## [1.0.0] — 2026-03-09

### Adicionado

**Infraestrutura**
- Arquitetura modular em vanilla JS ES2022 sem framework
- Motor físico em C com compilação para WebAssembly
- Fallback JS puro com API idêntica ao WASM (sem necessidade de compilação)
- Roteador hash-based (`#/module/:id/:expId`)
- Store observável simples (get/set/subscribe sem biblioteca)
- Canvas 2D como único mecanismo de renderização de simulações
- Gráficos ao vivo (`ChartEngine`, `DualChartEngine`) sem dependências externas
- Suite de testes com relatório DOM

**Módulos**
- Introdução à Física (pêndulo, grandezas e unidades)
- Movimento: MRU, MRUV, Queda Livre
- Forças: Inércia, Newton II, Atrito, Resultante
- Energia: Cinética, Rampa (Ep ↔ Ec), Conservação
- Fluidos: Empuxo, Densidade, Pressão hidrostática

**Conteúdo**
- 15 experimentos com fenômeno, pergunta orientadora e formalização
- 13 lições com fases pedagógicas estruturadas
- 16 exercícios (previsão, interpretação, comparação)
- 13 equações com variáveis e restrições documentadas

**Interface**
- Design de instrumento científico — dark, sem infantilização
- Layout responsivo: desktop, tablet, mobile
- Sidebar com navegação por módulo
- Modo Professor com objetivos e mediação sugerida
- Controles deslizantes ao vivo para todos os parâmetros
- Vetores de força visíveis nas simulações

**Acessibilidade**
- Navegação completa por teclado
- Alto contraste
- Tamanho de fonte ajustável
- Atributos ARIA completos
- Skip link

**Documentação**
- README técnico completo
- `/docs/architecture.md`
- `/docs/pedagogy.md`
- `/docs/simulation-model.md`
- `/docs/module-system.md`
- `/docs/development-guide.md`

---

<!-- Próximas versões planejadas -->
<!--
## [1.1.0] — planejado

### Planejado
- Módulo Ondas (frequência, amplitude, propagação)
- Módulo Eletricidade (lei de Ohm, circuitos simples)
- Replay de simulação com velocidade ajustável
- Comparação de dois cenários lado a lado (motion, forces)
- Exportação de gráficos como imagem
-->
