# ADR-0003: Separate Audio Engine from UI

## Status

Accepted

## Context

Metronomes require highly accurate timing.

JavaScript timers are not sufficiently reliable for sample-accurate playback.

## Decision

Create a dedicated native audio engine separate from Redux and UI.

Architecture:

UI → Redux → Playback Service → Native Audio Engine

## Rationale

Audio scheduling should not depend on rendering performance.

## Consequences

Positive:

* Accurate timing.
* Better separation of concerns.

Negative:

* Increased complexity.

## Alternatives Considered

### Audio scheduling in React components

Rejected because rendering delays affect playback.

### Audio scheduling inside Redux reducers

Rejected because reducers must remain pure.
