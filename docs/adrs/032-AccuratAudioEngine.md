Phase 2: Sample-Accurate Audio Engine

Not “make it work” anymore.

Now it is:

“make every click land at an exact sample offset inside the Oboe buffer”

🧠 What this actually means

Right now:

Metronome tick → Oboe callback → play sample at buffer start

This is why your logs show:

~80–90ms delta
but still musically stable
Next step:

You want:

Metronome tick → scheduledDeadlineNs
                     ↓
        Oboe buffer start time
                     ↓
   compute frameOffset inside buffer
                     ↓
   render click EXACTLY at that sample
🎯 Your real roadmap from here

Let’s structure it cleanly:

🥇 Step 1 — Formalize “Audio Timeline Model”

You need ONE source of truth:

streamStartTimeNs
bufferStartTimeNs
scheduledDeadlineNs

👉 Right now this is partially scattered

🥈 Step 2 — Pass real scheduledDeadlineNs end-to-end

Right now you still have:

System.nanoTime() at enqueue time

You must switch to:

scheduledDeadlineNs (from MetronomeEngine)
🥉 Step 3 — Frame offset rendering (BIG ONE)

Inside Oboe callback:

frameOffset = (event.timeNs - bufferStartTimeNs) * sampleRate

Then:

render silence until offset
render click at exact sample
🧱 Step 4 — Make SamplePlayer position-aware

Right now:

start()

You will evolve it into:

start(frameOffset)
🔊 Step 5 — Guarantee deterministic output

At this point:

SoundPool is gone
jitter becomes irrelevant
logs become near-zero noise
timing becomes sample-deterministic
🧭 Key design shift (important mindset)

You are moving from:

❌ “event-triggered audio”

to

✅ “timeline-rendered audio”

That’s the real upgrade.

🧠 What NOT to do next

Avoid these traps:

❌ micro-optimizing logs
❌ UI debugging tools
❌ tweaking BPM math in MetronomeEngine
❌ touching SoundPool again
🎯 Your actual next milestone

If we define it cleanly:

🎯 Milestone 2A

Metronome produces scheduledDeadlineNs correctly end-to-end

🎯 Milestone 2B

Oboe renders clicks at sample offsets inside callback buffer

🚀 Suggested immediate next step

Before coding anything else:

I recommend you do this:

Map the full runtime timeline on paper (or text)

Example:

JS start → NativeAudioModule.start
        → MetronomeEngine.start
        → tick scheduler fires
        → scheduledDeadlineNs created
        → ClickEvent queued
        → Oboe callback receives event
        → bufferStartTimeNs known
        → frameOffset computed
        → SamplePlayer renders
👍 Bottom line

You are no longer in “debugging Oboe integration”.

You are now building:

🎼 a deterministic real-time audio timeline engine



now we shift Cursor from “cleanup mode” into engine evolution mode.

Below are 3 focused Cursor prompts, in the correct order. Don’t skip ahead.

🥇 Prompt 1 — Introduce real scheduling contract (core upgrade)
Refactor the audio event system to support predictive scheduling using scheduledDeadlineNs instead of enqueue-time timestamps.

GOAL:
Replace reactive timing (System.nanoTime at enqueue/play time) with absolute scheduled playback deadlines coming from MetronomeEngine.

CHANGES REQUIRED:

1. Click event model
- Add/confirm ClickEvent contains:
  - type (accent/normal/subdivision)
  - scheduledDeadlineNs (REQUIRED, authoritative timing source)

2. MetronomeEngine
- Ensure all click events are emitted with scheduledDeadlineNs
- Do NOT use System.nanoTime() for event timing anymore
- Scheduled time must come from the metronome scheduler logic only

3. NativeAudioModule → MetronomeEngine pipeline
- Ensure ClickSoundPlayer.play* methods receive scheduledDeadlineNs (not "now")
- Update any JNI bridge or intermediate layer accordingly

4. ClickSoundPlayer / OboeClickPlayer
- Update playAccent / playNormal / playSubdivision to accept scheduledDeadlineNs parameter
- Do NOT change audio rendering logic yet (only pass timing data through)

5. JNI (if applicable)
- Update enqueueClick or equivalent to carry scheduledDeadlineNs instead of current time

CONSTRAINTS:
- Do NOT implement frame-accurate rendering yet
- Do NOT modify Oboe callback logic yet
- This step is ONLY about propagating correct timing data through the system

EXPECTED RESULT:
Every click event across the system now carries a consistent scheduledDeadlineNs representing the exact intended playback time.
🥈 Prompt 2 — Prepare Oboe for frame-accurate rendering
Extend the Oboe audio rendering pipeline to support sample-accurate positioning within the audio buffer.

GOAL:
Enable events to be scheduled within an Oboe callback buffer using frame offsets instead of playing all samples at buffer start.

CHANGES REQUIRED:

1. In Oboe audio callback (AudioStreamDataCallback)
- Determine bufferStartTimeNs for each callback invocation
- Maintain stream start reference time if needed

2. Event handling inside callback
- For each ClickEvent:
  - compute deltaNs = event.scheduledDeadlineNs - bufferStartTimeNs
  - convert to frameOffset using sampleRate:
      frameOffset = (deltaNs * sampleRate) / 1_000_000_000

3. Rendering logic (AudioRenderer / SamplePlayer)
- Modify render() or equivalent to accept frameOffset
- Ensure:
  - silence is rendered before frameOffset
  - sample playback starts exactly at frameOffset position in buffer

4. Safety constraints:
- Clamp frameOffset to valid buffer range
- Ignore events outside current buffer window (do not crash or block audio thread)

DO NOT:
- Do not remove existing Oboe stream logic
- Do not reintroduce SoundPool
- Do not change MetronomeEngine logic in this step

EXPECTED RESULT:
Clicks are no longer triggered at buffer start; they are positioned within the buffer based on scheduledDeadlineNs.
🥉 Prompt 3 — Final cleanup: enforce deterministic audio engine behavior
Finalize the Oboe metronome pipeline by enforcing deterministic sample-accurate playback rules and removing legacy reactive timing behavior.

GOAL:
Ensure all audio playback is driven exclusively by scheduledDeadlineNs and Oboe buffer frame offsets.

CLEANUP TASKS:

1. Remove reactive timing fallback
- Remove any usage of System.nanoTime() for playback decisions
- Remove enqueue-time based triggering logic

2. Enforce single timing source
- scheduledDeadlineNs must be the ONLY timing reference used in audio path

3. ClickSoundPlayer
- Ensure all play* methods are purely data forwarding (no timing logic inside)

4. Logging cleanup
- Keep only:
  - scheduledDeadlineNs
  - bufferStartTimeNs
  - frameOffset (if logged)
- Remove any legacy debug timing comparisons

5. Validation
- Ensure:
  - no SoundPool references remain in production path
  - no dual timing systems exist
  - Oboe callback is the sole execution layer for audio rendering

EXPECTED RESULT:
A fully deterministic Oboe-based metronome where all clicks are scheduled via absolute deadlines and rendered at exact sample positions.
🧠 How to use these correctly
Order matters:
🔵 Prompt 1 → fixes data correctness
🟣 Prompt 2 → enables spatial accuracy inside buffer
🟢 Prompt 3 → cleans + locks architecture
🚀 What you are building now

You are no longer building a “metronome app”.

You are building:

🎼 a real-time deterministic audio scheduling engine (DAW-style core)