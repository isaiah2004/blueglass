/**
 * Serves the answering UI from public/ — and nothing else.
 *
 * Extension allow-list only: .html .css .js .ico. The client agent can add any number of
 * modules under public/ without a server change, which is the one coupling that would
 * otherwise force the two agents to interleave. It cannot add a path outside public/.
 *
 * No caching: there is no build step and no content hashing, so a stale asset would be
 * indistinguishable from a broken one.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { HUB_ROOT } from './db.mjs';

const PUBLIC_DIR = path.join(HUB_ROOT, 'public');

const CONTENT_TYPES = Object.freeze({
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.ico': 'image/x-icon',
});

const BANNED_CHARS = [String.fromCharCode(92), String.fromCharCode(0), '%'];

function notFound(res) {
  res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' });
  res.end('Not found');
}

/**
 * Serve one file from public/.
 *
 * @param {string} relative Path after the leading slash; empty means index.html.
 */
export async function serveStatic(req, res, relative) {
  const wanted = relative === '' || relative === '/' ? 'index.html' : relative;
  if (wanted.includes('..') || BANNED_CHARS.some((char) => wanted.includes(char)) || path.isAbsolute(wanted)) {
    return notFound(res);
  }
  const type = CONTENT_TYPES[path.extname(wanted).toLowerCase()];
  if (!type) return notFound(res);
  const file = path.resolve(PUBLIC_DIR, wanted);
  if (file !== PUBLIC_DIR && !file.startsWith(PUBLIC_DIR + path.sep)) return notFound(res);
  let body;
  try {
    body = await readFile(file);
  } catch (err) {
    if (err.code !== 'ENOENT' && err.code !== 'EISDIR') console.warn('[hub] static read failed: ' + err.code);
    return notFound(res);
  }
  res.writeHead(200, {
    'content-type': type,
    'content-length': body.length,
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  });
  res.end(req.method === 'HEAD' ? undefined : body);
}
