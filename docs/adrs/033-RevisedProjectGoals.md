The Oboe migration is not the product. It's an enabling technology for one of your product requirements:

Playback must be sample accurate.

Everything else should support the product experience you've described.

I would think about the project in four layers
Layer 1 — Audio Engine (Foundation)

Purpose: produce accurate clicks.

This layer should know nothing about songs, bars, sections, or UI.

Responsibilities:

Oboe
Sample-accurate scheduling
Low-latency rendering
Audio buffers
Sample playback
Backend abstraction

Status:

🟢 Mostly complete
Remaining work: predictive scheduling / frame-offset rendering
Layer 2 — Musical Timeline (Core)

This is where PulseGrid becomes different from every simple metronome.

Responsibilities:

Tempo map
Meter map
Song timeline
Bar structure
Accent groups
Loop regions
Playback position

This layer should answer questions like:

"What happens at musical position 237?"

not

"Play a click now."

Layer 3 — Playback Engine

This layer converts musical time into audio events.

Responsibilities:

Read timeline
Compute future beat deadlines
Schedule clicks
Handle tempo changes
Handle meter changes
Handle loops
Handle seeking

This is the bridge between the musical world and the audio world.

Layer 4 — UI

Everything the user touches:

Song editor
Timeline
Quick metronome
Library
Settings
Visual beat indicator

The UI should never be responsible for timing.

I think your long-term architecture should look like this
React Native UI
        │
        ▼
Playback Controller
        │
        ▼
Timeline Engine
        │
        ▼
Metronome Scheduler
        │
 scheduledDeadlineNs
        ▼
Oboe Audio Engine
        │
PCM Output

Notice something important:

There is no direct connection between the UI and Oboe.

The UI talks about music.

The scheduler talks about time.

Oboe talks about samples.

Each layer has a single responsibility.

Where I think you are today
Audio Engine

About 90–95%

Remaining:

scheduledDeadlineNs propagation
frame offsets
deterministic rendering
Timeline Engine

About 20%

Currently you have Quick Metronome.

Song Timeline Mode doesn't really exist yet.

Playback Engine

About 40%

Current scheduler is good for a fixed metronome.

It needs to evolve into something that can read an entire song timeline.

UI

Maybe 35–40%

Quick Metronome exists.

Song editing is still ahead.

What I would work on next

Not immediately after Oboe.

I'd finish the audio engine first.

Specifically:

Milestone 1

Finish sample-accurate playback.

When this is done, you never have to rethink the audio engine again unless you add new sound-generation features.

Milestone 2

Design the Song Timeline.

Not the UI.

The data model.

Questions to answer include:

How is a song represented?
How are tempo changes stored?
How are meter changes stored?
How are loops represented?
How do you seek to bar 57?
How do you support accelerando and ritardando?

Once that model is solid, both Android and iOS can share it through your React Native layer.

Milestone 3

Teach the scheduler to consume the timeline instead of assuming a fixed BPM and meter.

Today it probably thinks:

"Every beat is identical."

Eventually it should think:

"Read the next event from the musical timeline."

That opens the door to:

7/8 → 5/4 → 13/16
tempo ramps
loop sections
rehearsal marks
setlists

without changing Oboe.

One architectural suggestion

As the app grows, avoid tying the scheduler to "metronome" concepts. Instead, think in terms of a generic sequence of timed musical events.

For example, instead of:

playAccent()
playNormal()
playSubdivision()

you might eventually have events like:

BeatEvent
{
    scheduledDeadlineNs
    clickType
    barIndex
    beatIndex
    subdivisionIndex
    accentLevel
    tempo
    timeSignature
}

The audio engine only cares about scheduledDeadlineNs and clickType. The UI can use the rest for highlighting bars, displaying the current beat, or synchronizing animations. This separation will make features like looping, seeking, and tempo changes much easier to implement.

Overall, I think you're approaching this in the right order. A metronome lives or dies by its timing. Investing the effort now to make the audio engine deterministic gives you a stable foundation before you tackle the much larger challenge: building a flexible musical timeline that can represent complex songs while remaining easy for musicians to use.