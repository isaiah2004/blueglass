/**
 * Tests for the licence-notice rules.
 *
 * Driven by the real attribution strings the API sends for Acts 16, because the whole
 * defect was a mismatch between two spellings of one licence that no invented fixture
 * would have contained.
 */

import { describe, expect, it } from 'vitest';

import { attributionStatesLicence, licenceChip, licenceToken } from './licence-notice';

/** The line OpenBible's cross-reference dataset obliges us to print, verbatim. */
const CROSS_REFS = 'Cross-references © OpenBible.info, CC BY 4.0';

/** Natural Earth's own notice, which names no licence at all. */
const NATURAL_EARTH = 'Made with Natural Earth.';

/** U+2011, the hyphen a line break may not fall on. */
const NON_BREAKING_HYPHEN = '\u2011';

describe('licenceToken', () => {
  it('makes every hyphen unbreakable, so the identifier is one token', () => {
    expect(licenceToken('CC-BY-4.0')).toBe(`CC${NON_BREAKING_HYPHEN}BY${NON_BREAKING_HYPHEN}4.0`);
  });

  it('contains no ordinary hyphen for a line break to fall on', () => {
    expect(licenceToken('CC-BY-SA-4.0')).not.toContain('-');
  });

  it('leaves an identifier with no hyphen exactly as it was', () => {
    expect(licenceToken('CC0')).toBe('CC0');
  });
});

describe('attributionStatesLicence', () => {
  it('sees through the difference between CC BY 4.0 and CC-BY-4.0', () => {
    expect(attributionStatesLicence(CROSS_REFS, 'CC-BY-4.0')).toBe(true);
  });

  it('is false when the notice names no licence', () => {
    expect(attributionStatesLicence(NATURAL_EARTH, 'public-domain')).toBe(false);
  });

  it('does not mistake one licence for a different one', () => {
    expect(attributionStatesLicence(CROSS_REFS, 'CC-BY-SA-4.0')).toBe(false);
  });

  it('treats a blank licence as not stated rather than as trivially present', () => {
    expect(attributionStatesLicence(CROSS_REFS, '')).toBe(false);
    expect(attributionStatesLicence(CROSS_REFS, '   ')).toBe(false);
  });
});

describe('licenceChip', () => {
  it('prints nothing when the notice already carries the licence', () => {
    expect(licenceChip(CROSS_REFS, 'CC-BY-4.0')).toBeNull();
  });

  it('prints the unbreakable identifier when the notice does not', () => {
    expect(licenceChip(NATURAL_EARTH, 'public-domain')).toBe(`public${NON_BREAKING_HYPHEN}domain`);
  });

  it('prints nothing rather than an empty chip when there is no identifier', () => {
    expect(licenceChip(NATURAL_EARTH, '')).toBeNull();
  });
});
