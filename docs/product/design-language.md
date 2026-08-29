# Atlas Bible — Design Language

Extracted from the twelve reference mockups in `docs/product/mockups/`.
This is the source of truth for the visual system until the token module supersedes it.

> **Status:** derived from mockups, pending confirmation of question `D-01`
> (dark cinematic vs. the prototype's warm-paper look). Treat as provisional.

---

## 1. Mockup index

| File | Screen | What it establishes |
|---|---|---|
| `image1.png` | Reader + Spatial sheet | Inline badges in scripture; glass sheet with 3D route map, segmented tabs, stat strip, sub-nav |
| `image2.png` | *(see file)* | — |
| `image3.png` | Three-up: Home / Reader / Audio player | Tab bar, Today's Drop hero, 3-step checklist, Atmosphere Mixer |
| `image4.png` | *(see file)* | — |
| `image5.png` | Discover | Search bar, 3D Travel Routes card, dual-axis Empire Timeline, Literary Patterns node graph |
| `image6.png` | Reader + Word Root sheet | Greek lemma, Strong's number, pronunciation, usage stats, examples, Save as Flashcard |
| `image7.png` | *(see file)* | — |
| `image8.png` | Reader + Manuscript sheet | Codex photo, translation-comparison cards, variant notes, provenance strip |
| `image9.png` | Reader (full) | **All 10 badge types in one view** + a badge summary list at the bottom of the chapter |
| `image10.png` | Home | Today's Drop, 3-step loop, quick-access media cards, progress sparkline + ring |
| `image11.png` | Reader + Studio Assistant sheet | Dual-host audio card, grounded chat with source chips, **Grounding Confidence** meter, action grid |
| `image12.png` | Studio tab | Grounded Chat / Custom Notebooks toggle, audio overview, 2×2 artifact grid |

---

## 2. Colour

Near-black canvas with a subtle blue cast. Two accents carry all meaning: **gold** for
the user's own journey (streaks, progress, primary actions, place names) and **cyan**
for the system's intelligence (AI, sources, analysis, navigation).

| Token | Value | Used for |
|---|---|---|
| `bg.canvas` | `#05070C` | App background |
| `bg.elevated` | `#0B1018` | Sheets, nav bar |
| `bg.card` | `#0E141E` | Cards |
| `bg.cardHover` | `#131B27` | Card top of gradient |
| `line.hairline` | `rgba(255,255,255,.08)` | Default border |
| `line.strong` | `rgba(255,255,255,.16)` | Emphasised border |
| `ink.primary` | `#E8EDF5` | Body text |
| `ink.secondary` | `#93A0B4` | Supporting text |
| `ink.tertiary` | `#5D6A7D` | Labels, metadata |
| `accent.gold` | `#F0B429` | Streaks, progress, primary CTA, place names, verse numbers |
| `accent.goldDim` | `#8A6414` | Gold borders at rest |
| `accent.cyan` | `#35D2E8` | AI, sources, navigation, analysis |
| `accent.cyanDim` | `#14606C` | Cyan borders at rest |
| `state.success` | `#34D399` | Completed steps |
| `state.danger` | `#F87171` | Errors |

**Badge accent per type** — each badge type owns a hue so the reader learns them by colour:

| Badge | Hue |
|---|---|
| Route | cyan |
| 3D City | gold |
| History | blue `#5B8DEF` |
| Manuscript | cyan |
| Cross-Ref | gold |
| Root | cyan |
| Structure | blue |
| Cultural | gold |
| Context | cyan |
| Meditate | violet `#A78BFA` |

Ambient depth comes from two large, very low-opacity radial gradients — gold from the
top-left, cyan from the top-right. Never a linear gradient across a surface.

---

## 3. Typography

Three families, strictly separated by role:

| Role | Family | Notes |
|---|---|---|
| **Scripture** | Classical serif | The reason the app feels like a Bible and not a dashboard. Generous line-height (~1.6), large size (19–21pt), never condensed. |
| **UI** | Geometric/neutral sans | Headings, labels, buttons, body copy. |
| **Metadata** | Monospace | Verse refs, Strong's numbers, dates, stat labels, section rules. Uppercase, wide tracking (`.14em`–`.18em`), small (9–11pt). |

The brand lockup is serif small-caps `ATLAS BIBLE` with a monospace cyan
`SEE. HEAR. UNDERSTAND.` beneath it at ~9pt.

Verse numbers are gold, monospace-ish, superscripted left of the text in a fixed gutter.

---

## 4. Surfaces & shape

- Corner radius: **14–16** on cards and sheets, **10–11** on controls, **999** on pills.
- Cards are a subtle vertical gradient (`bg.cardHover` → `bg.card`) with a 1px hairline —
  never a flat fill, never a drop shadow.
- Sheets cover the **bottom half** of the screen, have a grab handle, and let the
  scripture above stay partly visible. That visible scripture is the whole point of the
  interaction — never a full-screen modal.
- Glass effect is a heavy backdrop blur over an 86–92% opaque near-black. Not a
  light frosted look.

---

## 5. The inline badge

The signature component. A small pill sitting inline in the text flow, immediately after
the word it annotates.

- Bracketed label: `[🗺 Route]` — the brackets are part of the mark.
- 1px border in the badge's hue at ~35% opacity; background the same hue at ~10%.
- Text and icon in the full hue. Height ~22–24pt. Horizontal padding ~8pt.
- Must **not** disturb the scripture's line rhythm — it sits on the baseline and wraps
  with the text.
- The annotated word itself is tinted in the badge's hue.

At the bottom of a chapter, all badges in that chapter are repeated as a **summary list**:
badge pill on the left, a one-line teaser, a chevron (see `image9.png`). This is how a
reader who does not want to tap mid-verse still gets the context.

---

## 6. Motion

- Sheets: spring slide-up from the bottom, ~320ms, with the backdrop dimming in parallel.
- Route lines on maps: draw progressively, gold or cyan, with a soft glow.
- Streak completion: a fire animation plus haptic feedback.
- State transitions elsewhere: 150ms, no bounce.
- Respect `prefers-reduced-motion` — replace movement with a cross-fade.

---

## 7. Navigation

Five-tab bottom bar: **Home · Bible · Discover · Studio · Journal**.
The active tab's icon sits inside a glowing ring in that tab's accent colour, with the
label in the same hue. Inactive tabs are `ink.tertiary` outlines.

---

## 8. Non-negotiables

1. **Nothing floats over scripture** except a sheet the reader deliberately opened.
2. **Gold means "you", cyan means "the system".** Never mix the meanings.
3. **Every AI claim carries a visible source chip.** The Studio sheet shows a
   *Grounding Confidence* meter; a low-confidence answer must say so.
4. **Scripture is always the serif.** No exceptions, anywhere in the app.
5. **No raw hex values in components.** Reference a token, always.
