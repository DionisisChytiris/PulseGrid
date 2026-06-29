# Engineering Principles

## General Principles

1. Prefer simplicity.
2. Favor readability over cleverness.
3. Optimize for maintainability.
4. Business logic must be testable.
5. Every architectural decision must scale.

## SOLID Principles

The project follows SOLID principles.

## Separation of Concerns

UI:

Responsible only for presentation.

Services:

Responsible for business logic.

Repositories:

Responsible for data access.

Database:

Responsible for persistence.

## Rules

Components must never:

* Access SQLite directly.
* Schedule audio directly.
* Call native modules directly.

Reducers must remain pure.

All side effects belong in services or middleware.

## Code Quality

* Strict TypeScript mode enabled.
* ESLint enabled.
* Prettier enabled.
* Husky pre-commit hooks enabled.

## Documentation

All significant decisions require ADRs.
