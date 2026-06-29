# Quick Metronome (Phase 2)

## Overview

Quick Metronome is the first production feature of PulseGrid.

It provides a stable, sample-accurate metronome engine with:

- BPM control
- Time signature support
- Accent on first beat
- Start / Stop control
- Stable timing independent of UI rendering

This is NOT a UI feature.
This is an audio timing system.

---

# Architecture

## High-Level Flow

UI
↓
MetronomeService
↓
AudioScheduler
↓
AudioEngine
↓
Device Audio Output

---

# Core Rule

## NEVER use:

- setInterval
- setTimeout (for timing logic)
- requestAnimationFrame
- React lifecycle for timing

These are NOT accurate enough for audio timing.

---

# Design Principles

## 1. Separation of Concerns

- UI: user interaction only
- Service: orchestration
- Engine: timing logic
- Scheduler: audio scheduling
- AudioEngine: playback only

---

## 2. Deterministic Timing

Audio is scheduled ahead of time using a lookahead scheduler.

The system continuously schedules beats slightly ahead of playback time.

---

## 3. Audio Independence

Audio must NOT depend on UI state or Redux.

Once started, playback continues independently.

---

# Components

## 1. MetronomeService (Application Layer)

Responsibilities:
- start()
- stop()
- setBpm()
- setTimeSignature()

Does NOT compute timing.

---

## 2. MetronomeEngine (Domain Layer)

Responsibilities:
- BPM → beat duration conversion
- beat index calculation
- time signature logic (future extension)

Pure functions only.

---

## 3. AudioScheduler (Infrastructure Layer)

Responsibilities:
- maintain audio clock
- schedule beats ahead of time
- prevent drift
- call AudioEngine

Uses lookahead scheduling loop.

---

## 4. AudioEngine (Infrastructure Layer)

Responsibilities:
- play click sound
- play accent sound
- execute scheduled audio events

Initially mocked with console logs.
Later replaced with native audio engine.

---

# Scheduling Model

## Lookahead Strategy

Every 25ms:

1. Check current time
2. Schedule beats for next 200ms–500ms
3. Advance internal clock
4. Repeat

---

## Example

If BPM = 120:

- Beat interval = 500ms

Scheduler ensures:

Beat events are pre-scheduled before they occur.

---

# State Management Rules

## Redux:

- stores UI state only
- bpm
- isPlaying
- timeSignature

## Redux MUST NOT:

- schedule audio
- track beat timing
- control playback clock

---

# Audio Accuracy Goal

- No perceptible drift over 10+ minutes
- Stable timing under UI load
- Independent of render cycles

---

# Folder Structure

src/
 ├── domain/
 │    └── metronome/
 │         └── MetronomeEngine.ts
 │
 ├── application/
 │    └── services/
 │         └── MetronomeService.ts
 │
 ├── infrastructure/
 │    └── audio/
 │         ├── AudioScheduler.ts
 │         └── AudioEngine.ts
 │
 ├── presentation/
 │    └── screens/
 │         └── MetronomeScreen.tsx

---

# Success Criteria

- Start / Stop works reliably
- No timing drift over long sessions
- BPM changes do not break timing
- UI re-renders do not affect audio
- Audio continues even under UI stress