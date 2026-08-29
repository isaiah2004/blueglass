# Quick-Reference Checklist

Use before submitting any generated code.

```
Implementation Planning & TDD
  [ ] Written plan exists before any implementation code (file-by-file, function-by-function)
  [ ] Tests written BEFORE the corresponding implementation
  [ ] Every component/hook/service has at least one test
  [ ] Every API endpoint has tests for success + all error response codes
  [ ] All spec edge cases (duplicate file, RCM removal, two RCMs, etc.) have named tests
  [ ] Tests describe behaviour, not implementation details

Repo layout & Styling (ControlSight-specific)
  [ ] ONE root package.json + ONE root requirements.txt — no Nx, no workspaces, no per-app manifests
  [ ] Frontend deps stay in the root package.json (built via `next build apps/frontend`)
  [ ] UI primitives use shadcn/ui — no raw HTML elements styled from scratch
  [ ] shadcn/ui components customised via cn() + className, not overridden from scratch
  [ ] Shared code extracted to libs/ when used by more than one app

SOLID Principles
  [ ] Every class/function has a single responsibility
  [ ] New features extend existing code rather than modifying it
  [ ] Subtypes are substitutable for their base types
  [ ] Interfaces are small and role-specific
  [ ] High-level modules depend on abstractions, not concretions

Naming Conventions
  [ ] All names are descriptive and intention-revealing
  [ ] Casing matches language/framework conventions consistently
  [ ] No abbreviations, generic names, or placeholder names
  [ ] Booleans read as yes/no questions
  [ ] Files, directories, and API endpoints follow convention table

README & Deployment
  [ ] README contains all 13 required sections
  [ ] Every environment variable is documented
  [ ] Deployment steps are copy-pasteable and complete
  [ ] Rollback procedure is documented
  [ ] Health check endpoints are specified

Documentation
  [ ] Every file has a module-level docstring
  [ ] Every public class and function has a docstring
  [ ] Parameters, returns, and exceptions are documented
  [ ] Inline comments explain WHY, not WHAT
  [ ] All TODOs include owner and issue reference
  [ ] Type annotations are complete and strict

Project Structure
  [ ] Clear architectural layers with one-way dependencies
  [ ] Domain layer has zero infrastructure imports
  [ ] Features are organized into self-contained modules
  [ ] No circular dependencies between modules
  [ ] No file exceeds 300 lines; no function exceeds 50 lines
  [ ] Test structure mirrors source structure
  [ ] Lock file is committed; dependencies are pinned

Error Handling & Resilience
  [ ] No empty catch/except blocks anywhere
  [ ] Specific exception types used, not generic Exception
  [ ] Errors wrapped with context when re-thrown
  [ ] Consistent error response schema across all API endpoints
  [ ] No internal details (stack traces, SQL) exposed in production
  [ ] Correct HTTP status codes used for each error category
  [ ] Timeouts configured on all external service calls
  [ ] Retries use exponential backoff with jitter and max attempts
  [ ] Circuit breakers protect against cascading failures
  [ ] State-modifying operations are idempotent or use idempotency keys
  [ ] Graceful shutdown handles SIGTERM correctly
  [ ] All external input validated at system boundaries
  [ ] All resources (connections, handles, streams) explicitly closed
  [ ] Connection pooling used for databases and HTTP clients

Logging & Observability
  [ ] All logs are structured (JSON/key-value), not plain strings
  [ ] Logging framework used — no console.log/print in production
  [ ] Every log includes timestamp, level, service_name, and trace_id
  [ ] No sensitive data (passwords, tokens, PII) in logs
  [ ] Log levels used consistently per the level definitions
  [ ] Production defaults to INFO level
  [ ] ERROR logs are actionable — not used for expected conditions
  [ ] Correlation ID propagated across the full request lifecycle
  [ ] Domain context (user_id, order_id) included in relevant logs
  [ ] Health check endpoints (/health, /ready) implemented
  [ ] RED metrics tracked (rate, error rate, duration percentiles)
  [ ] Business-level metrics instrumented
  [ ] Distributed tracing implemented for multi-service systems
  [ ] Trace context propagated across service boundaries
  [ ] Alerts based on symptoms, not causes
  [ ] Every alert has a linked runbook
```
