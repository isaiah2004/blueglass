/**
 * Vitest configuration for the Atlas Bible workspace.
 *
 * Purpose
 *   Runs the unit and logic tests (`pnpm test`). Tests live beside the code they cover
 *   — `foo.ts` is tested by `foo.test.ts` in the same directory (rule 8.5).
 *
 * Current scope
 *   Pure TypeScript and TSX, `packages/*` plus `apps/mobile/src`, under Node.
 *
 * The component project — how it was closed
 *   The note that used to sit here said component tests could not run with the dependencies
 *   this repo has, and listed three ways to close it. A fourth turned out to be cheapest and
 *   is what `projects` below does: run `.test.tsx` in **jsdom** with `react-native` aliased
 *   to `react-native-web`, which is the same substitution the shipped web build already
 *   makes. That sidesteps the Flow-source problem entirely, because react-native-web is
 *   plain ESM. `@testing-library/react-native` is still unusable — it matches host
 *   components named `Text`/`View` and react-native-web renders `span`/`div` — so
 *   `apps/mobile/src/testing/render.tsx` is a small `react-dom/client` harness that queries
 *   the DOM instead. One dependency was added for this: `jsdom`.
 *
 *   What this does NOT cover: anything whose behaviour differs on a device — native
 *   gestures, Reanimated's UI thread, `expo-font`. Those are Maestro's and the Playwright
 *   walkthrough's job.
 *
 * The original note, kept because the measurements are still true
 *   The scaffold asked the first component author to add a `test.projects` entry with a
 *   React Native transform. That was attempted and does not work with the dependencies
 *   this repo has. Measured, not assumed:
 *     - `react-native` 0.86 ships Flow source. Running it through `@babel/core` with
 *       `@react-native/babel-preset` (both installed) emits CommonJS aimed at Metro —
 *       `module.exports`, bare `require`, and a free `__DEV__` — which Vite's ESM module
 *       runner cannot evaluate. Vitest reports `Missing initializer in const declaration`
 *       at `react-native/index.js:29`.
 *     - Aliasing to `react-native-web` instead does not rescue it: `@testing-library/
 *       react-native` matches host components named `Text`/`View`, and react-native-web
 *       renders `span`/`div`, so every query would miss even once it rendered.
 *   Closing this needs ONE of: `jest` + `@react-native/jest-preset` (the combination
 *   `@testing-library/react-native` is built for), or a Vite-side React Native preset such
 *   as `vitest-react-native`, or `jsdom` for a DOM-based react-native-web setup. None of
 *   the three is installed, and adding a dependency is not this config's call to make.
 *
 * Until then, `include` deliberately covers `.test.tsx` as well as `.test.ts`. Nothing
 * matches it today, and a component test added tomorrow will FAIL loudly on the transform
 * above instead of being silently skipped by a glob that never mentioned it.
 *
 * Path aliases
 *   `@/*` mirrors `apps/mobile/tsconfig.json`. Without it, a pure module under
 *   `apps/mobile/src` that imports `@/theme` type-checks and bundles but cannot be tested,
 *   which would quietly push logic out of the tested layer.
 */

import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./apps/mobile/src', import.meta.url)),
    },
  },
  test: {
    reporters: ['default'],
    projects: [
      {
        // Pure logic. Node, no DOM, no React Native — the modules here import neither.
        extends: true,
        test: {
          name: 'logic',
          environment: 'node',
          include: ['packages/*/src/**/*.test.ts', 'apps/mobile/src/**/*.test.ts'],
          exclude: ['**/node_modules/**', '**/dist/**', '**/.expo/**'],
        },
      },
      {
        // Components. jsdom, with `react-native` resolved to `react-native-web` exactly as
        // the shipped web build resolves it.
        extends: true,
        resolve: {
          alias: {
            '@': fileURLToPath(new URL('./apps/mobile/src', import.meta.url)),
            'react-native': 'react-native-web',
            // `react-native-svg`'s web entry still imports its Fabric native components,
            // which resolve through Metro's platform machinery rather than Vite's. The stub
            // keeps the tree's shape and the queryable props; what a browser actually paints
            // is the Playwright walkthrough's question, not a component test's. See the
            // header of `apps/mobile/src/testing/react-native-svg-stub.tsx`.
            'react-native-svg': fileURLToPath(
              new URL('./apps/mobile/src/testing/react-native-svg-stub.tsx', import.meta.url),
            ),
          },
        },
        test: {
          name: 'component',
          environment: 'jsdom',
          setupFiles: ['./apps/mobile/src/testing/component-setup.ts'],
          include: ['apps/mobile/src/**/*.test.tsx', 'packages/*/src/**/*.test.tsx'],
          exclude: ['**/node_modules/**', '**/dist/**', '**/.expo/**'],
        },
      },
    ],
  },
});
