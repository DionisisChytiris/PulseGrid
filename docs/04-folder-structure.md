# Folder Structure

PulseGrid uses Clean Architecture with feature modules. See ADR 004 (`docs/adrs/004-project-structure.md`) for the authoritative specification.

```
src/
├── presentation/
│   ├── navigation/
│   │   ├── RootNavigator.tsx          # Bottom tab navigator (entry point)
│   │   ├── HomeStackNavigator.tsx     # Home tab stack
│   │   ├── SongsStackNavigator.tsx    # Songs tab stack
│   │   └── types.ts                   # Typed route params
│   ├── screens/
│   │   ├── HomeScreen.tsx
│   │   ├── QuickMetronomeScreen.tsx
│   │   ├── SongLibraryScreen.tsx
│   │   ├── SongEditorScreen.tsx
│   │   └── SettingsScreen.tsx
│   ├── components/
│   │   ├── common/
│   │   ├── metronome/
│   │   └── timeline/
│   └── hooks/
├── application/
│   ├── services/
│   └── useCases/
├── domain/
│   ├── entities/
│   ├── repositories/
│   └── valueObjects/
├── infrastructure/
│   ├── database/
│   ├── audio/
│   ├── storage/
│   └── purchases/
├── features/
│   ├── metronome/
│   ├── songs/
│   └── settings/
├── store/
├── theme/
├── utils/
└── types/
```

## Layer Responsibilities

| Layer | Contains | Must not |
|-------|----------|----------|
| `presentation/` | Screens, components, navigation, UI hooks | Business logic, SQLite, audio scheduling |
| `application/` | Services, use cases | Render UI |
| `domain/` | Entities, repository interfaces, value objects | Platform-specific code |
| `infrastructure/` | SQLite, audio bridge, storage, purchases | UI |
| `features/` | Redux slices and feature-specific state | Shared state leakage across features |
| `store/` | Root reducer, typed hooks | Feature business logic |

## Feature Module Example

```
features/metronome/
  metronomeSlice.ts
  metronomeSelectors.ts   (optional, when needed)
```

Screens live under `presentation/screens/`, not inside `features/`. Services live under `application/services/`.

## Screens

All screen components stay in a **flat** `presentation/screens/` folder. Tab and stack wiring lives in `presentation/navigation/` — screens are not grouped into subfolders per tab.

| File | Tab | Stack route | Registered in |
|------|-----|-------------|---------------|
| `HomeScreen.tsx` | Home | `Home` | `HomeStackNavigator.tsx` |
| `QuickMetronomeScreen.tsx` | Home | `QuickMetronome` | `HomeStackNavigator.tsx` |
| `SongLibraryScreen.tsx` | Songs | `SongLibrary` | `SongsStackNavigator.tsx` |
| `SongEditorScreen.tsx` | Songs | `SongEditor` | `SongsStackNavigator.tsx` |
| `SettingsScreen.tsx` | Settings | — (tab root) | `RootNavigator.tsx` |

Naming: `{Name}Screen.tsx`, default export, one screen per file.

When adding a screen:

1. Create `presentation/screens/{Name}Screen.tsx`.
2. Add the route to the correct param list in `types.ts`.
3. Register it in the matching stack (`HomeStackNavigator`, `SongsStackNavigator`) or as a new tab in `RootNavigator`.

Do not put screens inside `features/` — features own Redux state; screens only render UI and dispatch actions.

## Navigation

Use **React Navigation**. Do not use Expo Router. See ADR 009.

The app uses a **bottom tab navigator** as the root, with **native stack navigators** nested inside tabs that need push navigation.

```
App
└── NavigationContainer
    └── RootNavigator (Bottom Tabs)
        ├── Home tab → HomeStackNavigator (Native Stack)
        │   ├── HomeScreen
        │   └── QuickMetronomeScreen
        ├── Songs tab → SongsStackNavigator (Native Stack)
        │   ├── SongLibraryScreen
        │   └── SongEditorScreen
        └── Settings tab → SettingsScreen
```

| File | Role |
|------|------|
| `RootNavigator.tsx` | Bottom tabs: Home, Songs, Settings |
| `HomeStackNavigator.tsx` | Stack for the Home tab |
| `SongsStackNavigator.tsx` | Stack for the Songs tab |
| `types.ts` | `RootTabParamList`, `HomeStackParamList`, `SongsStackParamList` |

Settings is a single screen on its tab (no nested stack yet). Add a `SettingsStackNavigator.tsx` later if Settings needs pushed screens (e.g. About, Sound packs).

New screens that belong to a tab go in that tab’s stack navigator. New top-level destinations get a new tab or a dedicated stack under an existing tab.

## Rules

* Keep dependency direction: presentation → application → domain → infrastructure interfaces.
* Avoid shared state leakage between features.
* Each feature owns its slice, selectors, and tests.
* Keep route param types in `presentation/navigation/types.ts`.
