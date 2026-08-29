# Rule 1 — SOLID Principles

All generated code **must** strictly adhere to the five SOLID principles. These apply regardless of paradigm (OOP, functional, procedural).

---

## 1.1 Single Responsibility Principle (SRP)

> *A module, class, or function should have one — and only one — reason to change.*

| # | Rule |
|---|------|
| 1.1.1 | Every function must do **exactly one thing**. If a function name requires the word "and", split it. |
| 1.1.2 | Every class/module must own **one cohesive area of responsibility**. |
| 1.1.3 | Side effects (I/O, logging, metrics) must be **separated** from pure business logic. |
| 1.1.4 | Configuration loading, validation, and usage must reside in **separate layers**. |

- **Do:** `UserValidator` validates. `UserRepository` persists.
- **Don't:** `UserManager` validates, persists, sends emails, and writes audit logs.

---

## 1.2 Open/Closed Principle (OCP)

> *Open for extension, closed for modification.*

| # | Rule |
|---|------|
| 1.2.1 | Use **abstractions** to define extension points. |
| 1.2.2 | Prefer **strategy/plugin patterns** over growing `if/else` or `switch` chains. |
| 1.2.3 | Prefer configuration-driven behaviour over hard-coded branches. |

- **Do:** `PaymentProcessor` interface → `StripeProcessor`, `PayPalProcessor` as implementations.
- **Don't:** Add another `elif payment_type == "paypal"` inside a 500-line function.

---

## 1.3 Liskov Substitution Principle (LSP)

> *Subtypes must be substitutable for their base types without altering correctness.*

| # | Rule |
|---|------|
| 1.3.1 | Subclasses must **honour the contract** (preconditions, postconditions, invariants) of their parent. |
| 1.3.2 | Never throw unexpected exceptions or return incompatible types in overridden methods. |
| 1.3.3 | Prefer **composition over inheritance** when the "is-a" relationship is not semantically accurate. |

- **Do:** `ReadOnlyRepository` does not inherit from `Repository` if `Repository` exposes `save()` / `delete()`.
- **Don't:** Override `save()` in `ReadOnlyRepository` to throw `NotImplementedError`.

---

## 1.4 Interface Segregation Principle (ISP)

> *Clients should not be forced to depend on interfaces they do not use.*

| # | Rule |
|---|------|
| 1.4.1 | Interfaces must be **small and role-specific**. |
| 1.4.2 | If a class leaves interface methods as no-ops or raises `NotImplementedError`, **split the interface**. |
| 1.4.3 | Favour multiple small interfaces over a single large one. |

- **Do:** Separate `Printer`, `Scanner`, `Faxer` interfaces.
- **Don't:** `IMultiFunctionDevice` with all three methods when most devices only print.

---

## 1.5 Dependency Inversion Principle (DIP)

> *High-level modules must not depend on low-level modules. Both should depend on abstractions.*

| # | Rule |
|---|------|
| 1.5.1 | All external dependencies (databases, APIs, file systems) must be accessed through **abstractions** (interfaces/ports). |
| 1.5.2 | Use **dependency injection** (constructor injection preferred). |
| 1.5.3 | Never instantiate infrastructure classes inside domain/business logic. |
| 1.5.4 | A **composition root** is the only place where concrete implementations are wired together. |

- **Do:** Inject `EmailService` interface into `OrderProcessor`; wire `SmtpEmailService` at the composition root.
- **Don't:** Call `new SmtpEmailService()` inside `OrderProcessor.process()`.
