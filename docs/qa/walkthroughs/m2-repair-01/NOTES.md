# M2 repair round 1 — 2026-08-29

The M2 adversarial walkthrough (`qa-m2-adversarial`) reported fourteen defects. This is the
round that closed them, and the run that proves it.

| | |
|---|---|
| Route driven | All fifteen chapters, phone 375 · tablet 768 · desktop 1280, both themes |
| Result | **153 tests — 147 passed, 0 failed, 6 skipped**, 377 screenshots |
| Evidence | `docs/qa/walkthroughs/m2-repair-01/` |
| Skips | Chapter 8 only, deliberately: it drives all three widths itself, so the tablet and phone projects would only repeat it |

The six skips are the same six that were skipped before the round; nothing was skipped to
make this pass.

## What the round fixed

Hardest first, which is the order they were worked in.

| # | Severity | Finding | Fix |
|---|---|---|---|
| 1 | blocker | Nothing mounted `BadgeSheetProvider`, so all five badges opened onto a pill, a reference, a teaser and a source list. The bodies existed and were reachable only from `/spike/*`. | `features/sheets/BadgeSheetHost.tsx` registers all five, mounted in `app/_layout.tsx`. Every body is drawn with `chrome="body"` so the chrome is not printed twice. |
| 2 | blocker | A cross-reference could not be followed: `BadgeSheetRenderer` passed no callback. | The renderer signature gained an `actions` argument; `BadgeSheetTarget` states the destination in the reader's own vocabulary; `ReaderScreen` resolves it. |
| 3 | major | The `[History]` teaser printed Murai's pericope title as fact (`Q-015`). | `badge-claim.ts` + `BadgeClaimMark`, applied to both surfaces that print a teaser. |
| 4 | major | Evidence chips were unbreakable lines running up to 472 px past the rail and clipped by an ancestor. | Chips shrink and wrap; verified in Chrome at all three widths across all five kinds. |
| 5 | minor | Each STEPBible attribution was printed four times per Root badge. | `badge-evidence.ts` drops a chip the attribution strip already prints. |
| 6 | minor | `verse_words` covers books 40–66 only, so Hebrew is unreachable. | **Recorded, not fixed** — `ASSUMPTIONS.md` `L-06`, the way `Q-016` records NT-only dating. |
| 7 | minor | `[3D City]` promised a model that cannot be licensed. | Relabelled `[Site]` (`Q-025`). |
| 8 | minor | An inland site map was a grey blob. | `geo/site-framing.ts` widens until twelve coastline vertices are in frame. |
| 9 | minor | `"Jerusalem - today Jerusalem"`. | The teaser prints a modern name only when it is a rename. |
| 10 | polish | `"to listen ro"` shipped as a sourced claim. | `domain/gloss.py` falls back to the same row's definition. |
| 11 | polish | A multi-verse cross-reference carried one verse of text. | Already handled by `targetNote`; unreachable until #1 was fixed, and verified here. |
| 12 | polish | Verse numbers and two badge hues are the same gold. | **Recorded, not fixed** — queued as `Q-026`; `design-language.md` contradicts itself. |
| 13 | polish | The tablet reading column fell to ~28 characters. | Gutter and type step now follow the reading pane's width, not the window's. 306 dp → 338 dp at a smaller step. |
| 14 | polish | The 0.16.0 changelog claimed widths never driven. | Corrected in place, with a note saying so. |

## Two defects found in the harness and the tools during the round

Both were reporting or writing something untrue, so both are recorded rather than quietly
patched.

- **`badgeSurfaceOverflow` measured clipped SVG geometry.** An SVG child reports its full
  geometric box regardless of the root that clips it, so the coastline path measured 967 px
  wide inside a 375 px sheet while rendering perfectly. Once the real chip overflow was
  fixed it was the *only* entry left, so a genuine regression would have arrived as one more
  line in a list already read as noise. `probes-layout.ts` had made the same exclusion for
  the same reason; the badge probe now matches it. The `<svg>` root is still measured.
- **The Question Hub handed out an id that was already taken.** `nextId` counted a prefix
  family and returned `count + 1`, which is only free when the family is contiguous and
  uniformly padded. It is neither, and `/api/ask` upserts by id, so two agents in a row were
  handed `Q-024` and each overwrote a question a human had already answered. The damaged
  question was restored verbatim from `data/snapshots/`; the allocator now reads the highest
  id in use; a regression test pins it. The hub was restarted and the fix verified live: the
  next `ask` landed on `Q-027`, where the old allocator would have returned the already-taken
  `Q-026`.

## What this run still does not prove

- **Hebrew and right-to-left.** Exercised only by the synthetic probe at
  `/spike/textual-sheets` (`L-06`). No badge in scripture can reach it.
- **The two spike routes.** `/spike/spatial-sheets` and `/spike/textual-sheets` are now
  redundant for the five shipped bodies — the reader renders them from live data. Their own
  headers say they should be deleted at that point. Left in place because the Hebrew probe
  and the unattributed-badge probe (`AI-05`) live there and have nowhere else to go yet.
- **Visual regression.** There is still no baseline; the 377 screenshots are for a human.
