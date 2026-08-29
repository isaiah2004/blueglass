/**
 * The Playwright fixture every hub walkthrough builds on.
 *
 * Two guarantees, both non-negotiable:
 *
 *   1. Each test gets its OWN server, on its OWN port, against its OWN temp directory,
 *      seeded from a fixture. Nothing is shared, so no test can be made to pass or fail
 *      by another one, and a failure always means what it says.
 *   2. `data/questions.json` — the human's real answers — is never opened. The isolation
 *      guards live in tests/helpers/hub-server.mjs and refuse to spawn if that is not true.
 *
 * `hubPage` is the common case: a booted hub with the page already loaded and the first
 * render complete, so specs start at the point they actually care about.
 */
import { test as base, expect, type Page } from '@playwright/test';
// @ts-expect-error - plain ESM helper shared with the node:test suites
import { startHub, portAllocator } from '../helpers/hub-server.mjs';

export interface Hub {
  url: string;
  port: number;
  dataDir: string;
  readDb(): Promise<any>;
  get(path: string, init?: RequestInit): Promise<Response>;
  post(path: string, body: unknown): Promise<Response>;
  stop(): Promise<void>;
}

/** Playwright's own workers get 7900+; the node:test suites use 7800-7899. */
const nextPort = portAllocator(7900);

export const SEED = 'e2e-seed.json';

export const test = base.extend<{
  hub: Hub;
  hubPage: { page: Page; hub: Hub };
  seedFixture: string;
}>({
  // Override in a spec with `test.use({ seedFixture: 'unknown-attachment.json' })`.
  seedFixture: [SEED, { option: true }],

  hub: async ({ seedFixture }, use) => {
    const hub: Hub = await startHub({ fixture: seedFixture, port: nextPort() });
    await use(hub);
    await hub.stop();
  },

  hubPage: async ({ page, hub }, use) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto(hub.url + '/');
    // A generous deadline for the FIRST render only. The assertions inside each test keep
    // the tight default: a slow cold start on a machine already running the whole suite is
    // not the thing under test, and letting it fail here would report a flake instead of a
    // bug. This is still a condition with a deadline, never a fixed wait.
    await expect(page.locator('article[data-card-id]').first()).toBeVisible({ timeout: 30000 });

    await use({ page, hub });

    // A module that throws takes the answering UI down, and from a phone that is
    // indistinguishable from the server being dead. Fail the test that caused it.
    expect(errors, 'uncaught page errors during this test').toEqual([]);
  },
});

export { expect };

/** Wait for the page to have saved and reloaded, without waiting on a duration. */
export async function save(page: Page) {
  await page.locator('#saveBtn').click();
  await expect(page.locator('#status')).toContainText(/Saved|Up to date/, { timeout: 15000 });
}

/**
 * Bring a card on screen regardless of filter or section state.
 *
 * A finished section collapses to a single green row (§5.3), so a card that was visible
 * before it was answered is legitimately hidden afterwards. Tests about persistence
 * should not fail because of a feature working.
 */
export async function revealCard(page: Page, id: string) {
  await page.locator(sel.filter('all')).click();
  const card = page.locator(sel.card(id));
  await expect(card).toHaveCount(1);
  if (await card.isVisible()) return card;
  // Opened programmatically, not clicked: revealing the card is a PRECONDITION here, and
  // driving the disclosure through a real tap would make every persistence test depend on
  // scroll position and re-render timing. The tap itself is covered by its own test in
  // progress-and-filters.spec.ts, so nothing is lost by not repeating it fourteen times.
  await page.evaluate((cardSelector) => {
    const block = document.querySelector(`details:has(${cardSelector})`);
    if (block) (block as HTMLDetailsElement).open = true;
  }, sel.card(id));
  await expect(card).toBeVisible();
  return card;
}

/**
 * Leave any focused field.
 *
 * The client deliberately defers re-rendering while a text input has focus, so a poll
 * arriving mid-sentence cannot yank the cursor. A test that types and then expects the
 * list to update has to leave the field first, exactly as a person would.
 */
export async function blurFields(page: Page) {
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
}

/**
 * Wait until the staged edits have actually reached localStorage.
 * Persistence is debounced by 300 ms, so reloading immediately is a race — and one that
 * would make this suite flaky rather than catching anything.
 */
export async function waitForDraft(page: Page, count: number) {
  await page.waitForFunction(
    (want) => {
      const key = Object.keys(localStorage).find((k) => k.startsWith('atlas-hub-drafts'));
      if (!key) return false;
      try {
        return JSON.parse(localStorage.getItem(key) ?? '[]').length >= want;
      } catch {
        return false;
      }
    },
    count,
    { timeout: 5000 },
  );
}

/** The selector contract. One place to change if the client agent renames anything. */
export const sel = {
  card: (id: string) => `article[data-card-id="${id}"]`,
  option: (id: string, value: string) => `[data-act="pick"][data-id="${id}"][data-val="${value}"]`,
  optionsOf: (id: string) => `article[data-card-id="${id}"] [data-act="pick"]`,
  otherPill: (id: string) => `[data-act="other-toggle"][data-id="${id}"]`,
  otherInput: (id: string) => `input[data-act="other"][data-id="${id}"]`,
  textInput: (id: string) => `textarea[data-act="text"][data-id="${id}"]`,
  acceptSection: (section: string) => `[data-act="accept-section"][data-section="${section}"]`,
  filter: (name: string) => `.chip[data-filter="${name}"]`,
  sheet: '#acceptSheet',
  sheetRows: '#acceptSheet [data-pick]',
  sheetConfirm: '#acceptConfirm',
  undo: '[data-act="undo-accept"]',
  lightbox: '#lightbox',
  lightboxTrigger: '[data-lightbox]',
  closeLightbox: '[data-act="close-lightbox"]',
  save: '#saveBtn',
  status: '#status',
  answered: '#pAnswered',
  total: '#pTotal',
};
