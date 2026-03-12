# Modelo de Simulação — Archimedes

Este documento descreve o modelo físico de cada experimento: o fenômeno real
de referência, as aproximações adotadas, e as situações do mundo real usadas
como âncoras pedagógicas.

---

## Movimento

### MRU — Movimento Retilíneo Uniforme

**Fenômeno âncora:** Um avião de carreira cruzando o Brasil de Recife a Porto
Alegre (~3.800 km) em velocidade de cruzeiro constante de 850–950 km/h.

**Modelo:** `x(t) = x₀ + v·t`

**Aproximações:**
- Velocidade estritamente constante (sem vento, sem variação de altitude)
- Movimento unidimensional
- Sem resistência do ar

**Parâmetros expostos:** velocidade inicial, posição inicial.

**O que observar:** No gráfico x×t, a inclinação da reta é exatamente a
velocidade. Velocidade negativa gera reta descendente. Velocidade zero gera
reta horizontal. Isso é tudo que o MRU tem para mostrar — e é suficiente.

---

### MRUV — Movimento Retilíneo Uniformemente Variado

**Fenômeno âncora:** Fabricantes de carros esportivos anunciam o tempo de
0 a 100 km/h. Um Porsche 911 faz em 3,5 s (a ≈ 7,9 m/s²). Um caminhão
carregado leva 40 s (a ≈ 0,7 m/s²).

**Modelo:** `v(t) = v₀ + a·t`, `x(t) = x₀ + v₀t + ½at²`

**Aproximações:**
- Aceleração perfeitamente constante (sem mudança de marcha, sem resistência
  do ar)
- Movimento unidimensional

**Parâmetros expostos:** aceleração, velocidade inicial.

**O que observar:** O gráfico v×t é reta — inclinação = aceleração. O gráfico
x×t é parábola — dobrar a aceleração não dobra a posição em tempo fixo.

---

### Queda Livre

**Fenômeno âncora:** Em 1971, David Scott (Apollo 15) soltou simultaneamente
uma pena e um martelo na superfície da Lua (sem atmosfera). Chegaram ao
solo juntos. O experimento foi transmitido ao vivo.

**Modelo:** Caso especial de MRUV com a = g, v₀ = 0, x₀ = h.

**Aproximações:**
- Sem resistência do ar (queda no vácuo)
- g constante ao longo da queda (válido para h << raio da Terra)

**Parâmetros expostos:** altura inicial, massa (para demonstrar independência).

**O que mostrar:** Variar a massa não altera o tempo de queda. A surpresa
pedagógica: o resultado contraria a intuição cotidiana (pena × pedra no ar),
que é distorcida pela resistência do ar — não pela física da gravidade.

---

## Forças

### Inércia — Primeira Lei de Newton

**Fenômeno âncora:** Passageiro de ônibus que freia bruscamente "vai para a
frente". O passageiro não foi empurrado — o ônibus parou, ele continuou.

**Modelo:** Se ΣF = 0, então a = 0 (estado de movimento não muda).

**Aproximações:**
- Piso sem atrito para demonstrar o caso ideal
- Corpo puntiforme

**O que observar:** No modo sem atrito, o objeto empurrado continua
indefinidamente. No modo com atrito, desacelera. A diferença entre os dois
modos é a demonstração da inércia vs. dissipação.

---

### Segunda Lei de Newton

**Fenômeno âncora:** Carrinho de supermercado vazio vs. cheio. Mesma força
aplicada, aceleração muito diferente.

**Modelo:** `F = m·a`, ou `a = F/m`

**O que observar:** Dobrar a força dobra a aceleração (proporcional). Dobrar
a massa reduz a aceleração à metade (inversamente proporcional). Dobrar ambos:
aceleração inalterada. Esse é o conteúdo completo da Segunda Lei.

---

### Atrito Cinético

**Fenômeno âncora:** Escaladores de pedra usam pó de magnésio para aumentar
o atrito. Em rocha molhada, μ cai de ~0,9 para ~0,4 — diferença entre
segurar e cair.

**Modelo:** `f = μₖ · N`

**Aproximações:**
- Atrito cinético (objeto já em movimento)
- μₖ constante (independente da velocidade, da área de contato)
- Normal = peso (superfície horizontal)

**O que mostrar:** Dobrar a massa dobra o atrito (via normal). Dobrar a área
de contato: sem efeito. Isso é contraintuitivo — a área não aparece na equação.

---

### Força Resultante

**Fenômeno âncora:** Barco tentando atravessar um rio em linha reta.
A correnteza empurra para o lado — o barco chega numa posição diferente de
onde mirava.

**Modelo:** Composição vetorial de duas forças com ângulo e módulo variáveis.

---

## Energia

### Energia Cinética

**Fenômeno âncora:** Limite de velocidade em zonas residenciais. A diferença
entre 40 km/h e 60 km/h parece pequena — mas a energia cinética cresce com
v², então um carro a 60 km/h tem 2,25× mais energia que a 40 km/h. A
distância de frenagem cresce na mesma proporção.

**Modelo:** `Ec = ½·m·v²`

**O que mostrar:** Dobrar a velocidade quadruplica a energia (relação v²).
Dobrar a massa dobra a energia (relação linear). A velocidade tem impacto
quadrático — este é o ponto central.

---

### Energia Potencial e Rampa

**Fenômeno âncora:** Skatista na rampa. Quanto mais alto o bordo, mais rápido
na saída. Parques aquáticos calculam a altura mínima para que o usuário
complete a curva sem parar.

**Modelo:** `Ep = m·g·h`, conversão Ep → Ec via conservação.

**Integração numérica:** Euler simples com dt ≤ 1/60 s. Para a rampa com
atrito, `a = g·sin(θ) − μₖ·g·cos(θ)`.

**Aproximações:**
- Corpo puntiforme (sem rotação)
- Atrito cinético constante ao longo da rampa

---

### Conservação de Energia

**Fenômeno âncora:** Pêndulo de Newton (esferas metálicas de mesa). A última
esfera sempre volta à mesma altura. Observando por horas, ela perde altura
muito lentamente — o ar e a suspensão absorvem pequenas quantidades.

**Modelo:** `Ep + Ec = cte` (sem dissipação). Com atrito: `ΔEmec = −W_atrito`.

**O que mostrar:** Com atrito desligado, a soma Ep + Ec é constante no gráfico.
Com atrito ligado, a soma decresce. A energia não desaparece — vira calor.

---

## Fluidos

### Densidade e Flutuação

**Fenômeno âncora:** Mar Morto (ρ ≈ 1240 kg/m³) — impossível afundar.
Piscina comum (ρ = 1000 kg/m³) — precisa nadar para flutuar.
Densidade humana média: ~985 kg/m³.

**Modelo:** `ρ = m/V`. Flutua se ρ_obj < ρ_fluido.

**O que mostrar:** Encontrar o ponto exato de equilíbrio neutro (ρ_obj =
ρ_fluido). Peixe-bexiga: controla volume para manter equilíbrio.

---

### Empuxo — Princípio de Arquimedes

**Fenômeno âncora:** Porta-aviões USS Gerald R. Ford — 100.000 toneladas de
aço flutuando. Um prego de 5 g afunda. Ambos são aço. A diferença é a forma:
o porta-aviões é oco; sua densidade média (com ar interno) é menor que a da água.

**Modelo:** `E = ρ_f · g · V_sub`

**Integração numérica:** A posição vertical do objeto é integrada a cada frame
diretamente em coordenadas canvas. A fração submersa é calculada como a
sobreposição entre a borda inferior do objeto e a superfície do fluido.
`a_canvas = (peso − empuxo) / massa` (positivo = descida). Amortecimento
viscoso de 1,5% por frame. Escala de tempo interna 3× para que flutuador
converja em ~0,5 s e afundador atinja o fundo em ~5 s.

**O que mostrar:** O empuxo depende do volume submerso e da densidade do fluido
— não do material do objeto. Um cubo de madeira e um de chumbo do mesmo
tamanho, totalmente submersos no mesmo fluido, recebem o mesmo empuxo.

---

### Pressão Hidrostática

**Fenômeno âncora:** Mergulhadores sentem os ouvidos doer a partir de 2–3 m.
Submarinos classe Los Angeles operam a 300 m (30 atm). A 600 m, o casco
seria esmagado.

**Modelo:** `P = P₀ + ρ·g·h`

**O que mostrar:** A pressão cresce linearmente com a profundidade. Dobrar h
dobra ΔP. Fluido mais denso → pressão maior na mesma profundidade.

---

## Ondas

### MHS — Massa-Mola

**Fenômeno âncora:** Metrônomo de músico — calibrado para uma frequência
específica. O período muda com a massa e com a constante da mola, mas não com
a amplitude.

**Modelo:** `x'' = −(k/m)·x`, `T = 2π·√(m/k)`, `ω = √(k/m)`

**Integração numérica:** Velocity Verlet via `waves_mhs_step`. O integrador
de Euler explícito é instável para osciladores harmônicos (a energia cresce
geometricamente com o tempo). Velocity Verlet é simpleticamente estável:
conserva energia exatamente para o caso linear. Drift medido: < 0,0001 % em
300 s com `dt = 1/60`. Sem amortecimento (para demonstrar isocronia de amplitude).

**O que mostrar:** Dobrar a amplitude não muda o período. Quadruplicar a massa
dobra o período (relação raiz quadrada). Quadruplicar k reduz o período à metade.

---

### Onda Transversal Progressiva

**Fenômeno âncora:** Cordas do violão. Todas têm o mesmo comprimento, mas
produzem notas diferentes. A frequência depende da tensão e da massa linear
— por isso afinar muda a nota.

**Modelo:** `y(x,t) = A·sin(kx − ωt)`, com `k = 2π/λ`, `ω = 2πf`, `v = f·λ`

**Renderização:** 200 pontos por frame, calculados via `waves_displacement`.

**O que mostrar:** `v = f·λ` — a velocidade é propriedade do meio. Dobrar f
(mantendo v) divide λ pela metade. Rádio AM (λ ≈ 550 m) vs. FM (λ ≈ 3 m):
mesma velocidade de propagação (c), frequências diferentes.

---

### Superposição e Interferência

**Fenômeno âncora:** Dois violinistas levemente desafinados (440 Hz e 443 Hz)
produzem batimentos a 3 Hz — o som pulsa 3 vezes por segundo. Técnicos de
afinação usam batimentos para afinar instrumentos sem equipamento eletrônico.

**Modelo:** `y = y₁ + y₂ = A₁·sin(k₁x − ω₁t) + A₂·sin(k₂x − ω₂t + φ)`

**Frequência de batimento:** `f_bat = |f₁ − f₂|`

**O que mostrar:** Interferência construtiva (φ = 0), destrutiva (φ = π),
batimentos (f₁ ≈ f₂). Quando f₁ = f₂ e φ = π, as ondas se cancelam
completamente.

---

### Pêndulo Simples

**Fenômeno âncora:** Relógio de pêndulo — mais preciso durante 270 anos por
uma razão: o período depende apenas de L. Independe de massa, independe de
amplitude (ângulos pequenos). Isso o torna estável mesmo com variações.
O pêndulo de Foucault no Panteão de Paris (L = 67 m, T ≈ 16,4 s) prova a
rotação da Terra.

**Modelo:** `θ'' = −(g/L)·sin(θ)`

**Integração numérica:** Velocity Verlet via `waves_pendulum_step`.
Equação completa com sin(θ) — não a aproximação de pequeno ângulo. Isso
significa que para ângulos grandes (θ > 15°), o período é visivelmente maior
que a fórmula de pequeno ângulo prevê. Sub-stepping 4× mantido para
precisão adicional em amplitudes altas.

**O que mostrar:** Variar L muda o período (T ∝ √L). Variar massa: sem efeito.
Variar θ₀: sem efeito para ângulos pequenos. Para ângulos grandes, o período
aumenta levemente — isso é visível na simulação e invisível na fórmula padrão.

---

## Termodinâmica

### Gás Ideal — Pistão

**Fenômeno âncora:** Pneu de bicicleta endurece no calor de verão e murcha
levemente no frio. Bomba de ar manual aquece durante uso — você comprime
o gás e converte trabalho mecânico em temperatura. Garrafa PET fechada
na geladeira amassa ao sair para o ambiente.

**Modelo:** `PV = nRT` com R = 8,314 J/(mol·K)

**Visualização:** Pistão animado com posição proporcional a V. Cor do gás
muda com T (frio = azul, quente = laranja). Diagrama P×V ao vivo com isotérmica
pontilhada para a temperatura atual e ponto indicando estado atual.

**O que mostrar:** V × (1/2) → P × 2 (Boyle, T cte). T × 2 → V × 2 (Charles,
P cte). T × 2 → P × 2 (Gay-Lussac, V cte).

---

### Processos Termodinâmicos

**Fenômeno âncora:**
- **Isocórico (V = cte):** Panela de pressão — vapor não pode escapar, pressão
  sobe com a temperatura. Frango cozinha em 20 min em vez de 1 h porque a
  água ferve a 120 °C em vez de 100 °C.
- **Isobárico (P = cte):** Bexiga aquecida — dilata livremente. Volume cresce
  com temperatura.
- **Isotérmico (T = cte):** Êmbolo de seringa puxado muito devagar (quasi-
  estático). P × V = constante.

**Modelo:** Três curvas sobrepostas no diagrama P×V, com animação de traçado.

**O que mostrar:** No diagrama P×V, a área sob a curva é o trabalho. O processo
isobárico realiza o maior trabalho externo (linha horizontal, P constante, ΔV
máximo). O isocórico não realiza trabalho (ΔV = 0).

---

### Capacidade Calorífica

**Fenômeno âncora:** Areia na praia queima os pés ao meio-dia; o mar continua
agradável. Ambos receberam o mesmo sol. A areia (c = 840 J/(kg·K)) aquece
5× mais que a água (c = 4186 J/(kg·K)) com o mesmo calor. O oceano é o
regulador climático das cidades costeiras por esse motivo.

**Modelo:** `Q = m·c·ΔT`

**Materiais simulados:** Água (c = 4186), Ferro (c = 449), Alumínio (c = 900),
Cobre (c = 385), Vidro (c = 840).

**Visualização:** Dois blocos com barras de temperatura; cor dos blocos muda
com T; gráfico T×Q ao vivo para os dois materiais.

**O que mostrar:** Mesma massa, mesmo calor → temperaturas finais radicalmente
diferentes. Material com menor c aquece muito mais rápido. Por isso panelas são
de ferro/alumínio (c baixo → aquece rápido) e não de água.

---

## Modelo numérico geral

A maioria das simulações usa integração de Euler semi-implícita com
`dt ≤ 1/60 s` (cap pelo frame do `requestAnimationFrame`).

**Exceções — Velocity Verlet:**

| Simulação | Motivo |
|---|---|
| `waves_mhs_step` | Euler explícito diverge: 14.000% de erro em 60 s |
| `waves_pendulum_step` | Mesma instabilidade; sub-stepping 4× adicional |

Velocity Verlet para osciladores: `v½ = v + a(x)·dt/2`, `x' = x + v½·dt`,
`v' = v½ + a(x')·dt/2`. Simpleticamente estável — conserva energia
exatamente para o caso linear, com erro O(dt⁴) para o não-linear.

O motor C (`physics_engine_wasm.c`) e o fallback JS (`PhysicsFallback` em
`wasm-loader.js`) produzem resultados numericamente equivalentes. Qualquer
diferença numérica entre os dois é um bug.

Funções trigonométricas no motor C são fornecidas pelo host JS via `env.*`
(importObject) — sem libm, sem WASI.
