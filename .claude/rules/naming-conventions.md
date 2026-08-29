# Rule 2 — Naming Conventions & Standards

All identifiers **must** follow internationally recognized naming conventions. Consistency is non-negotiable.

---

## 2.1 General Principles

| # | Rule |
|---|------|
| 2.1.1 | Names must be **descriptive and intention-revealing**. |
| 2.1.2 | Avoid **abbreviations** unless universally understood (`id`, `url`, `http`, `api`, `db`). |
| 2.1.3 | Avoid **generic names**: `data`, `info`, `item`, `temp`, `result`, `value`, `obj`. |
| 2.1.4 | Names must be in **English**. |
| 2.1.5 | Avoid **Hungarian notation** and type prefixes/suffixes (`strName`, `iCount`). |
| 2.1.6 | Boolean variables/functions must read as yes/no questions: `is_active`, `has_permission`, `can_retry`. |

---

## 2.2 Casing Conventions

| Element | Convention | Example |
|---------|-----------|---------|
| Classes / Types / Interfaces | `PascalCase` | `OrderService`, `IPaymentGateway` |
| Functions / Methods | `camelCase` (JS/TS/Java/Go) or `snake_case` (Python/Ruby/Rust) | `calculateTotal()` |
| Variables / Parameters | `camelCase` or `snake_case` (match language) | `orderCount` |
| Constants | `UPPER_SNAKE_CASE` | `MAX_RETRY_COUNT` |
| Enums | Type: `PascalCase`. Members: `UPPER_SNAKE_CASE` or `PascalCase` | `OrderStatus.PENDING` |
| Files — Classes/Components | `PascalCase` or `kebab-case` (match framework) | `OrderService.ts` |
| Files — Utilities/Helpers | `kebab-case` or `snake_case` | `date-utils.ts` |
| Directories | `kebab-case` or `snake_case` | `order-processing/` |
| Database Tables | `snake_case`, plural | `user_accounts`, `order_items` |
| Database Columns | `snake_case` | `created_at`, `first_name` |
| API Endpoints | `kebab-case`, plural nouns, no verbs | `/api/v1/order-items` |
| Environment Variables | `UPPER_SNAKE_CASE` | `DATABASE_URL` |
| CSS Classes | `kebab-case` or BEM | `nav-bar`, `card__title--active` |

---

## 2.3 Naming Patterns

| Pattern | When to Use | Example |
|---------|------------|---------|
| `verbNoun` | Functions that perform actions | `createOrder()`, `validateEmail()` |
| `Noun` | Classes representing entities | `Invoice`, `UserProfile` |
| `NounService` / `NounProcessor` | Classes performing operations | `PaymentProcessor` |
| `INoun` | Interfaces | `ILogger` |
| `NounRepository` | Data access layer | `UserRepository` |
| `NounController` | HTTP/API layer | `OrderController` |
| `NounMiddleware` | Cross-cutting concerns | `AuthMiddleware` |
| `useNoun` | React hooks | `useAuth()` |
| `NounFactory` | Object creation | `ConnectionFactory` |
| `NounDTO` / `NounSchema` | Data transfer / validation | `CreateOrderDTO` |

---

## 2.4 Anti-patterns

- `doStuff()`, `handleIt()`, `processData()` — vague, untestable names.
- `MyClass`, `MyService` — placeholder names must never ship.
- Single-letter variables outside loop indices or lambdas.
- Misleading names (e.g., `accountList` holding a `Map`).
- Inconsistent casing within the same project.
