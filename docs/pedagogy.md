# Pedagogia — Archimedes

## Princípio fundamental

A Física começa com o fenômeno, não com a equação.

O aluno que decora `F = ma` sem ter manipulado força e massa não aprendeu
Física — aprendeu a reconhecer símbolos. O objetivo do Archimedes é inverter
essa ordem: a equação é consequência de observações acumuladas, não ponto de
partida.

---

## Sequência obrigatória de cada lição

```
1. Fenômeno real     — situação concreta que o aluno já viveu ou pode imaginar
2. Pergunta guiada   — "O que você acha que acontece se...?"
3. Experimento       — visualização interativa do fenômeno
4. Manipulação       — o aluno altera variáveis e observa os efeitos
5. Observação        — leitura dos resultados no gráfico / HUD
6. Formalização      — a equação como síntese do que foi observado
7. Exercício         — aplicação em situação real, não abstrata
```

Nenhuma etapa pode ser pulada. O aluno não vê a equação antes de ter
manipulado o fenômeno.

---

## Por que situações do mundo real

Exercícios abstratos — "um corpo parte com v₀ = 5 m/s" — não ativam o
conhecimento prévio do aluno. Ele resolve mecanicamente e esquece.

Situações concretas criam âncoras cognitivas: o aluno já sentiu um ônibus
frear bruscamente, já encheu um pneu, já foi à praia. Quando o fenômeno
físico se conecta a uma experiência vivida, a retenção é diferente.

**Critério de seleção de fenômenos:**

- O aluno já encontrou isso na vida, ou vai encontrar em breve
- O resultado é surpreendente o suficiente para gerar curiosidade
- A situação pode ser parametrizada na simulação
- Existe uma pergunta causal clara ("por que X acontece?")

**Exemplos adotados por módulo:**

| Módulo | Fenômeno âncora |
|---|---|
| Movimento | Avião cruzando o Brasil em velocidade de cruzeiro |
| Forças | Carrinho de supermercado vazio vs. cheio |
| Energia | Limite de velocidade: por que 60 km/h é muito mais perigoso que 40 km/h |
| Fluidos | Mar Morto: impossível afundar; prego de aço: afunda imediatamente |
| Ondas | Violinistas desafinados produzindo batimentos audíveis |
| Termodinâmica | Areia quente na praia, mar agradável — mesmo sol, mesma hora |

---

## Tipos de exercício

| Tipo | Descrição | Exemplo |
|---|---|---|
| Previsão | Calcule antes de ver | "A bomba de ar fica quente — por quê? Qual é a nova pressão?" |
| Interpretação | Leia o gráfico / resultado | "O que a inclinação da reta v×t representa?" |
| Comparação | Duas situações, qual é diferente e por quê | "Carro a 30 vs. 60 km/h — quanto muda a distância de frenagem?" |

Exercícios puramente mecânicos (substituição direta de variável sem
interpretação) são evitados. O objetivo é sempre compreensão causal.

---

## O que o sistema evita

- Começar com equação
- "Um corpo de massa m..." sem contexto físico identificável
- Múltipla escolha como único tipo de avaliação
- Separar teoria de experimento em seções distintas
- Notas numéricas que incentivam decorar sem entender

---

## Dicas (hint system)

As dicas não entregam a resposta. Elas:

- Identificam qual variável observar
- Pedem que o aluno compare dois casos na simulação
- Indicam a sequência de passos sem resolver

**Correto:** "Observe o gráfico Ec×v. O que acontece quando você dobra a
velocidade? Compare com dobrar a massa."

**Incorreto:** "A energia cinética é proporcional ao quadrado da velocidade."

---

## Modo Professor

Cada experimento inclui metadados visíveis no modo professor:

- Objetivo pedagógico da lição
- Variável principal a ser investigada
- Observação esperada pelo aluno
- Mediação sugerida para dificuldades comuns
- Critério de resposta dos exercícios
- Tempo estimado (5–12 min por experimento)
- Conexões com outros módulos

---

## Sobre os fenômenos escolhidos

Os fenômenos não são "aplicações" inseridas ao final para parecer prático.
Eles são o ponto de partida — e foram escolhidos por três critérios:

**1. Reconhecimento imediato.** O aluno já passou por isso. O ônibus que
freia. O pneu que murcha no frio. A areia quente da praia.

**2. Surpresa calibrada.** O resultado deve ser não-óbvio o suficiente para
gerar curiosidade, mas não tão distante que pareça magia. "Por que o pneu
fica mais duro no calor?" é mais eficaz que "explique a lei dos gases ideais".

**3. Parametrizável.** O fenômeno pode ser manipulado na simulação. Não
adianta falar de tsunami se não há como variar algo e observar o efeito.

---

## Referências pedagógicas

A abordagem é baseada em:

- **Inquiry-based learning** (aprendizagem por investigação)
- **Aprendizagem significativa** (Ausubel) — ancoragem em conhecimento prévio
- **Sequência de ensino investigativa** (Carvalho et al.) — fenômeno → questão
  → experimentação → sistematização
- **Física do Cotidiano** — tradição da literatura brasileira de ensino de
  Física que prioriza situações reais sobre abstrações

O modelo de "fenômeno primeiro, equação depois" não é novo. O que o
Archimedes implementa é esse modelo numa interface interativa que permite ao
aluno realmente manipular variáveis — o que o laboratório físico tradicional
raramente viabiliza.
