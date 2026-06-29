# State Management

Global state is managed with Redux Toolkit. See ADR 002 and ADR 004.

## Slices (initial set)

* `metronomeSlice` — quick metronome UI state (`features/metronome/`)
* `songsSlice` — song library and editor UI state (`features/songs/`)
* `settingsSlice` — app preferences (`features/settings/`)

Store wiring lives in `src/store/` (`index.ts`, `hooks.ts`).

Redux stores UI state only.

Heavy business logic belongs in services.

Reducers must remain pure.

Example:

Good:

setCurrentBar()

Bad:

playAudio()

Selectors must be memoized.

Use Reselect for derived state.
