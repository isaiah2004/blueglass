/**
 * The rule that stops a downstream agent ever having to guess (hub-platform.md §2.5):
 *
 *   A string may appear in answerDetail.selected (or ranking) ONLY if it is === to an
 *   entry in that question's options. Free text appears only in `other`.
 *
 * If that rule leaks, an agent reading the hub cannot tell a picked option from something
 * the human typed, which is exactly the ambiguity answerDetail was added to remove.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  deriveAnswerDetail, flatten, buildDetail, normaliseForMatch, OTHER_PREFIX,
} from '../lib/answer-detail.mjs';

const question = (over = {}) => ({
  id: 'Q-1', kind: 'choice', options: ['Alpha', 'Beta', 'Gamma'], status: 'answered', answer: null, ...over,
});

describe('the flat answer string stays derivable — the frozen format', () => {
  test('choice: an exact pick round-trips to the identical stored string', () => {
    const q = question({ answer: 'Beta' });

    const detail = deriveAnswerDetail(q);

    assert.deepEqual(detail.selected, ['Beta']);
    assert.equal(flatten(detail), q.answer, 'the frozen flat string changed under an exact match');
  });

  test('multi: parts round-trip joined by " | "', () => {
    const q = question({ kind: 'multi', answer: 'Alpha | Gamma' });

    const detail = deriveAnswerDetail(q);

    assert.deepEqual(detail.selected, ['Alpha', 'Gamma']);
    assert.equal(flatten(detail), 'Alpha | Gamma');
  });

  test('rank: a partial ranking joins with " > " and is a valid answer', () => {
    const detail = buildDetail(question({ kind: 'rank' }), { ranking: ['Gamma', 'Alpha'] }, 'human').detail;

    assert.deepEqual(detail.ranking, ['Gamma', 'Alpha']);
    assert.equal(flatten(detail), 'Gamma > Alpha', 'ranking two of three options must be accepted');
  });

  test('text: the prose is the answer, untouched', () => {
    const q = question({ kind: 'text', options: [], answer: 'Plain and unhurried.' });

    assert.equal(flatten(deriveAnswerDetail(q)), 'Plain and unhurried.');
  });

  test('free text is prefixed "Other: " so even an old flat-string reader can tell', () => {
    const detail = buildDetail(question(), { selected: [], other: 'Something else entirely' }, 'human').detail;

    assert.equal(flatten(detail), OTHER_PREFIX + 'Something else entirely');
    assert.ok(flatten(detail).startsWith('Other: '), 'the escape hatch stopped degrading gracefully');
  });
});

describe('selected may only ever contain exact option strings', () => {
  test('a value that is not an option is refused rather than stored', () => {
    const { error, detail } = buildDetail(question(), { selected: ['Delta'] }, 'human');

    assert.ok(error, 'free text was accepted into selected; a reader can no longer trust it');
    assert.equal(detail, undefined);
  });

  test('the same option twice is refused', () => {
    const { error } = buildDetail(question({ kind: 'multi' }), { selected: ['Alpha', 'Alpha'] }, 'human');

    assert.ok(error, 'a duplicated pick would double-count in every downstream tally');
  });

  test('choice refuses more than one pick', () => {
    const { error } = buildDetail(question(), { selected: ['Alpha', 'Beta'] }, 'human');

    assert.ok(error, 'kind=choice accepted two answers');
  });

  test('typing into Other on a choice clears the pick — one answer means one answer', () => {
    const { detail } = buildDetail(question(), { selected: ['Alpha'], other: 'Neither' }, 'human');

    assert.deepEqual(detail.selected, [], 'a picked option survived alongside free text on a choice');
    assert.equal(detail.other, 'Neither');
  });

  test('on multi, Other is additive rather than exclusive', () => {
    const { detail } = buildDetail(question({ kind: 'multi' }), { selected: ['Alpha'], other: 'And this' }, 'human');

    assert.deepEqual(detail.selected, ['Alpha']);
    assert.equal(detail.other, 'And this');
    assert.equal(flatten(detail), 'Alpha | Other: And this');
  });
});

describe('normalisation folds punctuation drift, and nothing more', () => {
  test('curly quotes, dashes, whitespace and case all fold together', () => {
    const canonical = normaliseForMatch("build tokens so it's possible - yes");

    for (const variant of [
      'build tokens so it’s possible — yes',
      'BUILD  TOKENS   so it’s possible – yes ',
      '  build tokens so it’s possible - yes  ',
    ]) {
      assert.equal(normaliseForMatch(variant), canonical, 'did not fold: ' + variant);
    }
  });

  test('genuinely different strings do not fold together', () => {
    assert.notEqual(normaliseForMatch('Warm paper'), normaliseForMatch('Dark cinematic'));
    assert.notEqual(normaliseForMatch('iOS first'), normaliseForMatch('Android first'));
  });

  test('an untouched answer is reported as exact, not as needing reconciliation', () => {
    const detail = deriveAnswerDetail(question({ answer: 'Alpha' }));

    assert.equal(detail.match, 'exact');
    assert.deepEqual(detail.selected, ['Alpha']);
  });

  test('a drifted answer stores the ORIGINAL option spelling, never its own', () => {
    const q = question({ options: ["so it's possible", 'something else'], answer: 'so it’s possible' });

    const detail = deriveAnswerDetail(q);

    assert.equal(detail.match, 'normalised');
    assert.deepEqual(detail.selected, ["so it's possible"], 'the answer\'s spelling leaked into the option list');
  });

  test('two options that normalise alike produce no match at all', () => {
    const q = question({ options: ['Ship it', 'ship  it'], answer: 'SHIP IT' });

    const detail = deriveAnswerDetail(q);

    assert.deepEqual(detail.selected, [], 'the matcher guessed between two equally-good candidates');
    assert.equal(detail.needsReview, true);
  });
});

describe('provenance is recorded, because bulk endorsement is not deliberation', () => {
  test('a migrated answer is marked imported', () => {
    const detail = deriveAnswerDetail(question({ answer: 'Beta' }), 'imported');

    assert.equal(detail.source, 'imported');
  });

  test('an accepted recommendation is distinguishable from a considered pick', () => {
    const accepted = buildDetail(question(), { selected: ['Alpha'] }, 'accepted-recommendation').detail;
    const chosen = buildDetail(question(), { selected: ['Alpha'] }, 'human').detail;

    assert.equal(accepted.source, 'accepted-recommendation');
    assert.equal(chosen.source, 'human');
    assert.notEqual(accepted.source, chosen.source,
      'the fleet cannot tell a bulk accept from a deliberate decision');
  });
});

describe('unanswered and empty states', () => {
  test('an open question derives no detail at all', () => {
    assert.equal(deriveAnswerDetail(question({ status: 'open', answer: null })), null);
  });

  test('an answer matching nothing lands in other and is flagged', () => {
    const detail = deriveAnswerDetail(question({ answer: 'Something off-menu' }));

    assert.deepEqual(detail.selected, []);
    assert.equal(detail.other, 'Something off-menu');
    assert.equal(detail.needsReview, true);
  });
});
