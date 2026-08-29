/**
 * Icon.
 *
 * Purpose
 *   Draws one glyph from `./nav-icons`. The only component in the app that renders an
 *   `<Svg>` for chrome, so stroke weight, cap style and the 24-unit grid are decided once
 *   rather than per call site.
 *
 * Responsibilities
 *   - Owns: how a glyph is stroked, and how its size maps onto the viewBox.
 *   - Does NOT own: what colour it is, or whether it is decorative. Both are the caller's,
 *     because the caller knows the state (active tab, disabled control) and the semantics.
 *
 * Accessibility
 *   Hidden from assistive technology by default, because a glyph beside its own label is
 *   noise to a screen reader. A caller that uses an icon *as* the label passes `label`, and
 *   gets an `img` role with that name instead.
 *
 * Dependencies
 *   `react-native-svg`, and the path table in `./nav-icons`.
 */

import type { JSX } from 'react';
import Svg, { Path } from 'react-native-svg';

import { size } from '@/theme';

import { ICON_VIEWBOX, iconPaths, type IconName } from './nav-icons';

/** Inputs to {@link Icon}. */
export interface IconProps {
  /** Which glyph to draw. */
  readonly name: IconName;
  /** The square it is drawn into, in dp. Defaults to the medium icon token. */
  readonly size?: number | undefined;
  /** The stroke colour. Always a theme token — never a literal (CLAUDE.md). */
  readonly color: string;
  /** Stroke width in viewBox units. Defaults to {@link DEFAULT_STROKE}. */
  readonly strokeWidth?: number | undefined;
  /**
   * What a screen reader should call this glyph. Omit when a visible label sits beside it;
   * the icon is then hidden from assistive technology rather than read twice.
   */
  readonly label?: string | undefined;
}

/**
 * Stroke width, in viewBox units.
 *
 * 1.7 of 24 is the weight at which a 20 dp glyph still reads at a glance without turning
 * into a blob at 16 dp. Thinner disappears against `background.canvas`.
 */
const DEFAULT_STROKE = 1.7;

/**
 * Draw one glyph.
 *
 * @param props - See {@link IconProps}.
 * @returns The glyph, stroked in `color`.
 *
 * Side effects: none.
 */
export function Icon({
  name,
  size: boxSize = size.icon.md,
  color,
  strokeWidth = DEFAULT_STROKE,
  label,
}: IconProps): JSX.Element {
  const isDecorative = label === undefined;

  return (
    <Svg
      width={boxSize}
      height={boxSize}
      viewBox={`0 0 ${String(ICON_VIEWBOX)} ${String(ICON_VIEWBOX)}`}
      fill="none"
      // `aria-hidden` is the modern, cross-platform prop: react-native-web maps it to the
      // DOM attribute, and React Native maps it to `accessibilityElementsHidden` plus
      // `importantForAccessibility` itself. Passing those two directly makes React warn on
      // every render, because react-native-web forwards them to the DOM verbatim.
      aria-hidden={isDecorative}
      {...(label === undefined
        ? {}
        : { accessibilityRole: 'image' as const, accessibilityLabel: label })}
    >
      {iconPaths[name].map((d) => (
        <Path
          key={d}
          d={d}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </Svg>
  );
}
