Here’s a clean “handover prompt” you can paste into Cursor so it understands the full state and continues correctly next time.

📌 Cursor Handover Prompt — PulseGrid Current State
You are continuing development of a React Native (Expo Dev Client) project called PulseGrid.

DO NOT REBUILD ARCHITECTURE OR RE-INTRODUCE OLD SYSTEMS.
Continue from the current working native audio engine state.

---

CURRENT STATE SUMMARY:

1. Platform Setup:
- Expo Dev Client (NOT managed Expo anymore)
- Android native build is active via expo prebuild + expo run:android
- iOS is not initialized yet (no ios folder)

---

2. Core Architecture (FINALIZED):

PulseGrid is now fully separated into:

UI Layer (JS):
- React Native screens and components
- Redux state management
- PlaybackService / MetronomeTickConsumer
- Handles ONLY visuals (beat dots, UI updates)

Native Layer (Android):
- NativeAudioEngine (MetronomeEngine.kt)
- Native timing loop runs inside native thread
- ClickSoundPlayer handles actual audio playback (SoundPool)
- NativeAudioModule is the bridge to JS

---

3. Audio System (IMPORTANT):

- Audio is FULLY NATIVE (Case A architecture)
- MetronomeEngine is responsible for:
  - timing
  - beat generation
  - calling playAccent / playNormal internally

- Click sounds are NOT triggered from JS anymore
- JS only receives onTick events for UI updates

Correct flow:
MetronomeEngine (native)
  → fireTick()
  → playClickForBeat()
  → ClickSoundPlayer (SoundPool audio)

JS:
  → receives onTick only (UI sync)
  → NO audio calls exist in JS layer

---

4. Known Behavior:
- Android timing is stable (~120 BPM consistent ticks)
- Beat sequence is correct (1–4 cycling)
- Audio plays, but startup beat behavior was previously adjusted to avoid duplicate beat 1 triggers
- No JS → audio bridge calls exist anymore

---

5. Critical Rules (DO NOT VIOLATE):
- NEVER reintroduce JS-based audio scheduling
- NEVER use setTimeout/setInterval for metronome timing
- NEVER move audio back into React layer
- Native engine is the ONLY source of truth for timing + sound

---

6. Current Goal (NEXT WORK PHASE):

Now that audio engine is stable, next features to implement are:

- Tap Tempo
- Subdivisions (1/8, 1/16)
- Accent patterns per bar (not just beat 1)
- Visual beat animations (UI only)
- Optional latency calibration

---

7. IMPORTANT CONTEXT:
The hardest part (native audio engine + timing stability) is already COMPLETE.
Do NOT refactor existing engine unless fixing a confirmed bug.

---

You should continue building features ON TOP of this architecture, not replacing it.
🧠 Why this prompt works

It forces Cursor to:

stop re-architecting
stop reintroducing JS audio bugs
treat native engine as final
move into feature development mode

If you want, I can also give you a “Phase 2 feature roadmap prompt (tap tempo + subdivisions)” so Cursor builds like a proper metronome product instead of random features. 



Here’s a Phase 2 roadmap prompt you can paste into Cursor. It forces it to build on top of your stable native audio engine without breaking anything.

🚀 Cursor Prompt — PulseGrid Phase 2 Roadmap (Features Only)
You are continuing development of PulseGrid AFTER a fully working native audio engine has been implemented.

IMPORTANT:
- DO NOT modify or refactor the NativeAudioEngine timing system
- DO NOT reintroduce JS-based audio
- DO NOT touch MetronomeEngine.kt timing loop unless fixing a confirmed bug
- Build ONLY new features on top of the existing stable architecture

---

CURRENT ARCHITECTURE STATUS:

✔ NativeAudioEngine (Android) is stable and handles:
- timing loop (MetronomeEngine.kt)
- beat generation (1–4 or variable time signature)
- audio playback (ClickSoundPlayer using SoundPool)
- accent + normal click sounds

✔ JS layer:
- receives onTick events only
- handles UI updates (Redux, beat dots, screens)
- MUST NOT handle audio

---

NOW ENTERING PHASE 2 (FEATURE DEVELOPMENT)

Build the following features incrementally:

---

## 1. Tap Tempo (HIGH PRIORITY)

Requirements:
- User can tap a button to set BPM
- Calculate BPM from time intervals between taps
- Smooth averaging over last 4–8 taps
- Send BPM update to NativeAudioEngine via NativeAudioModule.setTempo(bpm)
- Native engine must update tempo WITHOUT restarting audio thread

Edge cases:
- ignore taps > 2 seconds apart (reset sequence)
- ensure no drift in native timing after BPM change

---

## 2. Subdivisions

Add support for:
- 1/4 (current default)
- 1/8
- 1/16

Requirements:
- Subdivisions must be generated in NativeAudioEngine (NOT JS)
- Example:
  - 4/4 at 120 BPM with 1/8 = 8 ticks per bar
- Only beat 1 is accented (for now)

---

## 3. Accent Patterns (BAR-LEVEL CONTROL)

Allow custom accent patterns like:
- 4/4 → [1,0,0,0]
- 7/8 → [1,0,1,0,1,0,0]

Requirements:
- Pattern stored in domain model (not UI)
- Native engine applies accent pattern during tick generation
- JS only sends pattern configuration to native

---

## 4. Visual Beat System (UI ONLY)

Requirements:
- UI shows active beat indicator
- Smooth animation on each onTick
- Optional “pulse effect” per beat (screen or dot scaling)
- MUST NOT trigger audio or timing changes

---

## 5. Performance + Stability Rules

- Native engine remains single source of truth for timing
- No JS interval-based logic allowed
- No duplicated tick listeners
- No audio logic in JS layer
- All timing changes must propagate via NativeAudioModule

---

## FINAL GOAL OF PHASE 2:

PulseGrid becomes a production-grade metronome with:
- stable native timing
- configurable tempo (tap tempo)
- subdivisions
- accent patterns
- smooth UI sync

WITHOUT breaking existing audio stability.
🧠 Why this is powerful

This prompt forces Cursor into:

feature mode (not architecture mode)
safe boundaries (no audio regression)
native-first thinking
incremental enhancement instead of rewrites

If you want next, I can also give you:

👉 Phase 3 prompt (polish + pro metronome features like swing, latency calibration, DAW accuracy mode)