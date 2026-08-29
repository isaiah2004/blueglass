/**
 * Journey 6 — finding the question that matters among eighty-five, and watching the pile
 * shrink.
 *
 * Not a crash risk, but the thing that decides whether the tool gets used at all. An
 * abandoned hub blocks the whole fleet just as surely as a dead one.
 */
import { test, expect, save, sel, revealCard } from './hub-fixture';

test.describe('the Blocking filter', () => {
  test('shows only the blocking question', async ({ hubPage }) => {
    const { page } = hubPage;

    await page.click(sel.filter('blocking'));

    await expect(page.locator(sel.card('S-01'))).toBeVisible();
    await expect(page.locator('article[data-card-id]')).toHaveCount(1);
  });

  test('answering it removes it from the filter — the list gets shorter as you work', async ({ hubPage }) => {
    const { page } = hubPage;
    await page.click(sel.filter('blocking'));
    await expect(page.locator(sel.card('S-01'))).toBeVisible();

    await page.click(sel.option('S-01', 'Whole-Bible reader shell, full depth only for Acts'));
    await save(page);

    await expect(page.locator(sel.card('S-01')),
      'an answered question stayed in the Blocking filter, so the queue never looks emptier').toBeHidden();
    await expect(page.locator('#pBlocking')).toHaveText('');
  });
});

test.describe('the other filters do what they say', () => {
  test('No recommendation surfaces only the questions the fleet cannot settle', async ({ hubPage }) => {
    const { page } = hubPage;

    await page.click(sel.filter('norec'));

    // Exactly the two the fleet cannot proceed on: N-01 and the free-text T-01.
    await expect(page.locator(sel.card('N-01'))).toBeVisible();
    await expect(page.locator(sel.card('T-01'))).toBeVisible();
    await expect(page.locator('article[data-card-id]')).toHaveCount(2);
  });

  test('In use surfaces the questions an agent has already built on', async ({ hubPage }) => {
    const { page } = hubPage;

    await page.click(sel.filter('inuse'));

    await expect(page.locator(sel.card('S-03'))).toBeVisible();
    await expect(page.locator('article[data-card-id]')).toHaveCount(1);
  });

  test('Has images surfaces only the questions carrying a mockup', async ({ hubPage }) => {
    const { page } = hubPage;

    await page.click(sel.filter('images'));

    await expect(page.locator(sel.card('D-01'))).toBeVisible();
    await expect(page.locator(sel.card('S-01'))).toHaveCount(0);
  });

  test('All includes the answered question that the default filter hides', async ({ hubPage }) => {
    const { page } = hubPage;
    await expect(page.locator(sel.card('A-01'))).toHaveCount(0);

    await page.click(sel.filter('all'));

    await expect(page.locator(sel.card('A-01'))).toHaveCount(1);
  });
});

test.describe('search', () => {
  test('narrows by question text, case-insensitively', async ({ hubPage }) => {
    const { page } = hubPage;

    await page.fill('#search', 'badge');

    await expect(page.locator(sel.card('M-01'))).toBeVisible();
    await expect(page.locator(sel.card('S-01'))).toHaveCount(0);
  });

  test('matches on the question id, so an agent can hand over "settle D-01"', async ({ hubPage }) => {
    const { page } = hubPage;

    await page.fill('#search', 'D-02');

    await expect(page.locator(sel.card('D-02'))).toBeVisible();
    await expect(page.locator('article[data-card-id]')).toHaveCount(1);
  });

  test('clearing the search restores the list', async ({ hubPage }) => {
    const { page } = hubPage;
    await page.fill('#search', 'badge');
    await expect(page.locator('article[data-card-id]')).toHaveCount(1);

    await page.fill('#search', '');

    await expect(page.locator('article[data-card-id]')).toHaveCount(10);
  });
});

test.describe('progress', () => {
  test('the header counts what is on disk, not what is staged', async ({ hubPage }) => {
    const { page } = hubPage;
    await expect(page.locator(sel.answered)).toHaveText('1');

    await page.click(sel.option('S-02', 'A clean rewrite'));

    await expect(page.locator(sel.answered),
      'staged edits inflated the counter, so the progress bar lies until Save').toHaveText('1');
  });

  test('a section ring shows how much of that section is done', async ({ hubPage }) => {
    const { page } = hubPage;

    await expect(page.locator(`details:has(${sel.card('S-01')}) .sec-count`)).toHaveText('0/3');
  });

  test('a completed section collapses, and a tap opens it again', async ({ hubPage }) => {
    const { page } = hubPage;
    await page.fill(sel.textInput('T-01'), 'Plain and unhurried.');
    await save(page);
    await page.click(sel.filter('all'));

    const section = page.locator(`details:has(${sel.card('T-01')})`);
    await expect(section).toHaveClass(/is-complete/);
    await expect(page.locator(sel.card('T-01'))).toBeHidden();

    const summary = section.locator('> summary');
    await summary.scrollIntoViewIfNeeded();
    await summary.click();

    await expect(page.locator(sel.card('T-01')), 'a collapsed section could not be reopened').toBeVisible();
  });

  test('a deep link scrolls to the question an agent asked about', async ({ hubPage }) => {
    const { page, hub } = hubPage;

    await page.goto(hub.url + '/#D-02');

    await expect(page.locator(sel.card('D-02'))).toBeInViewport();
  });

  test('the empty state names the shape of the work rather than showing a zero', async ({ hubPage }) => {
    const { page } = hubPage;

    await page.fill('#search', 'nothing matches this string at all');

    await expect(page.locator('#list')).not.toContainText('0 items');
  });
});

test.describe('an answered card still reads correctly', () => {
  test('it shows an ANSWERED chip and keeps the value visible', async ({ hubPage }) => {
    const { page } = hubPage;

    await revealCard(page, 'A-01');

    await expect(page.locator(sel.card('A-01'))).toContainText('ANSWERED');
    await expect(page.locator(sel.option('A-01', 'pnpm'))).toHaveAttribute('aria-pressed', 'true');
  });

  test('a bulk-accepted answer is chipped differently from a considered one', async ({ hubPage }) => {
    const { page } = hubPage;
    await page.locator(`${sel.card('N-02')} [data-act="accept"]`).click();
    await save(page);

    await revealCard(page, 'N-02');

    await expect(page.locator(sel.card('N-02')),
      'a bulk endorsement is indistinguishable from a deliberate decision on screen')
      .toContainText('ACCEPTED');
  });
});
