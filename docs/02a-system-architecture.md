# System Architecture (Current State)

This document extends [`02-system-architecture.md`](./02-system-architecture.md) with the architecture as implemented today. Use it as the reference for future changes. The original file remains a short layer overview; this file captures product shape, dual playback modes, Song Editor UI, and cross-cutting patterns that have landed since the initial scaffold.

For folder layout see [`04-folder-structure.md`](./04-folder-structure.md) (note: some paths there are outdated — see **Doc drift** below). For audio internals see [`06-audio-engine.md`](./06-audio-engine.md). For domain entities see [`03-domain-model.md`](./03-domain-model.md).

---

## Architecture Style

**Clean Architecture with feature modules.**

```
Presentation Layer
        ↓
Application Layer
        ↓
Domain Layer
        ↓
Infrastructure Layer (interfaces implemented here)
```

Redux feature slices (`src/features/`) sit beside the layers and hold **UI state only**. Heavy logic lives in application services and domain code.

---

## Product-Level Architecture

PulseGrid is no longer a single metronome screen. It has two playback paradigms that share one native audio engine:

| Mode | User entry | Compiler | Native mode | Primary Redux slice |
|------|------------|----------|-------------|---------------------|
| **Quick Metronome** | Home tab | None (live BPM / time signature) | `QUICK_METRONOME` | `metronome` |
| **Song Timeline** | Song Editor play | `SongPlaybackCompiler` | `SONG_TIMELINE` | `songPlayback` |

**Quick Metronome** is the default Home experience: tap tempo, accents, subdivisions, transport.

**Song Timeline** is a deterministic, compiled playback path: `Song → Section[] → Bar[]` is expanded into a flat `PlaybackEvent[]`, scheduled predictively on the native thread, with a JS cursor for UI follow.

The native engine (Oboe on Android, Swift on iOS) is the **timing authority**. JavaScript receives `onTick` events for visual sync only; it does not drive click deadlines.

Relevant ADRs: [038](adrs/038-Song-PlaybackCompiler.md), [039](adrs/039-IntegrateSongCompilerIntoMetronomeEngine.md), [040](adrs/040-SongTimelineIntegration.md), [041](adrs/041-RuntimePlaybackCursor.md), [042](adrs/042-SongSchedulerBridge.md), [043](adrs/043-User-facingSongModeUIIntegration.md), [049](adrs/049-DesignSignatureTimeline.md).

---

## Layer Responsibilities

### Presentation Layer (`src/presentation/`)

**Contains:** screens, navigation, UI components, presentation hooks, view models, theme.

**Responsibilities:**

- Render UI and layout (including landscape Song Editor and Signature Timeline)
- Dispatch Redux actions and call application services
- Map domain data to view models (`presentation/viewModels/`)
- Manage screen-level concerns (orientation lock, custom keyboard focus)

**Must not:** compile songs, schedule audio, persist to storage, or encode business rules.

#### Navigation

React Navigation (not Expo Router). Bottom tabs with nested native stacks.

```
App (App.tsx)
└── NavigationContainer
    └── RootNavigator (Bottom Tabs)
        ├── Home → HomeStackNavigator
        │   └── QuickMetronome          # Home tab root — no separate HomeScreen
        ├── Songs → SongsStackNavigator
        │   ├── SongLibrary
        │   └── SongEditor { songId }
        └── Settings → SettingsScreen   # Tab root, no nested stack yet
```

| File | Role |
|------|------|
| `navigation/RootNavigator.tsx` | Home, Songs, Settings tabs |
| `navigation/HomeStackNavigator.tsx` | Quick Metronome stack |
| `navigation/SongsStackNavigator.tsx` | Library → Editor |
| `navigation/types.ts` | Typed route params |

#### Key screens

| Screen | Path |
|--------|------|
| Quick Metronome | `screens/QuickMetronomeScreen.tsx` |
| Song Library | `screens/songs/SongLibraryScreen.tsx` |
| Song Editor | `screens/songs/editor/SongEditorScreen.tsx` |
| Settings | `screens/SettingsScreen.tsx` |

#### Song Editor UI stack

The Song Editor is a **landscape-first** editing surface built around the Signature Timeline:

```
SongEditorScreen
├── useSongEditorLandscapeLock()     # landscape on focus, portrait on blur
├── useSongEditor()                  # load/save, bar mutations
├── useSongPlayback()                # transport → SongPlaybackService
├── useEditorCustomKeyboard()        # song name + meter fields
└── SongSignatureTimeline            # primary editor surface
    ├── MeterRegion / BarPreview     # meter blocks, pulse markers
    ├── SegmentEditBottomSheet       # bar count, meter, BPM override, accents
    └── ListFooterComponent          # Add Bar control (aligned with pulse row)
```

Shared timeline logic also lives in `src/components/songTimeline/` (segment grouping, mutations, bottom sheet, constants). This folder predates the Signature Timeline redesign and is actively used by it.

#### Custom keyboard

`presentation/components/CustomKeyboard/` provides an in-app keyboard for fields where the OS keyboard is suppressed (`showSoftInputOnFocus={false}`).

| Piece | Role |
|-------|------|
| `CustomKeyboard.tsx` | ABC/123 layouts, Shift/Caps, slide animation |
| `keyboardLayouts.ts` | Key rows; `placement="auto"` (bottom portrait, right ~45% landscape) |
| `useEditorCustomKeyboard.ts` | `activeField`, focus/blur, value sync, dismiss |

**Integrated fields:** song name (letters), segment meter (numbers). Bar count and BPM still use the system keyboard.

#### Orientation

| Location | Behavior |
|----------|----------|
| `App.tsx` | `lockPortraitUpSafe()` on launch |
| `useSongEditorLandscapeLock.ts` | Landscape while Song Editor is focused |
| `utils/safeScreenOrientation.ts` | Best-effort `expo-screen-orientation` wrappers (no crash if native module missing) |
| `app.json` | `"orientation": "default"` — allows runtime locks |

A dev-client rebuild is required for full orientation support after adding `expo-screen-orientation`.

---

### Application Layer (`src/application/services/`)

**Contains:** orchestration services. `useCases/` exists but is empty.

**Responsibilities:** coordinate domain + infrastructure; bridge Redux and native engine; no UI rendering.

| Service | File | Role |
|---------|------|------|
| **PlaybackService** | `PlaybackService.ts` | Quick Metronome: start/stop, tempo, accents, tap tempo; Redux ↔ `IAudioEngine` ↔ `ITimingSource` |
| **SongPlaybackService** | `SongPlaybackService.ts` | Song Timeline transport: compile, start native song mode, pause/resume/stop/seek; fallback to Quick Metronome on failure |
| **MetronomeTickConsumer** | `MetronomeTickConsumer.ts` | Maps native `TimingTick` → Redux `setTick` for beat indicators |
| **ClickSoundService** | `ClickSoundService.ts` | Click sound catalog hydration and engine sync |
| **SubdivisionAccentSettingsService** | `SubdivisionAccentSettingsService.ts` | Subdivision accent mode/pattern sync |

Singleton wiring: `playbackServiceInstance.ts`, `songPlaybackServiceInstance.ts`, etc.

#### Quick Metronome data flow

```
QuickMetronomeScreen
  → Redux actions (metronomeSlice)
  → PlaybackService
      ├─ NativeAudioEngine (audio + timing)
      ├─ NativeTimingSource → MetronomeTickConsumer → metronomeSlice
      └─ songPlaybackSlice.playbackMode = QUICK_METRONOME
```

#### Song Timeline data flow

```
SongEditorScreen → useSongPlayback → SongPlaybackService
  ├─ SongPlaybackCompiler.compileSong(song)
  ├─ SongPlaybackCursor + SongSchedulerAdapter (lookahead snapshots)
  ├─ MetronomeEngine.start({ mode: SONG_TIMELINE, ... })
  ├─ serializeTimelineForNative (display BPM → engine BPM per event)
  └─ Native onTick → songPlaybackSlice (currentBarIndex, debugTick)
```

`SongPlaybackService` stops Quick Metronome before starting song mode. On native failure it calls `handleSongModeFallback` and restarts Quick Metronome with `songTimelineFallbackToQuick`.

---

### Domain Layer (`src/domain/`)

**Contains:** music model, compilers, tempo math, metronome settings, repository interfaces, editor mutations.

**Must not:** import React, Redux, or platform APIs (with the pragmatic exception of `AsyncStorageSongRepository` living in domain for now).

#### Song document model

```
Song
 └── Section[]
      └── Bar[]
           ├── meter: Meter { numerator, denominator, grouping[] }
           ├── accentPattern: AccentPattern
           ├── tempoDefinition?: TempoDefinition { bpm, beatUnit }  # optional per-bar override
           ├── clickPattern?, repeatCount?
```

Legacy `TempoEvent` is migrated to `tempoDefinition` on load (`songSerialization.ts`).

#### Two compiler pipelines

| Compiler | Path | Output | Used for |
|----------|------|--------|----------|
| **SongPlaybackCompiler** | `music/compiler/SongPlaybackCompiler.ts` | `CompiledPlaybackSequence` / `PlaybackEvent[]` | **Runtime playback** via `SongPlaybackService` |
| **SongTimelineCompiler** | `music/timelineCompiler/SongTimelineCompiler.ts` | `TimelineCompiledPlaybackSequence` | Analysis, validation, ns-duration inspection, stress tests |

Runtime playback path:

```
Song → compileSong() → PlaybackEvent[]
  → SongPlaybackCursor
  → SongSchedulerAdapter → ScheduledTickSnapshot[]
  → serializeTimelineForNative → native scheduler
```

#### Tempo and beat-unit model

**Central rule:** meter **denominator** defines the pulse grid, consistent across Quick Metronome and Song Timeline.

| Denominator | Pulse beat unit | Pulses per quarter-note grid slot |
|-------------|-----------------|-----------------------------------|
| /2 | Half note | 0.5 |
| /4 | Quarter note | 1 |
| /8 | Eighth note | 2 |
| /16 | Sixteenth note | 4 |

Key functions in `domain/metronome/PulseGridSettings.ts`:

- `toDisplayBpm(engineBpm, denominator)` / `toEngineBpm(displayBpm, denominator)` — UI shows display BPM; Redux stores engine BPM (Quick Metronome)
- `pulseDurationMsFromDisplayBpm(displayBpm, denominator)` — wall-clock pulse duration for Signature Timeline scroll/animation
- `inferBeatUnitFromDenominator(denominator)` in `Meter.ts`
- `computePulseDurationNs(tempoDefinition, pulseBeatUnit)` in `music/tempo/beatDuration.ts`

**Engine boundary:** `serializeTimelineForNative.ts` and `ScheduledTickSnapshot.ts` apply `toEngineBpm` before native scheduling so song events match Quick Metronome timing semantics.

#### Editor mutations

`domain/music/editor/songEditorMutations.ts` — `addBarToSong`, `updateBarMeter`, `updateBarBpm`, meter presets, immutable clones.

Segment-level grouping for the UI: `src/components/songTimeline/buildTimelineSegments.ts` + `segmentSongMutations.ts`.

#### Persistence

| Piece | Path | Notes |
|-------|------|-------|
| `SongRepository` | `music/storage/SongRepository.ts` | Interface |
| `AsyncStorageSongRepository` | `music/storage/AsyncStorageSongRepository.ts` | Key `pulsegrid:songs:v1` |
| `songSerialization.ts` | `music/storage/songSerialization.ts` | JSON + legacy migration |

SQLite and RevenueCat folders exist under `infrastructure/` but are not implemented yet.

---

### Infrastructure Layer (`src/infrastructure/`)

**Contains:** platform adapters — audio bridge, settings persistence, (planned) database and purchases.

#### Audio infrastructure (`infrastructure/audio/`)

| File | Role |
|------|------|
| `IAudioEngine.ts` | Engine contract |
| `NativeAudioEngine.ts` | Implements via `modules/native-audio` |
| `NoopAudioEngine.ts` | Web / missing native module fallback |
| `MetronomeEngine.ts` | Facade over `QUICK_METRONOME` and `SONG_TIMELINE` |
| `PlaybackMode.ts` | Enum aligned with native `PlaybackMode.kt` |
| `SongModeNativeBridge.ts` | Song session lifecycle + predictive scheduler bridge |
| `serializeTimelineForNative.ts` | `PlaybackEvent` → native wire format |
| `NativeTimingSource.ts` | Forwards native `onTick` to JS |
| `VisualTickScheduler.ts` | JS fallback timing (web/dev) |

#### Native module (`modules/native-audio/`)

Expo local module. Android uses Oboe (AAudio) for sample-accurate playback; iOS has Swift `MetronomeEngine` + `ClickSoundPlayer`.

```
NativeAudioModule (TS bridge)
  → MetronomeEngine (Kotlin / Swift)
      ├── QuickMetronomeEventSource
      └── SongTimelineEventSource
              → OboeEngine / SamplePlayer (Android)
```

#### Settings persistence

`infrastructure/persistence/metronomeSettingsStorage.ts` — AsyncStorage for click sounds and subdivision accent preferences.

---

## State Management

Redux Toolkit. Store: `src/store/index.ts`.

| Slice | Path | Holds |
|-------|------|-------|
| `metronome` | `features/metronome/metronomeSlice.ts` | Engine BPM, time signature, accent pattern, subdivision, beat indices, `isPlaying` |
| `settings` | `features/settings/settingsSlice.ts` | Click sound IDs, subdivision accent mode/pattern, hydration flag |
| `songPlayback` | `features/songPlayback/songPlaybackSlice.ts` | `playbackMode`, play/pause, `currentBarIndex`, `debugTick`, fallback reason |

**Note:** `features/songs/` is empty. Song documents live in `AsyncStorageSongRepository`; playback transport state lives in `songPlayback`.

Redux stores UI state only. Services own orchestration. Reducers stay pure — no `playAudio()` inside reducers.

---

## Signature Timeline — Visual Grid Architecture

The Signature Timeline UI (`presentation/components/songSignatureTimeline/`) renders a **fixed quarter-note ruler** with pulse density driven by meter denominator. This is presentation-only; it does not affect the playback compiler or native engine.

Constants: `signatureTimelineConstants.ts`

- `GRID_SLOT_WIDTH` (44px) — one quarter-note division
- `pulsesPerGridDivision(denominator)` — how many pulse markers fit in one grid slot
- `pulseSlotWidth(denominator)` — horizontal span per pulse
- `pulseMarkerCenterX(pulseIndex, denominator)` — anchor pulses on grid lines; subdivisions evenly between lines
- Bar width = `numerator × pulseSlotWidth(denominator)`

Playback highlight and auto-scroll use `pulseDurationMsFromDisplayBpm` so visual timing matches Quick Metronome beat-unit semantics.

Design spec: [ADR 049](adrs/049-DesignSignatureTimeline.md).

---

## Dependency Direction

```
presentation
  → application (services)
  → domain (entities, compilers, interfaces)
  → infrastructure (implements domain/audio contracts)

features/* (Redux)
  ← read/written by presentation and services
  ✗ must not contain business logic
```

Presentation hooks (`useSongEditor`, `useSongPlayback`, `useQuickMetronome`) are the usual boundary between screens and services/domain.

---

## Cross-Cutting Concerns

### Stable boundaries (do not change casually)

These components were deliberately kept stable while building Song Editor UI:

- `SongPlaybackService`
- `SongPlaybackCompiler`
- `songPlaybackSlice` playback state shape
- Native `MetronomeEngine` / Oboe scheduling internals

UI work (Signature Timeline, custom keyboard, orientation, library swipe-delete) should stay on the presentation and view-model side unless a product change explicitly requires engine work.

### Fallback behavior

If song timeline native start fails, `SongPlaybackService` falls back to Quick Metronome and records `fallbackReason` in `songPlaybackSlice`. The editor remains usable; playback degrades gracefully.

### Web / dev without native module

`NoopAudioEngine`, `VisualTickScheduler`, and safe orientation wrappers allow the app to run without a linked native binary. Full audio and orientation require an Expo dev client build.

---

## Doc Drift (vs older docs)

| Topic | Older docs say | Current code |
|-------|----------------|--------------|
| Home screen | `HomeScreen.tsx` exists | Home tab opens directly to Quick Metronome |
| Song screens | Flat `presentation/screens/` | `screens/songs/` and `screens/songs/editor/` |
| Songs Redux slice | `features/songs/` | Empty; use domain repository + `songPlayback` |
| Persistence | SQLite | AsyncStorage for songs v1 |
| Timeline UI | `presentation/components/timeline/` | Signature Timeline + `src/components/songTimeline/` |

When in doubt, prefer this file and the ADRs listed above over `04-folder-structure.md` for navigation and Songs paths.

---

## Related Documentation

| Doc | Topic |
|-----|-------|
| [02-system-architecture.md](./02-system-architecture.md) | Original short layer overview |
| [03-domain-model.md](./03-domain-model.md) | Entity definitions |
| [04-folder-structure.md](./04-folder-structure.md) | Folder conventions (partially outdated) |
| [05-state-management.md](./05-state-management.md) | Redux rules |
| [06-audio-engine.md](./06-audio-engine.md) | Oboe, scheduler, native module |
| [04a-quick_metronome.md](./04a-quick_metronome.md) | Quick Metronome feature |
| [adrs/049-DesignSignatureTimeline.md](adrs/049-DesignSignatureTimeline.md) | Signature Timeline design |
| [adrs/043-User-facingSongModeUIIntegration.md](adrs/043-User-facingSongModeUIIntegration.md) | Song mode UI integration milestone |

---

## Quick File Index

| Concern | Path |
|---------|------|
| App bootstrap | `App.tsx` |
| Navigation | `src/presentation/navigation/` |
| Song Editor | `src/presentation/screens/songs/editor/SongEditorScreen.tsx` |
| Signature Timeline | `src/presentation/components/songSignatureTimeline/` |
| Custom keyboard | `src/presentation/components/CustomKeyboard/` |
| Timeline shared UI | `src/components/songTimeline/` |
| Playback services | `src/application/services/PlaybackService.ts`, `SongPlaybackService.ts` |
| Song compiler (runtime) | `src/domain/music/compiler/SongPlaybackCompiler.ts` |
| Tempo / BPM model | `src/domain/metronome/PulseGridSettings.ts` |
| Native serialize | `src/infrastructure/audio/serializeTimelineForNative.ts` |
| Native module | `modules/native-audio/` |
| Redux store | `src/store/index.ts`, `src/features/` |
| Song storage | `src/domain/music/storage/AsyncStorageSongRepository.ts` |
