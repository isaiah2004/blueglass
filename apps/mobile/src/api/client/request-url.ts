/**
 * Build request URLs: join a base to a path, and encode a query string.
 *
 * Purpose
 *   Two small jobs that go wrong quietly when done by hand. A path segment that is not
 *   percent-encoded turns `Song of Solomon` into a 404 and `1 Cor` into two segments;
 *   a query string built with `+` sends a literal plus for a space. Both bugs existed
 *   in reach of the prototype's string concatenation, and both are silent — the request
 *   succeeds, it just asks for the wrong thing.
 *
 * Why not `URL` and `URLSearchParams`
 *   Hermes ships neither reliably (React Native's `URL` polyfill is famously partial),
 *   and `URLSearchParams` encodes a space as `+`, which FastAPI reads as a plus in a
 *   path-adjacent context. `encodeURIComponent` is in every JavaScript engine, encodes
 *   a space as `%20`, and is exactly what the server's `unquote` expects.
 *
 * Dependencies
 *   None.
 */

/** A query value. `undefined` and `null` drop the parameter entirely. */
export type QueryValue = string | number | boolean | undefined | null;

/** The query parameters for one request. Order in the object is the order in the URL. */
export type QueryParameters = Readonly<Record<string, QueryValue>>;

/**
 * Percent-encode each path segment, preserving the separators.
 *
 * @param path - A path such as `/chapters/BSB/Song of Solomon/2`.
 * @returns The path with every segment encoded. Side effects: none.
 *
 * @example
 * encodePath('/chapters/BSB/Song of Solomon/2');
 * // '/chapters/BSB/Song%20of%20Solomon/2'
 */
export function encodePath(path: string): string {
  return path
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

/**
 * Render a query string, omitting absent parameters.
 *
 * @param parameters - The parameters to encode.
 * @returns A string starting with `?`, or `''` when nothing survived.
 *          Side effects: none.
 */
export function encodeQuery(parameters: QueryParameters): string {
  const pairs: string[] = [];
  for (const [name, value] of Object.entries(parameters)) {
    if (value === undefined || value === null) continue;
    pairs.push(`${encodeURIComponent(name)}=${encodeURIComponent(String(value))}`);
  }
  return pairs.length === 0 ? '' : `?${pairs.join('&')}`;
}

/**
 * Join a base URL, a path and a query into the URL to request.
 *
 * @param baseUrl - Already normalised by `normaliseBaseUrl`; a trailing slash is
 *                  tolerated anyway.
 * @param path - Path beginning with `/`. Segments are encoded here, so callers pass
 *               raw values such as a book name with a space.
 * @param parameters - Optional query parameters.
 * @returns The absolute URL. Side effects: none.
 */
export function buildRequestUrl(
  baseUrl: string,
  path: string,
  parameters: QueryParameters = {},
): string {
  const base = baseUrl.replace(/\/+$/, '');
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return `${base}${encodePath(suffix)}${encodeQuery(parameters)}`;
}
