# Rule 8 — Test-Driven Development

**TDD is mandatory for all production code.** Write tests before implementation — no exceptions.

---

## 8.1 The TDD Cycle

1. **Red** — Write a failing test that describes the desired behaviour.
2. **Green** — Write the minimum code to make the test pass.
3. **Refactor** — Clean up with tests green. Do not add features during refactor.

Never write implementation code without a failing test that demands it.

---

## 8.2 Test Stack

| Layer | Framework |
|-------|-----------|
| Frontend unit/component | Vitest + React Testing Library |
| Frontend integration | Vitest + MSW (Mock Service Worker) |
| Backend unit | pytest |
| Backend integration | pytest + httpx (ASGI test client) |

---

## 8.3 What Must Be Tested

| # | Rule |
|---|------|
| 8.3.1 | Every React component must have tests for its render states and user interactions. |
| 8.3.2 | Every custom hook must have unit tests covering all state transitions. |
| 8.3.3 | Every API endpoint must have integration tests covering success and all error cases. |
| 8.3.4 | Every service function (frontend or backend) must have unit tests. |
| 8.3.5 | Every business rule (e.g. "RCM is required to begin processing") must have a named test. |

---

## 8.4 Test Quality Rules

| # | Rule |
|---|------|
| 8.4.1 | Tests must describe behaviour, not implementation. Use names like `"disables Begin Processing button when no RCM is uploaded"`. |
| 8.4.2 | No testing implementation details (internal state, private methods). Test the public interface. |
| 8.4.3 | Each test must have one clear assertion or a small group of related assertions. |
| 8.4.4 | Tests must be deterministic — no randomness, no time-dependence, no network calls without mocking. |
| 8.4.5 | Test structure: Arrange → Act → Assert. One blank line between each phase. |

---

## 8.5 Test File Location

Test files mirror source structure and live adjacent to the source file:

```
apps/frontend/
├── components/
│   ├── SessionHeader.tsx
│   └── SessionHeader.test.tsx      ← tests live next to source
├── lib/
│   ├── sessionStore.ts
│   └── sessionStore.test.ts
apps/backend/
├── routers/
│   ├── upload.py
│   └── test_upload.py              ← pytest convention
```

---

## 8.6 Coverage Requirements

| # | Rule |
|---|------|
| 8.6.1 | All business logic must have 100% branch coverage. |
| 8.6.2 | All API endpoints must have tests for every documented response code. |
| 8.6.3 | UI edge cases from the spec (e.g. duplicate file, RCM removal, two RCMs) must each have a named test. |
