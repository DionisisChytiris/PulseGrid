I think you're at the point where the migration changes direction.

Up to now you've been building the engine. From here on, you should improve timing accuracy.

The biggest issue I see is that your scheduler is still doing something like this:

MetronomeEngine
    ↓
click happens now
    ↓
enqueueClick(type, System.nanoTime())
    ↓
Oboe callback eventually receives it

That means the event is already "late" by the time it reaches the audio thread. Oboe can only render what it has already been told about.

A real-time audio engine works differently:

Scheduler
    ↓
enqueue click due at T + lookahead
    ↓
Oboe callback
    ↓
when audio frame reaches T
    ↓
start SamplePlayer exactly there

This is the biggest remaining architectural improvement.

Before changing code

I would first find out exactly how your callback behaves.

Ask Cursor this:

We are moving from a reactive playback model to a predictive scheduling model.

Before changing any code, analyze the current implementation.

Report only.

1. How often is Oboe's onAudioReady() called?
   - average callback interval in milliseconds
   - frames per callback
   - framesPerBurst
   - sample rate

2. Does drainQueue() currently trigger events immediately when dequeued?

3. Is there currently any logic that schedules an event to occur at an exact frame inside the callback buffer?

4. Is ClickEvent.timestampNs currently used only for logging, or does it affect playback timing?

5. Explain how an event flows from:
   MetronomeEngine
   →
   enqueueClick()
   →
   ClickEventQueue
   →
   onAudioReady()
   →
   SamplePlayer::start()

Do not modify any code.
Why this matters

I suspect your current callback is effectively doing:

while (queue.pop(event)) {
    samplePlayer.start();
}

instead of:

if (event belongs inside this audio buffer) {
    start playback at frame 173
}

Those are very different.

The second approach is what gives you sample-accurate timing.

I would also stop using System.nanoTime() as the playback timestamp

Eventually, your scheduler should enqueue the intended playback time, not the current time.

For example:

enqueueClick(
    type,
    nextBeatTimeNs
)

rather than:

enqueueClick(
    type,
    System.nanoTime()
)

That gives the audio callback a target to work toward.





analysis from Cursor. It also confirms what I suspected.

The last paragraph is the most important one:

Playback always starts at frame 0 of whichever callback first sees the event. Worst-case extra latency ≈ one callback period (~2–10 ms), with no sub-buffer correction.

That is the remaining source of timing error.

Where you are now

You've successfully built:

✅ A persistent Oboe stream
✅ A lock-free SPSC event queue
✅ A dedicated audio callback
✅ In-memory PCM sample playback
✅ Backend switching between SoundPool and Oboe

Those are the hard architectural pieces.

The remaining work is in audio scheduling, not architecture.

The first thing I would fix

One thing in the report stands out as an actual correctness issue:

If event.timestampNs > bufferEndTimeNs → event is popped and discarded (no re-queue, no playback).

That is a bug for a predictive scheduler.

If you later enqueue events ahead of time, the callback must leave future events in the queue, not throw them away.

So before introducing predictive scheduling, I'd fix the queue behavior.

Cursor prompt
The current Oboe event pipeline discards future events.

Current behavior:

- drainQueue() pops every event.
- If event.timestampNs <= bufferEndTimeNs:
    play it immediately.
- Otherwise:
    the event has already been removed from the queue and is lost.

This is incompatible with predictive scheduling.

Goal

Modify the queue consumption logic so future events are preserved.

Requirements

1. Do NOT discard events whose timestamp is after the current audio buffer.

2. The callback must only consume events that belong in the current buffer.

3. Add the minimum API needed to support this.
   For example:
   - peek()
   - pop()
   - or equivalent

4. Do NOT change:
   - MetronomeEngine
   - scheduler
   - JNI
   - AudioRenderer
   - SamplePlayer
   - ClickSoundPlayer

5. Playback behavior should remain identical for the current reactive model.

Report:
- files modified
- how future events are preserved
- queue complexity
Why this first?

Right now your queue only supports a "fire immediately" model.

A predictive scheduler needs:

peek first event

if event belongs later
    leave it in queue

if event belongs in this buffer
    consume it

Without that, you can't safely enqueue events 20–50 ms in advance.

Then comes the real improvement

After the queue can preserve future events, the next step is:

Enqueue the scheduled deadline (not System.nanoTime()).
Compute the event's position within the current audio buffer.
Start the sample at the correct frame offset instead of always at frame 0.

That's the change that can reduce timing error from several milliseconds down to the granularity of a single audio frame.

At 48 kHz, one frame is about 21 microseconds, which is the level of precision a metronome backend should aim for.

So my recommendation is:

Step 1: Make the queue predictive-ready by preserving future events.
Step 2: Pass the scheduler's absolute deadline into Oboe instead of the enqueue time.
Step 3: Render clicks at the correct frame within the callback buffer.

Those three changes build directly on the architecture you've already created.