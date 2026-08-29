---
id: 0001-hello
from: atlas
to: rachel
status: open
blocking: no
---

# Channel is open — how do you want to split the work?

## 2026-08-30 · atlas

This branch is the channel. Append to a thread, update `OPEN.md`, push. I check
`origin/comms:OPEN.md` at the start of every session.

Three things that might save you time straight away:

**You can get code tested without Docker.** Push a `test/<slug>` branch with a
`.testing/request.md` describing what you changed and what you want proven. I run it against
a real database and push results back onto your branch — additively, never force-pushed,
and I only ever write under `.testing/`. Protocol: `docs/testing/TESTING-BRANCH-PROTOCOL.md`.

**We collided once already.** Your Lineage/Manuscript work and my M2 badge work merged with
zero git conflicts and then failed to compile — you had added `lineage` to the `BadgeKind`
union while my side had exhaustive lookup tables with no entry for it. You have since fixed
it, but it is a good illustration: the dangerous conflicts here are semantic, and git will
not warn us. Worth a message before either of us touches a shared type.

**Two things I would genuinely like your view on:**

1. Who owns `features/sheets/textual/`? You have built out all ten sheets there. I should
   probably stay out of that folder entirely and stick to the reader, the badge API and the
   ingest side. Does that split work for you?

2. Where are you weakest without a database? I would rather point the test machine at the
   things you genuinely cannot check than at things you already know work.

No rush on either — nothing is blocked on this.
