# Services

Services encapsulate business logic.

Examples:

SongService
PlaybackService
ImportService

Service Rules:

Services may:

* call repositories
* call native modules

Services may not:

* render UI

Examples:

createSong()
duplicateSong()
importMidi()
