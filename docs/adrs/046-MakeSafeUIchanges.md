This is actually one of the most important habits to develop when working with Cursor on a project like PulseGrid.

The key is to tell Cursor what is off-limits before you tell it what to change. Think of it like giving it a "construction permit" that defines the work area.

For PulseGrid, I'd use a template like this for every UI task.

PulseGrid UI-only prompt template
GOAL

This task is STRICTLY a UI / UX refactor.

ONLY modify:

- React Native components
- Screens
- Styles
- Presentation layer
- Icons
- Layout
- Animations
- Hooks used only for UI
- UI selectors if necessary

DO NOT modify:

- MetronomeEngine (Kotlin)
- OboeEngine
- ClickSoundPlayer
- ClickEventQueue
- NativeAudioModule
- JNI
- C++
- Scheduling logic
- Timing calculations
- Song compiler
- Playback compiler
- Playback cursor
- Playback adapter
- Redux playback architecture
- Audio services
- Timing services

If any of these files require changes,
STOP and explain why instead of changing them.

The audio engine is considered production-stable and must remain untouched.

Then describe the UI change below it.

I would go even further

Since your audio engine is now in very good shape, I'd tell Cursor to treat it as frozen.

For example:

Audio Layer Status:

Production Stable

Do not refactor.

Do not rename.

Do not optimize.

Do not move files.

Do not "clean up".

Do not modernize.

Do not simplify.

Only consume its public APIs.

That prevents Cursor from deciding to "improve" something that isn't broken.

For example

Instead of writing:

Change the Quick Metronome page.

Write:

This task affects ONLY:

src/presentation/screens/home/**
src/components/**
styles/**

and

Everything under:

modules/native-audio/

is READ ONLY.
I also recommend creating "protected zones"

Based on everything we've built together, I'd mentally divide your project like this:

🟢 Safe to modify frequently
Screens
Components
Themes
Icons
Navigation
Bottom tabs
Song editor
Timeline UI
Forms
Storage
AsyncStorage
View models
Presentation hooks
🟡 Modify only when intentionally adding features
Song compiler
Playback cursor
Playback adapter
Song domain
Redux playback slice
🔴 Frozen unless there's a real bug
OboeEngine
SamplePlayer
AudioRenderer
ClickEventQueue
MetronomeEngine
NativeAudioModule
JNI
Frame offset logic
Hardware timestamp logic
Predictive scheduling

Those represent months of work and careful testing. I'd avoid touching them for cosmetic changes.

One more trick that works well

End your prompt with:

Before making changes:

List every file you intend to modify.

If any file is outside the UI layer,

stop and explain why before editing.

That forces Cursor to "show its plan" first, which makes it much easier to catch unintended changes.

I actually think PulseGrid has reached the point where it's worth adopting a simple development rule:

Audio engine → stable platform (rarely changed).
Domain layer → evolves when you add musical capabilities.
UI layer → changes freely as you refine the user experience.

That separation will make it much easier to keep improving the app without accidentally introducing regressions in the timing and playback architecture you've already validated.