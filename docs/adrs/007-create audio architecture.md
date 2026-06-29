# Step 8 — Create the Audio Architecture (No Playback Implementation Yet)

Using ADR-0003 as the source of truth, create the audio infrastructure for PulseGrid without implementing playback.

## Objective

Set up the architecture that separates the UI, Redux, and audio engine.

The flow must be:

```
UI
    ↓
Redux
    ↓
PlaybackService
    ↓
NativeAudioBridge
    ↓
Platform Audio Engine
```

## Requirements

Create the following structure:

```
infrastructure/
    audio/
        NativeAudioBridge.ts
        types.ts
```

### NativeAudioBridge

Create a `NativeAudioBridge` interface (or abstract class) that defines the API the native audio engine will implement.

Include methods such as:

* initialize()
* start()
* stop()
* seek(position: number)
* setTempo(bpm: number)
* setLoop(enabled: boolean)
* dispose()

These methods should contain TODOs or throw "Not Implemented" errors. Do not implement playback.

### PlaybackService

Update or create `application/services/PlaybackService.ts`.

Its responsibility is to coordinate playback.

It may:

* start playback
* stop playback
* change tempo
* enable looping

It must communicate only with `NativeAudioBridge`.

It must not contain timing or audio scheduling logic.

### Important Constraints

Do **not** use:

* setInterval
* setTimeout
* requestAnimationFrame

for metronome scheduling.

Do **not** schedule clicks in JavaScript.

Redux must never schedule audio.

React components must never schedule audio.

The future native engine will be responsible for:

* sample-accurate scheduling
* clock management
* low-latency playback

Platform implementations will eventually use:

* Android: Oboe / AAudio
* iOS: AVAudioEngine / CoreAudio

For this step, focus only on creating the architecture and interfaces. Leave all playback methods as placeholders with clear TODO comments. 


error to avoid in the future....

 real timing bug

 Cause
The beat dots were driven by RuntimeScheduler, which used setInterval. That API fires “about every N ms” after each callback finishes, so small delays on the JS thread (Redux updates, React re-renders, animations) stack up over time. After a few bars the pulse drifts slower than a reference metronome.

The spring animation on the dots also added a bit of visual lag on each pulse, but the gradual slowdown was mainly from the timer.

Fix
RuntimeScheduler — Replaced setInterval with wall-clock scheduling:

Record when playback starts (startWallMs)
Schedule each tick at startWallMs + tickIndex × intervalMs
If the thread was busy, catch up missed ticks instead of falling behind
On BPM/subdivision change, re-anchor the clock without resetting beat position
BeatIndicators — Swapped the spring pulse for a short 60ms timing animation so the dot lights up closer to the actual tick.

Reload the app (Metro should hot-reload) and run it against your reference metronome again for 30–60 seconds. The dots should stay locked to tempo instead of creeping slow.

When you add audio later, it should use the native audio clock (as in your docs), not this JS scheduler — this fix is for the visual-only simulation path.
