/**
 * How an absent wire field becomes an absent client field.
 *
 * Purpose
 *   The server sends `null` for an optional field; `@atlas/shared` and the sheet payloads
 *   declare those fields optional. Under `exactOptionalPropertyTypes` those are different
 *   types, and both decoder modules need the same one-line bridge between them — so it lives
 *   here rather than being written twice or, worse, written twice differently.
 *
 * Dependencies
 *   None. One pure function.
 */

/**
 * `{ key: value }` when the wire sent one, `{}` when it sent null.
 *
 * Every optional field on a sheet payload is declared optional, not nullable, and
 * `exactOptionalPropertyTypes` makes those different types. Keeping the difference is worth
 * one helper: a sheet then writes `payload.definition === undefined` once instead of guarding
 * two spellings of absence.
 *
 * @param key - The client-side field name.
 * @param value - What the wire sent, possibly null.
 * @returns A one-entry object, or an empty one. Side effects: none.
 */
export function present<TKey extends string, TValue>(
  key: TKey,
  value: TValue | null,
): Record<TKey, TValue> | Record<string, never> {
  return value === null ? {} : ({ [key]: value } as Record<TKey, TValue>);
}
