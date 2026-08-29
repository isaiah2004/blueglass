/**
 * Tests for the History sheet's obligations.
 *
 * What is worth asserting here
 *   `Q-015` and `Q-016` are decisions a refactor cannot see. Nothing breaks when Murai's
 *   name falls off a heading — the sheet still renders, it just starts asserting one
 *   scholar's division of Acts as the text's own. These tests are the thing that breaks
 *   instead.
 *
 * Why the fixtures are assembled rather than overridden
 *   `exactOptionalPropertyTypes` is on, so an optional field is either present with a value
 *   or absent — passing `undefined` for it is a type error, not a way to remove it. The
 *   incomplete payloads below are therefore built from a base rather than by overwriting a
 *   complete one, which is also closer to what the wire produces.
 */

import { describe, expect, it } from 'vitest';

import type { HistorySheetPayload } from '../model/textual-payloads';
import {
  ERA_NOTE,
  attributedTitle,
  coveragePhrase,
  emptyTimelineCopy,
  muraiNotice,
  originNotice,
} from './dating-notice';

/** Everything a `[History]` payload always carries, taken from Acts 16:6-10. */
const BASE = {
  passageYearLabel: 'AD 47',
  biblicalAxis: [],
  worldAxis: [],
  rationale: 'Dated from the Theographic event Mission to Phrygia, Galatia and Asia (AD 47).',
  datingOrigin: 'sourced',
} as const satisfies HistorySheetPayload;

/** The three fields `Q-015` requires to travel together. */
const TITLE = "Paul's vision of the man of Macedonia";
const CLAIM = "Murai's reading";
const SCHOLAR = 'Hajime Murai';

/** The complete payload the API sends for Acts 16:6-10. */
const FULL: HistorySheetPayload = {
  ...BASE,
  confidence: 0.6,
  rulerName: 'Claudius',
  passageTitle: TITLE,
  interpretiveClaim: CLAIM,
  attributedTo: SCHOLAR,
};

describe('ERA_NOTE', () => {
  it('explains why Old Testament passages carry no year', () => {
    expect(ERA_NOTE.body).toContain('Old Testament');
    expect(ERA_NOTE.label).toBe('New Testament dating only');
  });
});

describe('muraiNotice', () => {
  it('labels the title with the claim the source travels under', () => {
    expect(muraiNotice(FULL)?.label).toBe(CLAIM);
  });

  it('names the scholar in the body, not just in a footnote', () => {
    expect(muraiNotice(FULL)?.body).toContain(SCHOLAR);
  });

  it('says the heading is not in the text itself', () => {
    expect(muraiNotice(FULL)?.body).toContain('not a heading in the text itself');
  });

  it('returns nothing when the title is missing', () => {
    expect(
      muraiNotice({ ...BASE, interpretiveClaim: CLAIM, attributedTo: SCHOLAR }),
    ).toBeUndefined();
  });

  it('returns nothing when the claim label is missing', () => {
    expect(muraiNotice({ ...BASE, passageTitle: TITLE, attributedTo: SCHOLAR })).toBeUndefined();
  });

  it('returns nothing when the scholar is missing, so no unattributed reading renders', () => {
    expect(muraiNotice({ ...BASE, passageTitle: TITLE, interpretiveClaim: CLAIM })).toBeUndefined();
  });
});

describe('attributedTitle', () => {
  it('offers the title only when it is fully attributed', () => {
    expect(attributedTitle(FULL)).toBe(TITLE);
    expect(attributedTitle({ ...BASE, passageTitle: TITLE })).toBeUndefined();
  });
});

describe('originNotice', () => {
  it('is silent for the sourced dating every M2 row carries', () => {
    expect(originNotice(FULL)).toBeUndefined();
  });

  it('says out loud when a date was written by a model', () => {
    expect(originNotice({ ...FULL, datingOrigin: 'generated' })?.body).toContain(
      'written by a language model',
    );
  });

  it('says out loud when a date was written by an editor', () => {
    expect(originNotice({ ...FULL, datingOrigin: 'authored' })?.body).toContain(
      'written by an editor',
    );
  });
});

describe('coveragePhrase', () => {
  it('names what the number measures, which is coverage and not certainty', () => {
    expect(coveragePhrase(FULL)).toBe('Covers about 60% of the passage');
  });

  it('rounds to whole percent', () => {
    expect(coveragePhrase({ ...FULL, confidence: 0.666 })).toBe('Covers about 67% of the passage');
  });

  it('is undefined when no confidence was sent', () => {
    expect(coveragePhrase(BASE)).toBeUndefined();
  });
});

describe('emptyTimelineCopy', () => {
  it('names the year and keeps the date standing', () => {
    expect(emptyTimelineCopy(FULL)).toContain('AD 47');
    expect(emptyTimelineCopy(FULL)).toContain('The date itself still stands');
  });
});
