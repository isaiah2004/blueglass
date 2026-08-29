/**
 * Journey 4 — staged answers are never lost.
 *
 * The hub polls for new questions while the human is part-way through answering. Every
 * test here is about the same promise: the background must never cost you work you have
 * already done. Twenty answers lost to a poll is nearly as bad as losing them from disk,
 * because it is the same person's time either way.
 *
 * Nothing here waits on a duration. The poll is made to fire by posting a question as
 * another agent would, and the test then waits for that question to appear.
 */
import { test, expect, save, sel, blurFields, waitForDraft } from './hub-fixture';

/** Post a question the way a fleet agent would, then wait for the page to notice. */
async function fleetAsks(hub: any, page: any, id: string) {
  await blurFields(page);
  await hub.post('/api/ask', {
    id, section: '7 · From the fleet', question: 'Posted by an agent while you were answering: ' + id,
    why: 'Arrives through the long-poll.', kind: 'choice', options: ['Yes', 'No'],
    recommended: 'Yes', askedBy: 'fleet-agent',
  });
  await expect(page.locator(sel.card(id))).toBeVisible({ timeout: 20000 });
}

test.describe('a background poll never clobbers staged edits', () => {
  test('five staged answers all survive a question arriving from the fleet', async ({ hubPage }) => {
    const { page, hub } = hubPage;
    await page.click(sel.option('S-01', 'A demoable MVP of one journey'));
    await page.click(sel.option('S-02', 'A clean rewrite'));
    await page.click(sel.option('S-03', 'iOS first'));
    await page.fill(sel.textInput('T-01'), 'A tone I typed myself');
    await page.click(sel.option('M-01', 'Route'));

    await fleetAsks(hub, page, 'FLEET-01');

    await expect(page.locator(sel.option('S-01', 'A demoable MVP of one journey'))).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator(sel.option('S-02', 'A clean rewrite'))).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator(sel.option('S-03', 'iOS first'))).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator(sel.textInput('T-01'))).toHaveValue('A tone I typed myself');
    await expect(page.locator(sel.option('M-01', 'Route'))).toHaveAttribute('aria-pressed', 'true');
  });

  test('and they still save correctly afterwards', async ({ hubPage }) => {
    const { page, hub } = hubPage;
    await page.click(sel.option('S-01', 'A demoable MVP of one journey'));
    await page.fill(sel.textInput('T-01'), 'A tone I typed myself');

    await fleetAsks(hub, page, 'FLEET-02');
    await save(page);

    const db = await hub.readDb();
    expect(db.questions.find((q: any) => q.id === 'S-01').answer).toBe('A demoable MVP of one journey');
    expect(db.questions.find((q: any) => q.id === 'T-01').answer).toBe('A tone I typed myself');
  });

  test('a question answered elsewhere does not overwrite an untouched card silently', async ({ hubPage }) => {
    const { page, hub } = hubPage;
    await page.click(sel.option('S-01', 'A demoable MVP of one journey'));

    await hub.post('/api/answer', { id: 'S-02', answer: 'An incremental port' });
    await fleetAsks(hub, page, 'FLEET-03');

    await expect(page.locator(sel.option('S-01', 'A demoable MVP of one journey'))).toHaveAttribute('aria-pressed', 'true');
  });
});

test.describe('staged edits survive the tab being thrown away', () => {
  test('a reload restores every staged answer and says how many', async ({ hubPage }) => {
    const { page } = hubPage;
    await page.click(sel.option('S-01', 'A demoable MVP of one journey'));
    await page.click(sel.option('S-02', 'A clean rewrite'));
    await page.click(sel.option('S-03', 'iOS first'));
    await expect(page.locator(sel.save)).toBeEnabled();
    await waitForDraft(page, 3);

    await page.reload();

    await expect(page.locator('#restoreBanner')).toBeVisible();
    await expect(page.locator('#restoreCount')).toHaveText('3');
    await expect(page.locator(sel.option('S-01', 'A demoable MVP of one journey'))).toHaveAttribute('aria-pressed', 'true');
  });

  test('restored answers save exactly as if they had never been lost', async ({ hubPage }) => {
    const { page, hub } = hubPage;
    await page.click(sel.option('S-01', 'A demoable MVP of one journey'));
    await waitForDraft(page, 1);
    await page.reload();
    await expect(page.locator('#restoreBanner')).toBeVisible();

    await save(page);

    const stored = (await hub.readDb()).questions.find((q: any) => q.id === 'S-01');
    expect(stored.answer).toBe('A demoable MVP of one journey');
  });

  test('nothing is restored once it has actually been saved', async ({ hubPage }) => {
    const { page } = hubPage;
    await page.click(sel.option('S-01', 'A demoable MVP of one journey'));
    await save(page);

    await page.reload();

    await expect(page.locator('#restoreBanner'), 'a saved answer was offered back as an unsaved draft')
      .toBeHidden();
  });
});

test.describe('two devices, one question', () => {
  test('an answer arriving from another device surfaces a conflict rather than winning silently', async ({ hubPage }) => {
    const { page, hub } = hubPage;
    await page.click(sel.option('S-01', 'A demoable MVP of one journey'));

    await hub.post('/api/answer', { id: 'S-01', answer: 'Architectural skeleton with two flagship features' });
    await fleetAsks(hub, page, 'FLEET-04');

    const conflict = page.locator(`${sel.card('S-01')} .conflict`);
    await expect(conflict, 'the other device won silently; this is how people lose work').toBeVisible();
    await expect(conflict).toContainText('Architectural skeleton with two flagship features');
  });

  test('Keep mine wins and is what gets written', async ({ hubPage }) => {
    const { page, hub } = hubPage;
    await page.click(sel.option('S-01', 'A demoable MVP of one journey'));
    await hub.post('/api/answer', { id: 'S-01', answer: 'Architectural skeleton with two flagship features' });
    await fleetAsks(hub, page, 'FLEET-05');

    await page.locator(`${sel.card('S-01')} [data-act="keep-mine"]`).click();
    await save(page);

    const stored = (await hub.readDb()).questions.find((q: any) => q.id === 'S-01');
    expect(stored.answer, 'Keep mine did not keep mine').toBe('A demoable MVP of one journey');
  });

  test('Take theirs discards the local edit deliberately', async ({ hubPage }) => {
    const { page, hub } = hubPage;
    await page.click(sel.option('S-01', 'A demoable MVP of one journey'));
    await hub.post('/api/answer', { id: 'S-01', answer: 'Architectural skeleton with two flagship features' });
    await fleetAsks(hub, page, 'FLEET-06');

    await page.locator(`${sel.card('S-01')} [data-act="take-theirs"]`).click();

    await expect(page.locator(`${sel.card('S-01')} .conflict`)).toBeHidden();
    const stored = (await hub.readDb()).questions.find((q: any) => q.id === 'S-01');
    expect(stored.answer).toBe('Architectural skeleton with two flagship features');
  });
});
