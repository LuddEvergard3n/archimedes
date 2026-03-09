/**
 * router.js — Hash-based client-side router
 *
 * Routes:
 *   #/                    Home (module selector)
 *   #/module/:id          Module overview
 *   #/module/:id/:expId   Experiment/lab view
 *
 * No external dependencies. Uses window.hashchange.
 */

import { setState, getState } from './state.js';

/** @type {Map<string, Function>} */
const _routes = new Map();

/** @type {Function|null} — Called when no route matches */
let _notFoundHandler = null;

/**
 * Register a route handler.
 * Pattern supports `:param` segments.
 *
 * @param {string} pattern — e.g. '/module/:id/:expId'
 * @param {Function} handler — (params: Object) => void
 */
function register(pattern, handler) {
  _routes.set(pattern, handler);
}

/**
 * Navigate to a path.
 * @param {string} path — e.g. '/module/motion/mru-01'
 */
function navigate(path) {
  window.location.hash = path;
}

/**
 * Replace current hash without adding to history.
 * @param {string} path
 */
function replace(path) {
  const url = window.location.href.split('#')[0] + '#' + path;
  window.history.replaceState(null, '', url);
  _dispatch(path);
}

/**
 * Set handler for unmatched routes.
 * @param {Function} handler
 */
function onNotFound(handler) {
  _notFoundHandler = handler;
}

/**
 * Parse current hash and dispatch to handler.
 */
function _dispatch(rawPath) {
  /* Normalize: strip leading '#' and '/' */
  const path = (rawPath || '').replace(/^#?\/?/, '/').replace(/\/+/g, '/');

  for (const [pattern, handler] of _routes) {
    const params = _match(pattern, path);
    if (params !== null) {
      /* Update state so subscribers can react */
      setState('route', { pattern, path, params });
      try {
        handler(params);
      } catch (err) {
        console.error(`[router] Handler error for "${pattern}":`, err);
      }
      return;
    }
  }

  /* No match */
  setState('route', { pattern: null, path, params: {} });
  if (_notFoundHandler) _notFoundHandler(path);
}

/**
 * Match a URL path against a pattern with `:param` segments.
 * Returns a params object if matched, null if not.
 *
 * @param {string} pattern
 * @param {string} path
 * @returns {Object|null}
 */
function _match(pattern, path) {
  const pParts = pattern.split('/').filter(Boolean);
  const rParts = path.split('/').filter(Boolean);

  if (pParts.length !== rParts.length) return null;

  const params = {};
  for (let i = 0; i < pParts.length; i++) {
    const pp = pParts[i];
    const rp = rParts[i];
    if (pp.startsWith(':')) {
      params[pp.slice(1)] = decodeURIComponent(rp);
    } else if (pp !== rp) {
      return null;
    }
  }
  return params;
}

/**
 * Get current params from state.
 * @returns {Object}
 */
function getParams() {
  return getState('route').params || {};
}

/**
 * Start the router: listen for hash changes and dispatch current hash.
 */
function start() {
  window.addEventListener('hashchange', () => {
    _dispatch(window.location.hash);
  });

  /* Dispatch immediately for current URL */
  const initial = window.location.hash || '#/';
  _dispatch(initial);
}

export { register, navigate, replace, onNotFound, start, getParams };
