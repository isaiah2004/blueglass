# Spike — inline badges inside flowing scripture

**Status:** complete. **Verdict: solved, with two concessions the design must make.**
**Date:** 2026-08-29 · **Owner:** inline-badge spike · **Route:** `/spike/badges`

Answers `flutter-port-map.md` §8 risk 4 — "the most likely place the design has to bend".

---

## 1. The question

Atlas Bible's premise is a small rounded pill sitting *inside* a line of scripture:

> So, setting sail from Troas `[🗺 Route]`, we made a direct voyage…

`design-language.md` §5 fixes what that pill is: 22–24 pt tall, ~8 pt horizontal padding,
a 1 px border in the badge's hue at 35 %, a fill of the same hue at 10 %, pill corners, and
it "must not disturb the scripture's line rhythm". Ten of them appear on one screen in
`docs/product/mockups/image9.png`.

The port map warned that React Native cannot do this: nested `<Text>` ignores
`borderRadius` on Android and padding is unreliable. That warning is **correct, and
understated** — see §3, strategy A.

## 2. Verdict

**Strategy B — a real `<View>` placed as a child of the verse's `<Text>` — works.** It is
shipped as `apps/mobile/src/components/InlineBadge.tsx`. Every visual requirement of §5 is
met, the pill wraps atomically, it does not disturb the line rhythm, and it is tappable.

**Both concessions are now closed.** See §11 — the reader screen shipped a vector glyph
(`Q-021`) and the square-highlight note stands as a rule for search highlighting, which is the
only place it applies. The rest of this section is the spike as it was written; read §11 for
what changed.

Two things the design must concede, both small:

1. **Colour emoji cannot take the badge's hue.** §5 says "text and icon in the full hue";
   the OS paints an emoji in its own palette and `color` does not touch it. Question
   `Q-021` is queued; the recommendation is ten monochrome SVG paths vendored in-repo.
   Until then the spike ships emoji and §5 is visibly violated on the icon.
2. **`backgroundColor` on a nested `<Text>` is a square, on every platform** — including
   iOS. Search-hit highlighting and the verse selection tint must therefore be designed as
   rectangles, not as rounded highlights. The port map's §7.3 note that "iOS honours this
   on nested Text" is wrong; see §5 below for the source that disproves it.

Not conceded, and worth stating because it was the feared outcome: the design does **not**
have to accept square badges on Android, and does **not** have to break the badge out of
the text flow.

## 3. The four strategies

| | Strategy | Shape correct? | Flows & wraps? | Verdict |
|---|---|---|---|---|
| **A** | Nested `<Text>` + `backgroundColor` | **No** on iOS/Android (square, no padding); yes on web but **splits at a line break** | Yes | Rejected for badges. Correct for square highlights. |
| **B** | `<View>` inside the `<Text>` | **Yes**, everywhere | Yes, atomically | **Recommended** |
| **C** | `react-native-svg` `<Rect rx>` inside an inline `<View>` | Yes | Yes (same mechanism as B) | Fallback only |
| **D** | `flexWrap` row, one `<Text>` per word | Yes | Yes, but the paragraph stops being text | Escape hatch |

### A — nested `<Text>` with `backgroundColor`

The obvious implementation, and the one that will fool anyone who tests on the web build
first. Observed on the spike screen at 430 px wide:

- Web: rounded, because `react-native-web` emits a `<span>` and CSS honours `border-radius`
  and `padding`. **But the pill is 14.4 px tall, not 23** — `padding` on an inline box does
  not grow the line box, so there is no vertical padding at all and the "pill" is a thin
  lozenge, already off-design.
- Web, at a line break: `getClientRects().length === 2`. CSS slices the inline box, so the
  badge renders as **two half-pills** — flat edge at the end of one line, flat edge at the
  start of the next. Two of the badges on the spike screen do this. See
  `spike-inline-badges/05-stress-strategy-a-split-pill.png`.
- iOS and Android: square, no padding at all (§5 below).

### B — a `<View>` inside the `<Text>` — recommended

React Native turns a view child of a `<Text>` into an inline attachment. It is still a real
view, so `borderRadius`, `borderWidth`, and padding are real. Measured on the web build:

| Property | Measured | Expected |
|---|---|---|
| `display` | `inline-flex` | flows inline, does not break the line |
| height | 23.0 px | `badgeGeometry('md').height` |
| `border-radius` | 11.5 px | half the height — a true pill |
| `border-width` | 1 px (declared) | `borderWidth.hairline` |
| `getClientRects()` | **1**, for all 22 pills on the screen | never splits at a wrap |
| scripture line pitch | **32 px on every line**, with and without a badge | `scriptureText('md').lineHeight` — rhythm undisturbed |
| pill bottom vs baseline | 4.38 px below | 4.4 px, the modelled overhang |
| tap | counter advanced; renders as `<button role="button" aria-label="[🌱 Tap me]">` | hit-testable and labelled |

### C — `react-native-svg`

Renders correctly and is visually indistinguishable from B at reading sizes (`rx="11.5"`,
`stroke="rgba(53,210,232,0.35)"` confirmed in the DOM). It is **not** a different layout
strategy — an `<Svg>` is a view, so it uses the same inline-attachment mechanism as B and
inherits all of B's risks. What it buys is control of the corner painting, which matters
only if Android's own border renderer seams or aliases the 1 px translucent stroke over the
translucent fill. What it costs is a measure pass: SVG has no intrinsic layout, so each
badge needs an `onLayout` round trip and a second render.

**Keep it in the tree as a fallback, use it only if Android's corners disappoint.**

### D — flex-wrap row of words

No text nesting at all: the verse becomes a `flexWrap: 'wrap'` row with one `<Text>` per
word and the badge as a sibling `<View>`, aligned by `alignItems: 'baseline'` (the one
alignment Yoga and CSS implement the same way). It renders correctly and identically
everywhere, and it is the guaranteed fallback if inline attachments turn out to be broken
on a target platform. Its costs are real:

- **The paragraph is no longer text.** No native selection, no copy, no find-in-page, no
  hyphenation or justification. Screen readers need the whole verse handed back as an
  `accessibilityLabel` (the component does this).
- **Spaces are approximated.** `columnGap` puts back a constant 0.25 em instead of the
  face's real advance width.
- **Punctuation detaches.** `Troas` `[Route]` `, we made…` tokenises to a bare `,` that the
  row then spaces away from its word. Visible on the spike screen. A production version
  needs a tokeniser that glues trailing punctuation to the preceding word;
  `InlineBadge.passage.test.ts` pins this deliberately so that test fails when someone
  writes one.
- **Node cost.** The same two verses cost **60 DOM nodes under D against 26 under B** —
  2.3×, and it scales with word count, not badge count.

## 4. The cross-platform trap, and the fix

The three platforms start the pill at **different heights**, and the difference is about
8 pt at the 20 pt reading size — a third of the pill.

- **Native (iOS and Android): the pill's bottom edge lands on the baseline.**
  `TextLayoutManager.kt:1303` computes
  `placeholderTopPosition = layout.getLineBaseline(line) - placeholderHeight`, under the
  comment "Vertically align the inline view to the baseline of the line of text".
  `TextInlineViewPlaceholderSpan.getSize` agrees, setting `fm.ascent = -height` and
  `fm.descent = 0`. On iOS, `RCTAttributedTextUtils.mm:365-372` builds an `NSTextAttachment`
  whose `bounds.origin.y` is the view's frame origin — the same rule.
- **Web: the pill's own label baseline lands on the text baseline.** `react-native-web`'s
  `View` applies `display: inline-flex` whenever it has a text ancestor
  (`exports/View/index.js`, `hasTextAncestor && styles.inline`), and CSS aligns an
  inline-flex box by its first flex item's baseline.

`InlineBadge.geometry.ts` closes the gap with a `translateY` — a transform, so correcting
the alignment can never reflow the paragraph. Both platforms are driven to the same target:
the pill's bottom edge sits `0.22 × scriptureSize` below the baseline, matching a serif
descender so the pill sits in the same optical band as the text.

**The transform must sit on the OUTERMOST node.** This spike found the bug the hard way: with
the nudge on the inner pill and a `Pressable` wrapping it, the *painted* pill moved but the
*hit box* did not — measured 3.62 pt of offset between what the reader sees and what they can
tap. Fixed; the browser now measures 0.00 pt between them.

## 5. Corrections to `flutter-port-map.md`

§7.3 says: *"nested `<Text>` with background + padding + `borderRadius` (iOS honours this on
nested Text; **Android does not**)"*.

**Neither platform honours it.** Read from React Native 0.86.3 in `node_modules`:

- **Android** — `TextLayoutManager.kt:236-347` is the complete list of spans a nested text
  fragment can produce: inline-view placeholder, link, clickable, foreground colour,
  `ReactBackgroundColorSpan`, opacity, letter-spacing, absolute size, custom style,
  underline, strikethrough, shadow, line-height, fragment index. There is **no radius span
  and no padding span**. `ReactBackgroundColorSpan` is a one-line subclass of
  `android.text.style.BackgroundColorSpan` — a hard-edged rectangle hugging the glyphs.
  `borderRadius` on a `<Text>` is handled only by `ReactTextViewManager.setBorderRadius`,
  which applies to the *root* text view; a nested fragment never reaches it.
- **iOS** — `RCTTextAttributes.mm:171-172` maps the colour to
  `NSBackgroundColorAttributeName`. TextKit fills a rectangle. There is no attribute for a
  radius or for padding, and nothing in `Libraries/Text/` sets one.

The mitigation the port map proposes is still right; only the platform attribution was wrong.

## 6. What is untested — Android

**Nothing in this spike ran on Android.** The web build is the only platform observed.

Why not: `adb devices` is empty, `~/.android/avd` holds no AVD, and the app has no `android/`
directory. Getting to Android pixels means `expo prebuild` + a Gradle build, which would
create `android/` and touch the dependency surface another agent owns. An
`android-35 google_apis_playstore x86_64` system image **is** installed at
`%LOCALAPPDATA%\Android\Sdk\system-images`, and `cmdline-tools/latest/bin/avdmanager.bat`
exists, so an AVD is creatable by whoever owns that decision.

The predictions above are read out of React Native's own Android and iOS source rather than
guessed, which makes them strong for *layout arithmetic* and weak for *Fabric bugs*. Check
these, in this order, the first time the app runs on a device:

1. **Does the pill render at all inside a `<Text>` under the New Architecture?** This is the
   single residual risk. Source says the placeholder span and the positioning code exist;
   only a device proves Fabric wires them up.
2. **Does `onPress` fire?** An inline view's touch target is positioned by the text layout,
   not by the normal view tree. If it does not fire, switch that badge to strategy D — the
   whole reason D is in the tree.
3. **Is the pill's bottom edge ~4.4 pt below the baseline at the 20 pt size?** If it sits
   flush on the baseline, `badgeBaselineOffset`'s native branch is not being applied.
4. **Does a wrapped verse show a badge overlapping the line above?** `CustomLineHeightSpan`
   pins the line to exactly `lineHeight` **in both directions** — it will not grow a line to
   fit a tall attachment, so an oversized pill overlaps rather than reflows.
   `fitsLineBox()` asserts the invariant that prevents this; if the check ever has to be
   relaxed, this is the failure it was guarding against.
5. **Do the corners and the 1 px translucent border render cleanly?** If they seam or alias,
   swap in `InlineBadgeSvg` — same layout, different painter.
6. **Two badges with no text between them.** `TextLayoutManager.kt:1268` runs
   `Assertions.assertCondition(placeholders.size == 1)`. Adjacent badges are not in the
   fixture; author one before trusting them.

## 7. How the numbers were measured

`pnpm web` on port 8099, Chrome driven over CDP at a 430 × 932 viewport, `/spike/badges`.
Geometry read with `getBoundingClientRect`, `getClientRects`, and `getComputedStyle`. The
scripture baseline was probed by inserting a hidden `font: inherit` span next to each badge
containing a zero-size `vertical-align: baseline` marker, and reading that marker's bottom.
Zero console errors or warnings on load.

The label-metric ratios in `InlineBadge.geometry.ts` (`LABEL_ASCENT_RATIO = 0.9`,
`LABEL_CONTENT_RATIO = 1.22`) were **fitted to that probe**, not assumed: the first model used
0.8 and predicted the pill 2.4 pt higher than it measured. `fitsLineBox` and the
"reproduces the browser measurement" test lock the corrected values.

**Re-measure both ratios once `expo-font` resolves the real UI face** (assumption `D-03`).
The spike ran on the system fallback, because no font files are vendored yet, and a
different face moves both numbers by a point or so.

## 8. Screenshots

In `docs/architecture/spike-inline-badges/`, all from the web build at 430 × 932:

| File | Shows |
|---|---|
| `01-strategy-b-recommended.png` | The tap test and the recommended strategy over Acts 16:11-13 |
| `02-strategy-a-nested-text-and-c-svg.png` | Strategy A's split pill and its missing vertical padding, next to C |
| `03-strategy-d-flow-row-and-size-ladder.png` | Strategy D's detached punctuation, and the size ladder |
| `04-stress-strategy-b-atomic-wrap.png` | Narrow column: every badge moves whole to the next line |
| `05-stress-strategy-a-split-pill.png` | The same column under A: `[📜` on one line, `Manuscript]` on the next |

## 9. Files

| File | What it is |
|---|---|
| `apps/mobile/src/components/InlineBadge.tsx` | **The component to use.** Strategy B. |
| `apps/mobile/src/components/InlineBadge.geometry.ts` | Pill size, the per-platform baseline nudge, `fitsLineBox`. Pure, tested. |
| `apps/mobile/src/components/InlineBadge.types.ts` | Props, the kind → glyph/label tables, the bracketed mark. Pure, tested. |
| `apps/mobile/src/components/InlineBadge.passage.ts` | Acts 16:11-15 (World English Bible, public domain) as annotated segments. Pure, tested. |
| `apps/mobile/src/components/InlineBadgeNestedText.tsx` | Strategy A. Keep for square highlights; do not use for badges. |
| `apps/mobile/src/components/InlineBadgeSvg.tsx` | Strategy C. Corner-quality fallback. |
| `apps/mobile/src/components/InlineBadgeFlowRow.tsx` | Strategy D. Escape hatch. |
| `apps/mobile/src/components/InlineBadgeVerse.tsx` | One verse rendered by a chosen strategy — the spike's controlled comparison. |
| `apps/mobile/src/components/InlineBadgeSpike.tsx` | The spike screen body. |
| `apps/mobile/app/spike/badges.tsx` | The route. Delete the directory when the reader screen lands. |

The fixture uses the **World English Bible** rather than the mockup's ESV: the ESV is under
copyright and must not enter the repository for the sake of a layout experiment (see
`ASSUMPTIONS.md`, `S-01`).

## 10. What the reader screen should do with this

1. Use `InlineBadge`. Place it as a direct child of the verse's `<Text>`, immediately after
   the annotated word, with that word tinted in the badge's hue (§5).
2. Do not wrap it in anything that could re-introduce the transform/hit-box split — if a new
   wrapper is added, the nudge moves out to it.
3. Never render `InlineBadge` inside a `<View>`. Outside a text ancestor it becomes a block
   and takes its own line. Use `InlineBadgeFlowRow` if a row layout is genuinely wanted, and
   pass `alignment="flexBaseline"`.
4. The chapter-end badge summary list (`image9.png`) is an ordinary card list, not this
   component's problem — it has no inline-flow constraint at all.
5. `packages/shared/src/badges/badge-kind.ts` and `apps/mobile/src/theme/theme-contract.ts`
   currently disagree about the badge enum: shared uses kebab-case and lists **eleven** kinds
   including `lineage`, the theme uses camelCase and lists **ten**. `InlineBadge` is built on
   the theme's. Whoever reconciles them (`Q-018`) changes `InlineBadge.types.ts`'s two tables
   with it — the component itself is indifferent.

---

## 11. What the reader screen did with it (M2, 0.16.0)

`apps/mobile/src/features/reader/badges/` wires the badge API into the reading canvas.
Everything §10 asked for was followed; two things it recorded as open are now closed, and one
new constraint appeared that only a real chapter could have shown.

### Concession 1 is closed — the glyph is a vector

`components/badge-icons.ts` holds ten monochrome outline paths on the same 24-unit grid as
`nav-icons.ts`, drawn by `components/BadgeGlyph.tsx` and stroked in the badge's own hue. §5's
"text and icon in the full hue" is now literally true. The bracketed mark that
`InlineBadge.types.ts` composes is therefore **text only** — `[Route]` — and a renderer places
the glyph between the opening bracket and the word. Anything asserting on the old emoji mark
had to change; `InlineBadge.types.test.ts` records the new shape.

### Concession 2 stands, and applies only where it always did

`backgroundColor` on a nested `<Text>` is still a rectangle everywhere. Nothing in the badge
path depends on it: search highlighting and the verse selection tint are the affected features
and both were designed as rectangles.

### A third constraint, found in a real chapter

**A tappable pill inside a tappable verse row is two nested controls.** React Native has no
rule against that; the web does. `react-native-web` renders anything with
`accessibilityRole="button"` as a real `<button>`, so the pill inside the row produced
`<button> cannot contain a nested <button>` on every chapter, and the dev LogBox banner sat
over the tab bar. Queued as `Q-024`; the recommendation taken is in `ASSUMPTIONS.md`:

- The **verse row** keeps its button role — it is the older, more general control, and its
  `aria-pressed` toggle semantics are what M1 built and tested.
- The **pill** keeps its label, its hit slop and its tap target on the web but not the role.
  The **chapter-end summary list is the keyboard-reachable route to every badge**, which is
  what `design-language.md` §5 built that list for.
- On native there is no DOM and no nesting rule, so the role stays and TalkBack announces a
  button.

A second, plainer bug came with it: without `stopPropagation` on the badge press, tapping a
pill opened the sheet **and** selected the verse under it. `VerseText.tsx` stops it, and
`InlineBadgeProps.onPress` now forwards the event so it can.

### The tap-target exemption, stated out loud

§5 fixes the pill at 22-24 pt. A 44 dp control cannot live inside a 32 px line, so the
walkthrough's tap audit exempts `[data-testid^="inline-badge-"]` — with three conditions
recorded in `e2e/support/probes-text.ts` that must all stay true: the pill carries a `hitSlop`
computed to reach 44 dp, every badge is repeated in the chapter-end summary at full row
height (WCAG 2.5.8's "Equivalent" exception), and the pill is 67-96 px wide — small on one
axis, not small.

### Measured in Chrome, Acts 16 in BSB

At 390 dp: twelve pills across five verses, line pitch unchanged, every row an exact multiple
of the scripture line height with and without pills, a pill that would overflow wrapping whole
to the next line. Tapping one opens a sheet over the bottom half with the scripture visible
above it. At 1440 dp the same body fills the context rail and no sheet is mounted. Both themes.
**Zero console errors**, and the full Playwright suite passes at all three viewports.

Still untested: Android. §6's six device checks remain open, and check 6 — two badges with no
text between them — is now reachable in real data, because the per-verse cap allows two pills
on one verse and Acts 16:1 has them.

### The enum disagreement §10 flagged

Unreconciled, and now bridged rather than resolved. `@atlas/shared` and the five sheet bodies
use the wire's kebab-case (`3d-city`, `cross-ref`); the theme uses camelCase and owns the hue,
the glyph and the label. `features/reader/badges/badge-kinds.ts` is the single tested mapping
between them. `Q-018` still decides which one wins; until it does, that file is the only place
that has to know there are two.
