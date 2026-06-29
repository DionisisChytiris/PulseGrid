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
