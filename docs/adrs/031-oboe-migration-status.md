# Oboe Migration Status

**Project:** PulseGrid

**Last Updated:** July 2026

---

# Goal

Replace Android SoundPool playback with an Oboe-based real-time audio engine while preserving the existing MetronomeEngine scheduler.

The scheduler should remain responsible for musical timing and beat generation.

Oboe should become responsible for sample-accurate audio rendering.

---

# Overall Architecture

Current design:

React Native
    ↓
NativeAudioModule
    ↓
MetronomeEngine
    ↓
ClickSoundPlayer
    ↓
SoundPoolClickPlayer
or
OboeClickPlayer
    ↓
JNI
    ↓
OboeEngine
    ↓
AudioRenderer
    ↓
SamplePlayer
    ↓
Oboe Audio Callback

---

# Migration Progress

## ✅ Phase 1 — Oboe Build Integration

Completed.

Implemented:

- Oboe dependency
- Prefab configuration
- CMake integration
- Native library builds successfully
- Native library packaged in Android app

No runtime changes.

---

## ✅ Phase 2 — OboeEngine Skeleton

Completed.

Implemented:

- initialize()
- shutdown()
- start()
- stop()

Maintains initialization/running state.

No audio output yet.

---

## ✅ Phase 3 — Oboe Stream Creation

Completed.

Stream configuration:

- Output
- LowLatency
- Exclusive
- Mono
- 16-bit PCM
- Device sample rate

Stream opens successfully.

---

## ✅ Phase 4 — Audio Callback

Completed.

Uses:

AudioStreamDataCallback

Current callback:

onAudioReady()

Audio callback owns rendering.

No Java scheduling inside callback.

---

## ✅ Phase 5 — AudioRenderer

Completed.

Responsibilities:

- render()
- mix active SamplePlayers
- clear output buffer

No metronome logic.

---

## ✅ Phase 6 — SamplePlayer

Completed.

Supports:

- load()
- start()
- stop()
- render()

Current behavior:

- embedded PCM playback
- one-shot playback
- automatic stop

---

## ✅ Phase 7 — Embedded PCM Samples

Completed.

Embedded at compile time.

Current samples:

- Accent
- Normal
- Subdivision

Loaded into:

AudioRenderer

No runtime WAV loading.

---

## ✅ Phase 8 — JNI Bridge

Completed.

JNI currently supports:

- initialize
- shutdown
- enqueueClick()

Debug self-test implemented.

---

## ✅ Phase 9 — OboeClickPlayer

Completed.

Implements ClickPlayer interface.

Supports:

- initialize()
- release()
- playAccent()
- playNormal()
- playSubdivision()

Internally forwards to JNI.

---

## ✅ Phase 10 — Runtime Backend Switching

Completed.

ClickSoundPlayer now supports:

SoundPool backend

or

Oboe backend

Runtime configurable.

SoundPool and Oboe are mutually exclusive.

No dual playback.

---

## ✅ Phase 11 — Lock-Free Event Queue

Completed.

Current implementation:

Single Producer

↓

Single Consumer

↓

Lock-free ring buffer

Characteristics:

- fixed size
- no allocations
- no mutexes
- audio-thread safe

Producer:

Scheduler/JNI thread

Consumer:

Oboe callback thread

---

## ✅ Phase 12 — Queue Preservation

Completed.

Earlier implementation removed future events.

Current implementation:

peek()

↓

check timestamp

↓

only pop when event becomes due

Future events remain queued.

Required for predictive scheduling.

---

# Current Playback Pipeline

MetronomeEngine

↓

ClickSoundPlayer

↓

OboeClickPlayer

↓

JNI

↓

enqueueClick()

↓

ClickEventQueue

↓

Oboe callback

↓

AudioRenderer

↓

SamplePlayer

↓

PCM output

---

# Current Timing Model

Current scheduling is **reactive**.

Scheduler fires.

↓

enqueueClick(System.nanoTime())

↓

Oboe callback receives event

↓

SamplePlayer starts at beginning of callback buffer.

Current timestamp represents enqueue time.

Not intended playback time.

---

# Current Event Queue Behavior

Queue stores:

ClickEvent

Containing:

- ClickType
- timestampNs

Queue preserves chronological order.

Future events remain queued until eligible.

Consumer checks:

event.timestampNs <= bufferEndTimeNs

before triggering playback.

---

# Predictive Scheduling Status

Status:

Partially implemented.

Implemented:

- event queue
- timestamp field
- future-event preservation

Missing:

Scheduler absolute beat deadline

↓

Oboe enqueue

↓

Frame offset computation

↓

Sample-accurate playback inside callback

Current playback still starts at frame zero of callback buffer.

---

# Remaining Work

## 1. Propagate Scheduler Deadline

Instead of:

System.nanoTime()

pass:

scheduledDeadlineNs

from MetronomeEngine.

---

## 2. Update ClickPlayer API

Current:

playAccent()

Future:

playAccent(timestampNs)

Same for:

- playNormal
- playSubdivision

---

## 3. JNI

Replace:

enqueueClick(type, System.nanoTime())

with:

enqueueClick(type, scheduledDeadlineNs)

---

## 4. Oboe Callback

Instead of:

play at frame 0

calculate:

frameOffset =
(event.timestampNs - bufferStartTimeNs)
× sampleRate

Clip into current buffer.

---

## 5. SamplePlayer

Support:

start(frameOffset)

instead of immediate playback.

---

## 6. Renderer

Render silence before frameOffset.

Render sample beginning exactly at frameOffset.

---

## 7. Remove SoundPool

Once timing is validated:

ClickSoundPlayer

↓

OboeClickPlayer

only.

---

# Current Production Status

Android playback can use:

- SoundPool
- Oboe

Scheduler is unchanged.

React Native is unchanged.

MetronomeEngine remains authoritative for musical timing.

Oboe currently provides significantly smoother playback than SoundPool at high subdivision rates, but playback is not yet sample-accurate because events begin at callback boundaries rather than exact frame offsets.

---

# Important Design Principles

MetronomeEngine owns musical time.

Oboe owns audio rendering.

The audio callback never performs scheduling.

The scheduler never renders audio.

No locks on the audio thread.

No heap allocation on the audio thread.

No Java timers.

No Java audio rendering.

---

# Key Files

## Kotlin

NativeAudioModule.kt

ClickSoundPlayer.kt

SoundPoolClickPlayer.kt

OboeClickPlayer.kt

MetronomeEngine.kt

---

## JNI

oboe_click_player_jni.cpp

oboe_jni.cpp

---

## Native

OboeEngine.h

OboeEngine.cpp

AudioRenderer.h

AudioRenderer.cpp

SamplePlayer.h

SamplePlayer.cpp

ClickEvent.h

ClickEventQueue.h

ClickSampleData.h

---

# Long-Term Target

MetronomeEngine computes future beat deadlines.

↓

Deadlines are passed unchanged into Oboe.

↓

Oboe callback schedules clicks at exact sample offsets within each audio buffer.

↓

Sample-accurate metronome playback with a stable, low-latency audio engine.
