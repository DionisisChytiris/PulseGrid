Predictive enqueue design: MetronomeEngine scheduling contract
This design replaces wait-then-enqueue with publish-ahead enqueue, while keeping MetronomeEngine as the musical scheduler and Oboe as the sole renderer. No code changes — design only.

1. Current scheduling loop analysis
MetronomeEngine runs on a dedicated HandlerThread (NativeMetronomeEngine). State:

State	Purpose
anchorTimeNs
Musical epoch (System.nanoTime() at start())
totalTickCount
Next tick index to fire (UI + audio today)
bpm, ticksPerBeat, accentPattern
Musical parameters
generation
Invalidates in-flight handler work on stop/restart
Lifecycle today
start()
  anchorTimeNs = nanoTime()
  firstTick = advanceTickLocked()     // sequence 0, totalTickCount → 1
  post → scheduleNextTickLocked()   // schedule tick 1
  dispatchTick(firstTick)           // audio + onTick for tick 0 — IMMEDIATE
scheduleNextTickLocked()
  deadline = anchor + tickOffset(totalTickCount)
  post {
    waitUntilDeadlineNs(deadline)   // BLOCKS until musical moment
    fireTick()
  }
fireTick()
  advanceTickLocked()               // compute next snapshot
  scheduleNextTickLocked()          // chain next wait
  dispatchTick(snapshot)            // audio + onTick — AT OR AFTER deadline
What each function does
Function	Role today
advanceTickLocked()
Computes scheduledDeadlineNs = anchor + tickOffset(sequence); increments totalTickCount
dispatchTick()
Audio enqueue (playClickForTick) + UI (onTick) — coupled
scheduleNextTickLocked()
Posts blocking wait for next tick deadline
waitUntilDeadlineNs()
Sleep/spin until nanoTime() >= deadline
playClickForTick()
Calls ClickSoundPlayer.play*(scheduledDeadlineNs)
The coupling problem
Audio enqueue lives inside dispatchTick(), which runs after waitUntilDeadlineNs() returns. Enqueue time ≈ deadline time. The Oboe consumer (drainQueue) needs the event in ClickEventQueue before it renders the buffer containing that deadline. Late arrival → deltaNs < 0 → frameOffset = 0.

Tick 0 is worse: dispatchTick(firstTick) runs synchronously at start() with no lead time.

2. Where waitUntilDeadlineNs() blocks
Exact call chain:


MetronomeEngine.kt
Lines 245-253
  private fun scheduleNextTickLocked(activeGeneration: Long) {
    val deadlineNs = anchorTimeNs + tickOffsetNs(totalTickCount, bpm, ticksPerBeat)
    handler?.post {
      waitUntilDeadlineNs(deadlineNs)   // ← blocks HandlerThread here
      synchronized(lock) {
        fireTick(activeGeneration)
      }
    }
  }
waitUntilDeadlineNs() (lines 261–278) loops until System.nanoTime() >= deadlineNs. That wait is appropriate for UI tick emission but must not gate audio publication.

3. Lookahead window model
New contract
Scheduler publishes click events when their deadlines fall within [now, now + lookaheadNs].
Oboe callback renders when bufferStart <= deadline <= bufferEnd.

Separation of concerns:

Responsibility	Owner	When
Compute musical deadlines
MetronomeEngine
Always
Publish audio events to queue
MetronomeEngine
Ahead of deadline
Fire UI onTick
MetronomeEngine
At or near deadline (can keep wait)
Map deadline → frame offset
OboeEngine::drainQueue
Audio callback
Render PCM
AudioRenderer / SamplePlayer
Audio callback
Proposed flow
                    ┌─────────────────────────────────────┐
                    │         MetronomeEngine             │
                    │                                     │
  start() ─────────►│  anchorTimeNs = nanoTime()          │
                    │  fillAudioLookahead()  ◄───┐        │
                    │       │                    │        │
                    │       ▼                    │        │
                    │  for each tick with        │        │
                    │  deadline ≤ now+lookahead│        │
                    │       │                    │        │
                    │       ▼                    │        │
                    │  enqueueAudio(snapshot)    │        │
                    │  (no wait)                 │        │
                    │                            │        │
                    │  scheduleNextTickLocked()  │        │
                    │       │                    │        │
                    │       ▼                    │        │
                    │  waitUntilDeadlineNs()     │        │
                    │  (UI only)                 │        │
                    │       │                    │        │
                    │       ▼                    │        │
                    │  emitUiTick(snapshot)      │        │
                    │  fillAudioLookahead() ─────┘        │
                    └─────────────────────────────────────┘
                                      │
                                      ▼
                    ClickEventQueue (future events preserved)
                                      │
                                      ▼
                    Oboe drainQueue → frameOffset → SamplePlayer
Core new state
// Last sequence number whose audio has been enqueued (-1 before any)
private var lastEnqueuedSequence: Long = -1
// Configurable horizon (nanoseconds)
private val lookaheadNs: Long
Core new function (conceptual)
private fun fillAudioLookahead() {
  val horizonNs = System.nanoTime() + lookaheadNs
  while (isRunning) {
    val nextSequence = lastEnqueuedSequence + 1
    val deadlineNs = anchorTimeNs + tickOffsetNs(nextSequence, bpm, ticksPerBeat)
    if (deadlineNs > horizonNs) break
    val snapshot = snapshotForSequence(nextSequence)  // pure compute, no counter advance
    enqueueAudioForTick(snapshot)                      // play* only, no onTick
    lastEnqueuedSequence = nextSequence
  }
}
fillAudioLookahead() is called from:

start() — before first UI tick
End of each fireTick() / UI emission — refill horizon
updateTempo() / updateSubdivision() — after anchor retune + queue flush
Optional safety: periodic handler.postDelayed(refill, lookaheadNs / 2) if UI cadence could lag (belt-and-suspenders)
Split dispatchTick()
Today	Proposed
dispatchTick() = audio + UI
enqueueAudioForTick(snapshot) — lookahead path
emitUiTick(snapshot) — at deadline, onTick only
fireTick() becomes:

advanceTickLocked() — compute snapshot, advance totalTickCount
scheduleNextTickLocked() — chain next UI wait
emitUiTick(snapshot) — UI only
fillAudioLookahead() — publish more audio
For tick 0 in start(): call fillAudioLookahead() before emitUiTick(firstTick) so audio is queued ahead of the first deadline.

Duplicate prevention
lastEnqueuedSequence ensures each musical sequence is enqueued once. snapshotForSequence(n) is a pure function of anchorTimeNs, bpm, ticksPerBeat, accentPattern — no side effects.

4. Recommended lookahead duration
Constraints from PulseGrid + Oboe
Factor	Typical value	Implication
Oboe LowLatency + Exclusive
10–30 ms total output latency
Events need to be queued ≥1–3 buffers before DAC time
Callback buffer (device-dependent)
~96–384 frames @ 48 kHz ≈ 2–8 ms/buffer
Need ≥2–3 buffers of lead
Handler + JNI crossing
~0.5–5 ms
Non-audio-thread delay
waitUntilDeadlineNs spin window
5 ms
UI can fire up to ~5 ms late; audio must not depend on this
Queue capacity
64 events
Upper bound on how far ahead you can publish
Shortest tick interval (stress case)
Config	Tick interval
120 BPM, quarter notes
500 ms
120 BPM, 16ths
125 ms
200 BPM, 16ths
75 ms
300 BPM, 16ths
50 ms
Lookahead must exceed one tick interval + output latency + jitter so the next refill (after each UI tick) still leaves time for Oboe to receive the event before its buffer window.

Recommendation
Use a dynamic lookahead with a fixed floor:

lookaheadNs = max(
  MIN_LOOKAHEAD_NS,                           // 80 ms floor
  4 * bufferDurationNs,                       // ~4 Oboe buffers (once hardware timeline exists)
  2 * tickIntervalNs(bpm, ticksPerBeat)       // at least 2 musical ticks
)
Phase 1 (before hardware timestamps): use constants:

Constant	Value	Rationale
MIN_LOOKAHEAD_NS
80 ms
Covers ~3× 8 ms buffers + JNI + handler jitter
MAX_LOOKAHEAD_NS
500 ms
Caps queue fill; 64-event capacity is ample
Initial default
100 ms
~0.8 sixteenth @ 120 BPM; ~1.3 @ 200 BPM; safe starting point
Refill cadence: calling fillAudioLookahead() after every UI tick is sufficient when lookaheadNs >= 2 × tickIntervalNs. At 300 BPM 16ths (50 ms ticks), 100 ms lookahead holds ~2 ticks; refill every 50 ms keeps the horizon full.

Tempo changes: recompute lookaheadNs from new BPM immediately; flush queued audio events and reset lastEnqueuedSequence = totalTickCount - 1 (or current playback sequence).

Why not a fixed tick count?
Tick count alone fails across subdivisions (16th @ 200 BPM = 75 ms vs quarter @ 60 BPM = 1000 ms). Time-based horizon with a 2 × tickInterval term adapts automatically.

5. Interactions with playback modes
stop()
Today: haltLoopLocked() increments generation, clears handler, resets totalTickCount and anchorTimeNs. No native queue flush — stale events may still play.

Design:

haltLoopLocked() → call clickSoundPlayer.flushPendingEvents() (new)
Reset lastEnqueuedSequence = -1
Native: drain or discard all items in ClickEventQueue; SamplePlayer::stop() all voices
Pause (not implemented today)
Design for future:

pause() → stop handler waits; do not flush queue (optional: stop Oboe stream)
resume() → re-anchor or freeze offset; fillAudioLookahead() from resume position
UI ticks paused; audio queue frozen or cleared depending on product choice (recommend flush on pause to avoid burst on resume)
Seeking (future Song Timeline)
Not in current API. Layer 3 (Playback Engine) will:

Set musical position (bar/beat/subdivision)
Recompute totalTickCount and anchorTimeNs = now - tickOffset(position)
Flush native queue
Reset lastEnqueuedSequence = position - 1
fillAudioLookahead() from new position
MetronomeEngine becomes a publisher fed by timeline position, not only a self-advancing loop.

Looping (future)
Domain model already has loopEnabled, loopStart, loopEnd (docs/03-domain-model.md).

Design:

Timeline layer detects sequence past loopEnd → wrap to loopStart
Recompute deadlines from wrapped anchor (or additive loop offset)
On wrap: flush queue, reset lastEnqueuedSequence, republish lookahead from loop start
Oboe path unchanged — it only sees absolute scheduledDeadlineNs
Song Timeline mode (long-term)
Per docs/adrs/033-RevisedProjectGoals.md:

Layer	Role after this change
Layer 2 — Musical Timeline
Answers "what at position 237?"
Layer 3 — Playback Engine
Converts positions → ClickEvent deadlines; calls publisher
MetronomeEngine (today)
Evolves into quick-metronome publisher or delegates to AudioEventPublisher
Quick metronome: fixed BPM/meter → MetronomeEngine computes deadlines directly.
Song mode: PlaybackEngine produces (type, scheduledDeadlineNs) stream → same ClickSoundPlayer → same queue → same Oboe path.

Key invariant: only Layer 3 publishes; Oboe never schedules; UI never publishes audio.

updateTempo() / updateSubdivision()
Today: retune anchorTimeNs; queued events keep stale deadlines.

Design (required with lookahead):

Retune anchor (existing logic)
Flush native audio queue
lastEnqueuedSequence = totalTickCount - 1 (re-publish from current position)
fillAudioLookahead()
Same for updateAccentPattern() if it affects already-queued future ticks (accent changes on unpublished ticks only — if publishing 100 ms ahead, pattern change should republish or flush).

6. Files that would change
Must change
File	Changes
MetronomeEngine.kt
Split audio/UI dispatch; add lastEnqueuedSequence, lookaheadNs, fillAudioLookahead(), snapshotForSequence(); call fill on start/tick/tempo/subdivision; remove audio from post-wait path
ClickSoundPlayer.kt
Add flushPendingEvents() forwarding to native
OboeClickPlayer.kt
Add flushPendingEvents() + JNI
oboe_click_player_jni.cpp
nativeFlushPendingEvents()
OboeEngine.h / OboeEngine.cpp
flushEventQueue(); stop all SamplePlayers; optional clearQueue() on ClickEventQueue
ClickEventQueue.h
Add clear() or reset head/tail (consumer+producer coordination — flush only from scheduler thread when callback is not racing, or use generation stamp)
Should change (same feature, hardening)
File	Changes
NativeAudioModule.kt
On stop(), ensure flush path runs (if not only via MetronomeEngine.stop())
MetronomeEngine.kt companion
MIN_LOOKAHEAD_NS, DEFAULT_LOOKAHEAD_NS constants
Optional extraction (cleaner architecture)
File	Purpose
AudioLookaheadPublisher.kt (new)
fillUpTo(horizonNs), lastEnqueuedSequence, flush — keeps MetronomeEngine thinner
SchedulingConfig.kt (new)
Lookahead constants and dynamic formula
No change required (consumer already correct)
File	Why
ClickEvent.h
Already stores scheduledDeadlineNs
OboeEngine::drainQueue()
Already preserves future events (deadline > bufferEnd → break)
SamplePlayer.cpp
Already supports start(frameOffset)
AudioRenderer.cpp
Already zero-fills and mixes
React Native layer
No timing changes
Future (not this step)
File	When
PlaybackEngine.kt (new)
Song Timeline
NativeAudioModule.kt
pause(), seekTo(position) APIs
OboeEngine.cpp
Hardware getTimestamp() (separate blocker)
Queue flush concurrency note
ClickEventQueue is SPSC: producer = scheduler/JNI thread, consumer = audio callback. Flush must either:

Be called only when stream is stopped, or
Use a generation counter on events discarded by drain when generation mismatches, or
Atomically reset queue with care (audio thread may be mid-drain)
Safest v1: OboeEngine::flush() sets discardGeneration++, stops all players; drainQueue drops events with stale generation or clears queue between callbacks via flag checked at drain start.

7. Implementation plan
Phase A — Split dispatch (no behavior change yet)
Extract enqueueAudioForTick(snapshot) from dispatchTick()
Extract emitUiTick(snapshot) for onTick only
dispatchTick() = both (temporary) — verify tests/UI unchanged
Risk: Low. Mechanical refactor.

Phase B — Predictive publish
Add lastEnqueuedSequence, DEFAULT_LOOKAHEAD_NS = 100_000_000L
Implement snapshotForSequence(n) (pure, no totalTickCount mutation)
Implement fillAudioLookahead()
start(): fillAudioLookahead() before first UI tick; remove audio from synchronous first dispatchTick
fireTick(): emitUiTick only + fillAudioLookahead(); remove audio from post-wait path
Verify logcat: frame_offset should be > 0 and vary within buffers
Risk: Medium. Primary behavioral change.

Phase C — Queue flush on structural changes
ClickEventQueue::clear() + OboeEngine::flushPendingClicks()
JNI + Kotlin flushPendingEvents()
Call on stop(), updateTempo(), updateSubdivision(), updateAccentPattern()
Reset lastEnqueuedSequence appropriately
Risk: Medium. Concurrency with audio callback needs careful design.

Phase D — Dynamic lookahead
computeLookaheadNs(bpm, ticksPerBeat, bufferDurationNs?) with max(80ms, 2×tickInterval)
Optional: read buffer duration from native after stream open
Tune constants from device testing
Risk: Low–medium.

Phase E — Validation
Log scheduled_ns, buffer_start_ns, frame_offset at 120/200 BPM, all subdivisions
Confirm no frame_offset=0 on on-time ticks (except tick 0 edge case)
Stress: tempo change mid-playback, rapid start/stop
Queue never hits 64 capacity at default lookahead
Risk: Low (observability only).

Phase F — Extract publisher (optional, pre–Song Timeline)
Move lookahead logic to AudioLookaheadPublisher
MetronomeEngine owns UI loop; publisher owns lastEnqueuedSequence + fill
Document interface for future PlaybackEngine injection
Risk: Low. Sets up Layer 3.

Summary
Question	Answer
What blocks today?
waitUntilDeadlineNs() gates dispatchTick() which gates playClickForTick()
What changes?
Audio published in fillAudioLookahead(); wait gates UI only
Lookahead?
100 ms default; dynamic max(80ms, 2×tickInterval)
Oboe changes?
Minimal — add flush; drain logic already correct
Architectural?
Yes — scheduling contract change in MetronomeEngine; enables Layer 3
Do first?
Phase B after mechanical Phase A split
The lock-free queue and frame-offset renderer were built for this model. Predictive publish is the step that finally feeds them events before the buffer containing each deadline is rendered.


==============================


This is the first response from Cursor where I'd say:

Yes. This is the architectural direction PulseGrid should take.

It also aligns with your product vision.

The key sentence

"Audio published in fillAudioLookahead(); wait gates UI only."

This is a major architectural shift.

Today your scheduler is probably doing:

wait
↓

generate event
↓

play click
↓

UI updates

Cursor is proposing:

generate future audio events
↓

enqueue them

↓

wait

↓

UI tick

That is much closer to how professional audio engines work.

Why this matters beyond the metronome

Remember your future goals:

Song Timeline
Tempo automation
Loop regions
Seeking
Accelerando
Ritardando

Those features become much easier if the scheduler thinks in terms of:

"What events should exist in the next 100 ms?"

instead of

"It's time for the next beat."

I especially like this

dynamic max(80ms, 2×tickInterval)

That avoids two common problems:

At slow tempos:

40 BPM

you don't need to queue several seconds of events.

At fast tempos:

220 BPM
16ths

you still maintain enough future events to avoid underruns.

A dynamic lookahead is a sensible compromise.

One thing I would ask Cursor before implementing

I want one question answered.

How does it prevent duplicate events?

Imagine this:

lookahead = 100ms

scheduler wakes every 20ms

Without tracking what has already been published:

Beat #17

↓

enqueue

↓

20ms later

↓

enqueue again

↓

20ms later

↓

enqueue again

The scheduler needs a notion of:

lastPublishedDeadline

or

publishCursor

that advances independently of playback.

Otherwise you'll hear duplicate clicks.