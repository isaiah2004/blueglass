# Rule 7 — Logging & Observability

All production code **must** implement structured logging, meaningful metrics, and distributed tracing.

---

## 7.1 Logging Fundamentals

| # | Rule |
|---|------|
| 7.1.1 | All logs must be **structured** (JSON or key-value). No unstructured `print()` or string-concatenated messages. |
| 7.1.2 | Use a **logging framework** (Winston, Pino, Logback, Python `logging`, `slog`). Never use `console.log`/`print()` in production. |
| 7.1.3 | Every log entry must include: `timestamp` (ISO 8601, UTC), `level`, `message`, `service_name`, `trace_id`. |
| 7.1.4 | **Never log sensitive data**: passwords, tokens, API keys, credit card numbers, PII. |
| 7.1.5 | In containerized environments, logs must go to **stdout/stderr**. |

---

## 7.2 Log Levels

| Level | When to Use |
|-------|------------|
| **FATAL / CRITICAL** | Application cannot continue — immediate intervention required. |
| **ERROR** | Operation failed unrecoverably. User/process was impacted. Triggers alerts. |
| **WARN** | Unexpected but system recovered or used a fallback. |
| **INFO** | Significant business/operational events — the normal heartbeat. |
| **DEBUG** | Detailed diagnostics for development/troubleshooting. Disabled in production by default. |
| **TRACE** | Very fine-grained. Rarely enabled even in development. |

| # | Rule |
|---|------|
| 7.2.1 | **Production log level defaults to INFO.** DEBUG/TRACE disabled unless temporarily enabled. |
| 7.2.2 | **ERROR logs must be actionable.** If nobody needs to act, it's not an error. |
| 7.2.3 | **Do not log expected conditions as errors.** Wrong password = INFO/WARN, not ERROR. |
| 7.2.4 | Log level must be **configurable at runtime** without redeployment. |

---

## 7.3 Contextual Logging

| # | Rule |
|---|------|
| 7.3.1 | Every log within a request must include a **correlation ID** (`request_id` / `trace_id`) consistent across the full lifecycle. |
| 7.3.2 | Propagate correlation IDs **across service boundaries** via headers (`X-Request-Id`, `traceparent`). |
| 7.3.3 | Include **domain context** in logs: `user_id`, `order_id`, `tenant_id`, etc. |
| 7.3.4 | Use **scoped/child loggers** that automatically attach context. |

```
BAD:  logger.error("Something went wrong")
GOOD: logger.error({ message: "Payment charge failed after 3 retries", trace_id, order_id, user_id, error_code, retry_count: 3 })
```

---

## 7.4 Metrics & Monitoring

| # | Rule |
|---|------|
| 7.4.1 | Every service must expose `/health` (liveness) and `/ready` (readiness) endpoints. |
| 7.4.2 | Track **RED metrics**: Rate (req/s), Error rate (%), Duration (p50, p95, p99). |
| 7.4.3 | Track **USE metrics** for infrastructure: Utilization, Saturation, Errors. |
| 7.4.4 | Instrument **business-level metrics**: orders/min, sign-ups/hr, payment success rate. |
| 7.4.5 | Use **consistent naming with units** in metric names: `http_request_duration_seconds`. |
| 7.4.6 | Use **histograms** for latency, not averages. |

---

## 7.5 Distributed Tracing

| # | Rule |
|---|------|
| 7.5.1 | Implement **distributed tracing** (OpenTelemetry, Jaeger, Zipkin) for any multi-service system. |
| 7.5.2 | Every inbound request starts a **trace span**; every outbound call creates a **child span**. |
| 7.5.3 | Spans must include: operation name, duration, status, and relevant attributes. |
| 7.5.4 | **Propagate trace context** across all boundaries: HTTP headers, message queue metadata, background jobs. |

---

## 7.6 Alerting Rules

| # | Rule |
|---|------|
| 7.6.1 | Alerts must be based on **symptoms** (error rate > 5%), not causes (CPU > 80%). |
| 7.6.2 | Every alert must have a **runbook** linked in the alert definition. |
| 7.6.3 | Alerts must have **severity levels**: critical (page immediately), warning (investigate within hours), info (business hours). |
| 7.6.4 | **No alert fatigue.** If it fires frequently without action, tune or remove it. |
