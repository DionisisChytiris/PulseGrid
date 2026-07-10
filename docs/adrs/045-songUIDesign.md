I actually wouldn't make it a "debug" overlay anymore. At this stage, I'd make it a Playback Timeline—a core feature of the app.

Here's what I think would make PulseGrid feel professional.

During playback

Imagine the song:

4 bars 4/4     →     2 bars 5/4     →     4 bars 3/8

While playing, the UI becomes:

┌─────────────┐     ┌────────────┐     ┌─────────────┐
│ 4 bars 4/4  │ →   │ 2 bars 5/4 │ →   │ 4 bars 3/8 │
│ ● ○ ○ ○     │     │ ○ ○        │     │ ○ ○ ○ ○    │
└─────────────┘     └────────────┘     └─────────────┘

When bar 2 starts:

● ○ ○ ○
↓
○ ● ○ ○

Then:

○ ○ ● ○

Then:

○ ○ ○ ●

When bar 5 begins, the highlight automatically jumps to the next section.

Even better

Inside every section, show the actual bar numbers.

Instead of

● ○ ○ ○

show

① ② ③ ④

During playback:

❶ ② ③ ④

then

① ❷ ③ ④

then

① ② ❸ ④

Musicians naturally think in bar numbers.

Then add beat progress

When you're inside a bar:

Bar 3

Beat

● ○ ○ ○

Then

○ ● ○ ○

Then

○ ○ ● ○

Then

○ ○ ○ ●

So the musician always knows:

current section
current bar
current beat

without having to count.

For odd meters

This becomes even more valuable.

For a 5/4 section:

① ②

Current:

❶ ②

Inside bar 1:

Beat

● ○ ○ ○ ○

For 7/8:

① ②

Bar 1:

● ● ○

according to the accent grouping (for example 2+2+3).

Accent visualization

I also wouldn't display the raw text:

Accent: 3+2+2

Instead, visualize it.

For example:

7/8

▲ ○ ▲ ○ ▲ ○ ○

or

▲ ▲ ○ ▲ ▲ ○ ○

depending on how you define the pattern.

The musician immediately sees the feel of the meter.

Overall layout

I'd build the Songs screen something like this:

──────────────────────────────────────────────

Song Name

▶ Play     ■ Stop

──────────────────────────────────────────────

◄──────────────────────────────────────────►

┌──────────┐   ┌─────────┐   ┌──────────┐
│4 bars4/4 │→→ │2 bars5/4│→→ │4 bars3/8 │
│Bars 1-4  │   │Bars5-6  │   │Bars7-10  │
│①②③④      │   │①②       │   │①②③④     │
└──────────┘   └─────────┘   └──────────┘

──────────────────────────────────────────────

Current:
Section 2
Bar 5 of 10
Beat 3 / 5
120 BPM

──────────────────────────────────────────────
I would also make one architectural improvement

Right now you have:

Song
 └── Section
      └── Bars

For the UI, I'd create a derived view model rather than using the domain objects directly.

Something like:

TimelineSegment {
    id

    startBar
    endBar

    numberOfBars

    meter

    accentPattern

    bpm

    isActive

    currentBar

    progress
}

Your domain model stays clean, and the UI gets exactly the information it needs without scattering calculations across components.

I think this approach fits the direction you've taken with the engine: the playback architecture is becoming quite sophisticated, and a timeline UI that always answers "Where am I in the song?" will make that sophistication immediately useful to musicians. It also scales well if you later add repeats, loops, markers, tempo changes, or multiple practice sections without needing to redesign the interface.





============================================



Redesign the Songs playback UI into a professional "Timeline View" suitable for musicians.

This is a UI/Presentation layer task ONLY.

DO NOT modify:

- MetronomeEngine
- OboeEngine
- ClickSoundPlayer
- ClickEventQueue
- NativeAudioModule
- Song compiler
- Song scheduler
- Playback timing
- Kotlin or C++

Only modify React Native UI, Redux selectors if necessary, and presentation-layer view models.

--------------------------------------------------

DESIGN GOAL

The timeline should answer three questions at all times:

1. Where am I in the song?
2. Which bar am I playing?
3. Which beat am I am currently on?

The interface should make mixed-meter songs easy to understand visually.

--------------------------------------------------

LAYOUT

Below the transport controls, replace the current song structure editor with a horizontal timeline.

Example:

────────────────────────────────────────────────────────

[ 4 bars | 4/4 ]
Bars 1–4
① ② ③ ④

→

[ 2 bars | 5/4 ]
Bars 5–6
① ②

→

[ 4 bars | 3/8 ]
Bars 7–10
① ② ③ ④

────────────────────────────────────────────────────────

The entire timeline is horizontally scrollable.

Each section is rendered as a TimelineSegment.

Do NOT stack sections vertically.

--------------------------------------------------

TIMELINE SEGMENT

Each segment displays:

• number of bars
• meter
• overall song bar range

Example:

4 bars | 4/4

Bars 1–4

① ② ③ ④

Each numbered circle represents one bar inside that section.

--------------------------------------------------

PLAYBACK HIGHLIGHT

When playback is active:

Highlight:

• current section
• current bar inside that section

Example:

① ❷ ③ ④

Only one bar indicator should be active.

Do NOT modify playback logic.

Use existing playback state/onTick information.

--------------------------------------------------

AUTO SCROLL

When playback reaches another section:

Automatically scroll the timeline.

Behavior:

- keep active section near center
- smooth animation
- no jitter

User may manually scroll.

If user scrolls manually,
temporarily suspend auto-follow for approximately 3 seconds.

--------------------------------------------------

CURRENT PLAYBACK PANEL

Below the timeline add a compact status panel.

Example:

Current Section: Verse

Current Bar: 5 / 10

Current Beat: 3 / 5

Tempo: 120 BPM

Meter: 5/4

This updates live during playback.

--------------------------------------------------

ACCENT VISUALIZATION

Do NOT display raw text:

Accent: 3+2+2

Instead render a small visual preview.

Examples:

4/4

▲ ○ ○ ○

5/4

▲ ○ ○ ○ ○

7/8 grouped

▲ ○ ▲ ○ ▲ ○ ○

This is visual only.

No playback changes.

--------------------------------------------------

EDITING

Tapping a timeline segment opens a Bottom Sheet.

Allow editing:

• number of bars
• time signature
• BPM override
• accent pattern

Keep editing simple.

No navigation to another screen.

--------------------------------------------------

BPM OVERRIDE

If BPM override exists:

show a small badge

140 BPM

If not present:

hide the badge.

Do NOT change playback behavior.

This remains metadata for now.

--------------------------------------------------

VIEW MODEL

Create a presentation-only TimelineSegmentViewModel.

Do NOT expose Song domain objects directly to UI.

Suggested properties:

id

title

meter

numberOfBars

startBar

endBar

barIndicators

accentPreview

bpmOverride

isActive

activeBarIndex

sectionName

This ViewModel should be derived from the existing Song model.

Do not modify the Song domain model.

--------------------------------------------------

PERFORMANCE

Use FlatList horizontal.

Memoize TimelineSegment components.

Avoid re-rendering the entire timeline every beat.

Only active segment/bar should update.

--------------------------------------------------

DO NOT CHANGE

No scheduler changes.

No compiler changes.

No playback changes.

No native changes.

No Redux architecture changes unless required for UI state.

--------------------------------------------------

SUCCESS CRITERIA

✓ Horizontal timeline

✓ Mixed meters clearly visible

✓ Bar numbers visible

✓ Current bar highlighted live

✓ Auto-scroll follows playback

✓ Compact playback information panel

✓ Editing via bottom sheet

✓ Presentation layer only

The result should resemble a lightweight DAW timeline designed specifically for rhythmic practice rather than audio editing.