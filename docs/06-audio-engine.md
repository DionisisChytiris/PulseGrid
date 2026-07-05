# Audio Engine

## Goal

PulseGrid requires professional-grade metronome timing for complex meter, tempo changes, and long practice sessions.

Primary objective:

- Sample-accurate playback
- Stable timing over long sessions
- Offline operation
- Low latency
- Cross-platform implementation

---

# Architecture

```
Presentation (React Native)
        ↓
PlaybackService
        ↓
NativeAudioModule
        ↓
ClickSoundPlayer
        ↓
Platform ClickPlayer
```

Android:

```
OboeClickPlayer
        ↓
JNI
        ↓
OboeEngine
        ↓
ClickEventQueue (SPSC)
        ↓
AudioRenderer
        ↓
SamplePlayer
        ↓
Oboe callback
```

iOS (planned):

```
AVAudioEngineClickPlayer
```

---

# Scheduler

The scheduler owns musical time.

It computes:

- beat position
- bar position
- subdivision
- tempo
- scheduledDeadlineNs

The scheduler never renders audio.

---

# Oboe Engine

Current implementation

✅ Persistent audio stream

✅ Low latency mode

✅ Exclusive sharing mode

✅ Lock-free SPSC queue

✅ Embedded PCM click samples

✅ Audio callback rendering

✅ Runtime backend switching

---

# Click Pipeline

MetronomeEngine

↓

ClickSoundPlayer

↓

OboeClickPlayer

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

# Current Status

Completed

- Persistent Oboe stream
- Embedded PCM samples
- Callback rendering
- Exclusive routing
- Future events preserved in queue

Remaining

- Pass scheduledDeadlineNs into Oboe
- Predictive scheduling
- Frame-accurate rendering within callback buffer
- Remove SoundPool backend
- Implement AVAudioEngine backend

---

# Design Rules

Never use:

- setTimeout()
- setInterval()

JavaScript never schedules audio.

Redux never schedules audio.

The scheduler produces musical events.

The native engine renders audio.

The audio callback must:

- never allocate memory
- never lock
- never block
- never access React Native

All audio rendering occurs on the real-time audio thread.