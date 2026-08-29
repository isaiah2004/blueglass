/**
 * HTTP plumbing: the error type, JSON responses, body reading, CORS, and route dispatch.
 *
 * Deliberately thin. Everything here is about the wire; nothing here knows what a question
 * is. The route table is supplied by server.mjs, so adding an endpoint never means editing
 * this file.
 *
 * Error contract (spec §7): a validation failure is `400` with `{ error: "<one sentence a
 * human can act on>" }`. Never a stack trace, never a filesystem path — an unexpected error
 * is logged server-side and answered with a generic sentence.
 */

const CORS = Object.freeze({
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'content-type',
  'access-control-allow-methods': 'GET,POST,OPTIONS',
});

/** An error with an HTTP status and a message that is safe to show a caller. */
export class HttpError extends Error {
  constructor(status, message, code = null) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
  }
}

/** Send a JSON body. API routes are never cached — /media/ is the only cacheable route. */
export function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
    'cache-control': 'no-store',
    ...CORS,
  });
  res.end(payload);
}

/** Read and parse a JSON request body, refusing anything oversized. */
export async function readBody(req, limitBytes = 4000000) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limitBytes) throw new HttpError(413, 'Request body is larger than ' + limitBytes + ' bytes.');
    chunks.push(chunk);
  }
  if (size === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch (err) {
    throw new HttpError(400, 'Body is not valid JSON: ' + err.message);
  }
}

/** Map any thrown value onto a safe response. Unexpected errors are logged, not exposed. */
export function sendError(res, err, label) {
  if (err instanceof HttpError) return sendJson(res, err.status, { error: err.message, code: err.code ?? undefined });
  console.error('[hub] ' + label + ' failed:', err);
  return sendJson(res, 500, { error: 'The hub hit an unexpected error handling this request. It has been logged.' });
}

/**
 * Dispatch one request against a route table.
 *
 * @param {object} table `{ get: {path: fn}, post: {path: fn}, prefixes: [[prefix, fn]] }`.
 *   `get` handlers return a JSON body; `post` handlers receive the parsed body and return
 *   one; prefix handlers own their own response (they serve files, not JSON).
 */
export async function dispatch(req, res, table) {
  const url = new URL(req.url ?? '/', 'http://' + (req.headers.host ?? 'localhost'));
  const label = req.method + ' ' + url.pathname;
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS);
    return res.end();
  }
  try {
    const readOnly = req.method === 'GET' || req.method === 'HEAD';
    const get = table.get?.[url.pathname];
    if (get && readOnly) return sendJson(res, 200, await get(url, req));
    const post = table.post?.[url.pathname];
    if (post && req.method === 'POST') return sendJson(res, 200, await post(await readBody(req), url, req));
    if (readOnly) {
      for (const [prefix, handler] of table.prefixes ?? []) {
        if (url.pathname.startsWith(prefix)) return await handler(req, res, url.pathname.slice(prefix.length), url);
      }
    }
    throw new HttpError(404, 'No route for ' + label + '.');
  } catch (err) {
    return sendError(res, err, label);
  }
}
