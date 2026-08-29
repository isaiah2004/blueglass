# Rule 4 — Code Documentation

All code **must** be heavily documented. Documentation is a first-class deliverable.

---

## 4.1 Module / File-Level Documentation

Every source file must begin with a module-level docstring/comment block containing:

| Element | Required? |
|---------|-----------|
| Purpose | Yes — what this module does and why it exists |
| Key responsibilities | Yes — bulleted list |
| Dependencies | If non-obvious |
| Usage example | For libraries/utilities |
| Author / Team | Optional |

---

## 4.2 Class-Level Documentation

Every class must have a docstring with:

| Element | Required? |
|---------|-----------|
| Purpose | Yes |
| Responsibilities | Yes — what it owns and does *not* own |
| Usage example | For public APIs |
| Thread safety | If applicable |
| Design pattern | If applicable |

---

## 4.3 Function / Method-Level Documentation

Every public function/method must have a docstring with:

| Element | Required? |
|---------|-----------|
| Summary | Yes — one-line description |
| Parameters | Yes — name, type, description, default, constraints |
| Returns | Yes — type and description |
| Raises / Throws | Yes (if applicable) |
| Example | For public APIs |
| Side effects | If applicable |

Private/internal functions must be documented if logic is non-trivial (>10 lines or complex algorithms).

---

## 4.4 Inline Comments

| # | Rule |
|---|------|
| 4.4.1 | Comment the **why**, not the *what*. |
| 4.4.2 | Every **non-obvious business rule** must have a comment explaining the rule and its source. |
| 4.4.3 | Every workaround must use `// HACK:` or `// WORKAROUND:` with a link to the issue tracker. |
| 4.4.4 | Every `TODO` must include owner and ticket: `// TODO(username): Refactor once #1234 is resolved`. |
| 4.4.5 | **Magic numbers** must be named constants. If not self-explanatory, add a comment. |
| 4.4.6 | Complex algorithms or regex must have a **step-by-step explanation**. |

---

## 4.5 API Documentation

| # | Rule |
|---|------|
| 4.5.1 | All REST/GraphQL/gRPC endpoints must have OpenAPI/Swagger, GraphQL schema descriptions, or protobuf comments. |
| 4.5.2 | Every endpoint must document: method, path, description, params, request/response schema, auth, rate limits. |
| 4.5.3 | Every DTO/request/response model must have field-level descriptions. |
| 4.5.4 | API docs must include **example requests and responses** for every endpoint. |

---

## 4.6 Type Annotations

| # | Rule |
|---|------|
| 4.6.1 | All function signatures must include **complete type annotations**. |
| 4.6.2 | Use **strict type checking** (`strict: true` in TypeScript, `mypy --strict` in Python). |
| 4.6.3 | Avoid `any`, `object`, or equivalent catch-all types. |
| 4.6.4 | Complex types must have **named type aliases** with documentation. |
