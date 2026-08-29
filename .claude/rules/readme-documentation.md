# Rule 3 — README & Deployment Documentation

Every project **must** include a `README.md` at the repository root that is detailed enough for a deployment engineer with no prior context to set up, configure, deploy, and verify the application.

---

## 3.1 Required README Sections (in order)

1. **Project Title & Description** — one-line summary + 3–5 sentence paragraph (business problem, target users, approach).
2. **Table of Contents** — required for any README exceeding 100 lines.
3. **Architecture Overview** — high-level diagram (ASCII/Mermaid/image), list of services, databases, queues, third-party APIs.
4. **Technology Stack** — language/version, framework/version, databases, key libraries, infrastructure requirements.
5. **Prerequisites** — required software with minimum versions, required accounts/access, all environment variables (name, description, format, example — no actual secrets).
6. **Local Development Setup** — clone → install → env vars → database → run → verify (health check URL).
7. **Testing** — how to run unit, integration, and e2e tests; coverage reports; minimum thresholds.
8. **Deployment Guide**:
   - Build commands and artifact locations
   - Environment configuration and secrets management
   - Database migrations and rollback
   - Step-by-step deployment per environment (staging, production)
   - Infrastructure / IaC references
   - CI/CD pipeline overview
   - Health check endpoints (`/health`, `/ready`)
   - Rollback procedure
   - Monitoring & alerts
9. **API Documentation** — link to Swagger/OpenAPI/Postman, or endpoint summary table (method, path, description, auth).
10. **Project Structure** — directory tree with one-line descriptions.
11. **Contributing** — branch naming, commit format, PR process, code style/linting.
12. **Troubleshooting / FAQ** — common setup issues, known limitations.
13. **License** — type and link to `LICENSE` file.

---

## 3.2 README Quality Rules

| # | Rule |
|---|------|
| 3.2.1 | All commands must be **copy-pasteable**. No unexplained placeholder syntax. |
| 3.2.2 | Every environment variable must list: name, description, format, example, required/optional. |
| 3.2.3 | Version numbers must be **specific** (e.g., `Node.js >= 20.11.0`), not vague ("latest"). |
| 3.2.4 | The README must be kept **in sync** with the codebase. |
| 3.2.5 | Use code blocks with language identifiers for all commands and config examples. |
