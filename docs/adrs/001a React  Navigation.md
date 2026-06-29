# ADR-0009: Use React Navigation

## Status

Accepted

## Context

The application requires:

* Multiple navigation flows.
* Nested navigators.
* Modal screens.
* Future deep linking support.
* Explicit navigation configuration.

The development team already has experience with React Navigation.

## Decision

Use React Navigation as the navigation solution.

## Rationale

Benefits:

* Mature ecosystem.
* Excellent documentation.
* Explicit navigation architecture.
* Flexible nested navigators.
* Strong industry adoption.
* Familiarity within the team.

## Consequences

Positive:

* Easier onboarding for the team.
* Better understanding of navigation internals.
* Widely recognized in technical interviews.

Negative:

* More boilerplate than file-based routing.
* Manual deep-link configuration.

## Alternatives Considered

### Expo Router

Rejected because the team prefers explicit navigation configuration and already has React Navigation experience.
