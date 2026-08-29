/**
 * ESLint flat configuration for the Atlas Bible workspace.
 *
 * Purpose
 *   One lint contract for every package. It is type-aware: the TypeScript program is
 *   loaded so rules can reason about real types, not just syntax.
 *
 * Key responsibilities
 *   - Enforce the hard limits from CLAUDE.md that a linter can enforce:
 *     no `any`, no `console.*` in shipped code, no empty catch blocks.
 *   - Apply the React Hooks rules to every component and hook.
 *   - Keep configuration files (this one, Vitest's, Playwright's) out of the type-aware
 *     pass, since they belong to no package's tsconfig.
 *
 * Run with `pnpm lint` (or `pnpm lint:fix`).
 */

import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    // Generated, vendored, or reported output. Never linted.
    ignores: [
      '**/node_modules/**',
      '**/.expo/**',
      '**/dist/**',
      '**/web-build/**',
      '**/coverage/**',
      '**/playwright-report/**',
      '**/test-results/**',
      '**/expo-env.d.ts',
    ],
  },

  js.configs.recommended,

  {
    // The type-aware pass. Scoped to TypeScript sources so that JavaScript config files
    // never ask for a program that does not contain them.
    files: ['**/*.ts', '**/*.tsx'],
    extends: [tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        // Every TypeScript file in the repo belongs to exactly one tsconfig:
        // `apps/mobile`, `packages/shared`, or the root config for tooling files.
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // TypeScript's own checker already reports undefined identifiers, and core
      // `no-undef` cannot see type-only or ambient declarations.
      'no-undef': 'off',
      // CLAUDE.md, "Hard limits, restated": no `any`, ever. TypeScript is at maximum
      // strictness and an escape hatch here would silently undo that.
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },

  {
    // Native-only modules, and the one place each may be imported.
    //
    // Decision `T-01` made the browser a first-class target, so a native module reached
    // from shared code does not degrade the web build — it breaks it, at bundle time,
    // with a message that names a transitive file rather than the mistake. This rule
    // moves that failure to the import line.
    //
    // `react-native-mmkv` has no browser build. It is allowed in exactly one file,
    // `apps/mobile/src/api/storage/mmkv-key-value-store.native.ts`, whose `.native.ts`
    // extension keeps it out of the web bundle by Metro's own resolution rules. The
    // override below is scoped to `*.native.ts` rather than to that path, because the
    // extension is the property that actually makes the import safe.
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'react-native-mmkv',
              message:
                'No browser build. Go through `@/api/storage`; the engine is chosen by ' +
                'Metro in `device-storage.ts` / `device-storage.native.ts`. The only file ' +
                'that may import this is `mmkv-key-value-store.native.ts`.',
            },
          ],
        },
      ],
    },
  },

  {
    // The `.native.ts` files Metro never bundles for the web. They, and only they, may
    // import a native-only module.
    files: ['**/*.native.ts', '**/*.native.tsx'],
    rules: { 'no-restricted-imports': 'off' },
  },

  reactHooks.configs.flat['recommended-latest'],

  {
    // Core hard limits that need no type information, applied to every file
    // (CLAUDE.md, "Hard limits, restated").
    rules: {
      // Shipped code logs through the structured logger, never the console.
      'no-console': 'error',
      // A swallowed error is a bug you will never see. Rule 6.
      'no-empty': ['error', { allowEmptyCatch: false }],
      eqeqeq: ['error', 'always', { null: 'ignore' }],
    },
  },

  {
    // Plain-JavaScript tooling files: syntax rules only, no type information exists.
    files: ['**/*.js', '**/*.mjs', '**/*.cjs'],
    extends: [tseslint.configs.disableTypeChecked],
  },

  {
    // `tools/` holds the Question Hub's Node command-line scripts. They are developer
    // tooling, not shipped app code, so two app rules do not apply:
    //   - stdout IS their user interface, so `console` is correct there;
    //   - `preserve-caught-error` is off because these scripts predate this config and
    //     are owned by the Question Hub author, who should re-enable it when they next
    //     touch the error paths in `tools/question-hub/server.mjs`.
    files: ['tools/**/*.{js,mjs,cjs}'],
    languageOptions: {
      globals: globals.node,
      sourceType: 'module',
    },
    rules: {
      'no-console': 'off',
      'preserve-caught-error': 'off',
    },
  },

  {
    // The Question Hub's own Playwright specs. They are TypeScript, but they belong to no
    // application tsconfig on purpose: they test a vendored developer tool, run under
    // `tools/question-hub/playwright.config.mjs`, and drive an untyped JSON database
    // through a `.mjs` helper. Without a program the type-aware pass cannot parse them at
    // all, so this block gives them the same syntax-only contract the JavaScript beside
    // them already has.
    //   - `no-undef` is off for the same reason it is off in the type-aware block: the
    //     TypeScript parser sees type-only and ambient names core ESLint cannot.
    //   - `react-hooks/rules-of-hooks` is a false positive here. Playwright's fixture
    //     callbacks are `async ({ ... }, use) => { await use(value) }`; the plugin reads
    //     that `use` as React's `use` hook called outside a component.
    //   - `no-explicit-any` is off ONLY in this directory. It is real debt, not a
    //     dispensation: the specs annotate `(q: any)` because `Hub.readDb()` in
    //     `hub-fixture.ts` returns `Promise<any>`. Typing that one method removes every
    //     `any` in the suite, after which this rule should be deleted from this block.
    //     Owned by the Question Hub author.
    files: ['tools/question-hub/tests/**/*.ts'],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: {
      parserOptions: { projectService: false, project: false },
    },
    rules: {
      'no-undef': 'off',
      'react-hooks/rules-of-hooks': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },

  {
    // The walkthrough harness's fixture module. `react-hooks/rules-of-hooks` is a false
    // positive on Playwright's fixture signature — `async ({ ... }, use) => { await use(v) }`
    // reads as React's `use` hook called outside a component. Same reason, and same
    // narrow scope, as the Question Hub block above; nothing else is relaxed, so the
    // walkthrough specs stay under the full type-aware contract.
    files: ['e2e/support/fixtures.ts'],
    rules: { 'react-hooks/rules-of-hooks': 'off' },
  },

  {
    // The walkthrough runner and its helpers. Node command-line scripts that start and
    // stop a dev server, so their globals are Node's, and stdout is their user interface —
    // the run id, the evidence directory and the summary path are printed for a human to
    // follow. Everything else, including `no-empty` and `eqeqeq`, still applies.
    files: ['e2e/**/*.mjs'],
    languageOptions: {
      globals: globals.node,
      sourceType: 'module',
    },
    rules: { 'no-console': 'off' },
  },

  {
    // The Question Hub's browser bundle. These files sit under `tools/`, so the block
    // above already relaxed `no-console` for them, but they are NOT Node scripts: they
    // are ES modules the browser loads from `tools/question-hub/public/index.html`
    // (`<script type="module">`). Their globals are the DOM's — `document`, `window`,
    // `location`, `CSS` — none of which exist in a Node globals set, so without this
    // block core `no-undef` reports every one of them.
    files: ['tools/question-hub/public/**/*.js'],
    languageOptions: {
      globals: globals.browser,
      sourceType: 'module',
    },
  },
);
