/**
 * Full-screen image viewer: a native <dialog> with pinch-zoom and pan.
 *
 * <dialog> gives focus trapping, Esc-to-close and the top layer for free, which
 * is the whole reason it is used instead of a hand-rolled overlay.
 */
import { byId } from './util.js';

const MIN_SCALE = 1;
const MAX_SCALE = 5;
const view = { scale: 1, x: 0, y: 0 };
let pinchStart = 0;
let dragFrom = null;

function apply(img) {
  img.style.transform =
    'translate(' + view.x + 'px,' + view.y + 'px) scale(' + view.scale + ')';
  img.parentElement.dataset.zoomed = view.scale > 1.01 ? 'true' : 'false';
}

function reset(img) {
  view.scale = 1; view.x = 0; view.y = 0;
  apply(img);
}

const zoomTo = (img, next) => {
  view.scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, next));
  if (view.scale === 1) { view.x = 0; view.y = 0; }
  apply(img);
};

const spread = (touches) =>
  Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY);

/** Wire the viewer once; every `[data-lightbox]` in the page opens it. */
export function initLightbox(root = document) {
  const dialog = byId('lightbox');
  const img = byId('lightboxImage');
  const caption = byId('lightboxCaption');
  if (!dialog || !img) return;

  root.addEventListener('click', (ev) => {
    const trigger = ev.target.closest('[data-lightbox]');
    if (!trigger) return;
    ev.preventDefault();
    img.src = trigger.dataset.lightbox;
    img.alt = trigger.dataset.alt ?? '';
    caption.textContent = trigger.dataset.alt ?? '';
    reset(img);
    dialog.showModal();
  });

  dialog.addEventListener('click', (ev) => {
    if (ev.target.closest('[data-act="close-lightbox"]') || ev.target === dialog) dialog.close();
  });
  dialog.addEventListener('close', () => { img.removeAttribute('src'); });

  img.addEventListener('dblclick', () => zoomTo(img, view.scale > 1.01 ? 1 : 2.5));
  dialog.addEventListener('wheel', (ev) => {
    ev.preventDefault();
    zoomTo(img, view.scale * (ev.deltaY < 0 ? 1.12 : 0.89));
  }, { passive: false });

  dialog.addEventListener('touchstart', (ev) => {
    if (ev.touches.length === 2) pinchStart = spread(ev.touches) / view.scale;
    else if (ev.touches.length === 1 && view.scale > 1.01) {
      dragFrom = { x: ev.touches[0].clientX - view.x, y: ev.touches[0].clientY - view.y };
    }
  }, { passive: true });

  dialog.addEventListener('touchmove', (ev) => {
    if (ev.touches.length === 2 && pinchStart > 0) {
      ev.preventDefault();
      zoomTo(img, spread(ev.touches) / pinchStart);
    } else if (ev.touches.length === 1 && dragFrom) {
      ev.preventDefault();
      view.x = ev.touches[0].clientX - dragFrom.x;
      view.y = ev.touches[0].clientY - dragFrom.y;
      apply(img);
    }
  }, { passive: false });

  dialog.addEventListener('touchend', () => { pinchStart = 0; dragFrom = null; });
}
