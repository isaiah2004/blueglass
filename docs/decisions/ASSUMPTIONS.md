# Provisional assumptions

Decisions taken **without** an answer from the product owner, so that work could
continue. Each one names the Question Hub id that will settle it.

**Rule:** when an answer arrives and contradicts an assumption here, the row moves to
"Resolved" with a note on what had to change. Never silently delete a row.

Regenerate the current answer state with:

```bash
node tools/question-hub/answers.mjs --all
```

## Open — acting on the recommended default

| Question | Assumption in force | What it affects | Cost if wrong |
|---|---|---|---|
| `T-10` | Expo Router, file-based, typed routes. | Navigation, deep links. | Medium. |
| `T-11` | `StyleSheet` + typed design tokens (no CSS-in-JS runtime). | Every component. | Medium. |
| `T-12` | Zustand for client state. | State layer. | Low — small surface. |
| `T-14` | TypeScript at maximum strictness. | Whole codebase. | Low — relaxing later is trivial. |
| `T-15` | pnpm workspaces (`apps/`, `packages/`). | Repo layout. | Medium — moving files later is cheap but noisy. |
| `AI-03` | Hard spend guard **and** disk response cache on every AI call. | AI layer. | None — strictly protective. Building regardless. |
| `AI-04` | "NotebookLM" in the spec means NotebookLM-*style*: our own grounded RAG with strict citations. | Studio tab architecture. | High — there is no public NotebookLM API, so this is the only buildable reading. |
| `Q-01` | Playwright against the web build for the continuous unattended walkthrough loop. | QA harness. | Low — additive. |
| `AI-02` | Per-task open-weight defaults, benchmarked not guessed: `mistral-small-3.2-24b` for extraction, `qwen3-235b-a22b-2507` for chat and editorial, `mistral-nemo` for cheap classification. See `docs/architecture/ai-model-strategy.md`. | Model registry, every AI call. | Low — the registry makes a swap a one-line change. |
| `Q-010` | OpenRouter sells **no** embedding models (verified: 0 of 388). Self-host `BAAI/bge-m3` in the existing Docker stack behind a swappable interface — $0 per embedding. | pgvector retrieval, RAG. | Low — the interface allows a paid API to be dropped in later. |
| `Q-013` | App identity written into `apps/mobile/app.json`: slug `atlas-bible`, iOS bundle id and Android package `app.atlasbible.mobile`, deep-link scheme `atlasbible`. | Store listings, deep links, every share URL, EAS build profiles. | Low **until the first store submission**, then high — a bundle id cannot be changed on a published app. Must be settled before the first EAS build. |
| `Q-018` | Eleven inline badge kinds, not ten: Route and 3D City stay separate and Lineage is kept. The PRD prose says ten but lists eleven marks; `design-language.md` §2 gives a hue to ten and omits Lineage. | `packages/shared/src/badges.ts` discriminated union; every badge sheet; the design token table, which still owes Lineage a hue. | Low — dropping a kind later is a union edit plus a data migration of `kind` strings; adding one back is worse. |
| `Q-019` | A pre-computed `passage_id`'s book segment is the **uppercased OSIS code** (`1COR_13_1_13`), not the uppercased full name. The PRD's only example, `ACTS_16_11_15`, cannot distinguish the two. Parsing accepts either; only formatting had to choose. | `packages/shared/src/enrichment/passage-id.ts`; every pre-computed record filename, CDN path, and cache key. | Medium — if the editorial pipeline picks the other form, every lookup misses and the pipeline re-runs. Settle before the first pre-computed batch is published. |
| `D-03` | Typefaces picked, all SIL OFL: **Source Serif 4** for scripture (the Flutter prototype's serif, and it holds at 19–21 pt), **Inter** for UI, **JetBrains Mono** for metadata. `apps/mobile/src/theme/typography.ts` names one registered face per family-and-weight pair, so `expo-font` must load exactly those eight names. | The whole visual feel; the font-loading agent's asset list. | Low — swapping a family is one edit to `fontFamily` in `typography.ts`; no component names a font. |
| `Q-017` | `ink.tertiary` (`#5D6A7D`) stays at the mockup value but is **not legal for 9–11 pt metadata** — it measures 3.36:1 on `bg.card` against WCAG AA's 4.5:1. Small metadata text uses `ink.secondary` (6.53:1 worst case); `ink.tertiary` is for large text, icons and rules, where it clears the 3:1 bar. Locked by `apps/mobile/src/theme/colors.contrast.test.ts`. | Every label, stat caption, verse reference, and inactive tab label. | Low — a usage rule, not a palette change. If the human instead lightens the token, one hex and a handful of asserted ratios move. |
| `Q-020` | AI spend guard hard ceiling: `ABSOLUTE_MAX_CEILING_USD` = $2.00 (no env var may exceed it), with defaults of $0.50 locally and $0.05 under CI. Meters on each response's `usage.cost`. See `packages/ai-guard/README.md`. | Every AI call in the project; how much of the budget an unattended loop can reach. | Low — raising the cap is a one-constant edit in `packages/ai-guard/src/config.ts`; the cost of being wrong low is a blocked pre-compute run, not lost work. |
| `Q-022` | A dropped chat stream keeps whatever text arrived and surfaces a Retry control. Nothing is re-sent automatically, so a flaky connection can never spend the budget twice without a tap. `/chat/stream` is stateless and cannot resume a partial completion, so "retry" always means a fresh model call. | The Ask tab and the reader chat's failure UX; how much a flaky network can cost. | Low — auto-retry is one call site in the streaming bubble's error branch, and the typed `ChatStreamError` codes already distinguish a retryable transport drop from a server refusal. |
| `Q-021` | The ten badge glyphs are **colour emoji** as a stopgap, which means `design-language.md` §5's "text and icon in the full hue" is knowingly violated on the icon — an emoji is painted by the OS and cannot be tinted. Recommendation queued: ten monochrome `react-native-svg` paths vendored in-repo. | `apps/mobile/src/components/InlineBadge.types.ts` (`badgeGlyph`); the look of every badge; the pill's width, because emoji metrics differ per platform. | Low — the glyph table is ten strings behind one function. But shipping emoji would break the "learn the badge types by colour" rule the design language rests on, so it must be settled before the reader screen is signed off. |
| `Q-024` | The reader ships **four** public-domain translations: **BSB, KJV, WEB, ASV** (124,372 verses, measured). **BSB is the default** — modern English, and the PRD's own stated launch preference; the choice of default is queued for the product owner and this is the recommendation taken meanwhile. The BSB's 2023 public-domain dedication is now **verified**, not assumed: berean.bible/terms.htm states it outright, quoted in `data/scripture/PROVENANCE.md`. `KJVPCE` is gone — the scrollmapper dataset behind it is corrupt (Joshua 15:1, Job 7:1, Hosea 8:1 and **Romans 8:1** are empty strings in every format it publishes), so the KJV now comes from eBible.org. **ESV is licensed, appears in the mockups, and must never ship.** | What the switcher offers; how archaic the default reading experience is; the API's `default_translation`, which moved from `KJVPCE` to `BSB`. | Low. Changing the default is one settings line. Adding a translation is one catalogue entry plus `pnpm db:seed`; every licence is recorded per translation in `data_sources`, so removing one is a delete, not an audit. |
| `Q-024` *(hub id — the device-id question; see the collision note below)* | The anonymous device id (`A-01`) is 32 hex characters behind an `atlas-` prefix, minted from `crypto.randomUUID` where it exists, `crypto.getRandomValues` where it does not, and **`Math.random` on a bare Hermes runtime with neither**. The weak path is reported, not hidden: `generateDeviceId` returns `quality: 'weak'`, so startup can act on it. The alternative — adding `expo-crypto` — is a dependency the fleet has been told to add only when needed, and the id is an assertion rather than a secret (the server's own `device_identity_resolver.py` says so). | Every request's `X-Atlas-Device-Id`; how guessable one reader's data scope is. | Low, and one file wide. If strong entropy is required everywhere, `apps/mobile/src/api/identity/device-id.ts` gains an `expo-crypto` import behind the same interface; already-minted ids stay valid because the server validates format, not provenance. |
| `B-04` | Migrations are **Alembic**, in `apps/api/db/versions/`, applied by the `migrate` compose service. The bespoke forward-only SQL runner at `infra/db/migrate.sh` was deleted — its own header named Alembic as the intended end state for this decision. Written as SQL inside `op.execute`, with no ORM models and no `--autogenerate`: the schema uses generated columns, GiST range indexes and pgvector opclasses SQLAlchemy cannot express. | Every schema change from here on; the one command that brings the stack up. | Low. Alembic's own migration files are plain Python calling SQL, so moving off it would mean re-running the same statements under a different runner, not rewriting them. |
| `Q-024` *(hub id; see the collision note below)* | Every interactive surface the walkthrough must reach carries a **stable `testID`** from the contract in `e2e/support/test-ids.ts` (~30 ids: shell, tabs, reader, translation switcher, reference picker, verse sheet, search, error state). The harness addresses elements by test id and never by visible copy, so a wording change cannot break a walkthrough and an icon-only control is still reachable. Accessibility roles and labels are a separate, later pass — the harness audits tap-target size and text legibility today, not the accessibility tree. | Every screen the three feature agents are building now; every assertion in `e2e/walkthrough/`. | Low. If the answer is roles-and-labels instead, the test ids become dead props and ~30 selectors change in one directory — the chapters, steps and audits are unaffected. |
| `Q-023` | The 300-line file limit (CLAUDE.md "Hard limits", rule 5.4.2) is read as applying to **source files**, not to Markdown. The five long documents written this session stay whole: `docs/architecture/hub-platform.md` (932), `docs/architecture/dataset-validation.md` (605), `tools/question-hub/README.md` (515), `docs/DEVELOPMENT.md` (451), `docs/architecture/spike-sse.md` (372) — alongside the pre-existing 760-line `flutter-port-map.md` the briefing already sanctions. Every source file in the repo is under the limit and stays under it. | Whether reference documents get split across many files. | Low, and reversible either way — splitting prose later is a mechanical edit plus cross-links; the risk of splitting now is a map that is harder to read than the territory. |

### Note on the `Q-024` id

Two different things are called `Q-024` in this repository. The Question Hub's `Q-024` is
the walkthrough's testID contract, queued on 2026-08-29 by the walkthrough harness — that
is the id the hub will answer. The `Q-024` cited above for the four public-domain
translations, and again in `DECISIONS.md`, was written by hand and was never queued, so no
hub question carries it. The hub owner should renumber one of them; until then, cite them
by subject rather than by number.

**Correction, same day, from the client API layer.** There are now *three* things called
`Q-024`, and the note above is no longer accurate about which one the hub holds. Measured
with `node tools/question-hub/answers.mjs --all`, the hub's single `Q-024` is
**"On a bare Hermes runtime with no WebCrypto, should the anonymous device id fall back to
`Math.random`…"** — queued by the client API layer on 2026-08-29. No hub question mentions
`testID` at all, so the walkthrough harness's contract was never queued either, exactly as
the paragraph above says of the translations row. Nothing has been renumbered here: two
agents wrote a hub id into this file before the hub had allocated it, and silently
reassigning ids in a shared log would be worse than recording the clash. **Cite all three
by subject.** The row for the device-id question is in the table above.
| `Q-024b` (theme default; the hub numbered it `Q-024`, which collides with the translations row above — cite it by subject) | **The first run opens dark, not "System".** `D-01` says dark by default and the design language is a dark cinematic canvas, but every desktop browser tested reports a light system scheme, so a switcher starting on `System` would mean most first-time web visitors never see the app as drawn. `System` remains one tap away in Settings and, once chosen, keeps tracking the OS live rather than freezing at launch. | `apps/mobile/src/theme/theme-preference.ts` (`DEFAULT_THEME_PREFERENCE`); what a reader sees on a cold start; walkthrough chapter 7, which asserts the default canvas is dark. | Low — one constant, plus one assertion in `theme-preference.test.ts`. |

| `R-01` (hub `Q-024`, attribution) | **The chapter footer prints the translation's full name, and nothing the API did not send.** `GET /translations` supplies `code`, `name`, `language` and `can_redistribute`; there is no attribution or licence string, and the client must never author one. `can_redistribute: false` renders as "Server-delivered only" — a restatement of the API's own flag, not a licence claim. When the endpoint grows an `attribution` field the footer prints it verbatim and nothing else changes. | `features/reader/components/ChapterFooter.tsx`, `TranslationSheet.tsx`. | Low — one field, one render site. |
| `R-02` (badge source) | **The reader's badge anchors come from a hook that returns nothing in M1.** `useVerseBadges` is the seam; M2 replaces its body with a query. `EXPO_PUBLIC_READER_BADGE_PREVIEW=1` seeds one synthetic Route badge so the inline rendering can be looked at in a real chapter — off by default, and deliberately incapable of growing into a content source (port-map risk #11). | `features/reader/hooks/use-verse-badges.ts`, `model/badge-preview.ts`. | None — deleting the preview is one file. |
| `R-03` (highlights) | **Verse highlights live in reader-local state, while the open verse lives in `@/stores`' reader store.** The open verse is read by more than the canvas, so one store owns it; the shared store has no highlight field, and highlights are server-persisted user data whose home is the sync model (`A-03`), not a client store. They are therefore in-memory and per-chapter until that lands. | `features/reader/hooks/use-verse-selection.ts`. | Low — moving the set into the store or the API is a change to one hook. |
| `R-04` (navigator rail width) | **Superseded by `Q-024`.** The desktop navigator rail no longer exists; the clamps in `layout.contextRail` now belong to the context rail alone. | `components/split/context-rail-mode.ts`. | None. |
| `Q-024` (which rail is pinned) | **The context panel gets the pinned rail; the navigator is a sheet at every width.** A 1280 dp window minus the 232 dp sidebar leaves 1048 dp, and a 340 dp book list *and* a 320 dp context rail *and* a 460 dp reading column do not fit. The context panel is pillar 2's delivery surface and is wanted on every screenful; the picker is used once a session and is one tap from the reference. Queued as `Q-024`. | `features/reader/components/NavigatorSurface.tsx`, `ReaderScreen.tsx`, `components/split/context-rail-mode.ts`. | Low — the navigator sheet and the rail are separate components, so swapping which one is pinned is a change to `ReaderScreen`. |
| `R-05` (tablet rail is fixed) | **Between 600 and 1099 dp the context rail is fixed-width, not draggable.** `Q-006` puts the rail in scope from 600 dp, and `e2e/support/viewports.ts` puts the *split* at 1100. A tablet therefore gets the rail and no divider: there is room for the context beside the scripture, and not enough room to let a drag make either pane unreadable. The reader pane's floor in this regime is `minReaderTablet` (360 dp, a phone's column) rather than `minReader` (460), which is what makes a 768 dp tablet qualify and a 600 dp one correctly refuse. | `components/split/context-rail-mode.ts` and its test. | Low — one arithmetic rule, tested at every boundary. |
| `R-06` (Bible tab is the reader) | **Tapping Bible opens scripture at the reader's last position, rather than a plan screen.** `e2e/walkthrough/03-reader.spec.ts` states the contract; a tab that dead-ends on a stub is no route into the product. The plan content that lived there has no home yet — it belongs on Home or in a plan screen reached deliberately. | `app/(tabs)/bible.tsx`, `app/(tabs)/read/`. | Low, but the plan copy is currently unrendered and should be re-homed. |

## Standing constraints (not assumptions — stated by the human)

- `A:\Work\gt\ControlSight` and `A:\Work\spark\spark-app` are **read-only**. Never modify.
- The OpenRouter key holds **$4.57** (measured). The **$2 ceiling is kept as a deliberate
  self-imposed cap** (`Q-020`, `ABSOLUTE_MAX_CEILING_USD`). Cheap open-weight models only;
  no large frontier models. Every call goes through the spend guard and cache.
- The end state is production-ready, verified by repeated click-through walkthroughs
  of the real UI, not by unit tests alone.
- **The Question Hub is a first-class second project**, not a throwaway tool. It is
  engineered, tested, and improved continuously to the same standard as the app.

## Resolved

Answered by the product owner on 2026-08-28. These are now **decisions**, not assumptions.

| Question | Decision | Change from the assumption |
|---|---|---|
| `P-01` | Whole-Bible reader shell + full multimodal depth only for Acts. | None — assumption confirmed. |
| `P-02` | Hybrid: the PRD's screens and visual language win; the Flutter app's reader/chat *behaviour* is the quality bar. | None — assumption confirmed. The port map's §7 "behaviours worth preserving" is therefore binding. |
| `D-01` | Dark cinematic by default. **Light mode must actually be built and shipped**, not merely made possible. | **Changed.** The assumption deferred light mode; it is now a real deliverable. Every component must be verified in both themes, and the walkthrough must cover both. |
| `T-01` | **Android device + Web.** | **Changed.** Web was assumed to be a testing convenience (`T-04`); it is now a first-class target. This rules out native-only libraries and doubles the UI QA surface. iOS is out of scope. |
| `B-01` | Keep FastAPI, restructured to the layering rules. | None — assumption confirmed. |
| `A-01` | Anonymous device id now, real accounts later. | None — but the port map's risk #9 stands: do not port the prototype's hardcoded `dev-user` stub. Build the identity seam properly. |
| `S-01` | Multiple open translations with a switcher. | None. ESV in the mockups is **not** licensed and must not ship; the reader chrome should show the active translation code generically. |
| `AI-01` | Pre-compute all 28 chapters of Acts (~$0.05). | None — assumption confirmed, now with measured costs behind it. |
| `M-01` | Custom stylised map from GeoJSON. **No tile provider, no Mapbox token.** | None. All route/city rendering must be self-contained; no runtime tile fetches. |
| `AU-01` | **Stubs.** Full player UI with a few hand-made sample tracks; no generation pipeline. | **Changed.** The assumption was open-TTS generation. Audio drops down the priority order; build the player UI and the seam, not the pipeline. |
| `W-01` | Take the recommendation, log the assumption, keep moving. **Plus**: the Question Hub becomes a first-class second project. | **Extended.** See the standing constraint above and `docs/architecture/hub-platform.md`. |
