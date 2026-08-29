/**
 * Defines the bare `__DEV__` global, for component tests only.
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
 * IMPORT ORDER IS LOAD-BEARING. Keep this as the first import of any reader component
 * test, above every other import.
 *
 * The real home for this is a `define` or a setup file in `vitest.config.ts`, which
 * belongs to whoever owns that file.
 */

(globalThis as { __DEV__?: boolean }).__DEV__ ??= true;
