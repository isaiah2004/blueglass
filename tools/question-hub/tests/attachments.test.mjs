/**
 * Attachment and optionMeta validation (hub-platform.md §3.1, §3.2, §7).
 *
 * The point of validating at ASK time is that a bad path is rejected when an agent posts
 * it, not discovered when the human taps it on a phone. Every rejection below is a thing
 * that would otherwise reach the human as a broken card.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateAttachment, validateAttachments, validateOptionMeta, collectMediaSrcs,
} from '../lib/attachments.mjs';
import { resolveMediaPath } from '../lib/media.mjs';

/** The real gate, so an attachment cannot be stored with a path /media/ would refuse. */
const checkSrc = (src) => resolveMediaPath(src) !== null;
const MOCKUP = 'docs/product/mockups/image9.png';

const ok = (a, where = 'attachment') =>
  assert.equal(validateAttachment(a, where, checkSrc), null, 'rejected a valid attachment: ' + JSON.stringify(a));
const rejects = (a, hint) => {
  const err = validateAttachment(a, 'attachment', checkSrc);
  assert.ok(err, 'ACCEPTED an attachment it must refuse (' + hint + '): ' + JSON.stringify(a));
  assert.equal(typeof err, 'string');
  assert.ok(!err.includes('\\') && !/[A-Za-z]:[/\\]/.test(err),
    'the error message leaks a filesystem path: ' + err);
};

describe('image attachments', () => {
  test('a valid image passes', () => {
    ok({ type: 'image', src: MOCKUP, alt: 'Reader with all ten badges', caption: 'image9', width: 1170, height: 2532 });
  });

  test('alt is required, not optional — a screen reader is not an afterthought', () => {
    rejects({ type: 'image', src: MOCKUP }, 'no alt');
    rejects({ type: 'image', src: MOCKUP, alt: '' }, 'empty alt');
    rejects({ type: 'image', src: MOCKUP, alt: '   ' }, 'whitespace-only alt');
  });

  test('a src that /media/ would refuse is rejected at ask time', () => {
    for (const src of [
      'docs/product/../../CLAUDE.md',
      'docs/product/%2e%2e/package.json',
      'tools/question-hub/data/questions.json',
      'docs/product-secrets/leak.png',
      'docs/product/mockups/logo.svg',
      '/etc/passwd',
    ]) {
      rejects({ type: 'image', src, alt: 'nope' }, src);
    }
  });

  test('a non-positive width or height is rejected — it would collapse the reserved box', () => {
    rejects({ type: 'image', src: MOCKUP, alt: 'x', width: 0 }, 'zero width');
    rejects({ type: 'image', src: MOCKUP, alt: 'x', height: -5 }, 'negative height');
  });
});

describe('link attachments refuse every active scheme', () => {
  test('http and https are allowed', () => {
    ok({ type: 'link', href: 'https://example.com/spec', label: 'The spec' });
    ok({ type: 'link', href: 'http://192.168.1.20:7777/', label: 'The hub' });
  });

  test('javascript:, data: and file: are refused', () => {
    for (const href of [
      'javascript:alert(document.cookie)',
      'data:text/html,<script>alert(1)</script>',
      'file:///C:/Windows/win.ini',
      'vbscript:msgbox(1)',
    ]) {
      rejects({ type: 'link', href, label: 'tap me' }, href);
    }
  });

  test('a link needs a label — a bare URL is not a thing you can decide from', () => {
    rejects({ type: 'link', href: 'https://example.com' }, 'no label');
  });
});

describe('the other four types', () => {
  test('swatches need a name and a real hex per chip', () => {
    ok({ type: 'swatches', swatches: [{ name: 'Gold', hex: '#F0B429', note: 'primary CTA' }] });
    rejects({ type: 'swatches', swatches: [] }, 'empty');
    rejects({ type: 'swatches', swatches: [{ name: 'Gold' }] }, 'no hex');
    rejects({ type: 'swatches', swatches: [{ name: 'Gold', hex: 'gold' }] }, 'not a hex');
    rejects({ type: 'swatches', swatches: [{ hex: '#F0B429' }] }, 'no name');
  });

  test('compare nests two images, so the path rule applies to both halves', () => {
    ok({
      type: 'compare', leftLabel: 'Warm paper', rightLabel: 'Dark cinematic',
      left: { type: 'image', src: 'docs/product/mockups/image6.png', alt: 'warm' },
      right: { type: 'image', src: MOCKUP, alt: 'dark' },
    });
    rejects({
      type: 'compare', leftLabel: 'A', rightLabel: 'B',
      left: { type: 'image', src: '../../../etc/passwd', alt: 'x' },
      right: { type: 'image', src: MOCKUP, alt: 'y' },
    }, 'traversal in the left half');
  });

  test('code needs a language and a body', () => {
    ok({ type: 'code', language: 'json', code: '{"a":1}' });
    rejects({ type: 'code', code: '{"a":1}' }, 'no language');
    rejects({ type: 'code', language: 'json', code: '' }, 'empty code');
  });

  test('a note needs markdown', () => {
    ok({ type: 'note', markdown: 'A **note**.' });
    rejects({ type: 'note', markdown: '' }, 'empty markdown');
  });
});

describe('unknown shapes are refused on the way in', () => {
  test('an unknown type is rejected at ask time', () => {
    rejects({ type: 'quantum-hologram', spin: 0.5 }, 'unknown type');
    rejects({ type: 'svg', src: 'docs/product/mockups/a.svg' }, 'svg as a type');
  });

  test('a non-object attachment is rejected', () => {
    rejects('docs/product/mockups/image9.png', 'bare string');
    rejects(null, 'null');
    rejects([], 'array');
  });

  test('the whole array is rejected if any entry is bad, naming the index', () => {
    const err = validateAttachments(
      [{ type: 'note', markdown: 'fine' }, { type: 'image', src: MOCKUP }],
      checkSrc,
    );

    assert.ok(err, 'a bad attachment slipped through in position 2');
    assert.ok(err.includes('1'), 'the error must name which attachment is wrong: ' + err);
  });

  test('an omitted attachments array is fine — attachments are optional', () => {
    assert.equal(validateAttachments(undefined, checkSrc), null);
    assert.equal(validateAttachments([], checkSrc), null);
  });
});

describe('optionMeta is keyed by option label, and the keys must be real', () => {
  const options = ['Warm paper', 'Dark cinematic'];

  test('a key that is not an option is rejected — index drift is a silent bug', () => {
    const err = validateOptionMeta({ 'Warm  paper': { consequence: 'x' } }, options, checkSrc);

    assert.ok(err, 'a near-miss key was accepted and would attach to nothing');
  });

  test('a valid map passes, including a per-option attachment and consequence', () => {
    const err = validateOptionMeta({
      'Warm paper': {
        attachment: { type: 'image', src: 'docs/product/mockups/image6.png', alt: 'warm' },
        consequence: 'Restyle all twelve mockups.',
        hint: "The prototype's look.",
      },
    }, options, checkSrc);

    assert.equal(err, null);
  });

  test('a bad path inside optionMeta is caught too', () => {
    const err = validateOptionMeta({
      'Dark cinematic': { attachment: { type: 'image', src: '../../CLAUDE.md', alt: 'x' } },
    }, options, checkSrc);

    assert.ok(err, 'optionMeta is a second way to smuggle a path past the ask-time check');
  });

  test('consequence must be a string, so the card cannot render [object Object]', () => {
    assert.ok(validateOptionMeta({ 'Warm paper': { consequence: { text: 'x' } } }, options, checkSrc));
  });
});

describe('collectMediaSrcs feeds the referenced-only media gate', () => {
  test('it finds paths at both hang points and inside a nested compare', () => {
    const question = {
      options: ['Left'],
      attachments: [
        { type: 'image', src: 'docs/product/mockups/image9.png', alt: 'a' },
        { type: 'compare', leftLabel: 'L', rightLabel: 'R',
          left: { type: 'image', src: 'docs/product/mockups/image1.png', alt: 'l' },
          right: { type: 'image', src: 'docs/product/mockups/image2.png', alt: 'r' } },
      ],
      optionMeta: { Left: { attachment: { type: 'image', src: 'docs/product/mockups/image6.png', alt: 'o' } } },
    };

    const srcs = collectMediaSrcs(question);

    for (const expected of ['image9', 'image1', 'image2', 'image6']) {
      assert.ok(srcs.some((s) => s.includes(expected)),
        expected + ' was not collected, so /media/ would 404 a file the question publishes');
    }
  });
});
