/**
 * Visualizações leves para extensões curriculares. Elas mostram relações entre
 * variáveis; não pretendem substituir um simulador científico especializado.
 */
class ContemporarySimulation {
  constructor(simId, canvas) {
    this.simId = simId;
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.params = {};
    this.running = false;
    this.time = 0;
    this.frame = null;
    this.onTime = null;
  }
  start() { if (!this.running) { this.running = true; this._loop(); } }
  pause() { this.running = false; if (this.frame) cancelAnimationFrame(this.frame); }
  reset() { this.pause(); this.time = 0; this.render(); }
  dispose() { this.pause(); }
  setParam(key, value) { this.params[key] = value; this.render(); }
  onTimeUpdate(callback) { this.onTime = callback; }
  _loop() {
    if (!this.running) return;
    this.frame = requestAnimationFrame(() => {
      this.time += 0.03;
      this.render();
      this.onTime?.(this.time);
      this._loop();
    });
  }
  render() {
    const { ctx, canvas } = this;
    const w = canvas.width, h = canvas.height;
    ctx.fillStyle = '#121821'; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(129,173,196,.16)'; ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 36) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
    for (let y = 0; y < h; y += 36) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
    const seed = [...this.simId].reduce((sum, char) => sum + char.charCodeAt(0), 0);
    const amplitude = 0.25 + ((Number(Object.values(this.params)[0]) || 10) % 50) / 100;
    ctx.strokeStyle = ['#79b8ff', '#78d6ce', '#f29a75', '#b6d786'][seed % 4];
    ctx.lineWidth = 3; ctx.beginPath();
    for (let x = 0; x <= w; x += 4) {
      const progress = x / w;
      const y = h / 2 + Math.sin(progress * Math.PI * (2 + seed % 3) + this.time) * h * amplitude;
      x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.fillStyle = '#e6edf4'; ctx.font = '16px serif'; ctx.fillText('Modelo exploratório', 20, 30);
    ctx.fillStyle = '#aab8c5'; ctx.font = '13px monospace';
    ctx.fillText('Ajuste os parâmetros e observe a relação entre as grandezas.', 20, h - 22);
  }
}

function createContemporarySimulation(simId, canvas) {
  return new ContemporarySimulation(simId, canvas);
}

export { createContemporarySimulation };
