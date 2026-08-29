/**
 * Setup for the `component` Vitest project.
 *
 * Purpose
 *   React 19 refuses to treat `act()` as an act-environment unless a global says so, and
 *   without it every state update inside a test logs a warning and may not be flushed before
 *   the assertion runs. Setting the flag once here is the supported way; setting it per test
 *   file is the same line repeated.
 *
 *   `__DEV__` is Metro's, not JavaScript's. Anything under `expo-modules-core` reads it at
 *   module scope — importing `@/theme/runtime` reaches `expo-font` and therefore reaches it
 *   — and a bare `ReferenceError` there fails the whole file before a single test runs.
 *
 * Loaded by `vitest.config.ts`'s `component` project only. The `logic` project renders
 * nothing and must stay free of both DOM globals and Metro's.
 */

declare global {
  // `var` is the only declaration form that augments `globalThis`. `__DEV__` is *not*
  // declared here: `expo/types` already declares it globally, and a second declaration is
  // a redeclaration error rather than a merge.
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// Assigned through an index write because `__DEV__` is declared `const` by `expo/types`:
// true of the shipped bundle, where Metro substitutes a literal, and not true here.
(globalThis as unknown as Record<string, boolean>)['__DEV__'] = true;

export {};
