/**
 * The UI has to survive a bad moment on the network, unattended.
 *
 * This is answered on a phone, on home wifi, often in a lift or a back room. A single fetch
 * failing is not an exceptional event here — it is Tuesday. What matters is what the page does
 * next, and it has exactly two honest options: recover by itself, or say plainly that it
 * cannot. What it must never do is show an empty, confident-looking list.
 *
 * That failure mode is specific and it is nasty. The event subscription only reloads when an
 * event *arrives*, and a hub with no agents posting sends none for minutes at a time. So a
 * first load that failed and scheduled no retry left the page permanently empty — and an empty
 * question list does not read as "something went wrong", it reads as "the fleet has asked me
 * nothing". The human puts the phone down. Nobody finds out until the fleet is still blocked
 * an hour later.
 *
 * These tests use the raw `hub` fixture rather than `hubPage`, because `hubPage` waits for the
 * first render — and the first render is the thing under test.
 */
import { test, expect, sel } from './hub-fixture';

test.describe('a first load that fails is retried, never abandoned', () => {
  test('the list arrives on its own after the first fetch fails', async ({ page, hub }) => {
    let attempts = 0;
    await page.route('**/api/questions*', (route) => (
      attempts++ === 0 ? route.abort('failed') : route.continue()
    ));

    await page.goto(hub.url + '/');

    // No reload and no tap anywhere in this test: the page has to get there by itself.
    await expect(page.locator(sel.card('S-01')),
      'the page gave up after one failed load and showed an empty list for good').toBeVisible({ timeout: 20000 });
    expect(attempts, 'the failed load was never retried').toBeGreaterThan(1);
    await expect(page.locator(sel.status)).not.toContainText('offline');
  });

  test('while it is cut off the bar says so rather than claiming Up to date', async ({ page, hub }) => {
    await page.route('**/api/questions*', (route) => route.abort('failed'));

    await page.goto(hub.url + '/');

    // "Up to date" with nothing on screen is the worst of both: wrong, and reassuring.
    await expect(page.locator(sel.status)).toContainText('offline', { timeout: 20000 });
    await expect(page.locator(sel.status)).not.toContainText('Up to date');
  });

  test('recovery keeps retrying, so a long outage still heals without a reload', async ({ page, hub }) => {
    let blocked = true;
    await page.route('**/api/questions*', (route) => (blocked ? route.abort('failed') : route.continue()));

    await page.goto(hub.url + '/');
    await expect(page.locator(sel.status)).toContainText('offline', { timeout: 20000 });

    blocked = false;   // the wifi comes back; nobody touches the phone

    await expect(page.locator(sel.card('S-01'))).toBeVisible({ timeout: 20000 });
    await expect(page.locator(sel.status)).toContainText(/Up to date|unsaved/);
  });
});
