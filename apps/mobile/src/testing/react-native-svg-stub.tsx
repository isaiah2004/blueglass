/**
 * A stand-in for `react-native-svg`, for the component tests only.
 *
 * Purpose
 *   `react-native-svg`'s web entry point still imports its Fabric native components, which
 *   resolve through Metro's platform machinery and not through Vite. Rather than reproduce
 *   that machinery, the component project aliases the package to this file.
 *
 * What is deliberately given up, and where it is covered instead
 *   These tests then say nothing about vector output — whether a gradient has two stops, or
 *   whether a glyph's path is the right shape. That is not a gap: a component test could
 *   only ever assert the props, and the real question is what a browser paints. The
 *   Playwright walkthrough answers it by measuring rendered colour, and the screenshots
 *   answer it by eye. What these tests keep is everything around the vectors — structure,
 *   labels, roles, press behaviour, and which theme is in force.
 *
 * The stub renders each element as a `View` so the tree still has the right shape and depth,
 * and forwards `testID` and the ARIA props so queries behave the same.
 */

import type { JSX, ReactNode } from 'react';
import { View, type ViewProps } from 'react-native';

/** Anything the real library accepts. Only the props the harness queries are honoured. */
export interface SvgStubProps extends Pick<
  ViewProps,
  'aria-hidden' | 'accessibilityLabel' | 'accessibilityRole'
> {
  readonly children?: ReactNode;
  readonly testID?: string;
}

/**
 * Build one stub element.
 *
 * @param name - The element's name, used as its `data-svg` marker for debugging.
 * @returns A component rendering a `View`.
 */
function stub(name: string): (props: SvgStubProps) => JSX.Element {
  const Stub = ({ children, testID, ...rest }: SvgStubProps): JSX.Element => (
    <View testID={testID ?? `svg-${name}`} {...rest}>
      {children}
    </View>
  );
  Stub.displayName = `SvgStub(${name})`;
  return Stub;
}

export const Svg = stub('svg');
export const Path = stub('path');
export const Circle = stub('circle');
export const Rect = stub('rect');
export const G = stub('g');
export const Defs = stub('defs');
export const LinearGradient = stub('linearGradient');
export const RadialGradient = stub('radialGradient');
export const Stop = stub('stop');
export const Line = stub('line');
export const Polygon = stub('polygon');
export const Polyline = stub('polyline');
export const Text = stub('text');

export default Svg;
