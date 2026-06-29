Implement Subdivision support.

Create:

domain/valueObjects/Subdivision.ts

Supported:

* Quarter
* Eighth
* Triplet
* Sixteenth

Update RuntimeScheduler.

Scheduler should generate Tick events for subdivisions.

Tick should include:

* beatIndex
* subdivisionIndex
* isAccent
* timestamp

PlaybackService and Redux should expose subdivision information.

Visual Beat Indicator should animate subdivisions differently from primary beats.

No audio implementation.
