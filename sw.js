/**
 * sw.js — Service Worker do Archimedes
 *
 * Estratégia: Cache First para assets estáticos, Network First para dados.
 *
 * Fluxo:
 *   install  → pré-cacheia todos os assets do APP_SHELL
 *   activate → remove caches de versões antigas
 *   fetch    → serve do cache se disponível; atualiza em background
 *
 * Versão do cache: incrementar CACHE_VERSION a cada deploy.
 */

const CACHE_VERSION = 'v1.6.0';
const CACHE_STATIC  = `archimedes-static-${CACHE_VERSION}`;
const CACHE_DATA    = `archimedes-data-${CACHE_VERSION}`;

/* Assets do app shell — cacheados no install */
const APP_SHELL = [
  './',
  './index.html',
  './sobre.html',
  './referencia.html',
  './guia-professor.html',
  './plano-de-aula.html',
  './manifest.json',

  /* CSS */
  './css/theme.css',
  './css/base.css',
  './css/layout.css',
  './css/components.css',
  './css/mobile.css',

  /* JS core */
  './js/main.js',
  './js/state.js',
  './js/router.js',
  './js/wasm-loader.js',
  './js/ui.js',
  './js/accessibility.js',

  /* Engine */
  './engine/renderer.js',
  './engine/chart-engine.js',

  /* Módulos */
  './modules/intro/intro.js',
  './modules/motion/motion.js',
  './modules/forces/forces.js',
  './modules/energy/energy.js',
  './modules/fluids/fluids.js',
  './modules/ondas/ondas.js',
  './modules/termodinamica/termodinamica.js',

  /* Dados */
  './data/modules.json',
  './data/experiments.json',
  './data/lessons.json',
  './data/exercises.json',
  './data/equations.json',

  /* WASM */
  './wasm/physics_engine.wasm',

  /* Ícones */
  './assets/icons/icon-192.svg',
  './assets/icons/icon-512.svg',
];

/* ── Install — pré-cacheia o app shell ─────────────────────────────────────── */

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_STATIC).then((cache) => {
      /* addAll falha silenciosamente para URLs inválidas; usamos add individual */
      return Promise.allSettled(
        APP_SHELL.map(url => cache.add(url).catch(err => {
          console.warn(`[sw] Não foi possível cachear: ${url}`, err.message);
        }))
      );
    }).then(() => {
      console.info(`[sw] Install completo — ${CACHE_VERSION}`);
      return self.skipWaiting(); /* ativa imediatamente */
    })
  );
});

/* ── Activate — limpa caches antigos ──────────────────────────────────────── */

self.addEventListener('activate', (event) => {
  const keep = [CACHE_STATIC, CACHE_DATA];
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter(key => !keep.includes(key))
          .map(key => {
            console.info(`[sw] Removendo cache antigo: ${key}`);
            return caches.delete(key);
          })
      )
    ).then(() => {
      console.info('[sw] Activate completo.');
      return self.clients.claim(); /* assume controle imediato */
    })
  );
});

/* ── Fetch — Cache First para assets, Network First para dados dinâmicos ──── */

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  /* Ignora requisições não-GET e cross-origin */
  if (event.request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;

  /* Dados JSON — Network First (permite atualização sem trocar versão do cache) */
  if (url.pathname.endsWith('.json')) {
    event.respondWith(_networkFirst(event.request, CACHE_DATA));
    return;
  }

  /* Tudo mais — Cache First */
  event.respondWith(_cacheFirst(event.request, CACHE_STATIC));
});

/* ── Estratégias ──────────────────────────────────────────────────────────── */

/**
 * Cache First: serve do cache, busca na rede apenas se não estiver cacheado.
 * Atualiza o cache em background após servir.
 */
async function _cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) {
    /* Background refresh — não bloqueia a resposta */
    _refreshInBackground(request, cacheName);
    return cached;
  }
  return _fetchAndCache(request, cacheName);
}

/**
 * Network First: tenta rede, cai para cache se offline.
 */
async function _networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached || new Response('Offline', { status: 503 });
  }
}

async function _fetchAndCache(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('Offline', { status: 503 });
  }
}

function _refreshInBackground(request, cacheName) {
  fetch(request).then(response => {
    if (response.ok) {
      caches.open(cacheName).then(cache => cache.put(request, response));
    }
  }).catch(() => { /* offline — não fazer nada */ });
}
