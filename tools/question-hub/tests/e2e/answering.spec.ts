/**
 * Journey 1 — the walkthrough that must never break.
 *
 * If this file is red, the human cannot record a decision, and every agent in the fleet
 * is guessing. It is the smoke test the client hard rule in §8.2 exists to protect: a
 * broken swatch renderer must never cost someone the ability to answer a text question.
 *
 * Persistence is always checked twice — once in the UI after a reload, and once against
 * the file the server actually wrote. A UI that shows an answer it never saved is the
 * exact failure this is here to catch.
 */
import { test, expect, save, sel, revealCard } from './hub-fixture';

test.describe('answering and persistence', () => {
  test('a choice answer survives Save and a full page reload', async ({ hubPage }) => {
    const { page, hub } = hubPage;
    const answer = 'Whole-Bible reader shell, full depth only for Acts';

    await page.click(sel.option('S-01', answer));
    await save(page);
    await page.reload();
    await revealCard(page, 'S-01');

    await expect(page.locator(sel.option('S-01', answer))).toHaveAttribute('aria-pressed', 'true');
    const stored = (await hub.readDb()).questions.find((q: any) => q.id === 'S-01');
    expect(stored.answer, 'the UI showed an answer the server never stored').toBe(answer);
    expect(stored.status).toBe('answered');
    expect(stored.answerDetail.selected).toEqual([answer]);
    expect(stored.answerDetail.source).toBe('human');
  });

  test('a free-text answer survives Save and a reload', async ({ hubPage }) => {
    const { page, hub } = hubPage;
    const prose = 'Plain and unhurried. Never breathless, never salesy.';

    await page.fill(sel.textInput('T-01'), prose);
    await save(page);
    await page.reload();
    await revealCard(page, 'T-01');

    await expect(page.locator(sel.textInput('T-01'))).toHaveValue(prose);
    const stored = (await hub.readDb()).questions.find((q: any) => q.id === 'T-01');
    expect(stored.answer).toBe(prose);
    expect(stored.answerDetail.text).toBe(prose);
  });

  test('a multi answer stores every pick as an exact option string', async ({ hubPage }) => {
    const { page, hub } = hubPage;

    await page.click(sel.option('M-01', 'Route'));
    await page.click(sel.option('M-01', 'History'));
    await save(page);

    const stored = (await hub.readDb()).questions.find((q: any) => q.id === 'M-01');
    expect(stored.answerDetail.selected).toEqual(['Route', 'History']);
    expect(stored.answer).toBe('Route | History');
  });

  test('tap-to-rank numbers the options in tap order, with no dragging', async ({ hubPage }) => {
    const { page, hub } = hubPage;

    await page.click(sel.option('R-01', 'Reader'));
    await page.click(sel.option('R-01', 'Studio'));
    await page.click(sel.option('R-01', 'Home'));
    await save(page);

    const stored = (await hub.readDb()).questions.find((q: any) => q.id === 'R-01');
    expect(stored.answerDetail.ranking, 'ranking must follow tap order').toEqual(['Reader', 'Studio', 'Home']);
    expect(stored.answer).toBe('Reader > Studio > Home');
  });

  test('a partial ranking is a valid answer — stopping after three of five is allowed', async ({ hubPage }) => {
    const { page, hub } = hubPage;

    await page.click(sel.option('R-01', 'Reader'));
    await page.click(sel.option('R-01', 'Discover'));
    await save(page);

    const stored = (await hub.readDb()).questions.find((q: any) => q.id === 'R-01');
    expect(stored.status).toBe('answered');
    expect(stored.answerDetail.ranking).toEqual(['Reader', 'Discover']);
  });

  test('tapping a ranked option again clears it and renumbers the rest', async ({ hubPage }) => {
    const { page, hub } = hubPage;
    await page.click(sel.option('R-01', 'Reader'));
    await page.click(sel.option('R-01', 'Studio'));
    await page.click(sel.option('R-01', 'Home'));

    await page.click(sel.option('R-01', 'Studio'));
    await save(page);

    const stored = (await hub.readDb()).questions.find((q: any) => q.id === 'R-01');
    expect(stored.answerDetail.ranking, 'removing rank 2 must renumber rather than leave a hole')
      .toEqual(['Reader', 'Home']);
  });

  test('the progress counter moves when an answer lands', async ({ hubPage }) => {
    const { page } = hubPage;
    await expect(page.locator(sel.answered)).toHaveText('1');

    await page.click(sel.option('S-02', 'A clean rewrite'));
    await save(page);

    await expect(page.locator(sel.answered)).toHaveText('2');
    await expect(page.locator(sel.total)).toHaveText('11');
  });
});

test.describe('the Other escape hatch', () => {
  test('typing into Other stores free text, distinctly from any picked option', async ({ hubPage }) => {
    const { page, hub } = hubPage;
    const written = 'Something none of these options say';

    await page.click(sel.otherPill('S-01'));
    await page.fill(sel.otherInput('S-01'), written);
    await save(page);

    const stored = (await hub.readDb()).questions.find((q: any) => q.id === 'S-01');
    expect(stored.answerDetail.other, 'free text must land in other').toBe(written);
    expect(stored.answerDetail.selected, 'free text leaked into selected, where only options may appear').toEqual([]);
    expect(stored.answer, 'the flat string must mark it as written, not picked').toBe('Other: ' + written);
  });

  test('on a choice, typing into Other deselects the picked option', async ({ hubPage }) => {
    const { page, hub } = hubPage;
    const picked = 'A demoable MVP of one journey';
    await page.click(sel.option('S-01', picked));
    await expect(page.locator(sel.option('S-01', picked))).toHaveAttribute('aria-pressed', 'true');

    await page.click(sel.otherPill('S-01'));
    await page.fill(sel.otherInput('S-01'), 'Actually, neither');
    await save(page);

    const stored = (await hub.readDb()).questions.find((q: any) => q.id === 'S-01');
    expect(stored.answerDetail.selected, 'one answer must mean one answer').toEqual([]);
    expect(stored.answerDetail.other).toBe('Actually, neither');
  });

  test('on a multi, Other is additive alongside the picks', async ({ hubPage }) => {
    const { page, hub } = hubPage;

    await page.click(sel.option('M-01', 'Route'));
    await page.click(sel.otherPill('M-01'));
    await page.fill(sel.otherInput('M-01'), 'And chronology');
    await save(page);

    const stored = (await hub.readDb()).questions.find((q: any) => q.id === 'M-01');
    expect(stored.answerDetail.selected).toEqual(['Route']);
    expect(stored.answerDetail.other).toBe('And chronology');
    expect(stored.answer).toBe('Route | Other: And chronology');
  });

  test('the Other field is never focused on load — an auto-raised keyboard hides the question', async ({ hubPage }) => {
    const { page } = hubPage;

    // What matters is that no TEXT FIELD has focus: that is what raises the on-screen
    // keyboard and hides the question you were about to read. A focused container is fine.
    const typing = await page.evaluate(() => {
      const el = document.activeElement;
      return el ? ['INPUT', 'TEXTAREA'].includes(el.tagName) : false;
    });

    expect(typing, 'a text field was focused on load, so the keyboard covers the question').toBe(false);
  });

  test('a question with allowOther:false shows no Other row', async ({ hubPage }) => {
    const { page } = hubPage;

    await expect(page.locator(sel.otherPill('T-01'))).toHaveCount(0);
    await expect(page.locator(sel.otherPill('S-01'))).toHaveCount(1);
  });
});

test.describe('an answer is never destroyed by accident', () => {
  test('reloading without saving does not write anything to the server', async ({ hubPage }) => {
    const { page, hub } = hubPage;
    await page.click(sel.option('S-02', 'A clean rewrite'));

    await page.reload();

    const stored = (await hub.readDb()).questions.find((q: any) => q.id === 'S-02');
    expect(stored.status, 'an unsaved edit reached the server').toBe('open');
  });

  test('an already-answered question still reads correctly after a reload', async ({ hubPage }) => {
    const { page } = hubPage;

    await revealCard(page, 'A-01');

    await expect(page.locator(sel.card('A-01'))).toBeVisible();
    await expect(page.locator(sel.option('A-01', 'pnpm'))).toHaveAttribute('aria-pressed', 'true');
  });
});
