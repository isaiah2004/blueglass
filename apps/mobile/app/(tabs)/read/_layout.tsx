/**
 * The reader's own stack, inside the Bible tab.
 *
 * Purpose
 *   Without this file Expo Router still routes `/read/john/3`, but the navigation it
 *   generates for a nested directory does not push: `router.push` behaved as a replace, so
 *   the browser's Back button jumped straight past the previous chapter to `about:blank`.
 *   Web is a first-class target (`T-01`), and a reader who cannot go back is on a broken
 *   website however good the app feels.
 *
 * Why no animation
 *   A chapter change is a change of content, not a change of place, and sliding one
 *   chapter of scripture off to reveal another is exactly the motion pillar 1 asks the
 *   canvas not to make. It also keeps the outgoing screen — which renders nothing while it
 *   is blurred — from being visible mid-transition.
 *
 * Why headerless
 *   The reading canvas draws its own chrome (`features/reader/components/ReaderHeader`),
 *   and pillar 1 asks for a pristine canvas — a second, navigator-drawn title bar above the
 *   reader's own would be the dock clutter the pillar rules out.
 */

import { Stack } from 'expo-router';
import type { JSX } from 'react';

import { useTheme } from '@/theme/runtime';

/**
 * Declare the reader's stack.
 *
 * @returns A headerless stack on the app canvas.
 */
export default function ReadLayout(): JSX.Element {
  const theme = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'none',
        contentStyle: { backgroundColor: theme.background.canvas },
      }}
    />
  );
}
