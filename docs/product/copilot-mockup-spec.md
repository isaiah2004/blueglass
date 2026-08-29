# Mockup → implementation spec, for Copilot

**Purpose.** `docs/product/mockups/*.png` are images; an AI coding agent cannot "see" them
as inputs to a prompt unless it has vision, and even then loses precision. This file is
the textual, unambiguous translation of every mockup into components, states and file
paths that already exist or need to exist in `apps/mobile`. Read `docs/product/
design-language.md` first for tokens (colour, type, motion) — this file does not repeat
those, only screen/component structure and behaviour.

Every section names the real path a component belongs at, following the existing
convention (`src/features/sheets/textual/<type>/<Type>Sheet.tsx` for badge sheets,
`app/(tabs)/<tab>.tsx` for tab screens). Where a component already exists, its path is a
citation, not a proposal.

---

## 1 · Global chrome (every screen)

- Header: brand lockup `ATLAS BIBLE` (serif small-caps) + `SEE. HEAR. UNDERSTAND.`
  (monospace cyan, ~9pt) on the left; a streak pill (`🔥 N-Day Streak`) and a circular
  profile avatar (36×36, gold ring when active) on the right. Journal tab renames the
  lockup to `ATLAS JOURNAL` and swaps the streak pill for a `Level N <Title>` badge.
- Five-tab bottom bar: Home · Bible · Discover · Studio · Journal. Active tab: icon in a
  glowing ring + label, both in that tab's accent hue. See `app/(tabs)/_layout.tsx`.

## 2 · Home tab (`app/(tabs)/index.tsx`) — mockups `image3.png` (left phone), `image10.png`

Current state: scaffold copy only. Needs, top to bottom:

1. **Today's Drop hero card.** Rounded 16pt card, dark image/gradient background (a
   dimmed static map render, not a live 3D view — that lives in the reader). Contents:
   `TODAY'S DROP` label → book/chapter title (`Acts 16`, large) → one-line subtitle
   (`Paul's Mission in Macedonia`) → gold-outlined pill CTA `▶ Play 90s Preview`.
2. **3-step habit checklist**, vertically stacked, connected by a dashed spine:
   1. `Listen to Overview` — subtitle `Audio · 3–5 min`.
   2. `Explore Context` — subtitle `Maps · Timeline · People`.
   3. `Reflect & Quiz` — subtitle `Deepen Understanding`.
   Each step: circular indicator (green check when done, gold outline ring when not,
   hollow/dashed for not-yet-reached) + title + subtitle. State comes from the daily
   completion model in `A-03`/`J-01` (sync), not local-only state.
3. **Quick-access carousel**, horizontal scroll, 3 frosted-glass cards (~120×140):
   `AI Podcast` (headphone icon, cyan) · `Chapter Brief` (bar-chart icon, green) ·
   `Flashcards` (card-stack icon, violet). Each links into the Studio tab's matching
   artifact.
4. **Progress footer**: a small sparkline of the last 7 days' completion on the left, a
   circular ring showing this week's % completion in the centre, a trophy icon + total
   badge/verse-mastery count on the right.

Data dependency: none of this can show real numbers until the streak/sync model exists
(`ROADMAP.md` M8). Build the component tree now with an explicit "no data yet" state per
`flutter-port-map.md §7.4` (loading/empty/error are three different screens) rather than
placeholder numbers baked into JSX.

## 3 · Bible tab / reading canvas (`app/(tabs)/read/[book]/[chapter].tsx`)

Already ✅ for the canvas itself and the Route/3D City, Word Root, Cross-Ref and History
sheets. Mockups `image1.png`, `image9.png` show the footer **badge summary list**:
every badge instance in the open chapter, repeated at the bottom as `[badge pill] · one-
line teaser · chevron`, so a reader who never taps mid-verse still gets every badge's
content in one linear list. Confirm this list exists before marking M5 done; if not, it
is a small addition to the existing reader screen, not a new module.

### 3a · Sheets still to build (all under `src/features/sheets/textual/` or a new
`src/features/sheets/spatial/` sibling, following `HistorySheet.tsx`'s pattern exactly:
`SheetHeading` + `SheetSection`s + `SourceStrip`/`CaveatNote` for the empty/low-confidence
state):

- **Lineage sheet** (`[🧬 Lineage]`, `image4.png`) — `src/features/sheets/textual/
  lineage/LineageSheet.tsx`. Vertical node-tree: circular portrait nodes connected by
  dashed gold lines, each node labelled with name + one-reference citation
  (`Genesis 12`, `Ruth 4`, `2 Samuel 7`...). A callout bubble may hang off one node
  (e.g. `King David` — 2–3 line summary + citation). A `Prophetic Fulfillment` card lists
  promise → fulfillment verse pairs with a checkmark each. Footer segmented control:
  `Tree View` / `Timeline` / `List View` / `Show All`. Data: Theographic People +
  `person_relations` (already vendored in `data/raw/theographic-bible-metadata`, per
  `ROADMAP.md` M4).
- **Manuscript sheet** (`[📜 Manuscript]`, `image8.png`) — `.../manuscript/
  ManuscriptSheet.tsx`. Left: pinch-zoomable high-res codex photo (e.g. Codex
  Sinaiticus) with `−`/magnifier/`+` controls. Right, stacked: a translation card (verse
  text in the active translation) and a manuscript-language card (Greek/Hebrew text +
  a `Literal Rendering` toggle). Below: a `Textual Variant Notes` 3-column strip
  (`Variant` / `Scribal Note` / `Translation Impact`, the last a 5-star confidence).
  Footer provenance chips: `Manuscript: <siglum> · Date` / `Script Type` / `Location`.
- **Structure / Chiasm sheet** (`[🌳 Structure]`, spec §3.2) — `.../structure/
  StructureSheet.tsx`. Colour-coded node graph, `A → B → C → B' → A'`, mirrored layout
  showing the literary symmetry; each node is tappable to the verse it names. No open
  dataset (per `data-inventory.md §6`) — content is LLM-generated with review or hand
  authored; render an explicit empty state when a passage has none, same pattern as
  `HistorySheet`'s `emptyTimelineCopy`.
- **Cultural sheet** (`[⚖ Cultural]`) — `.../cultural/CulturalSheet.tsx`. A short sourced
  note card (unfoldingWord `en_tn`/`en_tw`, Easton's/Smith's dictionary entries) plus a
  `Roman Legal Citizenship`-style checklist card seen in `image2.png`'s attached callout
  (icon + short bullet list of concrete entitlements/customs, each sourced).
- **Meditate sheet** (`[🧘 Meditate]`) — no mockup exists in the twelve; spec describes it
  only as "appears next to high-impact devotional or command verses." Build last; it is
  pure content authoring with no dataset, per `data-inventory.md §6`.
- **Studio Assistant / `[🎙 Context]` sheet** (`image11.png`) — `.../context/
  StudioAssistantSheet.tsx`. Top: dual-host audio card (`HOST A`/`HOST B` avatars either
  side of a waveform + transport controls + elapsed/remaining time). Below: a chat
  thread (`You` bubble right-aligned plain; `Studio Assistant` bubble left-aligned with
  cited source chips, e.g. `Source: Acts 16:14 ↗`) and a `Grounding Confidence: High/
  Medium/Low` shield strip with a `View Sources` link — **never render an answer without
  this strip** (pillar 3). Footer: 4 action tiles (`Chapter Brief`, `Create Flashcard`,
  `Study Guide`, `Related Maps`) + a text input `Ask anything about this passage…` with a
  mic button. This sheet is gated on M6 (grounded chat / pgvector RAG) — do not wire it to
  a live model until the RAG relevance defect (`ROADMAP.md` M3 item 3) has a real fix in
  place, since a wrong-but-confident citation is worse than no sheet.

### 3b · Spatial sheet variants already partially built (`src/features/sheets/spatial/`)
`image1.png`'s Route/3D City sheet already ships a segmented sub-nav (`Route Map` /
`Elevation` / `Journey Timeline`), a 3D terrain view with glowing route + city pins, and
a stat strip (`125 Miles` / `Sea Level` / `2 Days`). Verify `Elevation` and `Journey
Timeline` sub-tabs exist before marking M5's spatial sheet complete — only the default
`Route Map` view is confirmed built as of this tracker's last update.

## 4 · Discover tab (`app/(tabs)/discover.tsx`) — mockup `image5.png`

Scaffold only. Three vertically-stacked cards below a search bar
(`Search 3D maps, world emperors, or topics...` + filter icon):

1. **3D Travel Routes** — free-roam map, cyan dashed sea routes / dotted land routes,
   gold "key stop" dots, city labels. Tapping any city opens the Bible tab at that verse
   (cross-app link, spec §3.2).
2. **Empire Timeline** — two vertical columns (`Roman Empire` emperors left, `Judea`
   kings right) against a shared central AD axis, connector dots at each entry's start
   year. This is the *canon-wide* browsing view of the same data `HistorySheet` shows
   per-passage — same source table, different presentation; do not duplicate the model.
3. **Literary Patterns** — a node tree, `Gospels` at the root fanning into `Matthew`/
   `Mark`/`Luke`/`John` leaf nodes (each tagged with its traditional symbol: King/
   Servant/Man/Son of God), with a `Shared Content ~60% Overlap` connector card.

## 5 · Studio tab (`app/(tabs)/studio.tsx`) — mockup `image12.png`

Scaffold only. Segmented toggle `Grounded Chat` / `Custom Notebooks` at the top. Hero
audio card: title + `BETA` badge, waveform, dual-host avatars + names, big centre play
button. 2×2 artifact grid: `Executive Briefings` (bar-chart icon) · `Visual Slide Decks`
(image icon, cover preview) · `Root Flashcards` (card-stack icon, live preview of a
saved word) · `Daily Quizzes` (`?` icon, live preview of a question). Footer: NotebookLM
attribution strip with a `Learn More` link — required by pillar 3, never omit it.

## 6 · Journal tab (`app/(tabs)/journal.tsx`) — mockup `image7.png`

Scaffold only, blocked on `J-01` (client-side encryption before sync — build the crypto
boundary before the UI reads or writes anything real). Structure once unblocked:

1. Header: `Level N <Title>` badge next to the avatar (e.g. `Level 3 Scholar`).
2. **This Week** card: a gold ring showing `N/7 Days Complete` + a row of 7 day-letter
   circles, checkmarked for completed days.
3. **Milestone Reward** card: a locked 3D asset preview image (dimmed until unlocked),
   `Unlock at N Days` label, asset name, and a progress bar with `N Days to Go`.
4. **My Reflections** feed: serif-text note cards, each with a header tag
   (`<Verse ref> - Note on <Subject>` in a pill) + timestamp + overflow menu, the note
   body in serif, and a footer row of like-count, save state, and topic pills
   (`#Faith #Hospitality #Salvation`).
5. **My Saved Resources** horizontal carousel: flashcard-deck and study-brief cards, each
   with a cover image, kind label (`FLASHCARDS`/`STUDY BRIEF`), title, and count
   (`48 Cards` / `12 pgs`).

## 7 · Cross-references back to product docs

- Colour/type/motion tokens: `docs/product/design-language.md`.
- Milestone sequencing and what blocks what: `docs/ROADMAP.md`.
- Which badges have real datasets vs. need content authoring: `docs/architecture/
  data-inventory.md §6`.
- The 6 rules every addition here must satisfy for canon-wide scale:
  `docs/PROGRESS_TRACKER.md` §3.
