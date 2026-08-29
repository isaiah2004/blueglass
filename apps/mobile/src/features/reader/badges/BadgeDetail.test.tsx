/**
 * Component tests for the badge detail — the body of both the sheet and the rail.
 *
 * What is worth asserting here
 *   Two things a pure test cannot reach. First, `AI-05` on screen: the attribution is
 *   rendered, always, with no disclosure to open. Second, the slot: a sheet body registered
 *   by `features/sheets/` is handed the badge and drawn in place, and a kind with no body
 *   registered still produces a complete surface rather than an empty one.
 *
 * Both themes
 *   `D-01`. The sheet is the surface where a mis-themed colour is most visible, because it
 *   is the only place the badge's hue appears at size.
 */

import { licenceChip, licenceToken } from '@atlas/shared';
import type { ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';

import type { ThemeName } from '@/theme';

vi.mock('expo-font', () => ({ useFonts: () => [true, null] }));

import { Text } from 'react-native';

import { BOTH_THEMES, renderReader } from '../testing/render-reader';

import { decodeChapterBadges } from './badge-decoders';
import type { ReaderBadge } from './badge-models';
import { BadgeDetail } from './BadgeDetail';
import {
  BadgeSheetProvider,
  type BadgeSheetRenderers,
  type BadgeSheetTarget,
} from './badge-sheet-slot';
import { ACTS_16_BADGES } from './testing/badge-fixtures';

/** One decoded badge of the given kind from the captured Acts 16 response. */
function badgeOf(kind: ReaderBadge['kind']): ReaderBadge {
  const decoded = decodeChapterBadges(ACTS_16_BADGES, '');
  if (!decoded.ok) throw new Error('the Acts 16 fixture did not decode');
  const found = decoded.value.badges.find((badge) => badge.kind === kind);
  if (found === undefined) throw new Error(`no ${kind} badge in the fixture`);
  return found;
}

/** The detail, optionally with sheet bodies registered around it. */
function detail(badge: ReaderBadge, renderers?: BadgeSheetRenderers): ReactElement {
  const body = <BadgeDetail badge={badge} />;
  return renderers === undefined ? (
    body
  ) : (
    <BadgeSheetProvider renderers={renderers}>{body}</BadgeSheetProvider>
  );
}

describe.each(BOTH_THEMES)('BadgeDetail — %s theme', (theme: ThemeName) => {
  it('heads the badge with its mark, its reference and the annotated word', () => {
    const badge = badgeOf('route');
    const view = renderReader(detail(badge), theme);

    expect(view.text()).toContain('Route]');
    expect(view.text()).toContain('Acts 16:1');
    expect(view.text()).toContain('Derbe');
    view.unmount();
  });

  it('shows the teaser as the lead line', () => {
    const view = renderReader(detail(badgeOf('root')), theme);

    expect(view.byTestId('badge-detail-teaser')?.textContent).toContain('Σαμοθρᾴκη');
    view.unmount();
  });

  it('prints every source behind the badge, and its licence exactly once (AI-05)', () => {
    const badge = badgeOf('history');
    const view = renderReader(detail(badge), theme);
    const text = view.text();

    expect(view.byTestId(`badge-sources-${badge.id}`)).not.toBeNull();
    for (const source of badge.sources) {
      // The verbatim notice is always printed — that is the licence obligation.
      expect(text).toContain(source.attribution);
      // The licence is stated once. Most notices name it themselves ("… CC BY 4.0"), in
      // which case repeating it as `CC-BY-4.0` underneath is noise; where a notice does
      // not name it, the identifier is printed as an unbreakable token.
      const chip = licenceChip(source.attribution, source.license);
      if (chip === null) {
        expect(text).not.toContain(licenceToken(source.license));
      } else {
        expect(text).toContain(chip);
      }
    }
    view.unmount();
  });

  it("names Murai's reading as one scholar's, never as settled fact (Q-015)", () => {
    const badge = badgeOf('history');
    if (badge.kind !== 'history') throw new Error('wrong kind');

    // The claim, the label for it and the scholar all arrive together or the sheet has no
    // business printing the heading. The decoder must not have separated them.
    expect(badge.payload.passageTitle).toBeDefined();
    expect(badge.payload.interpretiveClaim).toBe("Murai's reading");
    expect(badge.payload.attributedTo).toBe('Hajime Murai');

    const view = renderReader(detail(badge), theme);

    // The source strip at the foot says where the DATA came from. Q-015 asks for something
    // else: the sentence beside the claim that says this particular reading is one
    // scholar's. Both must be on screen — the strip alone was the shipped defect.
    expect(view.text()).toContain('Literary structure analysis by Hajime Murai');
    expect(view.byTestId(`badge-claim-${badge.id}`)?.textContent).toBe("Murai's reading");
    view.unmount();
  });

  it('leaves a sourced teaser unqualified — the mark is not decoration', () => {
    const badge = badgeOf('route');
    const view = renderReader(detail(badge), theme);

    expect(view.byTestId(`badge-claim-${badge.id}`)).toBeNull();
    expect(view.text()).not.toContain("Murai's reading");
    view.unmount();
  });

  it('prints each distinct source once, not once per file it was ingested from', () => {
    // STEPBible's TBESG and TAGNT are two files of one project under one attribution, so a
    // Root badge carries the identical sentence as two citations AND as two sources. It was
    // rendered four times: two evidence chips and two attribution lines, on a 375 dp sheet.
    const badge = badgeOf('root');
    const view = renderReader(detail(badge), theme);
    const text = view.text();

    for (const citation of badge.citations) {
      const occurrences = text.split(citation.label).length - 1;
      expect(occurrences, `"${citation.label}" is printed ${String(occurrences)} times`).toBe(1);
    }
    view.unmount();
  });

  it('drops an evidence chip that only repeats the attribution strip below it', () => {
    const badge = badgeOf('root');
    const view = renderReader(detail(badge), theme);

    // Every M2 citation is its dataset's own attribution line, which the strip prints in
    // full. A chip carrying a claim the strip cannot make would still render.
    expect(view.byTestId(`badge-evidence-${badge.id}`)).toBeNull();
    view.unmount();
  });

  it('draws a registered sheet body and hands it the badge', () => {
    const badge = badgeOf('route');
    const seen: ReaderBadge[] = [];
    const view = renderReader(
      detail(badge, {
        route: (given) => {
          seen.push(given);
          return <Text testID="fake-route-sheet">A map would go here</Text>;
        },
      }),
      theme,
    );

    expect(view.byTestId('fake-route-sheet')).not.toBeNull();
    expect(seen).toEqual([badge]);
    view.unmount();
  });

  it('hands a body the command that makes a cross-reference followable', () => {
    const badge = badgeOf('cross-ref');
    const opened: BadgeSheetTarget[] = [];
    const target: BadgeSheetTarget = {
      bookNumber: 44,
      bookId: 'acts',
      chapter: 11,
      verseNumber: 14,
      label: 'Acts 11:14',
    };
    let offered: ((given: BadgeSheetTarget) => void) | undefined;

    const view = renderReader(
      <BadgeSheetProvider
        renderers={{
          crossRef: (_given, actions) => {
            offered = actions.openVerse;
            return <Text testID="fake-crossref-sheet">Linked passages</Text>;
          },
        }}
      >
        <BadgeDetail
          badge={badge}
          onOpenVerse={(given) => {
            opened.push(given);
          }}
        />
      </BadgeSheetProvider>,
      theme,
    );

    expect(offered, 'the body was handed no way to navigate').toBeDefined();
    offered?.(target);
    expect(opened).toEqual([target]);
    view.unmount();
  });

  it('leaves a body inert rather than pretending, when the host cannot navigate', () => {
    let offered: ((given: BadgeSheetTarget) => void) | undefined = () => undefined;
    const view = renderReader(
      detail(badgeOf('cross-ref'), {
        crossRef: (_given, actions) => {
          offered = actions.openVerse;
          return <Text testID="fake-crossref-sheet">Linked passages</Text>;
        },
      }),
      theme,
    );

    expect(offered).toBeUndefined();
    view.unmount();
  });

  it('stays a complete surface when no body is registered for the kind', () => {
    const badge = badgeOf('3d-city');
    const view = renderReader(detail(badge, { route: () => <Text>wrong sheet</Text> }), theme);

    expect(view.text()).not.toContain('wrong sheet');
    expect(view.text()).toContain('Site]');
    expect(view.byTestId(`badge-sources-${badge.id}`)).not.toBeNull();
    view.unmount();
  });
});
