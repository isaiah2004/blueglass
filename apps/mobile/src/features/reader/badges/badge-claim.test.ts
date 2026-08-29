/**
 * Tests for `Q-015`'s rule: which teasers are somebody's reading.
 *
 * The shipped defect this pins
 *   The reader printed "AD 47 - Paul's vision of the man of Macedonia" as a bare statement
 *   of fact, in the open sheet and in the chapter-end summary, while the API was already
 *   sending `interpretiveClaim` and `attributedTo` alongside it. A source line at the foot
 *   of the sheet is not the inline attribution `Q-015` asks for.
 */

import { describe, expect, it } from 'vitest';

import { attributedTeaserLabel, interpretiveClaimOf } from './badge-claim';
import { decodeChapterBadges } from './badge-decoders';
import type { HistoryReaderBadge, ReaderBadge } from './badge-models';
import { ACTS_16_BADGES } from './testing/badge-fixtures';

/** One decoded badge of the given kind from the captured Acts 16 response. */
function badgeOf(kind: ReaderBadge['kind']): ReaderBadge {
  const decoded = decodeChapterBadges(ACTS_16_BADGES, '');
  if (!decoded.ok) throw new Error('the Acts 16 fixture did not decode');
  const found = decoded.value.badges.find((badge) => badge.kind === kind);
  if (found === undefined) throw new Error(`no ${kind} badge in the fixture`);
  return found;
}

/** The fixture's History badge, narrowed. */
function historyBadge(): HistoryReaderBadge {
  const badge = badgeOf('history');
  if (badge.kind !== 'history') throw new Error('wrong kind');
  return badge;
}

describe('interpretiveClaimOf', () => {
  it("names Murai's reading on the badge that carries his pericope title", () => {
    expect(interpretiveClaimOf(historyBadge())).toEqual({
      label: "Murai's reading",
      attributedTo: 'Hajime Murai',
    });
  });

  it('qualifies nothing on a badge whose teaser is entirely sourced', () => {
    for (const kind of ['route', '3d-city', 'root', 'cross-ref'] as const) {
      expect(interpretiveClaimOf(badgeOf(kind)), kind).toBeUndefined();
    }
  });

  it('refuses a partial attribution rather than printing half of one', () => {
    const badge = historyBadge();

    // The three fields travel together or not at all (`historical-badge.types.ts`). A title
    // whose scholar did not resolve is unattributed, not weakly attributed — and the
    // server's own fallback teaser asserts nothing, so there is nothing to qualify.
    for (const missing of ['passageTitle', 'interpretiveClaim', 'attributedTo'] as const) {
      const partial: HistoryReaderBadge = {
        ...badge,
        payload: { ...badge.payload, [missing]: undefined },
      };

      expect(interpretiveClaimOf(partial), missing).toBeUndefined();
    }
  });
});

describe('attributedTeaserLabel', () => {
  it('reads as one sentence, so the attribution stays attached to its claim', () => {
    expect(
      attributedTeaserLabel("AD 47 - Paul's vision", {
        label: "Murai's reading",
        attributedTo: 'Hajime Murai',
      }),
    ).toBe("AD 47 - Paul's vision. Murai's reading, Hajime Murai.");
  });

  it('leaves a sourced teaser exactly as it was', () => {
    expect(attributedTeaserLabel('Derbe to Thyatira - 20 stops', undefined)).toBe(
      'Derbe to Thyatira - 20 stops',
    );
  });
});
