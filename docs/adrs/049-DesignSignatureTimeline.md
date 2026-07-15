Absolutely. Given the amount of architecture you already have, I'd treat this as a proper UI redesign rather than "adding features." I'd write prompts that build it incrementally so each stage can be reviewed before moving on.

I'd start with Prompt 1, which is purely about the timeline UI and interaction model—no implementation details yet.

Prompt 1 — Design the PulseGrid Signature Timeline

Objective

Redesign the Song Editor to use a horizontal Signature Timeline inspired by Cubase's Signature Track, while remaining optimized for touch devices and mobile screens.

The timeline represents a sequence of musical regions, where each region contains one or more consecutive bars sharing the same time signature (meter).

This is a redesign of the existing Song Editor UI only. Do not change the playback engine or compiler in this step.

Timeline Layout

The main content of the Song Editor should become a horizontally scrollable timeline.

Each region represents a meter block.

Example:

──────────────────────────────────────────────────────────────

120 BPM                         ▶ PLAY

──────────────────────────────────────────────────────────────

      4/4                     7/8                  5/4

┌────────────────┐ ┌──────────────────────┐ ┌────────────────┐
│● ○ ○ ○│● ○ ○ ○ │ │● ○ ○ ● ○ ○ ○│● ○ ○ ● ○ ○ ○│ │● ○ ○ ● ○│● ○ ○ ● ○│
│ Bar1 │ Bar2    │ │ Bar3        │ Bar4        │ │ Bar5 │ Bar6    │
└────────────────┘ └──────────────────────┘ └────────────────┘
Region

Each timeline region must display:

the time signature prominently (4/4, 7/8, 5/4...)
number of bars
beat circles
accent indicators
current playback highlight
optional tempo label when overridden
Beat Display

The number of beat circles is generated automatically from the numerator.

Examples

4/4

● ○ ○ ○

5/4

● ○ ○ ● ○

7/8

● ○ ○ ● ○ ○ ○

Changing the meter automatically regenerates the beat layout.

Accent Editing

Each beat is tappable.

Tap cycles through accent states.

Example:

Strong

↓

Medium

↓

Weak

↓

Muted

↓

Strong

The UI updates immediately.

BPM

Tempo should be editable.

Each region may either:

inherit the previous BPM

or

override it

Display examples

Inherited

120 BPM

Override

♩ = 140

Tapping the BPM opens a tempo editor.

Playback

During playback:

playhead remains centered
timeline scrolls underneath
current bar highlighted
current beat highlighted
smooth automatic scrolling
user scrolling temporarily disables auto-follow
Region Editing

Tapping a region opens an editor allowing:

meter
number of bars
BPM
accent pattern

Long press opens:

Duplicate
Split
Merge
Delete
Add Region

Provide an Add Region button.

User chooses:

meter
number of bars
BPM (inherit or override)

The region is appended after the selected region.

Visual Style

The interface should resemble a lightweight DAW.

Use:

rounded cards
subtle separators
large touch targets
clear typography
strong playback colors

Avoid modal-heavy workflows.

Most edits should occur directly from the timeline.

Constraints

Do not redesign the playback architecture.

Do not redesign the compiler.

Do not redesign the domain model.

Only redesign the Song Editor UI and interaction model.

The result should feel similar to Cubase's Signature Track while remaining simple enough for musicians using a mobile phone.

I would then follow this with separate prompts for:

Implementing the Signature Timeline UI (React Native components and layout).
Connecting the timeline to the existing domain model and mutations.
Integrating playback highlighting and auto-scroll with the existing SongPlaybackService and Redux state.
Adding region editing, BPM overrides, and accent editing while reusing the existing compiler and persistence layer.

Breaking it up this way reduces the risk of large, conflicting changes and keeps the implementation aligned with the architecture you've already documented.




I actually think that's an excellent idea, and I'd make it part of the redesign from the start.

The Song editor is fundamentally different from the rest of PulseGrid:

Quick Metronome → portrait-first, simple controls.
Song Editor → timeline editing, much closer to a DAW.

Trying to squeeze a horizontal timeline into portrait mode usually means tiny bars, lots of scrolling, or hiding information. Landscape gives you enough width to show multiple meter regions, BPM changes, and playback progress simultaneously.

I'd add this to the design brief as a first-class requirement.

Prompt Addition — Landscape Song Workspace
Device Orientation

The Song feature should behave like a lightweight DAW workspace.

Orientation
Lock the Song tab (Library and Editor) to landscape orientation only.
The remainder of the application (Quick Metronome, Settings, etc.) should continue supporting portrait orientation exactly as today.
Entering the Song tab should automatically rotate the device to landscape when rotation is enabled.
Leaving the Song tab should restore the application's normal portrait behavior.
Layout Goals

Landscape should maximize horizontal space for timeline editing.

The layout should resemble:

┌────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ Song Name                                              120 BPM                     ▶ Play  ⏸ Pause        │
├────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                            │
│  4/4                         7/8                             5/4                          6/8              │
│                                                                                                            │
│ ┌──────────────┐      ┌──────────────────┐          ┌──────────────┐          ┌──────────────┐            │
│ │●○○○│●○○○│     │      │●○○●○○○│●○○●○○○│     │          │●○○●○│●○○●○│     │          │●○●○●○│●○●○●○│     │
│ └──────────────┘      └──────────────────┘          └──────────────┘          └──────────────┘            │
│                                                                                                            │
├────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ + Region          Zoom −   Zoom +           Current Bar 5 / Beat 3                    Auto Follow ON      │
└────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
Automatic Playback Scrolling

During playback:

Keep the playhead fixed near the center of the screen.
Scroll the timeline underneath it smoothly.
Highlight the current bar.
Highlight the current beat.
Display the active time signature.
Display the active BPM.

If the user manually scrolls:

pause auto-follow,
allow free navigation,
automatically resume auto-follow after a short delay or when playback reaches the visible area.
Touch Interaction

Landscape should prioritize direct editing.

Users should be able to:

tap a beat to edit accents,
tap a BPM label to edit tempo,
tap a time signature to edit the meter,
tap the bar count to change the number of bars,
long-press a region for advanced actions.

Avoid unnecessary modal screens whenever possible.

Design Philosophy

The Song workspace should feel closer to a music production timeline than a form-based editor.

The goal is to let musicians build a song by interacting directly with the timeline rather than navigating through multiple dialogs.

One suggestion beyond landscape

I'd also consider making the Song Library stay in portrait and locking only the Song Editor to landscape.

That gives you:

Library (Portrait): browse songs, create/delete songs, quick play.
Editor (Landscape): full-screen DAW-style workspace.

This is a pattern used by several creative apps because browsing benefits from portrait lists, while editing benefits from horizontal space. It also avoids forcing users to rotate their device just to select a song. I think that would provide the best overall experience while keeping the editor as spacious as possible.