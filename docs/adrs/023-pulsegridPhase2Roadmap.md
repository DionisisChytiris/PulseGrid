Here’s a Phase 2 roadmap prompt you can paste into Cursor. It forces it to build on top of your stable native audio engine without breaking anything. 

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



Why this is powerful

This prompt forces Cursor into:

feature mode (not architecture mode)
safe boundaries (no audio regression)
native-first thinking
incremental enhancement instead of rewrites