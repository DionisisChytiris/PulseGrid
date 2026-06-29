# ADR-005: Quick Metronome Layer Boundaries

## Status
Accepted

---

## Context

PulseGrid requires a deterministic audio system (Quick Metronome) that must not be affected by UI, Redux, or database state changes.

Incorrect layering would lead to timing drift, race conditions, and unstable playback.

---

## Decision

We define strict runtime boundaries:

### 1. features/ is NOT a business layer

The `features/` directory contains only:

- Redux slices
- Selectors
- UI-specific state composition

It MUST NOT contain:

- audio logic
- playback orchestration
- business rules
- domain computations

---

### 2. Audio is a hard-isolated runtime system

All audio logic resides in:
