# Rule 5 — Project Structure & Anti-Monolithic Design

Code must be **well-structured, modular, and anti-monolithic** with deliberate architectural layering.

## 5.0 Repo layout — plain multi-app repo (no Nx)

ControlSight is a **plain multi-app repo**, not an Nx workspace. There is ONE
root `package.json` (the only Node manifest) and ONE root `requirements.txt`
(the only Python manifest, shared by backend + worker in a single venv).

| # | Rule |
|---|------|
| 5.0.1 | Apps live in `apps/` (`apps/frontend`, `apps/backend`, `apps/worker`). Shared code lives in `libs/`. |
| 5.0.2 | The frontend has **no** `apps/frontend/package.json` — its deps live in the root `package.json` and it is built with `next build apps/frontend` (root scripts: `npm run build` / `npm start`). |
| 5.0.3 | Backend and worker share ONE Python venv built from the root `requirements.txt`. Do not reintroduce per-app `requirements.txt` files. |
| 5.0.4 | Run tasks via the root npm scripts (`npm run build`, `npm test`) or directly (`uvicorn`, `celery`, `pytest`, `alembic`). Do **not** add Nx, npm workspaces, or per-app `project.json`. |
| 5.0.5 | Shared libraries in `libs/` are pure-Python packages that are **imported, never pip-installed**. Each app puts them on `sys.path` itself — register a new library in `_SHARED_LIBS` in **both** `apps/backend/core/__init__.py` and `apps/worker/core/__init__.py`; that pair of lists is the source of truth, not an exported `PYTHONPATH` (PM2 snapshots the environment at spawn, so an export cannot be relied on). Extract shared code into `libs/` when used by more than one app. |

---

## 5.1 Architectural Layers

| Layer | Responsibility | Allowed Dependencies |
|-------|---------------|---------------------|
| **Presentation / API** | HTTP controllers, WebSocket handlers, CLI entry points, serialization. | Application layer only. |
| **Application / Use Cases** | Orchestration, transaction boundaries, input validation. | Domain layer and port interfaces. |
| **Domain / Core** | Business entities, value objects, domain events, business rules. | No external dependencies. Pure logic only. |
| **Infrastructure / Adapters** | Database, external APIs, file system, queues. | Implements port interfaces from Application/Domain. |
| **Configuration / Bootstrap** | DI wiring, env config, startup. | All layers (composition root). |

| # | Rule |
|---|------|
| 5.1.1 | **No layer may depend on a layer above it.** Dependencies flow inward only. |
| 5.1.2 | The **domain layer must have zero infrastructure imports**. No ORM decorators, HTTP libs, or framework annotations in domain entities. |
| 5.1.3 | Cross-cutting concerns (logging, auth, caching, metrics) must be **middleware, decorators, or interceptors** — not scattered in business logic. |

---

## 5.2 Reference Directory Structure

### Backend

```
project-root/
├── src/
│   ├── config/              # Environment config, DI container
│   ├── modules/             # Feature modules (bounded contexts)
│   │   └── orders/
│   │       ├── domain/          # Entities, value objects, domain services
│   │       ├── application/     # Use cases, DTOs, port interfaces
│   │       ├── infrastructure/  # Repositories, external clients, adapters
│   │       └── presentation/    # Controllers, routes
│   └── shared/              # Cross-module utilities, base classes
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── docs/
├── scripts/
├── .env.example
└── README.md
```

### Frontend (React/Vue/Angular)

```
project-root/
├── src/
│   ├── app/                 # Routing, providers, layout
│   ├── features/            # Feature modules
│   │   └── orders/
│   │       ├── components/
│   │       ├── hooks/
│   │       ├── services/
│   │       ├── stores/
│   │       ├── types/
│   │       └── index.ts     # Public API
│   └── shared/              # Reusable components, hooks, utils, types
└── README.md
```

---

## 5.3 Modularity Rules

| # | Rule |
|---|------|
| 5.3.1 | Each **feature/module must be self-contained** with its own layers. |
| 5.3.2 | Modules communicate through **well-defined interfaces** — never by reaching into another module's internals. |
| 5.3.3 | Each module must expose a **public API** (barrel/index file). Everything else is private. |
| 5.3.4 | **Shared code** lives in `shared/` or `common/`. Never import from another feature's internals. |
| 5.3.5 | Circular dependencies between modules are **strictly forbidden**. |

---

## 5.4 File Organization Rules

| # | Rule |
|---|------|
| 5.4.1 | **One class/component per file**. |
| 5.4.2 | **No file exceeds 300 lines.** Split if it does. |
| 5.4.3 | **No function exceeds 50 lines.** Extract sub-functions. |
| 5.4.4 | Group files by **feature**, not by type. |
| 5.4.5 | Test files must **mirror the source structure**. |
| 5.4.6 | Keep the **root directory clean** — only config files at root. |

---

## 5.5 Dependency Management

| # | Rule |
|---|------|
| 5.5.1 | Use and commit a **lock file** (`package-lock.json`, `poetry.lock`, `go.sum`). |
| 5.5.2 | Pin **exact versions** for production dependencies. |
| 5.5.3 | Do not introduce dependencies for trivial operations. |
| 5.5.4 | Separate **production** and **development** dependencies explicitly. |
