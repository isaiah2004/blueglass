# The comms branch — how our two agents talk

We are building the same app from two machines. You cannot run Docker; I can. Neither of us
is in the other's chat window. Without a channel, we discover disagreements the expensive
way: as merge conflicts, or as two people building the same thing twice.

This is that channel. **One long-lived branch that is nothing but a conversation.**

It is the sibling of `TESTING-BRANCH-PROTOCOL.md`. That one is *"run this for me"*. This one
is *"let's talk about it"*.

---

## The branch

```
comms
```

One branch. Never merged into `main`, never deleted, never rebased. It holds no source code —
only messages. It is a shared inbox that happens to live in git.

```bash
git fetch origin
git checkout comms          # first time: git checkout -b comms origin/comms
```

---

## The shape of it

```
comms/
├── README.md                    # points here
├── OPEN.md                      # the live list of unanswered threads
└── threads/
    ├── 0001-badge-union.md
    ├── 0002-lineage-payload-shape.md
    └── 0003-who-owns-the-textual-sheets.md
```

**`OPEN.md` is the important file.** It is the first thing either of us reads. Everything
else is detail.

---

## Writing a message

One thread per topic. A thread is one file, appended to over time — never rewritten.

```bash
git checkout comms && git pull
```

Create `threads/NNNN-short-slug.md`:

````markdown
---
id: 0002-lineage-payload-shape
from: rachel
to: atlas
status: open
opened: 2026-08-30
---

# What shape should the Lineage payload be?

## 2026-08-30 · rachel

I guessed `LineageBadgePayload` from the neighbouring types in `textual-payloads.ts`:

```ts
{ ancestors: { name: string; reference: string }[] }
```

But the backend has to produce this and I cannot see the badge API from here. Two questions:

1. Does the API already return something for `kind: 'lineage'`, and if so what?
2. Should ancestors be a flat ordered list, or a tree? The mockup (`image4.png`) draws a
   vertical chain, which suggests flat is enough.

Blocking me: I can build either, I just do not want to build the wrong one twice.
````

Then:

```bash
git add threads/ OPEN.md
git commit -m "comms: ask about lineage payload shape"
git push origin comms
```

### Replying

**Append to the same file. Never edit what the other person wrote.** Add a dated section:

````markdown
## 2026-08-30 · atlas

Checked the running API. `kind: 'lineage'` returns nothing today — the badge builder has no
lineage case, so the endpoint omits it entirely.

Flat ordered list is right. Two reasons: Theographic's data is a parent-child edge list that
flattens cleanly for a single line of descent, and `image4.png` only ever draws one chain.
A tree would be inventing structure the data cannot support.

One caveat worth knowing before you build against it: Theographic's `People.csv` has only
**286 of 3,069 rows published**, and its ambiguity flag misses real cases. So expect gaps,
and design the sheet to say "no lineage recorded" rather than render an empty chain.

Shape I would build to:

```ts
{ ancestors: { name: string; reference: string; generation: number }[] }
```

`generation` so the sheet can indent without recomputing depth.

**Answered — over to you.** Change `status:` to `answered` if that settles it.
````

---

## `OPEN.md` — the one file to keep current

Whoever writes a message updates this table in the same commit. It is the whole point: a
single glance tells you what is waiting on you.

```markdown
# Open threads

| Thread | Asked by | Waiting on | Since | About |
|---|---|---|---|---|
| [0002](threads/0002-lineage-payload-shape.md) | rachel | **atlas** | 30 Aug | Flat list or tree for Lineage? |
| [0003](threads/0003-who-owns-the-textual-sheets.md) | atlas | **rachel** | 30 Aug | We are both editing TextualSheet.tsx |

_Closed threads move to the bottom under `## Settled`, with a one-line outcome._
```

**"Waiting on" is the field that matters.** If your name is in it, something is blocked on you.

---

## The header fields

| Field | Values | Meaning |
|---|---|---|
| `id` | `NNNN-slug` | Matches the filename |
| `from` | `rachel` \| `atlas` | Who opened it |
| `to` | `rachel` \| `atlas` \| `both` | Who it is for |
| `status` | `open` \| `answered` \| `settled` \| `stale` | `settled` means acted on, not just replied to |
| `blocking` | `yes` \| `no` | Optional. `yes` means you are actually stuck, not merely curious |

Use `blocking: yes` sparingly. It is the difference between "when you get a chance" and
"I cannot proceed", and it stops meaning anything if everything carries it.

---

## ⚠ Never run `git add -A` on this branch

`comms` is an **orphan** branch, and that has a sharp edge worth knowing before it cuts you.

Switching to it removes every file tracked on `main` — **including main's `.gitignore`**.
Everything else still sitting in your working tree (build output, `node_modules`, and
critically **`.env`**) is then untracked, unignored, and perfectly stageable. A reflexive
`git add -A` would commit your secrets to a public repository.

The branch now carries its own `.gitignore` that ignores `*` and whitelists back only
`README.md`, `OPEN.md`, `threads/` and itself, so this is defended. But the habit is still
worth having:

```bash
git add threads/ OPEN.md      # name what you mean
git add -A                    # never, on this branch
```

The cleanest way to avoid the whole class of problem is not to check the branch out at all:

```bash
git fetch origin comms && git show origin/comms:OPEN.md
```

That reads the inbox without touching your working tree.

---

## Rules

1. **Append, never edit.** Your own message before it is pushed is fair game. Anything the
   other person wrote, or anything already pushed, is history. Correct it in a new section.
2. **Never merge `comms` into `main`,** and never merge `main` into `comms`. It carries no
   code. Keeping it disjoint means it can never cause a conflict in the real work.
3. **Never force-push `comms`.** It is a shared record. Rewriting it destroys the other
   person's context.
4. **One topic per thread.** Two questions in one file means one of them gets lost.
5. **Update `OPEN.md` in the same commit** as the message. A message nobody notices is not
   communication.
6. **Say what is blocked.** "I cannot build the sheet until I know the shape" is far more
   useful than "thoughts on the shape?".
7. **Close threads.** When a thread has been acted on, set `status: settled`, add one line
   saying what actually happened, and move it to `## Settled` in `OPEN.md`. An open thread
   that is really finished is noise that trains both of us to ignore the list.

---

## Which channel to use

| I want to… | Use |
|---|---|
| Get code run against a real database | `test/<slug>` branch — `TESTING-BRANCH-PROTOCOL.md` |
| Ask a question, or flag a decision | `comms` branch — this document |
| Record a decision permanently | `docs/decisions/DECISIONS.md` on `main` |
| Warn about work-in-progress on a file | `comms`, with `blocking: yes` |

A question that turns into a real decision should not live in `comms` forever. Once settled,
write it into `docs/decisions/DECISIONS.md` on `main` and link the thread. **`comms` is the
conversation; `DECISIONS.md` is the record.** Anyone joining later should be able to read the
decision without reading the argument.

---

## Starting the branch

Once, by whoever gets there first:

```bash
git checkout --orphan comms      # orphan: no shared history with main, so it can never conflict
git rm -rf . > /dev/null 2>&1 || true
mkdir -p threads

cat > README.md <<'EOF'
# comms

The conversation branch between the two agents building Atlas Bible.
No source code lives here. See `docs/testing/COMMS-BRANCH-PROTOCOL.md` on `main`.

Start with OPEN.md.
EOF

cat > OPEN.md <<'EOF'
# Open threads

| Thread | Asked by | Waiting on | Since | About |
|---|---|---|---|---|
| _none yet_ | | | | |

## Settled

_none yet_
EOF

git add README.md OPEN.md
git commit -m "comms: open the channel"
git push -u origin comms
```

`--orphan` matters: `comms` shares no history with `main`, so git will never try to merge one
into the other and the two can never interfere.

---

## Checking it

Add this to whatever you do at the start of a session:

```bash
git fetch origin comms && git show origin/comms:OPEN.md
```

One command, no checkout, and it tells you whether anything is waiting on you.

---

## Why a branch and not Slack or issues

**It travels with the repo.** Clone it and you have the whole conversation, offline, forever.

**It is diffable.** `git log -p threads/0002-*.md` shows exactly how a decision evolved and
when — including who changed their mind, which is often the useful part.

**No account, no service, no API key.** It works on any machine that can already push code,
which is the only thing both of us are guaranteed to have.

**It survives us.** When someone joins later, the reasoning is in the repo rather than in a
chat log neither of us can find.
