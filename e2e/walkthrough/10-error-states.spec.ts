/**
 * Chapter 10 · When the API is gone.
 *
 * The brief asks for the API to be stopped and the UI checked for an honest failure. The
 * outage is staged inside the browser rather than by stopping the container — see
 * `e2e/support/api-outage.ts` for why that is the same fact from the app's point of view,
 * and a great deal more deterministic.
 *
 * Three failures are being hunted here, and all three ship regularly:
 *   1. A blank canvas, which a reader reads as "the app is broken" with no way forward.
 *   2. A spinner that never resolves, which is a blank canvas with better manners.
 *   3. A raw error object on screen — honest, but not for a reader.
 *
 * Rule 6: an error the user cannot act on is an error you never see.
 *
 * Route: `/read/acts/1` with the API cut off
 */

import { expect, test } from '../support/fixtures';
import { cutTheApi } from '../support/api-outage';
import { tap, verseText } from '../support/journeys';
import { ERROR_IDS, ERROR_SELECTOR, LOADING_ID, READER_IDS } from '../support/test-ids';

/** Error copy that is honest to a developer and useless to a reader. */
const RAW_ERROR_LEAK =
  /TypeError|undefined is not|\[object Object\]|Traceback|at Object\.<anonymous>/;

test.describe('chapter 10 · when the API is gone', () => {
  test('an unreachable API produces an error state, not a blank screen', async ({
    page,
    walkthrough,
    diagnostics,
  }) => {
    // The outage is the point of the test, so its own noise is forgiven — and only its own.
    diagnostics.allowRequests(/.*/);
    diagnostics.allowConsole(/Failed to fetch|NetworkError|net::ERR_|ERR_CONNECTION_REFUSED/i);

    await walkthrough.step('load the app, then cut the API off', async () => {
      await page.goto('/');
      const outage = await cutTheApi(page, 'unreachable');
      await page.goto('/read/acts/1');

      // Guard before the accusation: if the reader never asked the API for anything, the
      // right finding is "the reader is not wired to the API", not "the error state is
      // missing". Reporting the wrong one would send someone to fix the wrong file.
      await expect
        .poll(() => outage.attempts(), {
          message:
            'the reader made no request to the API at all, so it is rendering from a fixture rather than from the backend',
        })
        .toBeGreaterThan(0);
    });

    await walkthrough.step('the reader admits it cannot load the chapter', async () => {
      // Catches failure 1 and 2 together: an error surface must appear, which rules out the
      // blank canvas, and it must appear within the assertion timeout, which rules out the
      // spinner that never resolves.
      await expect(
        page.locator(ERROR_SELECTOR),
        'the API is unreachable and the reader shows no failure surface (expected one of ' +
          `${ERROR_IDS.tones.join(', ')}). A blank reading canvas is the worst of the three ways to fail.`,
      ).toBeVisible();
      await expect(
        page.getByTestId(LOADING_ID),
        'a loading indicator is still spinning after the request failed',
      ).toBeHidden();
    });

    await walkthrough.step('the message is for a reader, and offers a way forward', async () => {
      const message = (await page.locator(ERROR_SELECTOR).innerText()).trim();

      // Catches failure 3: a raw exception rendered straight into the UI. It also catches
      // an empty error surface, which is a blank screen with a border.
      expect(message, 'the error state carries no message').not.toBe('');
      expect(message, `the error state shows a raw error to the reader: "${message}"`).not.toMatch(
        RAW_ERROR_LEAK,
      );

      // Q-022: never spend or re-request without a tap, but always offer the tap.
      await expect(
        page.getByTestId(ERROR_IDS.action),
        'the error state offers no action, so a reader whose network blipped has to restart the app',
      ).toBeVisible();
    });
  });

  test('the reader recovers when the API comes back', async ({
    page,
    walkthrough,
    diagnostics,
  }) => {
    diagnostics.allowRequests(/.*/);
    diagnostics.allowConsole(/Failed to fetch|NetworkError|net::ERR_|ERR_CONNECTION_REFUSED/i);

    await walkthrough.step('fail, restore, then retry', async () => {
      await page.goto('/');
      const outage = await cutTheApi(page, 'unreachable');
      await page.goto('/read/acts/1');
      await expect(page.locator(ERROR_SELECTOR)).toBeVisible();

      await outage.restore();
      await tap(page, ERROR_IDS.action, "the error state's retry control");

      // Catches: a retry that re-renders the same cached failure. Recovery is the half of
      // error handling that never gets demonstrated, and a retry button that does not
      // actually retry is worse than none — it teaches the reader the app is dead.
      await expect(
        page.getByTestId(READER_IDS.screen),
        'retrying after the API came back did not reach the reader',
      ).toBeVisible();
      expect(
        (await verseText(page, 1)).length,
        'the recovered reader shows no scripture',
      ).toBeGreaterThan(20);
    });
  });

  test('a 503 from the API is handled like an outage, not ignored', async ({
    page,
    walkthrough,
    diagnostics,
  }) => {
    diagnostics.allowRequests(/.*/);
    diagnostics.allowConsole(/503|Service Unavailable|Failed to fetch/i);

    await walkthrough.step('the API answers, badly', async () => {
      await page.goto('/');
      await cutTheApi(page, 'server-error');
      await page.goto('/read/acts/1');

      // Catches the difference an unreachable-only test misses: a client that treats any
      // response as success and renders an empty chapter, because the request technically
      // completed. That is a blank canvas with a 200-shaped excuse.
      await expect(
        page.locator(ERROR_SELECTOR),
        'the API returned 503 and the reader showed no failure surface — a non-2xx response is being treated as success',
      ).toBeVisible();
    });
  });
});
