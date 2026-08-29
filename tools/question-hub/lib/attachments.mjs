/**
 * Attachment and per-option metadata validation for the Question Hub (spec §3.1-§3.2).
 *
 * Purpose: reject a malformed attachment or an unservable media path at `POST /api/ask`,
 * so a broken image is found when it is posted, not when the human taps it.
 *
 * Owns the six attachment shapes, the `optionMeta` key rules, and `collectMediaSrcs` (the
 * one definition of "which paths a question publishes"). Owns no filesystem access: media
 * path safety (gates 1-4 of §3.3) arrives as an injected `checkSrc(src) -> boolean`, so
 * this module imports nothing and cannot fail to load and take the server down with it.
 *
 * Errors are values, not exceptions: each validator returns `null` when valid, or one
 * sentence a human can act on. Invalid input is an expected outcome, not an exception.
 */

/** The complete set of attachment types the server will store. */
export const ATTACHMENT_TYPES = Object.freeze(['image', 'swatches', 'compare', 'code', 'note', 'link']);

const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const SAFE_SCHEMES = ['http:', 'https:'];
const SRC_RULE = 'must sit under docs/product/, docs/architecture/ or tools/question-hub/media/, ' +
  'use one of .png .jpg .jpeg .webp .gif .md .json .txt, and contain no "..", backslash or "%"';

/** True when `value` is a non-empty string. */
const filled = (value) => typeof value === 'string' && value.trim() !== '';

/** Validate an `image` attachment, including its media path via the injected checker. */
function validateImage(a, where, checkSrc) {
  if (!filled(a.src)) return where + ' needs a repo-relative "src".';
  if (!filled(a.alt)) return where + ' needs a non-empty "alt" — it is required, not optional.';
  if (!checkSrc(a.src)) return where + ' src "' + a.src + '" is not a servable media path (' + SRC_RULE + ').';
  for (const key of ['width', 'height']) {
    if (a[key] !== undefined && !(Number.isFinite(a[key]) && a[key] > 0)) return where + ' "' + key + '" must be a positive number.';
  }
  return null;
}

/** Validate one attachment of any type. `where` is a human-readable location prefix. */
export function validateAttachment(a, where, checkSrc) {
  if (typeof checkSrc !== 'function') throw new TypeError('validateAttachment requires a checkSrc function');
  if (!a || typeof a !== 'object' || Array.isArray(a)) return where + ' must be an object.';
  if (!ATTACHMENT_TYPES.includes(a.type)) {
    return where + ' has unknown type "' + a.type + '" — expected one of ' + ATTACHMENT_TYPES.join(', ') + '.';
  }
  if (a.type === 'image') return validateImage(a, where, checkSrc);
  if (a.type === 'swatches') {
    if (!Array.isArray(a.swatches) || a.swatches.length === 0) return where + ' needs a non-empty "swatches" array.';
    for (const [i, sw] of a.swatches.entries()) {
      const at = where + ' swatch ' + (i + 1);
      if (!sw || typeof sw !== 'object') return at + ' must be an object.';
      if (!filled(sw.name)) return at + ' needs a "name".';
      if (!filled(sw.hex) || !HEX.test(sw.hex)) return at + ' needs a "hex" like #1a2b3c.';
    }
    return null;
  }
  if (a.type === 'compare') {
    if (!filled(a.leftLabel) || !filled(a.rightLabel)) return where + ' needs "leftLabel" and "rightLabel".';
    for (const side of ['left', 'right']) {
      if (!a[side] || typeof a[side] !== 'object') return where + ' needs an image object at "' + side + '".';
      const err = validateImage(a[side], where + ' ' + side, checkSrc);
      if (err) return err;
    }
    return null;
  }
  if (a.type === 'code') {
    if (!filled(a.language)) return where + ' needs a "language" (use "text" if there is none).';
    return typeof a.code === 'string' && a.code !== '' ? null : where + ' needs a non-empty "code" string.';
  }
  if (a.type === 'note') return filled(a.markdown) ? null : where + ' needs a non-empty "markdown" string.';
  if (!filled(a.href)) return where + ' needs an "href".';
  if (!filled(a.label)) return where + ' needs a "label".';
  let parsed;
  try { parsed = new URL(a.href); } catch { return where + ' href "' + a.href + '" is not a valid absolute URL.'; }
  if (!SAFE_SCHEMES.includes(parsed.protocol)) return where + ' href must be http: or https: — "' + parsed.protocol + '" is refused.';
  return null;
}

/** Validate the question-level `attachments` array. */
export function validateAttachments(list, checkSrc) {
  if (list === undefined) return null;
  if (!Array.isArray(list)) return 'attachments must be an array.';
  for (const [i, a] of list.entries()) {
    const err = validateAttachment(a, 'attachments[' + i + ']', checkSrc);
    if (err) return err;
  }
  return null;
}

/** Validate `optionMeta`: keys must be real option labels; each may carry one attachment. */
export function validateOptionMeta(meta, options, checkSrc) {
  if (meta === undefined) return null;
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return 'optionMeta must be an object keyed by option label.';
  for (const [label, entry] of Object.entries(meta)) {
    if (!options.includes(label)) {
      return 'optionMeta key "' + label + '" is not one of this question\'s options — keys must match an option exactly.';
    }
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return 'optionMeta["' + label + '"] must be an object.';
    for (const field of ['consequence', 'hint']) {
      if (entry[field] !== undefined && typeof entry[field] !== 'string') return 'optionMeta["' + label + '"].' + field + ' must be a string.';
    }
    if (entry.attachment !== undefined) {
      const err = validateAttachment(entry.attachment, 'optionMeta["' + label + '"].attachment', checkSrc);
      if (err) return err;
    }
  }
  return null;
}

/** Every media `src` a question publishes — the input to the referenced-only media gate. */
export function collectMediaSrcs(question) {
  const found = [];
  const walk = (a) => {
    if (!a || typeof a !== 'object') return;
    if (a.type === 'image' && typeof a.src === 'string') found.push(a.src);
    if (a.type === 'compare') {
      walk(a.left);
      walk(a.right);
    }
  };
  for (const a of Array.isArray(question.attachments) ? question.attachments : []) walk(a);
  for (const entry of Object.values(question.optionMeta ?? {})) walk(entry?.attachment);
  return found;
}
