/* Shared theme preference for the app shell and static pages. */
(() => {
  const buttons = [...document.querySelectorAll('[data-theme-toggle]')];
  if (buttons.length === 0) return;

  const apply = (active) => {
    document.documentElement.classList.toggle('dark-mode', active);
    buttons.forEach(button => {
      button.setAttribute('aria-pressed', String(active));
      button.textContent = active ? 'Modo claro' : 'Modo escuro';
    });
    try { localStorage.setItem('archimedes-dark-mode', active ? '1' : '0'); }
    catch (_) {}
  };

  try { apply(localStorage.getItem('archimedes-dark-mode') === '1'); }
  catch (_) { apply(false); }

  buttons.forEach(button => button.addEventListener('click', () => {
    apply(!document.documentElement.classList.contains('dark-mode'));
  }));
})();
