<!-- tested-commit: 743e481944f8c1e5204b43d10acfe96f86f750df -->

# Result 003 · protocol-smoke-test

**Verdict: PASS** — 4 of 4 checks passed.
Ran against commit `743e481944f8c1e5204b43d10acfe96f86f750df` on 2026-08-29T20:08:59Z.

> Third run — correcting a real bug the second run exposed

## Summary

Result 002 was written with an unexpanded shell variable as its commit, and the scanner accepted the branch as tested anyway because it substring-searched the body. Both ends are fixed and this run proves it. 002 is left in place, wrong, as evidence — results are append-only.

## Your checks

| # | What you asked | Result |
|---|---|---|
| 1 | A malformed commit sha is rejected before it can be written | ✅ pass — exits 1: commit must be a full 40-character sha |
| 2 | The scanner reads a declared marker, not a substring of the body | ✅ pass — corrupted 002 no longer satisfies the staleness check |
| 3 | The branch returned to waiting once 002 stopped counting | ✅ pass — scan exit 10, WAITING at 743e481 |
| 4 | The dirty-tree guard prevents cross-contamination | ✅ pass — refused to write while my own tool fixes were uncommitted |

## What I ran

### `node tools/test-runner/report.mjs bad.json`

exit code: `1`

```
[report] invalid result: commit must be a full 40-character sha, got: "$TIP"
```

### `node tools/test-runner/scan.mjs`

exit code: `10`

```
1 waiting — the corrupted result no longer falsely satisfies the check
```

## What I would fix first

1. Nothing outstanding. Found, fixed at both ends, and proven by this run.

---

_Written by the test machine. Your branch was not rebased, squashed or force-pushed;_
_this is an additive commit and only touches `.testing/`._
