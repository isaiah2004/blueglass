/**
 * Journey 3 — accept all recommendations for a section, and undo.
 *
 * This is the highest-value feature and the most dangerous: it is where "fast" turns into
 * "I just agreed to 79 things". The safety properties are what is tested here —
 *
 *   accepting STAGES and does not write, so undo costs nothing;
 *   undo is scoped to its own batch and cannot eat edits made in between;
 *   questions with no recommendation are structurally excluded, never bulk-answered;
 *   what is written records that it was a bulk endorsement, not a considered decision.
 */
import { test, expect, save, sel, revealCard } from './hub-fixture';

const SCOPE = '1 · Scope & truth';
const SETTLE = '5 · Only you can settle';

test.describe('the review sheet', () => {
  test('opens with one pre-checked row per recommendation in the section', async ({ hubPage }) => {
    const { page } = hubPage;

    await page.click(sel.acceptSection(SCOPE));

    await expect(page.locator(sel.sheet)).toBeVisible();
    await expect(page.locator(sel.sheetRows)).toHaveCount(3);
    for (const row of await page.locator(sel.sheetRows).all()) await expect(row).toBeChecked();
    await expect(page.locator(sel.sheetConfirm)).toHaveText('Accept 3');
  });

  test('shows the full recommended text, so nothing is accepted sight-unseen', async ({ hubPage }) => {
    const { page } = hubPage;

    await page.click(sel.acceptSection(SCOPE));

    await expect(page.locator(sel.sheet))
      .toContainText('Whole-Bible reader shell, full depth only for Acts');
    await expect(page.locator(sel.sheet)).toContainText('A clean rewrite');
  });

  test('unchecking a row lowers the count live', async ({ hubPage }) => {
    const { page } = hubPage;
    await page.click(sel.acceptSection(SCOPE));

    await page.locator(sel.sheetRows).first().uncheck();

    await expect(page.locator(sel.sheetConfirm)).toHaveText('Accept 2');
  });

  test('questions with no recommendation are excluded and the footer says so', async ({ hubPage }) => {
    const { page } = hubPage;

    await page.click(sel.acceptSection(SETTLE));

    await expect(page.locator(sel.sheetRows)).toHaveCount(1);
    await expect(page.locator(sel.sheet)).toContainText('no recommendation');
    await expect(page.locator(sel.sheet), 'a question only the human can settle was offered for bulk accept')
      .not.toContainText('What is the app actually for');
  });
});

test.describe('accepting stages, and never writes', () => {
  test('confirming stages every checked question without touching the server', async ({ hubPage }) => {
    const { page, hub } = hubPage;
    await page.click(sel.acceptSection(SCOPE));

    await page.click(sel.sheetConfirm);

    await expect(page.locator(sel.save)).toBeEnabled();
    const db = await hub.readDb();
    const answered = db.questions.filter((q: any) => q.status === 'answered').map((q: any) => q.id);
    expect(answered, 'accepting wrote to disk before Save; undo would have nothing to undo').toEqual(['A-01']);
  });

  test('the sticky bar reports the staged answers instead of claiming everything is saved', async ({ hubPage }) => {
    const { page } = hubPage;

    await page.click(sel.acceptSection(SCOPE));
    await page.click(sel.sheetConfirm);

    // Telling someone "Up to date" while three of their answers are unsaved is the kind of
    // small lie that costs real work when they close the tab believing it.
    await expect(page.locator(sel.status), 'the save bar claims everything is saved while edits are staged')
      .toContainText('unsaved');
  });

  test('exactly the checked rows are staged — an unchecked one stays open', async ({ hubPage }) => {
    const { page, hub } = hubPage;
    await page.click(sel.acceptSection(SCOPE));
    await page.locator('#acceptSheet [data-pick][value="S-03"], #acceptSheet [data-pick][data-pick="S-03"]')
      .or(page.locator(sel.sheetRows).nth(2)).first().uncheck();

    await page.click(sel.sheetConfirm);
    await save(page);

    const db = await hub.readDb();
    const answered = new Set(db.questions.filter((q: any) => q.status === 'answered').map((q: any) => q.id));
    expect(answered.has('S-01'), 'a checked recommendation was not accepted').toBe(true);
    expect(answered.size, 'an unchecked row was accepted anyway').toBe(3); // A-01 + two accepted
  });

  test('saving writes the recommendations and records them as a bulk endorsement', async ({ hubPage }) => {
    const { page, hub } = hubPage;
    await page.click(sel.acceptSection(SCOPE));
    await page.click(sel.sheetConfirm);

    await save(page);

    const db = await hub.readDb();
    for (const id of ['S-01', 'S-02', 'S-03']) {
      const q = db.questions.find((x: any) => x.id === id);
      expect(q.status, id + ' was not accepted').toBe('answered');
      expect(q.answer, id + ' did not take the recommended answer').toBe(q.recommended);
      expect(q.answerDetail.source, 'the fleet cannot tell this from a deliberate decision')
        .toBe('accepted-recommendation');
    }
  });

  test('the section shows as complete once everything in it is answered', async ({ hubPage }) => {
    const { page } = hubPage;
    await page.click(sel.acceptSection(SCOPE));
    await page.click(sel.sheetConfirm);

    await save(page);
    await revealCard(page, 'S-01');

    await expect(page.locator(`details:has(${sel.card('S-01')}) .sec-count`)).toHaveText('3/3');
  });
});

test.describe('undo', () => {
  test('undo empties the staging set and leaves the disk untouched', async ({ hubPage }) => {
    const { page, hub } = hubPage;
    await page.click(sel.acceptSection(SCOPE));
    await page.click(sel.sheetConfirm);
    await expect(page.locator(sel.undo)).toBeVisible();

    await page.click(sel.undo);

    await expect(page.locator(sel.save)).toBeDisabled();
    const db = await hub.readDb();
    const answered = db.questions.filter((q: any) => q.status === 'answered').map((q: any) => q.id);
    expect(answered, 'undo did not prevent the accepted answers reaching disk').toEqual(['A-01']);
  });

  test('undo is scoped to its own batch and does not eat an edit made in between', async ({ hubPage }) => {
    const { page, hub } = hubPage;
    await page.fill(sel.textInput('T-01'), 'A tone I typed myself');
    await page.click(sel.acceptSection(SCOPE));
    await page.click(sel.sheetConfirm);

    await page.click(sel.undo);
    await save(page);

    const db = await hub.readDb();
    expect(db.questions.find((q: any) => q.id === 'T-01').answer,
      'undo removed an edit that was not part of the accepted batch').toBe('A tone I typed myself');
    expect(db.questions.find((q: any) => q.id === 'S-01').status).toBe('open');
  });

  test('after undo, the recommendations can be accepted again', async ({ hubPage }) => {
    const { page, hub } = hubPage;
    await page.click(sel.acceptSection(SCOPE));
    await page.click(sel.sheetConfirm);
    await page.click(sel.undo);

    await page.click(sel.acceptSection(SCOPE));
    await page.click(sel.sheetConfirm);
    await save(page);

    const db = await hub.readDb();
    expect(db.questions.find((q: any) => q.id === 'S-01').status).toBe('answered');
  });
});

test.describe('the per-card fast path', () => {
  test('the Accept button on a recommended option stages just that one', async ({ hubPage }) => {
    const { page, hub } = hubPage;

    await page.locator(`${sel.card('N-02')} [data-act="accept"]`).click();
    await save(page);

    const db = await hub.readDb();
    const q = db.questions.find((x: any) => x.id === 'N-02');
    expect(q.answer).toBe('Yes, quietly');
    expect(q.answerDetail.source).toBe('accepted-recommendation');
    expect(db.questions.find((x: any) => x.id === 'N-01').status,
      'accepting one card accepted a question that has no recommendation').toBe('open');
  });

  test('a question with no recommendation offers no Accept button at all', async ({ hubPage }) => {
    const { page } = hubPage;

    await revealCard(page, 'N-01');

    await expect(page.locator(`${sel.card('N-01')} [data-act="accept"]`)).toHaveCount(0);
  });
});
