/**
 * The payload decoder for one badge kind.
 *
 * Purpose
 *   One table, and the lookup that uses it. The five decoders themselves live in
 *   `badge-spatial-decoders.ts` and `badge-textual-decoders.ts` — the same split
 *   `features/sheets/` makes, and the reason neither file has to be read to understand this
 *   one.
 *
 * Dependencies
 *   This folder's two decoder modules and its models. No HTTP, no React.
 */

import type { Decoder } from '@/api';

import type { BadgeOfKind, ReaderBadgeKind } from './badge-models';
import type { BadgePayload } from './badge-payloads';
import { decodeCityPayload, decodeRoutePayload } from './badge-spatial-decoders';
import {
  decodeCrossRefPayload,
  decodeHistoryPayload,
  decodeRootPayload,
} from './badge-textual-decoders';

/**
 * One decoder per kind, each proved to produce *that kind's* payload.
 *
 * The mapped `satisfies` is doing real work: it checks key by key that `route` yields a
 * `RouteSheetPayload` and `root` a `RootSheetPayload`. That is what lets `badge-decoders.ts`
 * pair a kind with a payload and know the pairing is sound, rather than hoping.
 */
const PAYLOAD_DECODERS = {
  route: decodeRoutePayload,
  '3d-city': decodeCityPayload,
  history: decodeHistoryPayload,
  root: decodeRootPayload,
  'cross-ref': decodeCrossRefPayload,
} as const satisfies { [TKind in ReaderBadgeKind]: Decoder<BadgeOfKind<TKind>['payload']> };

/**
 * Decode the `payload` object for one already-narrowed badge kind.
 *
 * Dispatching on the envelope's kind rather than on the payload's own `kind` field is
 * deliberate: `badge-vocabularies.ts` has already rejected anything this client cannot draw,
 * so an unknown kind never reaches a decoder, and a payload whose `kind` disagrees with its
 * envelope's cannot smuggle a Root sheet onto a Route badge.
 *
 * @param kind - The badge's wire kind.
 * @returns A decoder for that kind's payload. Side effects: none.
 */
export function decodeBadgePayload(kind: ReaderBadgeKind): Decoder<BadgePayload> {
  return PAYLOAD_DECODERS[kind];
}
