Step 12 — Runtime Scheduler + Visual Beat System
Goal

When you press Start, you should see:

Console logs ticking in time
A pulsing visual dot per beat
Accent beat clearly marked (beat 1)

No native audio yet.

Architecture (important)

We are creating a simulation runtime layer:

PlaybackService
      ↓
RuntimeScheduler
      ↓
Tick events
      ↓
Redux (beat state)
      ↓
UI (dots animate)
Part 1 — Create Tick model (domain)

Ask Cursor:

Create a Tick event model in domain/timing.

Tick should include:

- beatIndex (number)
- isAccent (boolean)
- timestamp (number)

Keep it a pure TypeScript type or interface.
Part 2 — Create RuntimeScheduler (execution layer)
Create domain/timing/RuntimeScheduler.ts

Requirements:

- Uses BeatClock from Step 11
- Generates Tick events continuously while running
- No audio logic
- No setInterval for audio (only for simulation allowed)
- Must support start() and stop()

On each tick:
- log to console:
  "TICK beat X (accent?)"

- call a callback:
  onTick(tick: Tick)

BPM should affect timing speed.

Example:
120 BPM → 500ms per beat
Part 3 — Connect to PlaybackService
Update PlaybackService to:

- create an instance of RuntimeScheduler
- on start():
    start scheduler
- on stop():
    stop scheduler

Subscribe to onTick and dispatch ticks upward
Part 4 — Add Redux state for beat visualization
Add to playback Redux slice:

- currentBeat: number
- isAccent: boolean

Create action:

setTick(tick: Tick)

PlaybackService should dispatch setTick.

Part 5 — Build visual beat dots (THIS IS THE FUN PART)

Now UI.

Ask Cursor:

Update QuickMetronomeScreen to show beat indicators.

Add a row of 4 dots (for now assume 4/4):

Visual behavior:

- The active beat dot should scale up slightly (1.0 → 1.5)
- Accent beat (beat 1) should be a different color (e.g. orange or red)
- Inactive beats should be gray

Use Redux state:
- currentBeat
- isAccent

Animation:
- simple scale animation or animated style
- no external libraries required beyond React Native Animated
What you will see after this

When you press Start, you will get:

Console:
TICK beat 1 (accent)
TICK beat 2
TICK beat 3
TICK beat 4
UI:
● ○ ○ ○   → beat 1 (big + accent color)
○ ● ○ ○
○ ○ ● ○
○ ○ ○ ●
Why this step is critical

This is your first full system loop:

timing exists
state updates exist
UI responds
service layer is active

You are now debugging:

“Does the system behave musically?”

before:

“Does the system sound correct?”

Important design rule (don’t skip this)

Even though we're simulating timing:

keep Scheduler independent of Redux
Redux only stores last Tick
UI only renders state
PlaybackService is the coordinator

This prevents later chaos when native audio arrives.




move time signature below start stop buttons. keep only 4 time signature and add a + to create your own time signature. 
