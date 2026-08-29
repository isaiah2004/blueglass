# Result 001 · protocol-smoke-test

**Verdict: PASS** — 3 of 3 checks passed.
Ran against commit `d7f4cce4e3c998d5263dce42b4194a537f2d906d` on 2026-08-29T20:00:03Z.

> Does the testing-branch protocol actually work end to end?

## Summary

The protocol works. The scanner found this branch and ranked it waiting, the backend came up and served real scripture, and this result reached the branch without touching a line of source.

## Your checks

| # | What you asked | Result |
|---|---|---|
| 1 | The scanner sees this branch and reports it as waiting | ✅ pass — exit 10, listed [high] first |
| 2 | The backend comes up and serves real scripture | ✅ pass — /ready ok; John 3:16 correct from KJV |
| 3 | The reporter writes a result back without touching source | ✅ pass — only .testing/ staged |

## What I ran

### `node tools/test-runner/scan.mjs`

exit code: `10`

```
[scan] 1 testing branch(es), 1 waiting
  WAITING  test/protocol-smoke-test  [high]
```

### `curl http://localhost:8010/ready`

exit code: `0`

```
{"status":"ready","checks":{"database":"ok"}}
```

### `curl http://localhost:8010/chapters/KJV/john/3`

exit code: `0`

```
John 3:16 -> For God so loved the world, that he gave his only begotten Son, that whosoever b
```

---

_Written by the test machine. Your branch was not rebased, squashed or force-pushed;_
_this is an additive commit and only touches `.testing/`._
