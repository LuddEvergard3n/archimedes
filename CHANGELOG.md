# Changelog

Todas as alterações relevantes ao projeto são registradas aqui.  
Formato: [Semantic Versioning](https://semver.org/lang/pt-BR/).

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
