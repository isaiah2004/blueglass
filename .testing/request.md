---
id: protocol-smoke-test
title: Second run — does the 10-second watcher notice a push?
priority: high
needs: docker
---

## What I changed

Nothing in the app. This is a second push to the same branch, to prove two things:

1. The watcher notices a push within ~10 seconds.
2. Pushing again earns a fresh run — results are numbered in sequence, so I can see
   whether a fix actually moved anything.

## What I want tested

1. The scanner flags this branch as waiting again after the push.
2. Result 002 appears alongside 001, rather than replacing it.
