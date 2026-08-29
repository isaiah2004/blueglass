/**
 * The shape of one thing the harness noticed, and how it is reported.
 *
 * Purpose
 *   Every page probe returns the same record, so a failure message reads the same whether
 *   it came from a layout probe or a typography probe: what kind of problem, which element,
 *   and the measurement that proves it. Rule 6 (`error-handling`) asks for actionable
 *   errors; "expected 0 findings, got 3" is not one.
 *
 * Dependencies
 *   None. Shared by code that runs in Node and by code serialised into the browser, so it
 *   must stay pure data with no imports.
 */

/** One observation from a page probe. */
export interface Finding {
  /** Stable machine-readable category, e.g. `element-wider-than-viewport`. */
  readonly kind: string;
  /** The element, described well enough for a human to find it in the source. */
  readonly label: string;
  /** The measurement that makes this a defect rather than an opinion. */
  readonly detail: string;
}

/**
 * Render findings as a failure message.
 *
 * @param heading What was being checked, e.g. `tap targets on /read/acts/1`.
 * @param findings The findings to report. An empty list renders an empty string.
 * @returns A multi-line message, one bullet per finding.
 */
export function formatFindings(heading: string, findings: readonly Finding[]): string {
  if (findings.length === 0) return '';
  const bullets = findings
    .map((finding) => `  - [${finding.kind}] ${finding.label}\n      ${finding.detail}`)
    .join('\n');
  return `${heading} — ${String(findings.length)} problem(s):\n${bullets}`;
}
