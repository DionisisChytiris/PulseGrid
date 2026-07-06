Milestone 1B — Hardware Timeline Alignment
Why we're doing this

Right now you have:

MetronomeEngine
        │
scheduledDeadlineNs
        │
        ▼
Oboe callback
        │
bufferStartTimeNs (estimated)
        │
frameOffset

The weak point is:

bufferStartTimeNs

Today it's estimated from:

streamStartTimeNs
+
framesWritten / sampleRate

That assumes the stream started exactly when you called requestStart(), and that every callback occurred perfectly.

Real audio hardware doesn't work that way.

The goal

Instead of saying:

"I think frame 0 of this callback reaches the DAC now..."

you want Oboe to tell you:

"Frame X was presented by the DAC at time T."

Then derive the callback's buffer timeline from that.

That removes systematic timing bias and makes the renderer align with the hardware's notion of time.

Cursor prompt

This is the prompt I'd give Cursor.

Implement Milestone 1B: Hardware Timeline Alignment.

GOAL

Replace the software-estimated bufferStartTimeNs used by the Oboe callback with a hardware-derived presentation timeline using Oboe timestamps.

Do not modify MetronomeEngine.

Do not modify deadline generation.

Do not modify predictive publication.

Those layers are now considered correct.

OBJECTIVE

Currently frameOffset is computed using an estimated:

bufferStartTimeNs =
streamStartTimeNs +
framesWritten * frameDuration

Replace this estimation with a timeline derived from the Oboe AudioStream timestamp API.

IMPLEMENTATION

Inside the Oboe callback:

1.

Use AudioStream::getTimestamp().

Retrieve:

- frame position
- presentation timestamp

2.

Derive the presentation time of frame zero of the current callback buffer.

3.

Use that value as bufferStartTimeNs when computing:

frameOffset =
(scheduledDeadlineNs - bufferStartTimeNs)
× sampleRate

4.

If getTimestamp() is temporarily unavailable:

fall back to the current software timeline.

5.

Log which timeline source is being used:

HW_TIMESTAMP
or

SOFTWARE_ESTIMATE

using the existing PulseGrid-Oboe log tag.

6.

Do not change:

- ClickEventQueue
- SamplePlayer
- AudioRenderer
- JNI interface
- Kotlin scheduler

EXPECTED OUTPUT

Provide:

1.

Files modified.

2.

Explanation of the timestamp math.

3.

Clock-domain analysis.

Explain why System.nanoTime() and the Oboe timestamp are compatible (or how compatibility is ensured).

4.

Fallback behavior.

5.

Any device-specific limitations of getTimestamp().

6.

Updated architecture diagram.

The objective is to make the Oboe callback align scheduled deadlines to the hardware presentation timeline without changing the scheduler architecture.
What I expect after this

Your logs should evolve from something like:

scheduled_ns=...
buffer_start_ns=...
frame_offset=168

to something like:

timeline=HW_TIMESTAMP
frame_offset=171

or, if a device doesn't provide a timestamp:

timeline=SOFTWARE_ESTIMATE
frame_offset=169

That gives you confidence about which timing source is in use.

After Milestone 1B

At that point, I would consider the core audio engine complete.

The architecture would be:

MetronomeEngine
(authoritative musical timeline)
        │
        ▼
Predictive Publisher
        │
        ▼
Lock-Free Queue
        │
        ▼
Oboe Callback
(hardware timeline)
        │
        ▼
Frame Offset
        │
        ▼
AudioRenderer
        │
        ▼
DAC

That's a solid foundation for everything in your product vision—quick metronome mode, song timeline mode, tempo changes, odd meters, loops, and eventually full timeline playback. Those future features can build on this engine without needing to redesign the audio pipeline.