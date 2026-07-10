I definitely would. You've reached a point where the audio engine is stable. From now on, I'd treat it almost like a separate product and avoid large cross-cutting changes.

I'd organize this as a series of small milestones that each leave the project in a working state.

Milestone A — Introduce BeatUnit (No Behavior Change)

Goal

Introduce the concept of BeatUnit without changing playback at all.

Everything should continue to behave exactly as today.

Cursor prompt
Goal

Introduce a new BeatUnit model into the music domain WITHOUT changing any playback behaviour.

IMPORTANT

This is a domain-only change.

DO NOT modify:

- Oboe
- MetronomeEngine
- Scheduler
- Playback cursor
- Timeline compiler timing
- NativeAudioModule
- ClickSoundPlayer

Current playback must remain identical.

------------------------------------------------

Create:

enum BeatUnit {

    WHOLE,
    HALF,
    QUARTER,
    EIGHTH,
    SIXTEENTH,
    THIRTY_SECOND,

    DOTTED_HALF,
    DOTTED_QUARTER,
    DOTTED_EIGHTH,

}

Create:

interface TempoDefinition {

    bpm: number
    beatUnit: BeatUnit

}

Bar should now contain:

tempoDefinition

instead of only bpm.

For backward compatibility:

existing bpm should automatically become

TempoDefinition {

    bpm,
    beatUnit inferred from denominator

}

Inference:

2 -> HALF

4 -> QUARTER

8 -> EIGHTH

16 -> SIXTEENTH

32 -> THIRTY_SECOND

For:

6/8

9/8

12/8

default BeatUnit = DOTTED_QUARTER

No timing calculations should change.

The compiler should still use the existing denominator-based logic.

This milestone only introduces the richer model.
Milestone B — Compiler Uses BeatUnit

Goal

Now switch the compiler.

Still no scheduler changes.

Cursor prompt
Goal

Update SongTimelineCompiler so playback timing comes from TempoDefinition.beatUnit.

DO NOT modify:

- Oboe
- Scheduler
- Playback cursor
- NativeAudioModule

Create:

computeBeatDurationNs(
    tempoDefinition
)

Supported:

WHOLE

HALF

QUARTER

EIGHTH

SIXTEENTH

THIRTY_SECOND

DOTTED_HALF

DOTTED_QUARTER

DOTTED_EIGHTH

The compiler should compute beat durations exclusively from BeatUnit.

The denominator should remain notation only.

Everything downstream should continue consuming already-computed durations exactly as before.

Update unit tests.

No UI changes.
Milestone C — Separate Meter From Playback

This is where the architecture becomes elegant.

Instead of

Meter

↓

playback

it becomes

Meter

↓

notation

and

TempoDefinition

↓

playback
Cursor prompt
Goal

Refactor the domain so Meter and TempoDefinition have separate responsibilities.

Meter

- numerator
- denominator
- grouping

TempoDefinition

- bpm
- beatUnit

Playback timing must never read denominator directly.

Grouping must still validate against numerator.

No UI changes.

No scheduler changes.

No audio changes.
Milestone D — Upgrade the Song Editor

Now expose the new model.

For every section:

4 bars

4/4

Beat Unit

Quarter ▼

120 BPM

Grouping

[4]

Accent Pattern

or

2 bars

6/8

Beat Unit

Dotted Quarter ▼

120 BPM

Grouping

3+3

Accent Pattern

The UI should simply edit the new domain.

Milestone E — Compound Meter Intelligence

Now PulseGrid starts becoming more "musical."

Defaults:

Meter	Beat Unit	Grouping
4/4	Quarter	4
2/4	Quarter	2
3/4	Quarter	3
4/2	Half	4
3/8	Eighth	3
6/8	Dotted Quarter	3+3
9/8	Dotted Quarter	3+3+3
12/8	Dotted Quarter	3+3+3+3
5/4	Quarter	3+2
7/8	Eighth	2+2+3
13/16	Sixteenth	3+3+3+4

Users can override any default.

Milestone F — Future Features

At this point you can add, without redesigning the architecture:

✓ Swing
✓ Shuffle
✓ Tuplets
✓ Polyrhythms
✓ Tempo automation
✓ Fermatas
✓ Pickup bars
✓ Repeat signs
✓ D.S. / D.C.
✓ MusicXML import
✓ MIDI import
✓ Practice loops
✓ Variable click sounds
✓ Humanization
✓ Conducting patterns
Why I like this plan

One thing I've noticed throughout your project is that you've built a very strong separation:

Music Domain
        ↓
Compiler
        ↓
Playback Cursor
        ↓
Scheduler
        ↓
Oboe

I would preserve that separation.

The scheduler and Oboe should become almost "untouchable" infrastructure. Almost every new feature—from odd meters to MusicXML—should be implemented above that line, in the music domain and compiler.

That's the kind of architecture that remains maintainable as the app grows, because you can keep adding musical capabilities without risking the timing-critical audio engine you've already validated.


===========================================



Introduced BeatUnit and TempoDefinition in the music domain. Playback behavior is unchanged — compilers still read BPM only and keep the same denominator-based timing.

New types
BeatUnit (src/domain/music/BeatUnit.ts)

WHOLE, HALF, QUARTER, EIGHTH, SIXTEENTH, THIRTY_SECOND
DOTTED_HALF, DOTTED_QUARTER, DOTTED_EIGHTH
inferBeatUnitFromMeter() — 6/8, 9/8, 12/8 → DOTTED_QUARTER
inferBeatUnitFromDenominator() — 2→HALF, 4→QUARTER, 8→EIGHTH, 16→SIXTEENTH, 32→THIRTY_SECOND
TempoDefinition (src/domain/music/TempoDefinition.ts)

{ bpm: number; beatUnit: BeatUnit }
Bar model
Bar now has:

tempoDefinition?: TempoDefinition (replaces bare BPM)
tempoTransition?: TempoTransitionType (optional, e.g. 'instant')
Helpers: getBarTempoBpm(), hasBarTempoOverride(), createTempoDefinitionForMeter()

CreateBarInput still accepts deprecated tempo?: TempoEvent for migration; it maps to tempoDefinition.

Backward compatibility
Storage (songSerialization.ts):

New format: tempoDefinition: { bpm, beatUnit }
Legacy tempo: { bpm, type } loads as TempoDefinition with beatUnit inferred from the bar’s meter
Editor (updateBarBpm): creates tempoDefinition with inferred beatUnit from the bar meter.

Compiler behavior (unchanged)
SongPlaybackCompiler and SongTimelineCompiler use getBarTempoBpm(bar) — same BPM values, no beat-unit math yet.

Not modified
Oboe, MetronomeEngine, scheduler, cursor, adapter, native audio, timing services.

TempoEvent now wraps TempoDefinition (for legacy APIs); new code should use Bar.tempoDefinition directly.


