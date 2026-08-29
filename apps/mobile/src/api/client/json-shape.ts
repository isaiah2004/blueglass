/**
 * Decoders that turn `unknown` JSON into typed values without a single cast at a
 * call site.
 *
 * Purpose
 *   `await response.json()` is `unknown` at maximum strictness, and the honest ways to
 *   spend that `unknown` are a cast (which lies) or a hand-written chain of `typeof`
 *   checks (which rule 6.5.2 calls out by name). This module is the third way: small
 *   composable decoders, each of which reports *where* and *what* it expected, so a
 *   contract drift between the client and the API surfaces as
 *   `chapter.verses[3].verse_key: expected a number` rather than as `undefined` three
 *   screens later.
 *
 * Why not a schema library
 *   Zod would do this well and is the rule's own example. It is not a dependency of
 *   this app, and the total surface being decoded is five endpoints of flat objects and
 *   arrays. The eighty lines below cover it, add no bundle weight to a client that must
 *   also load a font and a map, and — unlike a general schema library — cannot be used
 *   to validate anything but a response body, which is the only thing it should ever
 *   validate.
 *
 * Key responsibilities
 *   - Decode the four JSON primitives the API actually uses, plus arrays and objects.
 *   - Thread a dotted path through the whole traversal, so every failure names itself.
 *   - Return results, never throw (rule 6.1.4).
 *
 * Dependencies
 *   `@atlas/shared` for `Result`. No I/O, no platform.
 *
 * Usage
 *   ```ts
 *   const decodeVerse = decodeObject({ verse: decodeNumber, text: decodeString });
 *   const decoded = decodeVerse(body, 'chapter.verses[0]');
 *   ```
 */

import { fail, succeed, type Result } from '@atlas/shared';

/** Where a body failed to match, and what was wanted there. */
export interface DecodeFailure {
  /** Dotted path from the root of the response, e.g. `verses[2].verse_key`. */
  readonly path: string;
  /** What the decoder expected, phrased to complete "expected …". */
  readonly expected: string;
}

/** The outcome of decoding one node. */
export type Decoded<TValue> = Result<TValue, DecodeFailure>;

/**
 * A decoder for one node of a response body.
 *
 * The `path` parameter is passed down rather than reconstructed, because only the
 * caller knows whether this node is a field, an element, or the root.
 */
export type Decoder<TValue> = (raw: unknown, path: string) => Decoded<TValue>;

/** Build the failure arm. */
function expected(path: string, description: string): Decoded<never> {
  return fail({ path, expected: description });
}

/** Decode a JSON string. */
export const decodeString: Decoder<string> = (raw, path) =>
  typeof raw === 'string' ? succeed(raw) : expected(path, 'a string');

/** Decode a finite JSON number. `NaN` and `Infinity` are rejected: neither survives JSON. */
export const decodeNumber: Decoder<number> = (raw, path) =>
  typeof raw === 'number' && Number.isFinite(raw) ? succeed(raw) : expected(path, 'a number');

/** Decode a JSON boolean. */
export const decodeBoolean: Decoder<boolean> = (raw, path) =>
  typeof raw === 'boolean' ? succeed(raw) : expected(path, 'a boolean');

/**
 * Decode a JSON object into an index signature.
 *
 * Rejects `null` and arrays, both of which are `typeof 'object'` and neither of which
 * is what any endpoint means by an object.
 */
export const decodeRecord: Decoder<Readonly<Record<string, unknown>>> = (raw, path) =>
  typeof raw === 'object' && raw !== null && !Array.isArray(raw)
    ? succeed(raw as Readonly<Record<string, unknown>>)
    : expected(path, 'an object');

/**
 * Accept `null` and `undefined` as an absent value, and delegate anything else.
 *
 * @param inner - The decoder for a present value.
 * @returns A decoder resolving `null` when the node is absent. Side effects: none.
 */
export function decodeNullable<TValue>(inner: Decoder<TValue>): Decoder<TValue | null> {
  return (raw, path) => (raw == null ? succeed(null) : inner(raw, path));
}

/**
 * Decode a JSON array, element by element, stopping at the first bad element.
 *
 * @param element - The decoder applied to each element.
 * @returns A decoder for a readonly array. Side effects: none.
 */
export function decodeArray<TValue>(element: Decoder<TValue>): Decoder<readonly TValue[]> {
  return (raw, path) => {
    if (!Array.isArray(raw)) return expected(path, 'an array');

    const decoded: TValue[] = [];
    for (let index = 0; index < raw.length; index += 1) {
      const item = element(raw[index], `${path}[${String(index)}]`);
      if (!item.ok) return item;
      decoded.push(item.value);
    }
    return succeed(decoded);
  };
}

/** One decoder per property of the target type. Every property must be listed. */
export type DecoderMap<TShape> = { readonly [TKey in keyof TShape]-?: Decoder<TShape[TKey]> };

/**
 * Decode a JSON object into a typed shape, one field at a time.
 *
 * Field names in the map are the *wire* names, so a decoder reads as the contract it
 * enforces. Renaming to the client's own vocabulary happens after decoding, in the
 * endpoint module, where both names are visible side by side.
 *
 * @param fields - A decoder for each field of `TShape`.
 * @returns A decoder for the whole object, failing at the first bad field.
 *          Side effects: none.
 */
export function decodeObject<TShape extends object>(fields: DecoderMap<TShape>): Decoder<TShape> {
  const keys = Object.keys(fields) as unknown as readonly (keyof TShape & string)[];

  return (raw, path) => {
    const record = decodeRecord(raw, path);
    if (!record.ok) return record;

    const built: Partial<Record<keyof TShape & string, unknown>> = {};
    for (const key of keys) {
      const field = fields[key](record.value[key], path === '' ? key : `${path}.${key}`);
      if (!field.ok) return field;
      built[key] = field.value;
    }
    // Safe: every key of `TShape` was decoded above, and `DecoderMap` makes omitting one
    // a compile error. The double assertion is required only because TypeScript cannot
    // see that the loop closed the `Partial`.
    return succeed(built as unknown as TShape);
  };
}
