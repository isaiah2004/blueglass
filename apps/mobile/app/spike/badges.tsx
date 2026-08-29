/**
 * Route: /spike/badges — the inline-badge spike screen.
 *
 * Purpose
 *   Gives the badge strategies a real URL so they can be opened in a browser, on a device,
 *   and by a future Playwright spec. The screen itself is `@/components/InlineBadgeSpike`;
 *   this file is only the router entry, so the diagnostic can be deleted by removing one
 *   directory.
 *
 * Lifetime
 *   Delete this route once the reader screen renders badges for real and
 *   `docs/architecture/spike-inline-badges.md` has been acted on. It is deliberately not
 *   linked from any tab (pillar 1: nothing clutters the reading canvas).
 */

import type { JSX } from 'react';

import { InlineBadgeSpike } from '@/components/InlineBadgeSpike';

/**
 * Render the spike screen.
 *
 * @returns The badge comparison screen.
 */
export default function BadgeSpikeRoute(): JSX.Element {
  return <InlineBadgeSpike />;
}
