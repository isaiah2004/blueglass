/**
 * Public API of `@atlas/shared`.
 *
 * Purpose
 *   The single import surface for everything this package offers. Consumers import
 *   from `@atlas/shared`; nothing outside the package may reach into `src/**` directly
 *   (rule 5.3.3).
 *
 * Key responsibilities
 *   - Re-export the `Result` type every fallible domain function returns.
 *   - Re-export the scripture domain: the canonical 66-book table, book resolution,
 *     the `VerseKey` value object, and OSIS parsing.
 *   - Re-export the citation and geography primitives those domains share, and the
 *     display rules for a licence notice (`AI-05`).
 *   - Re-export the inline-badge union and the pre-computed passage record types.
 *
 * Constraint
 *   This package stays framework-free: no React, no React Native, no Node built-ins.
 *   It is imported by the Expo client and (later) by the API's type generation, so any
 *   platform dependency added here breaks one of those two consumers.
 *
 * Not exported on purpose
 *   `src/testing/unwrap-result` — a test-only helper that throws. Keeping it out of this
 *   barrel stops shipped code from reintroducing exceptions as control flow.
 */

export type { FailureResult, Result, SuccessResult } from './result';
export { fail, succeed } from './result';

export * from './citation';
export * from './licence-notice';
export * from './geo';
export * from './scripture';
export * from './badges';
export * from './enrichment';
