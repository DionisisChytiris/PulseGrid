How to run on physical device - project sdk 56 -> expo go 54   incompatible

px expo start --dev-client

create dev build 
eas build --profile development --platform android
eas build --profile development --platform ios


Build feature by feature

Do not ask:
    Build my metronome app.

Ask:
    Read docs/00-product-vision.md and docs/02-system-architecture.md.
    Design the Redux state for song playback.
    Explain why each field exists.

Then:
    Implement only the Redux slice.
    Do not create UI yet.

Then:
    Generate Jest tests for this slice.

Then:
    Review the implementation for architectural problems.

This mirrors how real teams work.





Architecture Decision Record (ADR)





Ask Cursor to teach, not just code

Good prompts:

    Explain this reducer line by line.
    What are the tradeoffs of this architecture?
    How would a senior engineer review this code?
    What interview questions could be asked from this file?
    Refactor this code for readability but explain every change.



Building App
Step 1  - create folders and files
Implement ADR 0001 exactly. Create all folders and files, Redux setup, navigation, and placeholder screens. No extra features.

Recommended split it into 3 phases
STEP 1 — ONLY folder structure (fast, 10–20 sec)
    Tell Cursor:
    “Create the folder structure from ADR-0001 only. Do not create files.”

STEP 2 — Redux only
    Then:
    “Implement Redux Toolkit store + typed hooks only.”
    Files:
    store/index.ts
    store/hooks.ts#

STEP 3 — Screens only
    Then:
    “Create placeholder screens only (centered text).”

STEP 4 — Navigation only
    Then:
    “Implement React Navigation Native Stack with those screens.”



Development Philosophy (IMPORTANT)
At this stage:
You are NOT building a metronome.
    You are building:
        “A production-ready architecture shell for a metronome system”


What NOT to do yet
Avoid for now:
    audio scheduling
    tempo logic
    timeline model
    database schema design
    complex state
These come AFTER structure is stable.


First Milestone Checklist (Day 1–2)
You are done when:
    App runs on iOS simulator
    App runs on Android emulator
    Bottom tabs work
    Redux store exists
    Folder structure is clean
    No business logic exists yet
    SQLite initializes without errors
    Audio layer exists (empty)


Why this approach works

Most developers fail here because they:

start with audio logic too early
mix UI + timing logic
skip architecture scaffolding
build features before system stability

You are doing the opposite:

✔ stable foundation first
✔ strict boundaries
✔ feature isolation later

This is exactly how production music apps are built.


One thing I've learned with Cursor is that smaller, milestone-based prompts produce much better code than one giant prompt. Each prompt should have a single responsibility and a clear definition of done.

Below is the prompt pack I'd use for Phase 2.

Phase 2 Goal
By the end of Phase 2 we should have:
    Quick Metronome screen
    BPM control
    Time signature selection
    Start / Stop
    Accent on beat 1
    Clean architecture
    No timing implementation yet beyond well-defined interfaces and stubs if native audio isn't being built immediately

Each prompt builds on the previous one.

Prompt 1 — Review the Project
Read the project documentation before making changes.

Review:

- docs/PRODUCT_VISION.md
- docs/ENGINEERING_PRINCIPLES.md
- docs/ARCHITECTURE.md
- docs/FOLDER_STRUCTURE.md
- docs/QUICK_METRONOME.md
- docs/adrs/

Do not write any code yet.

Summarize:

- the architecture
- dependency direction
- responsibilities of each layer
- where the Quick Metronome should be implemented

Point out any inconsistencies before implementation.

Prompt 2 — Create the Domain Layer
Implement the domain layer for the Quick Metronome.

Requirements:

Create:

domain/entities/
domain/valueObjects/

Introduce the domain model needed for Quick Metronome.

The domain should contain only pure business logic.

No React.
No Redux.
No SQLite.
No platform APIs.

Keep the implementation small and focused.

If calculations are not yet needed, create interfaces and placeholders rather than overengineering.


Prompt 3 — Application Layer
Implement the application layer for Quick Metronome.

Create:

application/services/MetronomeService.ts

Responsibilities:

- expose start()
- expose stop()
- expose updateTempo()
- expose updateTimeSignature()

Do not implement audio scheduling yet.

The service should orchestrate the domain and infrastructure layers.

Follow Clean Architecture.



Prompt 4 — Audio Infrastructure
Implement the infrastructure layer for the audio system.

Create:

infrastructure/audio/

Include:

AudioEngine
AudioScheduler

This phase only creates interfaces and stub implementations.

Do not implement native audio playback yet.

The goal is to define responsibilities and dependencies.

The scheduler should expose methods for:

start
stop
updateTempo

Keep the implementation minimal.


Prompt 5 — Redux Slice
Implement the metronome Redux slice.

Location:

features/metronome/

Requirements:

Store only UI state.

Include:

- bpm
- numerator
- denominator
- isPlaying

Reducers must remain pure.

Do not trigger audio.

Create selectors if appropriate.

Use Redux Toolkit.



Prompt 6 — Quick Metronome Screen
Implement QuickMetronomeScreen.

The screen should contain:

- BPM control
- Time signature control
- Start button
- Stop button

Use Redux for UI state.

Do not implement business logic inside the screen.

The screen should communicate with MetronomeService.

Keep components small and reusable.




A Workflow That Works Well with Cursor

Instead of asking Cursor to "build the metronome," work in this cycle:

Read – Ask Cursor to review the relevant docs.
Plan – Have it explain what it's going to build.
Implement – Limit each prompt to one layer or one feature.
Review – Ask it to check for architecture violations.
Test – Add or update tests.
Document – Keep the docs in sync.

That loop keeps the project consistent and makes it much easier to catch architectural drift early.

One recommendation about the audio scheduler

In the earlier discussion we used a lookahead scheduler to explain the architecture. Since your product vision requires sample-accurate playback and explicitly states that scheduling must not rely on JavaScript timers, I would avoid implementing any timer-based scheduler in Phase 2, even as "temporary production code."

Instead, Phase 2 should define the interfaces (AudioEngine, AudioScheduler, MetronomeService) and wire the UI to those abstractions. Once the architecture is in place, Phase 3 can focus on implementing the native audio scheduling layer. That avoids building logic you'll immediately replace and keeps the codebase aligned with your long-term requirements.

Get smarter responses, upload files and images, and more.
Log in
Sign up for free