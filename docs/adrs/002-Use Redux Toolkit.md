# ADR-0002: Use Redux Toolkit

## Status

Accepted

## Context

Playback state, current song, settings, and subscription information are shared across multiple screens.

## Decision

Use Redux Toolkit for global state.

## Rationale

Redux Toolkit provides:

* Predictable state.
* DevTools support.
* Excellent TypeScript integration.
* Scalable architecture.

## Consequences

Positive:

* Easier debugging.
* Centralized state.

Negative:

* Additional boilerplate.

## Alternatives Considered

### React Context

Rejected because playback updates may cause unnecessary rerenders.

### Zustand

Rejected because Redux provides stronger conventions and tooling for long-term maintainability.
