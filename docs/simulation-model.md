# Modelo de Simulação — Archimedes

## Loop de simulação

Todas as simulações usam `requestAnimationFrame`:

```js
_loop() {
  this._raf = requestAnimationFrame(ts => {
    const dt = Math.min((ts - this._lastTs) / 1000, 0.033); // cap a ~30fps equiv.
    this._update(dt);   // física
    this._render();     // desenho
    this._loop();
  });
}
```

O delta time é limitado a 33ms para evitar instabilidade numérica se o frame demorar (aba em segundo plano, etc.).

## Integração numérica

Usa integração de Euler simples:

```
v_{n+1} = v_n + a · dt
x_{n+1} = x_n + v_n · dt
```

Para as simulações implementadas (movimento retilíneo, rampa, fluidos), Euler com dt ≤ 33ms produz erro < 1% em comparação com a solução analítica. Integradores de ordem superior (Verlet, RK4) estão reservados para versões futuras caso simulações mais complexas sejam adicionadas.

## Precisão numérica

- Todas as funções físicas usam `double` (64-bit) — tanto no C/WASM quanto no JS
- A conservação de energia no JS fallback é verificada nos testes com tolerância de 2% (integração numérica acumula erro)
- Comparações de densidade usam `>`, `<`, `===` diretos sem epsilon (as diferenças são sempre ≥ 50 kg/m³)

## Coordenadas de canvas

```
(0,0) ─────────────────→ x
  │
  │
  ↓ y
```

- Y cresce para baixo (padrão Canvas)
- Em simulações verticais (queda livre, fluidos), o código converte coordenadas físicas (y cresce para cima) para canvas antes de renderizar
- Vetores de velocidade para cima têm dy negativo no canvas

## Simulações: parâmetros e saída

### motion_step(x, v, a, dt)
Entrada: posição atual (m), velocidade (m/s), aceleração (m/s²), delta t (s)  
Saída: `{ x: número, v: número }`

### forces_step(x, v, F_app, mass, mu_k, N, has_friction, dt)
Calcula atrito cinético/estático internamente.  
Retorna `{ x, v }`.

### energy_ramp_step(s, v, max_s, angle_rad, mass, mu_k, has_friction, g, dt)
`s` = distância percorrida ao longo da rampa (0 = topo, max_s = base).  
Retorna `{ s, v, height }` onde `height` é a altura física atual.

### fluids_object_step(y, v, ...)
`y` = posição vertical do centro do objeto (m), 0 = superfície do fluido, positivo = acima.  
Calcula volume submerso, empuxo, força líquida e integra.  
Retorna `{ y, v, submerged_fraction }`.

## Amortecimento em fluidos

A simulação de fluidos aplica amortecimento viscoso simplificado (`v *= 0.97` por frame) para evitar oscilação infinita. Isso não representa viscosidade real, mas produz comportamento visualmente correto para o propósito educacional.
