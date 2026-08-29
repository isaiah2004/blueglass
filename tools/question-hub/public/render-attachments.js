/**
 * The six attachment types (§3.2) plus the strict markdown subset.
 *
 * Everything here is presentation. An unknown type, a bad path, or a hostile
 * href degrades to a dimmed placeholder — a future attachment kind must never
 * stop an old client rendering the question it hangs on.
 */
import { esc, mediaUrl, safeHref, saveData } from './util.js';

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

const unsupported = (label) =>
  '<div class="att att-unsupported">Unsupported attachment' +
  (label ? ' &middot; ' + esc(label) : '') + '</div>';

/** A fixed aspect-ratio box reserves space before load, so nothing shifts under a thumb. */
function imageBox(att, extraClass = '') {
  const url = mediaUrl(att && att.src);
  const alt = att && att.alt ? String(att.alt) : '';
  if (!url || !alt) return unsupported('image');
  const ratio = att.width && att.height ? att.width + ' / ' + att.height : '16 / 10';
  const style = ' style="aspect-ratio:' + esc(ratio) + '"';
  if (saveData()) {
    return '<button class="media-box is-placeholder ' + extraClass + '"' + style +
      ' data-act="load-media" data-src="' + esc(att.src) + '" data-alt="' + esc(alt) + '">' +
      '<span>Tap to load image</span><small>' + esc(alt) + '</small></button>';
  }
  return '<button class="media-box ' + extraClass + '"' + style +
    ' data-lightbox="' + esc(url) + '" data-alt="' + esc(alt) + '"' +
    ' aria-label="' + esc('Open full screen: ' + alt) + '">' +
    '<img src="' + esc(url) + '" alt="' + esc(alt) + '" loading="lazy" decoding="async" />' +
    '</button>';
}

function renderImage(att) {
  return '<figure class="att att-image">' + imageBox(att) +
    (att.caption ? '<figcaption>' + esc(att.caption) + '</figcaption>' : '') + '</figure>';
}

function renderSwatches(att) {
  const list = Array.isArray(att.swatches) ? att.swatches : [];
  if (list.length === 0) return unsupported('swatches');
  const chips = list.map((s) => {
    const hex = HEX.test(String(s.hex ?? '')) ? String(s.hex) : null;
    return '<div class="swatch">' +
      '<span class="swatch-chip"' + (hex ? ' style="background:' + esc(hex) + '"' : '') +
      ' role="img" aria-label="' + esc((s.name ?? 'colour') + ' ' + (hex ?? '')) + '"></span>' +
      '<b>' + esc(s.name ?? '') + '</b><code>' + esc(hex ?? '—') + '</code>' +
      (s.note ? '<small>' + esc(s.note) + '</small>' : '') + '</div>';
  }).join('');
  return '<div class="att att-swatches">' + chips + '</div>';
}

/** Always genuinely side by side — no slider, which would hide half the evidence. */
function renderCompare(att) {
  const half = (image, label) =>
    '<figure class="cmp-half">' + imageBox(image) +
    '<figcaption>' + esc(label ?? '') + '</figcaption></figure>';
  return '<div class="att att-compare">' +
    half(att.left, att.leftLabel) + half(att.right, att.rightLabel) + '</div>';
}

function renderCode(att) {
  return '<figure class="att att-code">' +
    (att.language ? '<figcaption class="lang">' + esc(att.language) + '</figcaption>' : '') +
    '<pre tabindex="0"><code>' + esc(att.code ?? '') + '</code></pre>' +
    (att.caption ? '<figcaption>' + esc(att.caption) + '</figcaption>' : '') + '</figure>';
}

function renderLink(att) {
  const href = safeHref(att.href);
  if (!href) return unsupported('link');
  return '<div class="att att-link"><a href="' + esc(href) + '" target="_blank" rel="noopener noreferrer">' +
    esc(att.label ?? href) + ' &nearr;</a>' +
    (att.caption ? '<small>' + esc(att.caption) + '</small>' : '') + '</div>';
}

/** Inline spans, applied to already-escaped text so no markup can be injected. */
const inline = (escaped) => escaped
  .replace(/`([^`]+)`/g, '<code>$1</code>')
  .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

/**
 * A deliberately tiny markdown subset: paragraphs, bold, inline code, `- ` lists,
 * `> ` quotes. Anything unrecognised stays literal text — there is no HTML path in.
 */
export function renderMarkdown(source) {
  const blocks = String(source ?? '').replace(/\r\n/g, '\n').split(/\n{2,}/);
  return blocks.map((block) => {
    const lines = block.split('\n').filter((l) => l.trim() !== '');
    if (lines.length === 0) return '';
    if (lines.every((l) => l.startsWith('- '))) {
      return '<ul>' + lines.map((l) => '<li>' + inline(esc(l.slice(2))) + '</li>').join('') + '</ul>';
    }
    if (lines.every((l) => l.startsWith('> '))) {
      return '<blockquote>' + inline(esc(lines.map((l) => l.slice(2)).join(' '))) + '</blockquote>';
    }
    return '<p>' + inline(esc(lines.join('\n'))).replace(/\n/g, '<br />') + '</p>';
  }).join('');
}

const RENDERERS = {
  image: renderImage,
  swatches: renderSwatches,
  compare: renderCompare,
  code: renderCode,
  link: renderLink,
  note: (att) => '<div class="att att-note">' + renderMarkdown(att.markdown) + '</div>',
};

/** One attachment, never throwing: a renderer bug becomes a placeholder. */
export function renderAttachment(att) {
  if (!att || typeof att !== 'object') return unsupported('');
  const renderer = RENDERERS[att.type];
  if (!renderer) return unsupported(att.type);
  try {
    return renderer(att);
  } catch (err) {
    console.warn('[hub] attachment render failed', att.type, err);
    return unsupported(att.type);
  }
}

/** The question-level attachment strip, rendered between `why` and the options. */
export function renderAttachments(list) {
  if (!Array.isArray(list) || list.length === 0) return '';
  return '<div class="atts">' + list.map(renderAttachment).join('') + '</div>';
}

/** The single attachment that may hang on one option (compare / swatch layouts). */
export function renderOptionAttachment(att) {
  if (!att) return '';
  return '<div class="opt-att">' + renderAttachment(att) + '</div>';
}

/** Swap a save-data placeholder for the real image on deliberate tap. */
export function initAttachments(root = document) {
  root.addEventListener('click', (ev) => {
    const box = ev.target.closest('[data-act="load-media"]');
    if (!box) return;
    const url = mediaUrl(box.dataset.src);
    if (!url) return;
    box.classList.remove('is-placeholder');
    box.dataset.lightbox = url;
    box.removeAttribute('data-act');
    box.innerHTML = '<img src="' + esc(url) + '" alt="' + esc(box.dataset.alt ?? '') +
      '" decoding="async" />';
  });
}
