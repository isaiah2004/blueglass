# Result 002 · protocol-smoke-test

**Verdict: PASS** — 2 of 2 checks passed.
Ran against commit `$TIP` on 2026-08-29T20:06:01Z.

> Second run — does the 10-second watcher notice a push?

## Summary

The watcher fired within ten seconds of the push, without anyone asking it to. The branch went back to waiting, and this is result 002 sitting alongside 001 rather than replacing it — so a re-run always shows whether a fix actually moved anything.

## Your checks

| # | What you asked | Result |
|---|---|---|
| 1 | The scanner flags this branch as waiting again after the push | ✅ pass — status=waiting at 743e481, with results=1 already recorded |
| 2 | Result 002 appears alongside 001, not replacing it | ✅ pass — sequence derived from existing files, so history is additive |

## What I ran

### `git ls-remote --heads origin refs/heads/test/*  (every 10s)`

exit code: `0`

```
ref sha changed -> TEST BRANCH CHANGED event raised
```

### `node tools/test-runner/scan.mjs`

exit code: `10`

```
[scan] 1 testing branch(es), 1 waiting
  WAITING  test/protocol-smoke-test  @743e481  [high]
```

### `curl http://localhost:8010/ready`

exit code: `0`

```
{"status":"ready","checks":{"database":"ok"}}
```

---

_Written by the test machine. Your branch was not rebased, squashed or force-pushed;_
_this is an additive commit and only touches `.testing/`._
