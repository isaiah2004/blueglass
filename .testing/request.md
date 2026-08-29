---
id: protocol-smoke-test
title: Does the testing-branch protocol actually work end to end?
priority: high
needs: docker, walkthrough
---

## What I changed

Nothing. This branch exists only to prove the protocol works before anyone relies on it.

## What I want tested

1. The scanner sees this branch and reports it as waiting.
2. The backend comes up and serves real scripture.
3. The reporter writes a result back onto this branch without touching source.

## How I would know it worked

A `.testing/results/001-protocol-smoke-test.md` file appears on this branch, and
`.testing/STATUS.md` summarises it.
