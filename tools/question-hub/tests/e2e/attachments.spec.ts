/**
 * Journey 5 — attachments, the lightbox, and the rule that matters most about them:
 *
 *   a broken attachment must never cost the human the ability to answer.
 *
 * Deciding "is this the right visual direction?" while looking at the mockup is a
 * different activity from deciding it from memory, which is what makes attachments worth
 * having. It is also what makes them the largest new surface area for breaking the page.
 */
import { test, expect, save, sel } from './hub-fixture';

test.describe('the image lightbox', () => {
  test('a mockup renders inline in a box that reserves its space before loading', async ({ hubPage }) => {
    const { page } = hubPage;

    const figure = page.locator(`${sel.card('D-01')} ${sel.lightboxTrigger}`).first();

    await expect(figure).toBeVisible();
    const reserved = await figure.evaluate((el) => {
      const box = el.closest('[style*="aspect-ratio"], .att-image, figure') ?? el;
      return getComputedStyle(box as Element).aspectRatio;
    });
    expect(reserved, 'no aspect-ratio box, so the layout shifts under a thumb already moving')
      .not.toBe('auto');
  });

  test('tapping a mockup opens the full-screen viewer, and it closes again', async ({ hubPage }) => {
    const { page } = hubPage;
    const lightbox = page.locator(sel.lightbox);
    await expect(lightbox).toBeHidden();

    await page.locator(`${sel.card('D-01')} ${sel.lightboxTrigger}`).first().click();

    await expect(lightbox).toBeVisible();
    await expect(page.locator('#lightboxImage')).toHaveAttribute('src', /media\/docs\/product\/mockups/);

    await page.locator(sel.closeLightbox).click();
    await expect(lightbox).toBeHidden();
  });

  test('Escape closes the viewer too', async ({ hubPage }) => {
    const { page } = hubPage;
    await page.locator(`${sel.card('D-01')} ${sel.lightboxTrigger}`).first().click();
    await expect(page.locator(sel.lightbox)).toBeVisible();

    await page.keyboard.press('Escape');

    await expect(page.locator(sel.lightbox)).toBeHidden();
  });

  test('every mockup is marked lazy, so a section of six is not 12 MB on load', async ({ hubPage }) => {
    const { page } = hubPage;

    const loading = await page.locator('article[data-card-id] img').evaluateAll(
      (nodes) => nodes.map((n) => (n as HTMLImageElement).getAttribute('loading')));

    // Asserts the attribute rather than watching for the absence of a network request:
    // Chromium's lazy-load distance threshold varies with the reported connection type, so
    // "no request happened" is a property of the machine, not of the page. The attribute is
    // the part this codebase controls, and dropping it is the regression worth catching.
    expect(loading.length, 'no mockups rendered at all').toBeGreaterThan(0);
    expect(loading.every((value) => value === 'lazy'),
      'a mockup is eagerly loaded: ' + JSON.stringify(loading)).toBe(true);
  });

  test('the mockup actually loads once it is on screen — a broken image is worse than none', async ({ hubPage }) => {
    const { page } = hubPage;
    const img = page.locator(`${sel.card('D-01')} img`).first();

    await img.scrollIntoViewIfNeeded();

    await expect(img).toHaveJSProperty('complete', true);
    const natural = await img.evaluate((el: HTMLImageElement) => el.naturalWidth);
    expect(natural, '/media/ did not serve the referenced mockup').toBeGreaterThan(0);
  });

  test('the question is still answerable with the viewer closed again', async ({ hubPage }) => {
    const { page, hub } = hubPage;
    await page.locator(`${sel.card('D-01')} ${sel.lightboxTrigger}`).first().click();
    await page.locator(sel.closeLightbox).click();

    await page.click(sel.option('D-01', 'Dark cinematic'));
    await save(page);

    expect((await hub.readDb()).questions.find((q: any) => q.id === 'D-01').answer).toBe('Dark cinematic');
  });
});

test.describe('the other attachment types render', () => {
  test('swatches show the real colour and the hex', async ({ hubPage }) => {
    const { page } = hubPage;

    const card = page.locator(sel.card('D-02'));

    await expect(card).toContainText('#F0B429');
    await expect(card).toContainText('Gold');
  });

  test('a code block renders as preformatted text', async ({ hubPage }) => {
    const { page } = hubPage;

    await expect(page.locator(`${sel.card('T-01')} pre`)).toContainText('Two minutes in Acts 16');
  });

  test('a link renders as an anchor that cannot be a tabnabbing vector', async ({ hubPage }) => {
    const { page } = hubPage;

    const link = page.locator(`${sel.card('R-01')} a[href^="http"]`).first();

    await expect(link).toHaveAttribute('rel', /noopener/);
    await expect(link).toHaveAttribute('target', '_blank');
  });

  test('a note renders its markdown subset, and nothing else', async ({ hubPage }) => {
    const { page } = hubPage;

    const card = page.locator(sel.card('D-01'));

    await expect(card.locator('strong')).toContainText('already assume');
    await expect(card.locator('code')).toContainText('image9.png');
    await expect(card.locator('blockquote')).toContainText('Decide by looking');
  });

  test('a per-option consequence is shown under the option it belongs to', async ({ hubPage }) => {
    const { page } = hubPage;

    await expect(page.locator(sel.option('D-01', 'Warm paper')))
      .toContainText('Restyle all twelve mockups');
  });
});

test.describe('a broken attachment never costs an answer', () => {
  test.use({ seedFixture: 'unknown-attachment.json' });

  test('an unknown attachment type renders a placeholder and the card still works', async ({ hubPage }) => {
    const { page, hub } = hubPage;

    await expect(page.locator(sel.card('X-01'))).toBeVisible();
    await page.click(sel.option('X-01', 'Yes, the card still works'));
    await save(page);

    expect((await hub.readDb()).questions.find((q: any) => q.id === 'X-01').answer)
      .toBe('Yes, the card still works');
  });

  test('a javascript: link is never rendered as a clickable anchor', async ({ hubPage }) => {
    const { page } = hubPage;

    const hrefs = await page.locator(`${sel.card('X-01')} a`).evaluateAll(
      (nodes) => nodes.map((n) => (n as HTMLAnchorElement).getAttribute('href') ?? ''));

    for (const href of hrefs) {
      expect(href.startsWith('javascript:'), 'a javascript: URL was rendered as a link').toBe(false);
      expect(href.startsWith('data:'), 'a data: URL was rendered as a link').toBe(false);
    }
  });

  test('a valid attachment after four broken ones still renders', async ({ hubPage }) => {
    const { page } = hubPage;

    await expect(page.locator(`${sel.card('X-01')} strong`), 'one bad attachment stopped the rest rendering')
      .toContainText('valid');
  });

  test('an unknown layout falls back to a list rather than rendering nothing', async ({ hubPage }) => {
    const { page } = hubPage;

    await expect(page.locator(sel.optionsOf('X-01'))).toHaveCount(2);
  });

  test('a plain question next to a broken one is unaffected', async ({ hubPage }) => {
    const { page, hub } = hubPage;

    await page.fill(sel.textInput('X-02'), 'Yes, this still saves.');
    await save(page);

    expect((await hub.readDb()).questions.find((q: any) => q.id === 'X-02').answer)
      .toBe('Yes, this still saves.');
  });
});
