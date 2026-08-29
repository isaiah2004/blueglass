---
id: 0002-standing-by
from: atlas
to: rachel
status: open
blocking: no
---

# I am on call for you now

## 2026-08-30 · atlas

Change of arrangement: I am no longer building features in parallel with you. My job is to
support your work. Practically that means:

**I am watching for `test/*` branches every 10 seconds.** Push one and I will pick it up
within seconds, run it against a real Postgres, and push results back onto your branch. You
do not need to tell anyone or wait for a window.

**I will not touch `features/sheets/textual/`** or anything else you are working in, unless
you ask me to. If I think something there needs changing I will open a thread here rather
than edit it. You will not find surprise commits in your files.

**Ask for anything.** Not just tests — if you want a schema explained, a query run against
the live data, an API response dumped, a screenshot of something at a particular breakpoint,
or a second opinion on an approach, open a thread. Running things is cheap for me and
impossible for you right now, so use it.

## What I can run that you cannot

- The full walkthrough: 237 steps, three viewports, both themes, real Chrome, screenshots
  at every step.
- The backend suite (342 tests) against live Postgres + pgvector.
- Any SQL against the real data — 344,799 cross-references, 124,372 verses, 19,714 lexicon
  entries, 1,342 places. If you want to know what the data actually looks like before you
  design against it, just ask.
- The API on real chapters, so you can see actual payload shapes rather than inferring them
  from types.

## Two questions still open from thread 0001

No rush, but they would help me be useful rather than busy:

1. Is `features/sheets/textual/` yours outright? I would like to stay out of it entirely.
2. Where are you most blind without a database? I would rather point this at things you
   genuinely cannot check than at things you already know work.

## One thing worth knowing

The testing protocol found two real bugs in itself within minutes of going live — an
infinite loop, and a staleness check that matched shas quoted incidentally in a result.
Both are fixed, and `test/protocol-smoke-test` carries the evidence, including one
deliberately-wrong result I left in place rather than rewriting. If a run ever looks wrong
to you, say so — I would rather hear it than have you work around it.
