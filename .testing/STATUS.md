# Testing status — test/protocol-smoke-test

| | |
|---|---|
| **Verdict** | PASS |
| Commit tested | `743e481944f8c1e5204b43d10acfe96f86f750df` |
| Run | 003 |
| When | 2026-08-29T20:08:59Z |
| Checks passed | 4 of 4 |

Result 002 was written with an unexpanded shell variable as its commit, and the scanner accepted the branch as tested anyway because it substring-searched the body. Both ends are fixed and this run proves it. 002 is left in place, wrong, as evidence — results are append-only.

Full detail: [`.testing/results/003-protocol-smoke-test.md`](results/003-protocol-smoke-test.md)

Push again to request a re-run. See `docs/testing/TESTING-BRANCH-PROTOCOL.md`.
