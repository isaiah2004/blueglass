/**
 * `/read` — the reader with no address.
 *
 * Purpose
 *   Somebody will land here: a bookmark trimmed back to its root, a deep link that lost its
 *   segments, a tab that has not yet been told where the reader left off. Rather than a
 *   404, it opens the reading plan's first chapter.
 *
 * Why Acts 1
 *   The MVP reading plan is thirty days through Acts (`docs/product/prd.md`, "MVP Phase"),
 *   so Acts 1 is where a reader with no history is meant to begin. When reader progress is
 *   persisted this becomes "your last position", and this file is the only thing that
 *   changes.
 */

import { Redirect } from 'expo-router';
import type { JSX } from 'react';

/**
 * The plan's first chapter, as a typed route object.
 *
 * The object form rather than `'/read/acts/1'`: `experiments.typedRoutes` checks the
 * pathname against the generated route union, so a renamed segment fails to compile here
 * instead of 404-ing at runtime.
 */
const PLAN_START = {
  pathname: '/read/[book]/[chapter]',
  params: { book: 'acts', chapter: '1' },
} as const;

/**
 * Send an addressless reader to the start of the plan.
 *
 * @returns A redirect. Side effects: navigates.
 */
export default function ReadIndexRoute(): JSX.Element {
  return <Redirect href={PLAN_START} />;
}
