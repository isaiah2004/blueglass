# Rule 6 — Error Handling & Resilience

All code **must** handle errors explicitly, predictably, and gracefully.

---

## 6.1 General Principles

| # | Rule |
|---|------|
| 6.1.1 | **Never swallow exceptions silently.** Every `catch`/`except` must handle, re-throw, or log with context. Empty catch blocks are forbidden. |
| 6.1.2 | **Fail fast, fail loud.** Detect invalid state at system boundaries and reject immediately. |
| 6.1.3 | **Use specific exception types** — `OrderNotFoundException`, not `Exception("not found")`. |
| 6.1.4 | **Never use exceptions for control flow.** Use result types, optionals, or return codes for expected outcomes. |
| 6.1.5 | **Distinguish recoverable from unrecoverable errors.** Unrecoverable errors should crash the process cleanly. |

---

## 6.2 Error Propagation

| # | Rule |
|---|------|
| 6.2.1 | **Catch at the right level** — where there is enough context to respond meaningfully. |
| 6.2.2 | **Wrap and re-throw with context.** Never discard the original stack trace. |
| 6.2.3 | Each architectural layer must have a **top-level error handler** that catches unhandled exceptions. |
| 6.2.4 | **Map infrastructure errors to domain errors** at the adapter boundary. Business logic must never see `SqlException`. |

- **Do:** Catch `SqlException` in the repository and throw `PersistenceException("Failed to save order #123", cause=e)`.
- **Don't:** Let `SqlException` bubble to the controller, or catch it and log "something went wrong".

---

## 6.3 Error Response Standards

| # | Rule |
|---|------|
| 6.3.1 | All API error responses must follow a **consistent schema** across the entire application. |
| 6.3.2 | Include: `status` (HTTP code), `error_code` (machine-readable), `message` (human-readable), `details` (optional). |
| 6.3.3 | **Never expose internal details** (stack traces, SQL queries, file paths) in production. |
| 6.3.4 | Use **correct HTTP status codes**: `400` bad input, `401` unauthenticated, `403` unauthorized, `404` not found, `409` conflict, `422` validation, `429` rate limit, `500` unexpected. |

```json
{
  "status": 422,
  "error_code": "VALIDATION_FAILED",
  "message": "The request contains invalid fields.",
  "details": [{ "field": "email", "message": "Must be a valid email address.", "rejected_value": "not-an-email" }],
  "trace_id": "abc-123-def-456"
}
```

---

## 6.4 Resilience Patterns

| # | Rule |
|---|------|
| 6.4.1 | All calls to **external services** must have **timeouts**. No indefinite waits. |
| 6.4.2 | Implement **retries with exponential backoff and jitter**. Define a max retry count. Never retry non-idempotent operations without safeguards. |
| 6.4.3 | Use the **circuit breaker pattern** for dependencies that may become unavailable. |
| 6.4.4 | Define **fallback behaviour** for non-critical dependencies. |
| 6.4.5 | State-modifying operations must be **idempotent** or use idempotency keys. |
| 6.4.6 | Implement **graceful shutdown**: stop accepting new requests, finish in-flight work, release resources, then exit on `SIGTERM`. |

---

## 6.5 Input Validation

| # | Rule |
|---|------|
| 6.5.1 | **Validate all external input** at the system boundary (API controllers, message consumers, CLI handlers). |
| 6.5.2 | Use **schema validation** (Zod, Pydantic, class-validator). Avoid hand-written validation chains. |
| 6.5.3 | Return **all validation errors at once**, not one at a time. |
| 6.5.4 | **Sanitize inputs** — parameterized queries, output encoding, allowlists over blocklists. |

---

## 6.6 Resource Management

| # | Rule |
|---|------|
| 6.6.1 | All resources (DB connections, file handles, sockets) must be **explicitly closed** in `finally`, `using`, `with`, or equivalent. |
| 6.6.2 | Use **connection pooling** for databases and HTTP clients. Never open a new connection per request. |
| 6.6.3 | Set **pool size limits** and monitor pool exhaustion. |
