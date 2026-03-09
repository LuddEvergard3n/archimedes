# Guia de Desenvolvimento — Archimedes

## Pré-requisitos

- Navegador moderno com suporte a ES2022 modules (Chrome 90+, Firefox 89+, Safari 15+)
- Servidor HTTP local (veja abaixo)
- emscripten (opcional, apenas para compilar o motor WASM)

## Executar em desenvolvimento

```bash
# Python 3 (qualquer plataforma)
python3 -m http.server 8080

# Node.js
npx serve .

# Caddy
caddy file-server --root . --listen :8080
```

Acesse `http://localhost:8080`.

## Adicionar um novo experimento

1. **Defina o experimento em `data/experiments.json`:**

```json
{
  "id": "meu-exp-01",
  "module": "motion",
  "title": "Título do experimento",
  "phenomenon": "Descrição do fenômeno observável.",
  "variables": ["variavel1", "variavel2"],
  "equations": ["F = m·a"],
  "question": "Pergunta orientadora?",
  "simulation": "meu-sim-id",
  "phase": "phenomenon",
  "difficulty": 1,
  "duration_min": 15
}
```

2. **Adicione a lição em `data/lessons.json`** com as fases pedagógicas.

3. **Implemente a simulação no módulo correspondente.**  
   Crie uma classe que estende `SimBase` e exporte na factory `createXxxSimulation`.

4. **Adicione as equações em `data/equations.json`** com `experiment_ids` referenciando o novo experimento.

5. **Adicione exercícios em `data/exercises.json`** com `experiment_id` correto.

6. **Atualize `data/modules.json`** para incluir o novo experimento no array `experiments` do módulo.

## Adicionar um novo módulo

1. Criar diretório `modules/<nome>/`
2. Criar `modules/<nome>/<nome>.js` com factory `createNomeSimulation(simId, canvas, chartCanvas)`
3. Registrar o módulo em `data/modules.json`
4. Adicionar no loader de `ui.js → _loadSimulation()`:

```js
nome: () => import('../modules/nome/nome.js').then(m => m.createNomeSimulation(simId, canvas, chartCanvas)),
```

5. Adicionar a cor do módulo em `js/ui.js → MODULE_COLORS`

## Estrutura de uma simulação

```js
class MinhaSimulacao extends SimBase {
  constructor(canvas, chartCanvas) {
    super(canvas);
    // Inicializar estado físico e params
    this.params = { variavel: valorDefault };
  }

  _onReset() {
    // Restaurar estado inicial a partir de this.params
  }

  _onParamChange(key, value) {
    // Reagir a mudança de parâmetro (resetar trail, limpar gráfico...)
  }

  _update(dt) {
    // Chamar Physics.xxx_step(...)
    // Atualizar estado físico
    // Adicionar ponto ao chart se necessário
    this.time += dt;
  }

  _render() {
    // clearCanvas, drawGrid
    // Desenhar corpos, vetores, labels
    // chart.render()
  }
}
```

## Rodar testes

```
http://localhost:8080/tests/test-runner.html
```

Para adicionar um teste:

```js
// Em tests/test-runner.js, dentro de uma função testXxx():
assertApprox('descrição', valorCalculado, valorEsperado, tolerancia);
assertTrue('descrição', condicao, 'nota de debug');
assertEqual('descrição', valorAtual, valorEsperado);
```

## Compilar WASM (opcional)

```bash
cd wasm
emcc physics_engine.c -O2 -s WASM=1 \
  -s EXPORTED_FUNCTIONS='["_motion_position","_motion_velocity","_forces_acceleration","_forces_friction","_forces_weight","_energy_kinetic","_energy_potential","_energy_work","_fluids_buoyancy","_fluids_net_force","_fluids_pressure","_fluids_equilibrium_fraction"]' \
  -s EXPORTED_RUNTIME_METHODS='[]' \
  --no-entry \
  -o physics_engine.wasm
```

O arquivo `physics_engine.wasm` deve ir para `wasm/physics_engine.wasm`.

## Convenções

- Nunca use `innerHTML` para dados vindos do usuário (XSS)
- Toda função pública deve ter JSDoc com `@param` e `@returns`
- Nenhuma dependência NPM em runtime
- Imports sempre com extensão `.js` explícita
- Nenhum `console.log` em produção (use `console.info` com prefixo `[módulo]`)
- Simulações devem funcionar corretamente com dt entre 1ms e 33ms
