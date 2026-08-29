/**
 * Journeys 7 and 8 — the phone, and the fleet status board.
 *
 * This is answered one-handed, in short bursts, on a phone. A horizontal scrollbar or a
 * 30px tap target is not a cosmetic problem here: it is the difference between an answer
 * being given and the tool being put down.
 *
 * 375x812 is the small end of what the human actually uses (an iPhone SE / mini), so it is
 * the width worth pinning rather than a comfortable one.
 */
import { test, expect, save, sel } from './hub-fixture';

const PHONE = { width: 375, height: 812 };

test.describe('375x812 — the small phone', () => {
  test.use({ viewport: PHONE });

  test('the page never scrolls sideways', async ({ hubPage }) => {
    const { page } = hubPage;

    const overflow = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      client: document.documentElement.clientWidth,
    }));

    expect(overflow.scroll,
      'the page is ' + overflow.scroll + 'px wide in a ' + overflow.client + 'px viewport')
      .toBeLessThanOrEqual(overflow.client + 1);
  });

  test('no element widens the page — wide content scrolls inside its own box', async ({ hubPage }) => {
    const { page } = hubPage;

    const wide = await page.evaluate((limit) => {
      // An element wider than the screen is fine if it lives in a container that scrolls
      // horizontally on purpose: the filter chip row is meant to be swiped along. What is
      // never fine is content that widens the PAGE, because then the whole canvas slides
      // under the thumb and the question you were reading moves.
      const insideScroller = (el: Element) => {
        for (let n = el.parentElement; n; n = n.parentElement) {
          const overflowX = getComputedStyle(n).overflowX;
          if (overflowX === 'auto' || overflowX === 'scroll') return true;
        }
        return false;
      };
      const out: string[] = [];
      for (const el of document.querySelectorAll('body *')) {
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.right > limit + 1 && !insideScroller(el)) {
          out.push(el.tagName.toLowerCase() + '.' + String(el.className).split(' ')[0] +
            ' right=' + Math.round(rect.right));
        }
      }
      return out.slice(0, 8);
    }, PHONE.width);

    expect(wide, 'these elements widen the page past the phone viewport').toEqual([]);
  });

  test('every tap target is at least 44px tall', async ({ hubPage }) => {
    const { page } = hubPage;

    const small = await page.evaluate((width) => {
      const out: string[] = [];
      const targets = document.querySelectorAll('button, a[href], input:not([type=hidden]), textarea, summary, [role=button]');
      for (const el of targets) {
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) continue;                  // not rendered
        // Skip links sit off-screen until focused; they are a keyboard affordance, not a
        // thumb target, so holding them to 44px would be measuring the wrong thing.
        if (rect.right < 0 || rect.bottom < 0 || rect.left > width) continue;
        if (rect.height < 44) {
          out.push(el.tagName.toLowerCase() + '.' + String(el.className).split(' ')[0] +
            ' h=' + rect.height.toFixed(1) + ' "' + (el.textContent ?? '').trim().slice(0, 24) + '"');
        }
      }
      return out;
    }, PHONE.width);

    expect(small, 'tap targets under 44px — these are the ones a thumb misses').toEqual([]);
  });

  test('an answer can be given and saved entirely at phone width', async ({ hubPage }) => {
    const { page, hub } = hubPage;

    await page.click(sel.option('S-01', 'A demoable MVP of one journey'));
    await save(page);

    expect((await hub.readDb()).questions.find((q: any) => q.id === 'S-01').status).toBe('answered');
  });

  test('the save bar stays reachable without scrolling to the bottom of the page', async ({ hubPage }) => {
    const { page } = hubPage;

    const box = await page.locator(sel.save).boundingBox();

    expect(box, 'the Save button is not rendered').not.toBeNull();
    expect(box!.y + box!.height, 'Save is below the fold, so it cannot be reached one-handed')
      .toBeLessThanOrEqual(PHONE.height + 1);
  });

  test('text inputs ask the keyboard for the right behaviour', async ({ hubPage }) => {
    const { page } = hubPage;

    const field = page.locator(sel.textInput('T-01'));

    await expect(field).toHaveAttribute('enterkeyhint', 'done');
    await expect(field).toHaveAttribute('autocapitalize', 'sentences');
  });
});

test.describe('the four card states are distinguishable without colour', () => {
  test.use({ viewport: PHONE });

  test('an open recommendation and a staged answer carry different marks', async ({ hubPage }) => {
    const { page } = hubPage;
    const recommended = page.locator(sel.option('S-01', 'Whole-Bible reader shell, full depth only for Acts'));
    const openClass = await recommended.locator('.mark').getAttribute('class');

    await recommended.click();

    const stagedClass = await recommended.locator('.mark').getAttribute('class');
    expect(stagedClass, 'staged and unstaged look identical in greyscale').not.toBe(openClass);
    expect(stagedClass).toContain('is-on');
  });

  test('a question an agent has already built on is marked as in use', async ({ hubPage }) => {
    const { page } = hubPage;

    await expect(page.locator(sel.card('S-03'))).toContainText('IN USE');
  });

  test('the blocking question says so in words, not only in colour', async ({ hubPage }) => {
    const { page } = hubPage;

    await expect(page.locator(sel.card('S-01'))).toContainText('BLOCKING');
  });
});

test.describe('the fleet status board', () => {
  test('renders the headline and every entry', async ({ hubPage }) => {
    const { page } = hubPage;

    await page.click(sel.filter('status'));

    await expect(page.locator('#list')).toContainText('Fleet is building the reader shell');
    await expect(page.locator('#list')).toContainText('Expo scaffold');
    await expect(page.locator('#list')).toContainText('Question Hub platform');
    await expect(page.locator('#list')).toContainText('Map tile provider');
    await expect(page.locator('#list')).toContainText('Audio pipeline');
  });

  test('each entry shows its state, so blocked work is visible at a glance', async ({ hubPage }) => {
    const { page } = hubPage;

    await page.click(sel.filter('status'));

    await expect(page.locator('#list .sstate.blocked')).toHaveText('blocked');
    await expect(page.locator('#list .sstate.done')).toHaveText('done');
  });

  test('a board republished by the orchestrator replaces the old one wholesale', async ({ hubPage }) => {
    const { page, hub } = hubPage;
    await page.click(sel.filter('status'));
    await expect(page.locator('#list')).toContainText('Expo scaffold');

    await hub.post('/api/status', {
      headline: 'Hub restarted on 7777.',
      entries: [{ title: 'Question Hub', state: 'done', detail: 'v3 live, 11 answers intact.' }],
    });
    await page.reload();
    await page.click(sel.filter('status'));

    await expect(page.locator('#list')).toContainText('Hub restarted on 7777.');
    await expect(page.locator('#list'), 'stale rows survived a republish').not.toContainText('Expo scaffold');
  });

  test('leaving the board returns to the questions', async ({ hubPage }) => {
    const { page } = hubPage;
    await page.click(sel.filter('status'));

    await page.click(sel.filter('open'));

    await expect(page.locator(sel.card('S-01'))).toBeVisible();
  });
});
