Your next milestone (Audio Stage 1)
Goal

Replace:

TICK logs

with:

real click sounds

BUT keep everything else unchanged:

Redux stays
PlaybackService stays
Scheduler stays
NativeAudioBridge stays (as interface layer)

========================================
Step 1 — Define real audio contract
========================================
Ask Cursor:

Update the audio architecture to support real sound playback.

Do NOT introduce native code.

Create or update:

infrastructure/audio/IAudioEngine.ts

interface:

* initialize()
* start()
* stop()
* playAccentClick()
* playNormalClick()
* setTempo(bpm:number)

PlaybackService must depend ONLY on this interface.

NativeAudioBridge remains as a higher-level abstraction and should delegate to IAudioEngine.

No timing logic changes.

No setInterval / setTimeout for scheduling audio.

This step is only about enabling real sound playback in the app.




==============================================
Step 2 — Use Expo Audio (temporary engine)
==============================================
Ask Cursor:

Implement ExpoAudioEngine as a temporary audio backend.

Location:

infrastructure/audio/ExpoAudioEngine.ts

Requirements:

* Use expo-av or expo-audio (depending on project setup)

* Load two sound files:

  * accent click
  * normal click

* Implement:

  * playAccentClick()
  * playNormalClick()

No scheduling logic inside this class.

This class ONLY plays a single sound when called.

Do not use timers or intervals.

Ensure audio files are preloaded for low latency.


========================================
Step 3 — Wire it into PlaybackService
========================================
Ask Cursor:

Update PlaybackService to use ExpoAudioEngine through IAudioEngine.

Important:

* Scheduler still emits Tick events.
* PlaybackService decides when to call:

  * playAccentClick()
  * playNormalClick()

Do NOT move scheduling into audio engine.

Flow must remain:

RuntimeScheduler → Tick → PlaybackService → IAudioEngine → sound



=================================================
Step 4 — Connect Tick → sound (critical moment)
=================================================
Ask Cursor:

Modify PlaybackService to convert Tick events into audio playback.

Rules:

* If Tick.isAccent → playAccentClick()
* Else → playNormalClick()

Keep everything synchronous for now.

Do NOT introduce timing inside audio engine.

Do NOT use setInterval anywhere in audio layer.

The scheduler remains the only timing source.





Fix (still in Expo stage)

Before native audio, you must add audio warm-up + preloading strategy.



Step 1 — Preload both click sounds
Ask Cursor:
Update ExpoAudioEngine to preload audio properly.

Requirements:

* Load both accent and normal click sounds on app startup
* Ensure sounds are fully ready before playback starts
* Add a method:

  initialize()

Behavior:

* Must preload audio files using expo-av or expo-audio
* Must not wait for first Tick to load sounds
* Must be called once when app starts (App.ts or root provider)

Add a log:
"Audio engine initialized"

This step is critical to prevent first-beat delay.



Step 2 — Warm up audio BEFORE first tick
Ask Cursor:
Add audio warm-up in PlaybackService.

Before starting the scheduler:

* call audioEngine.initialize()
* optionally trigger silent play of both sounds once
  (to warm up Android audio pipeline)

Do NOT affect timing logic.

This ensures audio system is ready before Tick events begin.





Step 3 — Add "start delay compensation" (important for Android)
Ask Cursor:
Add a small playback delay compensation in PlaybackService.

When start() is called:

* wait ~100–200ms BEFORE starting RuntimeScheduler
* ensure audio engine is initialized first
* then start scheduler

This prevents first 2–3 ticks being dropped on Android.

This is a workaround for audio warm-up latency.

Do NOT change scheduling logic itself.




Why this works

You are separating:

Problem	Fix
audio not ready	preload + initialize
Android cold start	warm-up delay
first ticks lost	start delay buffer
Important truth (this is key)

Even after fixing this:

Expo audio will still NOT be:
sample accurate
perfectly in sync under load
immune to Android jitter

But it WILL be:

usable
stable for UI development
good enough for feature building
Why Android slows down over time

This is likely:

JS thread contention (UI + scheduler + audio calls)
garbage collection pauses
audio buffer drift in Expo layer

This is another reason your architecture choice (native later) is correct.

When you SHOULD move to native audio

You’re ready when:

✔ clicks are stable after warm-up fix
✔ UI feels synced
✔ no initial delay
✔ jitter is acceptable for prototyping

Then next step becomes:

Replace ExpoAudioEngine → NativeAudioEngine
One honest conclusion

What you’re seeing is NOT a design issue.

It’s exactly what happens when:

“correct architecture meets non-real-time audio system”

You’ve actually done the hard part right.



This is the point where it becomes clear: this is no longer a logic problem in your app.

Your scheduler is fine. Your architecture is fine. The symptom you’re describing is almost always:

⚠️ Android audio playback is being driven from the JS thread in a way it cannot sustain in real time.

iOS “looks fine” because AVAudioEngine is forgiving and better optimized. Android exposes the cracks.

What’s actually going wrong (Android)

Even with preloading, Expo audio on Android typically has:

1. JS-thread audio triggering

Every tick likely does something like:

JS receives Tick
JS calls play()
Bridge crosses to native
Android audio system queues playback

That round-trip is not deterministic under load.

2. GC + UI + scheduler contention

You now have 3 things happening at once:

Tick scheduler loop
Redux updates
React re-renders
Audio calls per tick

On Android this causes:

delayed audio calls
uneven scheduling
“slowing down” feel
3. Expo Audio limitation (important truth)

Even with perfect code:

Expo Audio is not a real-time audio scheduler
it is a media playback system

Metronomes need:

sample-accurate or near-sample-accurate scheduling

Expo Audio does not guarantee that.

Why iOS seems fine

iOS is:

more aggressive in buffering
lower audio latency stack
better thread prioritization for AVAudioEngine

So it “hides” the issue better.

But the architecture problem is still there.

The key diagnosis

If:

ticks are correct ✔
logs are correct ✔
UI is smooth ✔
Android audio drifts ❌

Then the issue is:

❗ You are scheduling audio from JavaScript instead of native audio timing

Real fix (no workaround anymore)

At this point, there is only one correct direction:

👉 Move audio scheduling out of JS completely

Not later. Now.

You already built the abstraction:

PlaybackService
    ↓
NativeAudioBridge

This is exactly where Android is breaking.

What you should do next (correct path)
Step 1 — Stop trying to fix Expo audio timing

Do NOT keep tweaking:

delays
warmups
intervals
buffering hacks

It won’t fully solve Android drift.

Step 2 — Move NativeAudioBridge to REAL native implementation

You are now at:

Phase where NativeAudioBridge must stop being a wrapper and become a real engine

Step 3 — Your real architecture should become:
UI
 ↓
Redux
 ↓
PlaybackService
 ↓
NativeAudioEngine (ANDROID + IOS)
     ↓
AudioTrack (Android)
AVAudioEngine (iOS)

No JS scheduling involved anymore.

Important decision point (Expo reality)

Since you're in Expo Managed, you now have 2 options:

Option A (temporary compromise — NOT recommended for metronome)
accept drift
stay in Expo Audio
continue building features

❌ You already hit its limit

Option B (correct for PulseGrid)

Move to:

npx expo prebuild

and use:

Android: AAudio or AudioTrack
iOS: AVAudioEngine

or Expo Dev Client + native module

✔ This is the correct path for metronome-grade timing

Hard truth (important)

What you're building is not:

an app that plays sounds

It is:

a real-time audio timing system

That requires native scheduling.

JS cannot reliably do this on Android.

What I recommend (clear path)
Step 1 (now)

Stop debugging Expo audio.

Step 2

Move NativeAudioBridge to real native module.

Step 3

Start with minimal proof:

“Play click on native request with zero drift”

NOT scheduling yet.

Step 4

Only after that:

move scheduler into native layer
remove JS timing dependency