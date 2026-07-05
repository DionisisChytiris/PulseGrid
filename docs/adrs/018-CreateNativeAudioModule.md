PHASE 3 — Create Native Audio Module (core upgrade)

Now we replace your stub:

NativeAudioBridge (logs only)

with a real native module.

========================================
Step 5 — Create module (Cursor prompt)
========================================
Give Cursor this:

Create a React Native native module called NativeAudioModule.

It must support both iOS and Android.

Expose methods:

start()
stop()
setTempo(bpm: number)
playAccent()
playNormal()

Requirements:

No scheduling logic yet
Only trigger single click playback per call
Must be callable from JavaScript via NativeAudioBridge
Use React Native TurboModule or classic Native Module depending on setup
Keep implementation minimal for first version

Goal: verify JS → Native communication works.


PHASE 4 — Wire Native Bridge → Native Module (JS ↔ Native connection)
Goal

Make sure JavaScript can trigger native code.

No scheduling. No metronome logic. Just communication.

Cursor Prompt

Connect NativeAudioBridge to the native module implementation.

Objective

Enable JavaScript to call native audio functions through NativeAudioBridge.

Requirements

Update:

infrastructure/audio/NativeAudioBridge.ts

It must delegate ALL calls to NativeAudioModule (native layer).

Methods:

start()
stop()
playAccent()
playNormal()
setTempo(bpm: number)

Each method must:

call the corresponding native module function
log result for debugging

Ensure:

No scheduling logic exists here
No timers
No setInterval
No audio playback in JS

Goal:
When a button is pressed in UI → native function is triggered and logs appear from native side.

PHASE 5 — First Native Audio Success (single click test)
Goal

Prove native audio works (NO metronome yet).

You should hear:
👉 one click per button press

Cursor Prompt

Implement first native audio playback test.

Objective

When playAccent() or playNormal() is called from JavaScript, a real sound plays natively.

Requirements

Native module must:

Android
Use AudioTrack or SoundPool
Load two audio assets:
accent click
normal click
Play them instantly on request
iOS
Use AVAudioEngine or AVAudioPlayerNode
Preload two click sounds
Play immediately when called
Rules
No scheduling logic
No loops
No timing system
Only "play one sound per call"
Output

When user presses Start:

a click must be heard immediately
logs must confirm native execution

Goal:
Verify JS → Native → Audio path works reliably on both platforms.

PHASE 6 — Native Metronome Engine (real timing system)
Goal

Move ALL timing from JS → native layer.

JS only sends:

start
stop
tempo

Native engine handles:

scheduling
timing accuracy
drift correction
Cursor Prompt

Implement Native Metronome Engine.

Objective

Move all scheduling logic from JavaScript into native code.

Requirements

Create native metronome engine:

Android
Use AudioTrack or AAudio
Implement high-priority audio thread
Precompute click buffer
Schedule playback in native loop
iOS
Use AVAudioEngine
Use audio rendering callback or AVAudioPlayerNode scheduling
Maintain internal clock
Behavior

Engine must:

start(bpm)
stop()
updateTempo(bpm)

AND internally:

generate ticks
play clicks at correct intervals
handle drift correction
JS Changes

PlaybackService must ONLY:

call start/stop/setTempo
NOT handle ticks anymore
Rules
No setInterval in JS
No JS scheduler
No Tick-based audio in JS
Native is single source of timing truth

Goal:
Metronome runs even if JS thread is blocked.

PHASE 7 — Replace JS Scheduler (final architecture cleanup)
Goal

Remove JS timing completely.

JS becomes UI controller only.

Cursor Prompt

Remove JavaScript-based scheduling and fully delegate timing to native engine.

Objective

Eliminate RuntimeScheduler from audio responsibilities.

Requirements
Remove tick-based audio playback from JS
RuntimeScheduler remains ONLY for visual UI feedback (optional)
Native engine is sole timing authority
Update architecture:

UI
↓
Redux
↓
PlaybackService
↓
NativeAudioEngine (ONLY timing source)
↓
Audio output

Behavior
JS sends start(bpm)
Native engine schedules everything internally
JS receives optional tick callbacks ONLY for visuals
Rules
No JS audio timing
No JS scheduling loops
No audio decisions in Redux or services

Goal:
Fully native-timed metronome with deterministic playback.

Important advice (this will save you pain)
After Phase 5:

Do NOT rush Phase 6.

First confirm:

Android click latency is stable
iOS click timing is consistent
no drift in simple playback

Only then proceed.

If you want next step help

When you finish Phase 5, I can help you with:

Android AudioTrack low-latency setup (this is tricky)
iOS AVAudioEngine scheduling (clean but precise)
JSI vs Native Module decision (important for performance)
eliminating audio latency completely

Just tell me when Phase 5 is done.