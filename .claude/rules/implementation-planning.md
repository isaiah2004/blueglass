# Rule 9 — Implementation Planning

**Before writing any code, produce a detailed implementation plan.** No implementation without a plan.

---

## 9.1 The Planning Requirement

For every task or feature, write an implementation plan first. The plan must be:
- **File-by-file** — list every file that will be created or modified
- **Function-by-function** — for each file, list every function/component/class with its signature and purpose
- **Test-first** — list the tests that will be written before each implementation unit

The plan does not need to be a separate document — it can be a structured comment block or a response to the user before coding begins. But it must exist before the first line of implementation code is written.

---

## 9.2 Plan Format

For each task, the plan must include:

```
## Implementation Plan: [Feature Name]

### Files to create
- path/to/File.tsx
  - ComponentFoo(props: FooProps): JSX.Element — renders X, handles Y
  - Tests: renders correctly, handles empty state, handles error state

### Files to modify
- path/to/existing.ts
  - addBar(id: string): Promise<Bar> — adds bar to the store
  - Tests: returns bar on success, throws BarNotFoundError on missing id

### Sequence
1. Write tests for ComponentFoo
2. Implement ComponentFoo
3. Write tests for addBar
4. Implement addBar
```

---

## 9.3 Rules

| # | Rule |
|---|------|
| 9.3.1 | **Never start writing implementation code without a written plan.** |
| 9.3.2 | Every function in the plan must include its signature, purpose, and what tests will validate it. |
| 9.3.3 | The plan must list files in dependency order — dependencies planned before dependents. |
| 9.3.4 | If the plan changes during implementation, update the plan before continuing. |
| 9.3.5 | The plan is reviewed by the human before implementation begins for non-trivial tasks. |
