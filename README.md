# Atlas Bible (Aletheia)

> Your multimodal Bible atlas — _See the Context. Hear the Voice. Live the Word._

Atlas Bible renders scripture as an interactive canvas. Inline badges inside each verse
open focused sheets containing 3D route maps, dual-axis history timelines, Greek/Hebrew
word roots, manuscript variants, literary structure, and grounded AI commentary — so
context arrives where the reader already is, instead of behind a search box. A
five-minute daily habit loop (listen → explore → reflect) drives retention through
streaks. This repository is the React Native / Expo rewrite of an earlier Flutter
prototype, built against the master product specification in `docs/product/prd.md`.

## Table of contents

1. [Architecture overview](#architecture-overview)
2. [Technology stack](#technology-stack)
3. [Prerequisites](#prerequisites)
4. [Local development setup](#local-development-setup)
5. [Testing](#testing)
6. [Deployment guide](#deployment-guide)
7. [API documentation](#api-documentation)
8. [Project structure](#project-structure)
9. [Contributing](#contributing)
10. [Troubleshooting](#troubleshooting)
11. [License](#license)

## Architecture overview

Only the client half of the system exists in this repository today. The backend is a
FastAPI service that is being restructured (assumption `B-01`); until it lands, the app
talks to no network at all.

```
┌────────────────────────────────────────────┐
│ apps/mobile — Expo (iOS · Android · Web)   │
│                                            │
│  app/            Expo Router file routes   │
│   └ (tabs)/      Home · Bible · Discover   │
│                  Studio · Journal          │
│  src/theme/      design tokens             │
│  src/components/ shared primitives         │
└───────────────┬────────────────────────────┘
                │ imports (pnpm workspace)
┌───────────────▼────────────────────────────┐
│ packages/shared — pure TypeScript          │
│  domain types + pure helpers, no React     │
│                                            │
│ packages/ai-guard — Node only, never the   │
│  client. Spend ledger, disk cache, rate    │
│  limiter, OpenRouter provider. The ONLY    │
│  sanctioned route to a language model.     │
└───────────────┬────────────────────────────┘
                │ (planned) same types
┌───────────────▼────────────────────────────┐
│ FastAPI + PostgreSQL 16 / pgvector         │
│ OpenRouter (open-weight models only)       │
│ NOT IN THIS REPOSITORY YET                 │
└────────────────────────────────────────────┘
```

- **Services:** one Expo client. No server, queue, or database here yet.
- **Third-party APIs:** none reachable from the client at present. The AI provider is
  OpenRouter, reached only through `packages/ai-guard`, which enforces a hard spend
  ceiling, a disk cache, a rate limiter, and a model price cap before any request leaves
  the machine. Feature code never calls a provider directly (CLAUDE.md, "Non-negotiable
  AI constraint"). The guard is a Node package: it reads the filesystem and the API key,
  so it must never be imported from `apps/mobile`.

## Technology stack

| Layer           | Choice                                 | Version             |
| --------------- | -------------------------------------- | ------------------- |
| Runtime         | Node.js                                | `>= 20.19.4`        |
| Package manager | pnpm workspaces                        | `10.33.0`           |
| Language        | TypeScript, maximum strictness         | `6.0.3`             |
| App framework   | Expo SDK                               | `57.0.18`           |
| Native runtime  | React Native (New Architecture)        | `0.86.3`            |
| UI runtime      | React                                  | `19.2.3`            |
| Routing         | Expo Router — file-based, typed routes | `57.0.17`           |
| Client state    | Zustand                                | `5.0.15`            |
| Server state    | TanStack Query                         | `5.102.8`           |
| Local storage   | react-native-mmkv + nitro modules      | `4.3.2`             |
| Animation       | react-native-reanimated                | `4.5.1`             |
| Sheets          | @gorhom/bottom-sheet                   | `5.2.14`            |
| Unit tests      | Vitest                                 | `4.1.11`            |
| Component tests | @testing-library/react-native          | `14.0.1`            |
| E2E (web)       | Playwright                             | `1.62.1`            |
| Lint            | ESLint + typescript-eslint             | `10.9.1` / `8.68.0` |

Every version is pinned exactly — no `^`, no `~` (rule 5.5.2). React-native packages are
held at whatever `npx expo install --check` blesses for the SDK.

## Prerequisites

| Software               | Minimum version | Notes                                              |
| ---------------------- | --------------- | -------------------------------------------------- |
| Node.js                | 20.19.4         | Required by React Native 0.86.                     |
| pnpm                   | 10.33.0         | `corepack enable pnpm`, or install globally.       |
| Expo Go / dev client   | SDK 57          | Only for on-device runs. Web needs nothing extra.  |
| Xcode / Android Studio | current         | Only for native builds. Not needed for `pnpm web`. |

**Accounts:** none required to run the client. An Expo account is needed only for EAS
builds, which are not configured yet.

**Environment variables** — the client currently requires none.

| Name                 | Description                                                       | Format            | Example                 | Required                          |
| -------------------- | ----------------------------------------------------------------- | ----------------- | ----------------------- | --------------------------------- |
| `ATLAS_WEB_BASE_URL` | Where Playwright points its walkthrough.                          | URL               | `http://localhost:8081` | Optional — defaults to that value |
| `CI`                 | Set by CI. Disables Metro watch mode; enables Playwright retries. | any truthy string | `1`                     | Optional                          |

`OPENROUTER_API_KEY` will be read by the backend when it exists. It never reaches the
client, and its value never appears in this repository.

## Local development setup

```bash
git clone <this-repo> spark-expo
cd spark-expo
pnpm install
```

`pnpm install` must run from the repository root. The workspace uses
`node-linker=hoisted` (see `.npmrc`); installing inside `apps/mobile` alone produces a
tree Metro cannot resolve.

Run the app:

```bash
pnpm web       # Expo web at http://localhost:8081
pnpm dev       # Expo dev server; press i / a for a simulator
pnpm android   # Android device or emulator
pnpm ios       # iOS simulator (macOS only)
```

**Verify the setup.** `pnpm web` prints `Web Bundled … node_modules\expo-router\entry.js`
and serves HTTP 200 at `http://localhost:8081`, showing the five-tab shell with Home
selected. There is no health-check endpoint — the client has no server.

## Testing

```bash
pnpm typecheck   # tsc --noEmit for the root tooling config and every package
pnpm lint        # ESLint flat config, type-aware; no-explicit-any is an error
pnpm test        # Vitest — unit and logic tests
pnpm test:watch  # the same, in watch mode
pnpm e2e         # Playwright against the Expo web build
```

Test files live **next to the code they cover** — `foo.ts` is tested by `foo.test.ts` in
the same directory (rule 8.5). There is no `tests/` directory.

Coverage thresholds are not enforced yet. Rule 8.6.1 requires 100 % branch coverage of
business logic; the agent that adds the first business logic wires the threshold into
`vitest.config.ts`.

`pnpm e2e` runs 14 Playwright tests over the five-tab shell, the not-found route, and the
inline-badge spike. It starts the Expo web build itself (`webServer` in
`playwright.config.ts`) and reuses one you already have running. **First run only:**
`npx playwright install chromium` — the browser binary is not a package dependency.

Component tests do not run yet. `@testing-library/react-native` is installed but cannot be
driven by Vitest with the dependencies this repo has; `vitest.config.ts` records the
measured failure and the three ways out. `include` already covers `.test.tsx`, so a
component test added tomorrow fails loudly rather than being skipped.

## Deployment guide

**Not configured yet.** No EAS profile, CI pipeline, or hosting target exists. What is
true today:

- **Build command:** `pnpm build` → `expo export --platform web --output-dir dist` inside
  `apps/mobile`. Artifact: `apps/mobile/dist/` — a static site (`index.html`,
  `_expo/static/js/web/*.js`).
- **Secrets management:** none in the repo. The client reads no `.env` file.
- **Migrations / rollback:** not applicable — no database in this repository.
- **Health checks:** not applicable — no server in this repository.
- **Monitoring and alerts:** not configured.

The agent that owns release engineering fills this section in.

## API documentation

No API is served from this repository. The FastAPI contract being ported is catalogued in
`docs/architecture/flutter-port-map.md` §5, which lists every endpoint the client will
call. Generated OpenAPI types will land in `packages/shared` when the backend does.

## Project structure

```
.
├── apps/mobile/            Expo client
│   ├── app/                Expo Router routes — the file tree IS the route tree
│   │   ├── _layout.tsx     composition root: gesture host, safe area, query client
│   │   ├── (tabs)/         the five-tab shell
│   │   └── +not-found.tsx  unmatched-URL fallback
│   ├── src/api/stream/     SSE chat streaming: transports, parser, client, draft store
│   ├── src/components/     shared UI primitives, including the inline badge
│   ├── src/theme/          design tokens — the only place a colour or size is written
│   ├── app.json            Expo config: plugins, scheme, typed routes
│   └── tsconfig.json       expo/tsconfig.base + the workspace strictness
├── packages/shared/        pure TypeScript shared by client and (future) API
│   ├── src/scripture/      canonical books, verse references, formatting
│   ├── src/badges/         the eleven inline-badge kinds and their payload envelopes
│   └── src/enrichment/     passage ids and the enrichment record shape
├── packages/ai-guard/      Node-only spend guard around OpenRouter — see its README
│   └── src/                config, ledger + file lock, disk cache, rate limit, retry,
│                           model registry, provider client
├── docs/                   product spec, architecture maps, decisions, QA records
├── tools/question-hub/     CLI for asking the product owner a blocking question
├── e2e/                    Playwright walkthrough specs
├── eslint.config.mjs       one lint contract for the whole workspace
├── tsconfig.base.json      shared strictness; every package extends it
├── tsconfig.json           program for the root tooling configs only
├── vitest.config.ts        unit test runner
├── playwright.config.ts    e2e runner
├── pnpm-workspace.yaml     workspace membership
└── .npmrc                  node-linker=hoisted — required by React Native
```

## Contributing

- Read `CLAUDE.md` first. It is the engineering constitution, and the ten rules in
  `.claude/rules/` are mandatory.
- **Hard limits:** no file over 300 lines, no function over 50 lines, no `any`, no raw
  colour/size/spacing literal in a component, no `console.*` in shipped code.
- Every module opens with a docstring saying what it is for.
- Tests come before implementation (rule 8).
- Versioning is `MAJOR.FEATURE.PATCH` in the root `package.json`, with a `CHANGELOG.md`
  entry per feature and a PATCH bump per fix.
- Before calling anything done, run `pnpm typecheck && pnpm lint && pnpm test`, then walk
  the real UI and record the walkthrough in `docs/qa/walkthroughs/`.

## Troubleshooting

**`pnpm install` reports `Packages: -26` on every run.** Cosmetic. It is how pnpm's
hoisted linker reports deduplicated peer-dependency variants. `pnpm install
--frozen-lockfile` succeeds and `pnpm-lock.yaml` does not change.

**Metro cannot resolve a native module.** Confirm `.npmrc` still contains
`node-linker=hoisted`, and that you installed from the repository root. React Native's
autolinking walks a flat `node_modules`; pnpm's default symlinked layout breaks it.

**A React Native package version looks wrong.** Do not hand-edit it. Run `npx expo
install --check` inside `apps/mobile` and take what the SDK recommends.

**Typed routes are missing, or `href` is typed as plain `string`.**
`.expo/types/router.d.ts` is generated by the dev server. Run `pnpm web` once, then
re-run `pnpm typecheck`.

**Known limitations.** `react-native-mmkv` has no web implementation and needs a custom
dev client rather than Expo Go — never import it from code that must run in a browser.
The five tab screens are placeholders with no design.

## License

No licence has been chosen yet. Until one is, the contents of this repository are
unlicensed and all rights are reserved by the project owner.
