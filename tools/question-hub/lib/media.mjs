/**
 * `GET /media/<repo-relative-path>` — the only route that reads a file outside
 * tools/question-hub/. Implements all eight gates of spec §3.3.
 *
 * The governing idea: **the media endpoint is a projection of the question log, not a file
 * browser.** Gate 6 (referenced-only) is the real boundary — a file nobody asked a question
 * about is 404 even when it passes every other gate, so the attack surface is exactly the
 * set of files the fleet deliberately published.
 *
 * Every failure is a BARE 404 with no body detail. The response never distinguishes
 * "not allowed" from "not there", so the endpoint cannot be used to probe the filesystem.
 * Only the requested repo-relative path is ever logged — logging the resolved absolute path
 * would hand a reader the filesystem layout for free.
 */
import { createReadStream } from 'node:fs';
import { lstat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectMediaSrcs } from './attachments.mjs';

/** Derived from import.meta.url, never process.cwd() — cwd is not a security boundary. */
export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

const ALLOWED_ROOTS = ['docs/product/mockups', 'docs/product', 'docs/architecture', 'tools/question-hub/media']
  .map((relative) => path.resolve(REPO_ROOT, relative));

/** Extension -> content type. Fixed table: never sniff, never fall back to octet-stream.
 *  `.svg` is deliberately absent — it executes script on direct navigation. */
const CONTENT_TYPES = Object.freeze({
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.gif': 'image/gif', '.md': 'text/markdown; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
});

const MAX_BYTES = 8 * 1024 * 1024;
const IMMUTABLE = 'public, max-age=31536000, immutable';

/** Built from char codes rather than written literally: an escaped backslash inside a
 *  regex is exactly the kind of thing a tool or an editor silently mangles, and this
 *  check is a security boundary. Blocks backslash, NUL and any parent-directory hop. */
const BANNED_CHARS = [String.fromCharCode(92), String.fromCharCode(0)];

function hasBannedChars(value) {
  return value.includes('..') || BANNED_CHARS.some((char) => value.includes(char));
}

let referenced = new Set();

/** Windows filenames are case-insensitive, so the referenced-set key must be too. */
function mediaKey(absolute) {
  return process.platform === 'win32' ? absolute.toLowerCase() : absolute;
}

/**
 * Gates 1-4: character check, decode exactly once, re-check, resolve against REPO_ROOT,
 * root allow-list, extension allow-list.
 *
 * @returns {{rel: string, abs: string, type: string, key: string}|null} null on any failure.
 */
export function resolveMediaPath(raw) {
  if (typeof raw !== 'string' || raw === '') return null;
  if (hasBannedChars(raw)) return null;
  let decoded;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return null;
  }
  // A surviving '%' means the input was double-encoded: dead on arrival.
  if (decoded.includes('%') || hasBannedChars(decoded)) return null;
  if (decoded.startsWith('/') || path.isAbsolute(decoded)) return null;
  const abs = path.resolve(REPO_ROOT, decoded);
  // `candidate === root || startsWith(root + sep)` — a bare startsWith would admit
  // docs/product-secrets/ through the docs/product/ entry.
  if (!ALLOWED_ROOTS.some((root) => abs === root || abs.startsWith(root + path.sep))) return null;
  const type = CONTENT_TYPES[path.extname(abs).toLowerCase()];
  if (!type) return null;
  return { rel: decoded, abs, type, key: mediaKey(abs) };
}

/** Gate 6's source of truth. Rebuilt after every write; withdrawn questions publish nothing. */
export function rebuildReferencedSet(db) {
  const next = new Set();
  for (const question of db?.questions ?? []) {
    if (question.status === 'withdrawn') continue;
    for (const src of collectMediaSrcs(question)) {
      const hit = resolveMediaPath(src);
      if (hit) next.add(hit.key);
    }
  }
  referenced = next;
  return referenced.size;
}

/** True when some non-withdrawn question published this exact path. */
export function isReferenced(key) {
  return referenced.has(key);
}

/** Printable, bounded, single-line form of an attacker-controlled path, for the log. */
function forLog(raw) {
  return String(raw).replace(/[^\x20-\x7e]/g, '?').slice(0, 120);
}

function notFound(res, raw, reason) {
  console.warn('[hub] media 404 (' + reason + '): ' + forLog(raw));
  res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8', 'x-content-type-options': 'nosniff', 'cache-control': 'no-store' });
  res.end('Not found');
}

/**
 * Serve one media file. Gates 5 (lstat + isFile, which rejects directories AND symlinks),
 * 6 (referenced-only), 7 (size ceiling) and 8 (stream, never buffer).
 */
export async function serveMedia(req, res, rawPath) {
  const hit = resolveMediaPath(rawPath);
  if (!hit) return notFound(res, rawPath, 'path');
  if (!isReferenced(hit.key)) return notFound(res, hit.rel, 'unreferenced');
  let stats;
  try {
    stats = await lstat(hit.abs);
  } catch {
    return notFound(res, hit.rel, 'missing');
  }
  if (!stats.isFile()) return notFound(res, hit.rel, 'not-a-file');
  if (stats.size > MAX_BYTES) return notFound(res, hit.rel, 'too-large');

  const etag = '"' + stats.mtimeMs + '-' + stats.size + '"';
  if (req.headers['if-none-match'] === etag) {
    res.writeHead(304, { etag, 'cache-control': IMMUTABLE });
    return res.end();
  }
  res.writeHead(200, {
    'content-type': hit.type,
    'content-length': String(stats.size),
    'x-content-type-options': 'nosniff',
    etag,
    'cache-control': IMMUTABLE,
  });
  if (req.method === 'HEAD') return res.end();
  const stream = createReadStream(hit.abs);
  stream.on('error', (err) => {
    console.warn('[hub] media stream failed for ' + forLog(hit.rel) + ': ' + err.code);
    res.destroy();
  });
  stream.pipe(res);
}
