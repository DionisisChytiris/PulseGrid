# ADR-026: How Metronome Audio Playback Works

**Status:** Current as of audio-fix iteration  
**Scope:** Native click playback only — timing/scheduling is documented separately (ADR-021, ADR-025)

---

## Short answer

| Platform | Playback API | Status |
|----------|--------------|--------|
| **Android** | **SoundPool** | Active — this is what produces sound today |
| **iOS** | **AVAudioPlayer** (pooled instances) | Ready for iOS builds |
| ~~Android AudioTrack pool~~ | Tried, **reverted** | Produced **no sound** on device |

Timing (when to click) lives in **`MetronomeEngine`**.  
Sound (what to play) lives in **`ClickSoundPlayer`**.

---

## End-to-end flow

```
JS: PlaybackService / NativeAudioEngine
        │  initialize(), start({ bpm, subdivision, accentPattern })
        ▼
NativeAudioModule (Expo bridge)
        │  clickSoundPlayer.initialize()
        │  metronomeEngine.start(...)
        ▼
MetronomeEngine (native timing thread)
        │  absolute deadline scheduler (Model A — monotonic totalTickCount)
        │  on each tick → playClickForTick()
        ▼
ClickSoundPlayer
        │  Android: SoundPool.play(...)
        │  iOS:     AVAudioPlayer.play() from round-robin pool
        ▼
Speaker
```

**Important:** JavaScript does **not** trigger clicks. JS only receives `onTick` events for UI (beat indicators). Audio is fired on the native metronome thread.

---

## Android: SoundPool (current)

**File:** `modules/native-audio/android/.../ClickSoundPlayer.kt`

### Lifecycle

1. **`initialize()`** (called from JS via `NativeAudioModule.initialize()`)
   - Creates one `SoundPool` (`maxStreams = 16`)
   - `AudioAttributes`: `USAGE_GAME` + `CONTENT_TYPE_SONIFICATION`
   - Loads three WAV files from the **Expo module** resources (not `android/app/src/main/res/raw/`):
     - `modules/native-audio/android/src/main/res/raw/click_accent.wav`
     - `modules/native-audio/android/src/main/res/raw/click_normal.wav`
     - `modules/native-audio/android/src/main/res/raw/click_subdivision.wav`
   - Maps: `R.raw.click_accent` → `accentSoundId`, etc.
   - Waits for async `OnLoadCompleteListener` callbacks
   - Runs silent **warm-up** plays (volume 0) to reduce first-click latency

2. **On each metronome tick** — `MetronomeEngine.playClickForTick()`:
   - `subdivisionIndex == 0` (downbeat):
     - accent pattern true → `playAccent()`
     - else → `playNormal()`
   - `subdivisionIndex > 0` (16th / triplet / eighth off-beats):
     - `playSubdivision()`

3. **`SoundPool.play(soundId, leftVol, rightVol, priority, loop, rate)`**
   - Returns `streamId` (0 = failure / no free stream)
   - All sounds use **play priority 1** (accent loudness comes from the WAV + volume, not priority preemption)
   - Volumes: accent `1.0`, normal `0.85`, subdivision `0.65`

### What we tried on Android (and reverted)

| Approach | Result |
|----------|--------|
| SoundPool priority 2 for accent | Fixed “gap before accent” but caused stream preemption |
| Uniform priority 1 | Accent gap improved; kept |
| **AudioTrack pool** (low-latency streaming) | **No sound** — `MODE_STREAM` write/play ordering unreliable on device; reverted to SoundPool |
| Longer accent sample (14 ms) vs normal (10 ms) | Beat 1 felt heavier; replaced with equal 10 ms accent/normal |

### Temporary diagnostics

`ClickSoundPlayer` currently logs SoundPool lifecycle (creation hashCode, load resId→soundId, play streamId, `PLAY FAILED` on first `streamId==0`). Remove when debugging is done.

---

## iOS: AVAudioPlayer pools (for future builds)

**File:** `modules/native-audio/ios/ClickSoundPlayer.swift`

- Same three WAV files in `modules/native-audio/ios/Assets/`
- **Round-robin pools** so overlapping clicks do not cut each other:
  - 2× accent, 4× normal, 12× subdivision players
- Single `AVAudioPlayer` per sound was abandoned — restarting `currentTime = 0` on one player **cuts** the previous click, which sounds uneven at fast subdivisions.

---

## Click samples

**Generator:** `scripts/generate_metronome_clicks.py`  
**Source copies:** `assets/audio/`

| File | ~Duration | Use |
|------|-----------|-----|
| `click_accent.wav` | 10 ms | Downbeat accents (higher pitch, louder) |
| `click_normal.wav` | 10 ms | Non-accent downbeats |
| `click_subdivision.wav` | 5 ms | 16ths, triplets, eighth off-beats (lighter) |

All: mono, 44.1 kHz, PCM 16-bit. Envelope uses **cosine** so sample 0 has peak energy (instant attack).

---

## What is *not* responsible for sound

| Layer | Role |
|-------|------|
| `NativeTimingSource.ts` | UI tick events only (`onTick` → Redux) |
| `PlaybackService.ts` | Start/stop/tempo/pattern — no `play()` |
| `ExpoAudioEngine` | Legacy / web fallback — not used on device native path |
| JS timers | Not used for metronome beats |

---

## Why 16th notes can still sound uneven above ~120 BPM

**Timing has been verified** (~80 ms spacing at 177 BPM 16ths in logs). Uneven *sound* with correct timestamps usually means **playback layer**, not scheduler.

### Likely causes (Android + SoundPool)

1. **Mixer latency jitter**  
   `SoundPool.play()` returns immediately; actual speaker output goes through Android’s audio mixer with variable delay. Dense 16ths (interval at 120 BPM ≈ **125 ms**; at 180 BPM ≈ **83 ms**) expose this more than quarter notes.

2. **Stream reuse / masking**  
   Even with 5 ms samples, SoundPool may hold streams briefly. Overlapping energy at high density changes perceived loudness (“bouncy” feel) even when every `streamId > 0`.

3. **Downbeat vs subdivision timbre**  
   Beat boundaries switch between `playSubdivision()` and `playNormal()` / `playAccent()`. Different pitch/length/volume can feel like uneven spacing even when timing is exact.

4. **`Thread.sleep` coarse wait** (scheduler side, not SoundPool)  
   MetronomeEngine uses `Thread.sleep(remainingMs)` for long waits; only the last ~2 ms spin-waits. This affects *when* `play()` is called, but logs showed stable timestamps — so this is a secondary suspect for *sound* unevenness.

### How to confirm

```bash
adb logcat -s ClickSoundPlayer MetronomeEngine SubdivisionTiming
```

- **Timing OK, audio uneven:** `SubdivisionTiming` stable, `streamId` always > 0 → SoundPool/mixer/perception issue  
- **Playback failing:** `streamId=0` or `PLAY FAILED` → pool capacity or load problem  
- **Timing bad:** `SubdivisionTiming` errorMs growing → scheduler issue (separate from this ADR)

---

## Sensible next steps (not yet implemented)

These would target **audio evenness only**, without changing timing math:

1. **Oboe / AAudio one-shot buffer** — lower and more consistent latency than SoundPool for rapid clicks  
2. **Even quieter / shorter subdivision sample** — less masking at 150+ BPM  
3. **Single timbre for all ticks, accent = volume only** — reduces perceptual “bounce” at beat boundaries  
4. **Remove temporary `Log.d` spam** — reduces metronome-thread work after diagnosis  
5. **iOS:** validate same samples + player pools on device when you build for iOS

---

## Key files

| File | Purpose |
|------|---------|
| `ClickSoundPlayer.kt` | Android SoundPool load/play |
| `ClickSoundPlayer.swift` | iOS AVAudioPlayer pools |
| `MetronomeEngine.kt` / `.swift` | When to click (`playClickForTick`) |
| `NativeAudioModule.kt` / `.swift` | Expo bridge, `initialize` / `start` |
| `NativeAudioEngine.ts` | JS entry to native lifecycle |
| `scripts/generate_metronome_clicks.py` | Regenerate WAV assets |

---

## Rebuild reminder

Native audio changes (Kotlin, Swift, WAV assets) require a **dev client rebuild**. Metro hot reload does not update `ClickSoundPlayer` or bundled `res/raw` files.
