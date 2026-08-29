/**
 * Shared, dependency-free helpers used by every client module.
 *
 * Kept in one place so escaping and media-URL construction have a single
 * implementation: a second copy of `esc` is a future XSS hole.
 */

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** HTML-escape any value for interpolation into a template string. */
export const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ESCAPES[c]);

export const byId = (id) => document.getElementById(id);

export const reducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** True when the phone has asked us not to burn data — gates 2 MB mockups. */
export const saveData = () => Boolean(navigator.connection && navigator.connection.saveData);

/** Characters the server's path gates reject; mirrored here so we never even ask. */
const UNSAFE_PATH = /[\\%]|\.\./;

/**
 * Build the `/media/` URL for a repo-relative attachment path.
 *
 * Returns null for anything the server's path gates would reject anyway, so a
 * malformed `src` renders as a placeholder instead of a broken image request.
 */
export function mediaUrl(src) {
  if (typeof src !== 'string' || src === '') return null;
  if (UNSAFE_PATH.test(src) || src.startsWith('/')) return null;
  return '/media/' + src.split('/').map(encodeURIComponent).join('/');
}

/** Only http/https survive; `javascript:` and `data:` links are dropped entirely. */
export function safeHref(href) {
  try {
    const url = new URL(String(href), location.origin);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

/** Debounce that keeps the latest call's arguments — used for draft persistence. */
export function debounce(fn, ms) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}
