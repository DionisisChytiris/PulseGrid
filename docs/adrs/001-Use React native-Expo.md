# ADR-0001: Use React Native + Expo

## Status

Accepted

## Context

The application must support Android and iOS while maintaining a single codebase.

Requirements:

* Fast iteration.
* Cross-platform support.
* Small team.
* Shared business logic.

## Decision

Use React Native with Expo and TypeScript.

## Rationale

Benefits:

* Single codebase.
* Mature ecosystem.
* Strong TypeScript support.
* OTA updates.
* Excellent developer experience.

## Consequences

Positive:

* Faster delivery.
* Lower maintenance cost.

Negative:

* Some native functionality requires custom modules.

## Alternatives Considered

### Native Android + Native iOS

Rejected because development and maintenance costs are higher.

### Flutter

Rejected because the team has stronger React experience and React Native aligns better with future web expansion.
