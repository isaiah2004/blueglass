# Question Hub — the answering UI

The UX contract for `tools/question-hub/public/`. What the human sees, what every state
means, and what is deliberately absent. Implements §5 of
`docs/architecture/hub-platform.md`; that document wins if the two ever disagree.

Plain ES modules, no build step, no framework, no CDN. Adding a `.js` or `.css` file here
needs no server change — `lib/static.mjs` serves the whole directory by extension.

---

## 1. Modules

| File | Owns | Loaded |
|---|---|---|
| `index.html` | markup and module tags only | — |
| `app.css` | the whole stylesheet, incl. the four card states | `<link>` |
| `app.js` | bootstrap, load loop, long-poll, save + retry, event wiring | `<script type="module">` |
| `store.js` | staged-edit map, `localStorage`, merge-on-poll, conflict detection | static |
| `render-card.js` | one card: five kinds, Other, chips, note, consequence, conflict bar | static |
| `filters.js` | chips, search, leverage sort, section index, deep links | static |
| `progress.js` | header bar, section rings, collapse-when-complete, `↓ Next` | static |
| `status-board.js` | the fleet status view | static |
| `util.js` | `esc`, `mediaUrl`, `safeHref`, `debounce` | static |
| `render-attachments.js` | six attachment types + the strict markdown subset | **dynamic** |
| `lightbox.js` | full-screen `<dialog>` with pinch-zoom | **dynamic** |
| `accept-sheet.js` | the review sheet, staging, scoped undo toast | **dynamic** |
| `gestures.js` | swipe, keyboard map, shortcut overlay | **dynamic** |

`util.js` is not in the spec's file table. It exists so `esc()` has exactly one
implementation — a second copy of an HTML escaper is a future XSS hole.

### The hard rule, and how it is enforced

The four **dynamic** modules are `await import(...)`-ed inside individual `try/catch`
blocks in `app.js`. `render-card.js` receives its attachment renderers through
`setAttachmentRenderers()` rather than importing them, so a module that throws at import
time cannot take the card renderer down with it.

**Verified, not asserted:** with all three of `render-attachments.js`, `gestures.js` and
`accept-sheet.js` replaced by a bare `throw`, the page still rendered 97 cards, still
staged a pick and a typed answer, and still wrote three answers to disk. The console
carried one `[hub] … disabled` line per failure and nothing else.

---

## 2. The four card states

Colour is never the only signal — phone screens in sunlight, and greyscale verified.
Each state carries a **shape** cue (dashed vs solid) and a **mono word**.

| State | Option mark | Card | Chip |
|---|---|---|---|
| Open, recommended | **dashed** gold ring, hollow | hairline border | `RECOMMENDED` green mono on the option |
| Open, in use (`assumedInUse`) | dashed **cyan** ring | 2px cyan left rule | `IN USE` cyan |
| Staged this session | solid gold fill, `✓` | 3px **gold** left rule | `UNSAVED` gold |
| Answered, on disk | solid gold fill, `✓` | 55% opacity, 100% on focus/hover | `ANSWERED` green, or `ACCEPTED` gold when `source === "accepted-recommendation"` |

Also `BLOCKING` (cyan) and `RE-CHECK` (cyan, when `answerDetail.needsReview` — the
question was reworded after you answered it).

Gold means *you*. Cyan means *the fleet*. That mapping is never mixed.

---

## 3. The five kinds

| Kind | Interaction |
|---|---|
| `choice` | one option, or Other. Tapping the selected option on an **answered** question opens an inline `Clear this saved answer?` row rather than clearing. |
| `multi` | any number of options, plus Other, additively. |
| `rank` | **tap-to-rank**: tapping assigns the next number; tapping a numbered option clears it and renumbers the rest. Partial rankings are valid. No drag. |
| `text` | one textarea. |
| `scale` | 1–5 row. Deprecated for new asks; renders so old asks still work. |

`layout` is presentation only: `list` (default) · `compare` (2-up grid) · `swatch` (chip
grid). An unknown layout falls back to `list` and still renders.

### The Other escape

On by default for `choice`, `multi` and `rank`; opt out with `allowOther: false`.
A pill (`+ Something else`) that expands into one input — no vertical cost until wanted,
**never autofocused on load**. On `choice`, typing into Other deselects the picked option
live, and the flat answer becomes `Other: <text>` with `answerDetail.selected` empty.

### `scale` and the wire format

Everything is sent as `answerDetail` plus a derived flat `answer`. `scale` is the one
exception: its 1–5 labels are not entries in `options`, which the server rejects inside
`answerDetail`, so `scale` sends the flat `answer` alone and lets the server derive.

`source` is sent **at the top level of the batch entry as well as inside `answerDetail`** —
top level is where the server reads provenance from, and it is what later tells the fleet
that a bulk endorsement was not a deliberated decision.

---

## 4. Attachments

Six types (`image`, `swatches`, `compare`, `code`, `note`, `link`), rendered between `why`
and the options, or on a single option via `optionMeta[label].attachment`.

- Images sit in a fixed `aspect-ratio` box so **nothing shifts under a thumb mid-tap**,
  are `loading="lazy"`, and open a full-screen `<dialog>` with pinch-zoom, double-tap
  zoom and drag-to-pan on tap.
- When `navigator.connection.saveData` is set, every image renders as a
  `Tap to load image` placeholder **in the same reserved box**, and loads on deliberate tap.
- `note` renders a strict markdown subset — paragraphs, `**bold**`, `` `code` ``, `- `
  lists, `> ` quotes — applied to already-escaped text. There is no HTML path in;
  `<script>alert(1)</script>` renders as literal characters.
- `link` accepts `http:`/`https:` only. `javascript:`, `data:` and `file:` are dropped.
- An unknown `type`, a missing `alt`, or a `src` containing `..`, `\` or `%` renders a
  dimmed **unsupported attachment** placeholder and nothing else breaks.

An option that carries an attachment renders it **above** its option button, not inside
it: tapping the image opens the lightbox, tapping the labelled button picks the option.
Two unambiguous targets beat one overloaded one, and it avoids a button inside a button.

---

## 5. Accept all recommendations

Three entry points, all opening the same review sheet:

1. `Accept 6 ›` on the section header (the canonical control).
2. A thumb-reachable mirror in the sticky bar when that header scrolls out of view.
3. `Accept all N remaining` at the **bottom of the page** — deliberately a scroll away
   from Save.

The sheet shows one row per question: id, the question in one clamped line, and **the full
recommended answer text**, checkbox pre-checked. `IN USE` questions are grouped first with
a one-line note. A footer names what is excluded: *"3 questions here have no
recommendation — left for you."* Those are never bulk-answered.

**Accepting stages; it does not write.** A `6 accepted · Undo` toast stands for 8 seconds
and its Undo is scoped to exactly that batch — verified: accepting 7, then editing an
unrelated question, then tapping Undo left exactly the unrelated edit staged. Each staged
answer records `source: "accepted-recommendation"`.

Per-card fast paths that stage identically: the `Accept` affordance on the recommended
row, the `a` key, and a right-swipe.

---

## 6. Never losing an answer

1. Staged edits are mirrored to `localStorage` (debounced 300 ms, keyed by origin) and
   restored on load behind a `5 unsaved answers restored` banner.
2. `beforeunload` guards whenever anything is staged.
3. A poll never clobbers: merge is by id with pending always winning, and a re-render is
   **deferred until blur** while a text field inside the list has focus.
4. Cross-device conflict is surfaced, not resolved. If a question is answered elsewhere
   while staged here, the card grows a bar with **both** values and `Keep mine` /
   `Take theirs`.
5. Save retries at 1 s / 3 s / 9 s on network and 5xx failures and clears pending **only**
   for the ids the server returns in `saved`. A 4xx is never retried — it reports the
   server's own sentence and keeps everything staged.
6. Un-answering is explicit: `{ clear: true }`, behind an inline confirm row.
7. Note-only edits on an unanswered question are held back rather than sent, because the
   server ignores an entry with no answer. The status line says so instead of pretending.

---

## 7. Finding the right question among 85

- Chips: `Unanswered` (default) · `Blocking` · `In use` · `No recommendation` ·
  `Has images` · `Re-check` · `All` · `Fleet status`, plus a `Gestures` toggle.
- Plain case-insensitive substring search over id, question, why and section. No fuzzy
  matching.
- **Default sort is leverage, not insertion order:** blocking → in use → no
  recommendation → oldest. Skipped cards sink to the bottom of their section.
- Deep links: `#FX-01` scrolls to and flashes that card; `#section-9` opens that section.
- Tapping the header progress bar opens an 18-section index with `3/6` counts.
- Completed sections collapse to a single green row. The page gets visibly shorter.
- The header condenses on scroll — brand, search and sort note collapse, 251 px → 119 px —
  so the questions get the screen back.

---

## 8. Keyboard and touch

| Key | Action |
|---|---|
| `j` / `k` | next / previous card |
| `1`–`9` | pick option *n* on the focused card |
| `a` | accept the recommendation (focus stays on the card) |
| `Shift+A` | open the review sheet for that card's section |
| `o` | expand and focus Other |
| `n` | toggle the note box |
| `/` | focus search |
| `Ctrl`/`Cmd`+`S` | Save |
| `Esc` | close a sheet, or leave a field |
| `?` | the shortcut overlay |

All disabled while focus is inside a text field.

Touch: **swipe right = accept** (33% of card width, rubber-band resistance, a gold
`ACCEPT` label revealing progressively; disabled with no recommendation), **swipe left =
skip** (moves the card to the bottom for this session; nothing written). The `Gestures`
chip disables both, persisted in `localStorage`.

---

## 9. Accessibility

- Every interactive control is **≥ 44 px** tall; primary controls are 48 px. Verified by
  measuring every `button`, `input`, `textarea`, `a` and `summary` in the live DOM.
- The page never scrolls sideways at 375 px or 1280 px. Wide content (code blocks, the
  filter row) scrolls inside its own container.
- Every control has an accessible name; every form field has a `name`.
- No interactive element inside a `<summary>` — the section `Accept` control is a
  positioned sibling.
- `prefers-reduced-motion` collapses every animation and transition, and `↓ Next` and
  `j`/`k` scroll without smoothing.
- The four card states are distinguishable in a forced-greyscale render.
- Console is clean on load: no errors, no a11y issues, no 404s.

---

## 10. Deliberately absent

- **No drag-to-reorder.** `rank` is tap-to-rank. Drag is the hardest one-handed phone
  interaction and the most fragile thing in a Playwright suite.
- **No before/after slider** on `compare`. It is fiddly one-handed and hides half the
  evidence at any moment. Two images, always side by side.
- **No streaks, confetti or badges.** The product being built already owns that
  vocabulary; borrowing it here would be noise. Momentum is "fewer things left, visibly".
- **No destructive gesture.** No swipe-to-delete, no swipe-to-clear.
- **No autofocus on load.** An auto-raised keyboard hides half the question.
- **No syntax highlighting** in `code` attachments — it would cost a dependency.
- **No framework and no build step.** There is nothing here that can be stale.

---

## 11. Running the UI against test data

Never point a browser session at the live instance's data. Build a copy, start a second
instance on a port the test agent is not using (it owns 7788), and drive that:

```bash
HUB_PORT=7791 HUB_DATA_DIR=<a temp dir holding a copy> node tools/question-hub/server.mjs
```
