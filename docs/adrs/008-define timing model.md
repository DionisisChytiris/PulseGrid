What you should do next (important)
Step 11 — Define the timing model (before native audio)

Before writing any native code, you need to decide:

“How does PulseGrid think about time?”

Because native audio engines don’t just “play clicks”—they need a schedule model.

Cursor step

Ask Cursor to do this:

Create the timing system design for PulseGrid inside the domain layer.

Do NOT implement native audio.

Create:

domain/timing/

Include:

1. BeatClock
2. Scheduler
3. TempoMap (or TempoState)
4. Tick event model

Requirements:

- No React, Redux, or native APIs
- No setInterval or setTimeout
- Pure TypeScript only

Define:

BeatClock:
- knows current BPM
- can convert beats → time (ms)
- can convert time → beats

Scheduler:
- accepts a tempo and time signature
- produces a sequence of "ticks" (events)
- supports start/stop abstraction (no real timers yet)

Tick event model:
- timestamp (logical, not real-time)
- beatIndex
- isAccent (true/false)

This is a design-only step. No real audio or timing execution.
Why this step matters

Right now your system is:

User → UI → Redux → PlaybackService → NativeAudioBridge (logs)

But a real metronome requires:

Tempo → time conversion model → scheduling strategy → audio engine

If you skip this, you’ll hit problems later like:

drift (clicks slowly go off beat)
jitter (uneven timing)
latency mismatch between iOS/Android
inability to support subdivisions or swing
What you're building here (conceptually)

You're defining:

1. BeatClock

“How does BPM translate into real time?”

2. Scheduler

“When should each click happen?”

3. Tick model

“What exactly is a ‘click’ in abstract terms?”

This is the brain of the metronome, independent of audio.