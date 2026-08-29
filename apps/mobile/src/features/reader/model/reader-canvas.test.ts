/**
 * Tests for the scripture column's shaping numbers.
 *
 * The `0`-means-uncapped conversion is the one that matters: shipping `maxWidth: 0` would
 * collapse the reading column to nothing on every phone.
 *
 * The second thing pinned here is the pane-versus-window distinction. A 768 dp tablet has
 * 408 dp of scripture pane once the nav rail and the context rail are taken off, and
 * answering "tablet" to both the gutter and the type step put a 306 dp column of the app's
 * largest serif inside it — narrower than the same app's phone column, at about 28
 * characters a line.
 */

import {
  layout,
  readingMeasure,
  scriptureStepByFormFactor,
  spacing,
  type FormFactor,
} from '@/theme';
import { describe, expect, it } from 'vitest';

import {
  columnMaxWidth,
  PHONE_LIKE_PANE_DP,
  readerGutterFor,
  readerPaneWidth,
  readerScriptureStep,
} from './reader-canvas';

const FORM_FACTORS: readonly FormFactor[] = ['phone', 'tablet', 'desktop'];

describe('readerGutterFor', () => {
  it('answers for every form factor with a spacing token', () => {
    const scale = Object.values(spacing);
    for (const form of FORM_FACTORS) {
      expect(scale).toContain(readerGutterFor(form));
    }
  });

  it('gives a phone the tightest gutter and never a tighter one to a larger screen', () => {
    expect(readerGutterFor('phone')).toBeLessThan(readerGutterFor('tablet'));
    expect(readerGutterFor('tablet')).toBeLessThanOrEqual(readerGutterFor('desktop'));
  });

  it('spends no air on a pane too narrow to have any', () => {
    // 768 dp tablet: 80 dp nav rail, 280 dp context rail, 408 dp of scripture left.
    expect(readerGutterFor('tablet', 408)).toBe(readerGutterFor('phone'));
  });

  it('leaves a roomy pane roomy, whatever its window', () => {
    expect(readerGutterFor('tablet', 664)).toBe(readerGutterFor('tablet'));
    expect(readerGutterFor('desktop', 900)).toBe(readerGutterFor('desktop'));
  });
});

describe('readerPaneWidth', () => {
  it('takes the context rail off the content width', () => {
    expect(readerPaneWidth(688, layout.contextRail.minTablet)).toBe(408);
  });

  it('is the whole content width when there is no rail', () => {
    expect(readerPaneWidth(375, 0)).toBe(375);
  });

  it('never reports a negative pane', () => {
    expect(readerPaneWidth(200, 280)).toBe(0);
  });
});

describe('readerScriptureStep', () => {
  it('sets a phone-sized pane in a phone type step, whatever the window says', () => {
    expect(readerScriptureStep('tablet', 408)).toBe(scriptureStepByFormFactor.phone);
  });

  it('keeps the form factor own step once the pane is wide enough', () => {
    for (const form of FORM_FACTORS) {
      expect(readerScriptureStep(form, PHONE_LIKE_PANE_DP)).toBe(scriptureStepByFormFactor[form]);
    }
  });

  it('falls back to the window when the pane is not known', () => {
    for (const form of FORM_FACTORS) {
      expect(readerScriptureStep(form)).toBe(scriptureStepByFormFactor[form]);
    }
  });
});

describe('columnMaxWidth', () => {
  it('treats the design system’s 0 as uncapped, not as zero width', () => {
    expect(columnMaxWidth(readingMeasure.phone)).toBeUndefined();
  });

  it('passes a real cap straight through', () => {
    expect(columnMaxWidth(readingMeasure.tablet)).toBe(readingMeasure.tablet);
    expect(columnMaxWidth(readingMeasure.desktop)).toBe(readingMeasure.desktop);
  });

  it('never returns zero', () => {
    for (const form of FORM_FACTORS) {
      expect(columnMaxWidth(readingMeasure[form])).not.toBe(0);
    }
  });
});
