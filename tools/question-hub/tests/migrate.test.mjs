/**
 * The v1 -> v3 migration, under a microscope.
 *
 * The hub's data file holds answers a human already gave. Every test here exists to
 * catch one specific way those answers could quietly stop being answers.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { migrate } from '../lib/migrate.mjs';
import { loadFixture } from './helpers/hub-server.mjs';
import { identityGate, idempotenceGate, answerCensus } from './helpers/migration-gates.mjs';

const HUB_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
const byId = (db, id) => db.questions.find((q) => q.id === id);

describe('migrate() is pure', () => {
  test('imports nothing from node:fs — a pure function is the only kind you can prove safe', async () => {
    const source = await readFile(join(HUB_DIR, 'lib', 'migrate.mjs'), 'utf8');

    assert.equal(/from\s+['"]node:fs/.test(source), false, 'lib/migrate.mjs imports node:fs');
    assert.equal(/require\(['"]node:fs/.test(source), false, 'lib/migrate.mjs requires node:fs');
  });

  test('does not mutate the database it is given', async () => {
    const db = await loadFixture('legacy-v1-kinds.json');
    const untouched = structuredClone(db);

    migrate(db);

    assert.deepEqual(db, untouched, 'migrate() mutated its input; a failed migration would corrupt memory');
  });
});

describe('no answer is lost — the regression that matters most', () => {
  for (const fixture of ['legacy-v1-kinds.json', 'legacy-v1-curly-apostrophe.json', 'legacy-v1-edge-cases.json']) {
    test(fixture + ': every stored answer survives byte-for-byte', async () => {
      const before = await loadFixture(fixture);

      const after = migrate(structuredClone(before));

      const censusBefore = answerCensus(before);
      const censusAfter = answerCensus(after);
      assert.deepEqual(censusAfter.ids, censusBefore.ids, 'the set of answered questions changed');
      for (const original of before.questions) {
        const migrated = byId(after, original.id);
        assert.ok(migrated, original.id + ' vanished during migration');
        assert.deepEqual(migrated.answer, original.answer, original.id + ' answer text changed');
        assert.equal(migrated.answeredAt, original.answeredAt, original.id + ' answeredAt changed');
        assert.equal(migrated.note, original.note, original.id + ' note changed');
      }
    });

    test(fixture + ': the identity gate holds — the migration may only add', async () => {
      const before = await loadFixture(fixture);

      const { ok, failures } = identityGate(before, migrate(structuredClone(before)));

      assert.ok(ok, 'frozen fields changed: ' + JSON.stringify(failures.slice(0, 5), null, 2));
    });
  }

  test('a withdrawn question keeps its answer in storage', async () => {
    const before = await loadFixture('legacy-v1-edge-cases.json');

    const after = migrate(structuredClone(before));

    const withdrawn = byId(after, 'W-01');
    assert.equal(withdrawn.status, 'withdrawn');
    assert.equal(withdrawn.answer, 'No — LAN only', 'a soft-deleted question must not lose its answer');
  });
});

describe('the curly-apostrophe case — why pass 2 exists', () => {
  test('C-01: an answer whose apostrophe drifted still resolves to the picked option', async () => {
    const before = await loadFixture('legacy-v1-curly-apostrophe.json');
    const original = byId(before, 'C-01');
    assert.equal(original.options.indexOf(original.answer), -1, 'fixture no longer reproduces the defect');

    const q = byId(migrate(structuredClone(before)), 'C-01');

    assert.equal(q.answerDetail.match, 'normalised', 'the drifted answer was not reconciled');
    assert.deepEqual(q.answerDetail.selected, [original.options[1]],
      'selected must carry the ORIGINAL option string, never the answer\'s spelling');
    assert.equal(q.answerDetail.other, null, 'a deliberately-picked option was demoted to free text');
    assert.equal(q.answerDetail.needsReview, false);
  });

  test('C-01: the option string in selected uses the straight apostrophe, not the curly one', async () => {
    const before = await loadFixture('legacy-v1-curly-apostrophe.json');

    const q = byId(migrate(structuredClone(before)), 'C-01');

    assert.equal(q.answerDetail.selected[0].includes('’'), false, 'selected kept the answer\'s curly apostrophe');
    assert.equal(q.answerDetail.selected[0].includes("'"), true);
  });

  for (const [id, label] of [
    ['C-02', 'em dash against a plain hyphen'],
    ['C-03', 'curly double quotes against straight ones'],
    ['C-04', 'doubled whitespace and different casing'],
  ]) {
    test(id + ': ' + label + ' still resolves to an option', async () => {
      const before = await loadFixture('legacy-v1-curly-apostrophe.json');

      const q = byId(migrate(structuredClone(before)), id);

      assert.equal(q.answerDetail.selected.length, 1, id + ' was not reconciled to its option');
      assert.ok(byId(before, id).options.includes(q.answerDetail.selected[0]),
        'selected must be an exact member of options');
    });
  }

  test('C-AMBIGUOUS: two options normalising alike are never guessed between', async () => {
    const before = await loadFixture('legacy-v1-curly-apostrophe.json');

    const q = byId(migrate(structuredClone(before)), 'C-AMBIGUOUS');

    assert.deepEqual(q.answerDetail.selected, [], 'the matcher guessed between two equally-good options');
    assert.equal(q.answerDetail.needsReview, true, 'an ambiguous match must be flagged for a human');
    assert.equal(q.answerDetail.other, 'SHIP IT', 'the human\'s text must survive somewhere');
  });
});

describe('answers that match nothing are kept, not discarded', () => {
  test('U-01: an off-menu answer becomes free text and is flagged', async () => {
    const before = await loadFixture('legacy-v1-edge-cases.json');

    const q = byId(migrate(structuredClone(before)), 'U-01');

    assert.deepEqual(q.answerDetail.selected, []);
    assert.equal(q.answerDetail.other, 'Neither — use React context and stop adding libraries');
    assert.equal(q.answerDetail.needsReview, true);
    assert.equal(q.status, 'answered', 'an unmatched answer is still an answer');
  });

  test('P-01: an option label containing " | " loses no text when the answer is split', async () => {
    const before = await loadFixture('legacy-v1-edge-cases.json');
    const original = byId(before, 'P-01');

    const q = byId(migrate(structuredClone(before)), 'P-01');

    const recovered = [...q.answerDetail.selected, q.answerDetail.other ?? ''].join(' ');
    for (const fragment of ['Reader', 'Studio combined', 'Journal']) {
      assert.ok(recovered.includes(fragment), fragment + ' was destroyed by the separator split');
    }
    assert.equal(q.answer, original.answer, 'the flat answer must be left exactly as stored');
  });

  test('E-01: an answered-but-empty record does not crash the migration', async () => {
    const before = await loadFixture('legacy-v1-edge-cases.json');

    const q = byId(migrate(structuredClone(before)), 'E-01');

    assert.equal(q.answer, '', 'the stored value was rewritten');
    assert.equal(q.status, 'answered', 'status changed, which would move the question back into the queue');
  });
});

describe('the added fields', () => {
  test('every question gains the v3 optional fields with documented defaults', async () => {
    const before = await loadFixture('legacy-v1-kinds.json');

    const after = migrate(structuredClone(before));

    for (const q of after.questions) {
      assert.deepEqual(q.attachments, [], q.id + ' attachments default');
      assert.deepEqual(q.optionMeta, {}, q.id + ' optionMeta default');
      assert.equal(q.layout, 'list', q.id + ' layout default');
      assert.equal(q.assumedInUse, false, q.id + ' assumedInUse default');
      assert.equal(q.priority, null, q.id + ' priority default');
      assert.equal(q.withdrawnAt, null, q.id + ' withdrawnAt default');
      assert.equal(q.withdrawReason, null, q.id + ' withdrawReason default');
      assert.equal(q.updatedAt, q.answeredAt ?? q.askedAt, q.id + ' updatedAt default');
    }
  });

  test('allowOther is on for pickable kinds and off for free-text kinds', async () => {
    const before = await loadFixture('legacy-v1-kinds.json');

    const after = migrate(structuredClone(before));

    assert.equal(byId(after, 'K-CHOICE').allowOther, true);
    assert.equal(byId(after, 'K-MULTI').allowOther, true);
    assert.equal(byId(after, 'K-TEXT').allowOther, false);
    assert.equal(byId(after, 'K-SCALE').allowOther, false);
  });

  test('an open question gets a null answerDetail, not an empty one', async () => {
    const before = await loadFixture('legacy-v1-kinds.json');

    const q = byId(migrate(structuredClone(before)), 'K-OPEN');

    assert.equal(q.answerDetail, null, 'an unanswered question must not look answered to a reader');
  });

  test('text and scale answers land in the right slot', async () => {
    const before = await loadFixture('legacy-v1-kinds.json');

    const after = migrate(structuredClone(before));

    assert.equal(byId(after, 'K-TEXT').answerDetail.text, 'Plain and unhurried. Never breathless, never salesy.');
    assert.deepEqual(byId(after, 'K-SCALE').answerDetail.selected, ['4'], 'a numeric scale answer must be stringified');
  });

  test('multi answers split into exact option strings', async () => {
    const before = await loadFixture('legacy-v1-kinds.json');

    const q = byId(migrate(structuredClone(before)), 'K-MULTI');

    assert.deepEqual(q.answerDetail.selected, ['Home', 'Reader', 'Studio']);
    assert.equal(q.answerDetail.other, null);
  });

  test('the database header records where it came from', async () => {
    const before = await loadFixture('legacy-v1-kinds.json');

    const after = migrate(structuredClone(before));

    assert.equal(after.version, 3);
    assert.equal(after.migratedFrom, 1);
    assert.ok(after.migratedAt, 'migratedAt must be stamped so "when did this change" is answerable');
    assert.equal(typeof after.seq, 'number', 'the DB needs a monotonic seq for the event channel');
  });

  test('existing events are given a seq by index rather than being dropped', async () => {
    const before = await loadFixture('legacy-v1-kinds.json');

    const after = migrate(structuredClone(before));

    assert.equal(after.events.length, before.events.length, 'events were lost');
    assert.deepEqual(after.events.map((e) => e.seq), [1, 2]);
  });
});

describe('running it twice is safe', () => {
  for (const fixture of ['legacy-v1-kinds.json', 'legacy-v1-curly-apostrophe.json', 'legacy-v1-edge-cases.json']) {
    test(fixture + ': migrate(migrate(db)) deep-equals migrate(db)', async () => {
      const db = await loadFixture(fixture);

      const { ok, once, twice } = idempotenceGate(migrate, db);

      assert.ok(ok, 'a second boot changed the data. First divergence: ' +
        JSON.stringify({ once: once.questions?.[0], twice: twice.questions?.[0] }).slice(0, 400));
    });
  }

  test('an already-v3 database comes back unchanged', async () => {
    const db = await loadFixture('already-v3.json');

    const after = migrate(structuredClone(db));

    assert.deepEqual(after, db, 'a v3 file was rewritten on load; answerDetail would drift on every restart');
  });
});

describe('degenerate inputs', () => {
  test('an empty v1 database migrates to a valid empty v3 database', async () => {
    const db = await loadFixture('legacy-v1-empty.json');

    const after = migrate(structuredClone(db));

    assert.deepEqual(after.questions, [], 'the migration invented records out of nothing');
    assert.equal(after.version, 3);
  });

  test('a database from a newer server is never silently downgraded', async () => {
    const db = await loadFixture('future-version-99.json');

    let after = null;
    let threw = false;
    try {
      after = migrate(structuredClone(db));
    } catch {
      threw = true;
    }

    if (!threw) {
      assert.equal(after.version, 99, 'migrate() rewrote a v99 database as v3 — every newer field would be dropped');
      assert.deepEqual(after.questions, db.questions, 'migrate() altered records it does not understand');
    }
  });
});
