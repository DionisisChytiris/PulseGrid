Metronome Modes

Quick Metronome
---------------
Purpose:
Live practice.

Owns:
- tempo
- time signature
- Bar Start
- accent pattern
- subdivision accent settings
- click sound settings

Song Timeline
-------------
Purpose:
Playback of authored music.

Owns:
- compiled playback events
- event accents
- tempo changes
- meter changes
- bar boundaries

Shared
------
- scheduler
- audio engine
- ClickSoundPlayer
- BAR / ACCENT / CLICK roles

Rule
----
Quick Metronome state must never modify Song Timeline playback semantics.
Song Timeline must only follow its compiled events.