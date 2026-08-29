/**
 * Defines the bare `__DEV__` global, for the spatial component tests only.
 *
 * Why this file exists and why it has no imports
 *   `expo-modules-core` reads the free identifier `__DEV__` at *import* time, and
 *   `@/theme/runtime` reaches it through the font loader. Metro defines that global;
 *   Vitest does not, so importing the theme runtime in a component test throws
 *   `ReferenceError: __DEV__` before a single assertion runs.
 *
 *   ES modules evaluate their imports in source order, and a module with no imports of its
 *   own evaluates immediately. Importing this file FIRST therefore guarantees the global
 *   exists before anything that reads it is evaluated. Adding an import to this file would
 *   silently break that guarantee.
 *
 * Why it is duplicated rather than imported from `features/reader/testing`
 *   Two lines, no imports, and reaching across features for a test shim couples this
 *   feature's tests to another feature's file layout (rule 5.3.3). The real home is a
 *   `define` in `vitest.config.ts`, which belongs to whoever owns that file; when it lands,
 *   both copies go.
 *
 * IMPORT ORDER IS LOAD-BEARING. Keep this as the first import of any spatial component test.
 */

(globalThis as { __DEV__?: boolean }).__DEV__ ??= true;
