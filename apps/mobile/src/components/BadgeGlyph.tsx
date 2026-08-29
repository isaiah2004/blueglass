/**
 * One badge's icon, stroked in the badge's own hue.
 *
 * Purpose
 *   `design-language.md` §5: "text and icon in the full hue". A stroked outline takes a
 *   single colour, which is what makes that sentence implementable at all — the colour emoji
 *   the spike shipped could not be tinted, and the badge's hue is how a reader learns the
 *   badge types apart (`spike-inline-badges.md` §2, assumption `Q-021`).
 *
 * Responsibilities
 *   - Owns: how a badge glyph is stroked and how its size maps onto the 24-unit box.
 *   - Does NOT own: which colour it is, or how big. Both come from the pill around it, which
 *     scales with the reader's scripture size.
 *
 * Accessibility
 *   Always hidden from assistive technology. The glyph never appears without the badge's word
 *   beside it, and a screen reader that announced both would read "map, Route".
 *
 * Dependencies
 *   `react-native-svg` and the path table in `./badge-icons`.
 */

import type { JSX } from 'react';
import Svg, { Path } from 'react-native-svg';

import type { BadgeKind } from '@/theme';

import { BADGE_ICON_STROKE, BADGE_ICON_VIEWBOX, badgeIconPaths } from './badge-icons';

/** Inputs to {@link BadgeGlyph}. */
export interface BadgeGlyphProps {
  readonly kind: BadgeKind;
  /** The square it is drawn into, in dp. The pill sizes this from its own label metrics. */
  readonly size: number;
  /** The badge's tint. Always a theme token — never a literal (CLAUDE.md). */
  readonly color: string;
}

/**
 * Draw one badge glyph.
 *
 * @param props - See {@link BadgeGlyphProps}.
 * @returns The glyph, stroked in `color`. Side effects: none.
 */
export function BadgeGlyph({ kind, size, color }: BadgeGlyphProps): JSX.Element {
  return (
    <Svg
      width={size}
      height={size}
      viewBox={`0 0 ${String(BADGE_ICON_VIEWBOX)} ${String(BADGE_ICON_VIEWBOX)}`}
      fill="none"
      // The modern, cross-platform prop: react-native-web maps it to the DOM attribute and
      // React Native maps it to `accessibilityElementsHidden` itself. Passing those two
      // directly makes React warn on every render.
      aria-hidden
    >
      {badgeIconPaths[kind].map((d) => (
        <Path
          key={d}
          d={d}
          stroke={color}
          strokeWidth={BADGE_ICON_STROKE}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </Svg>
  );
}
