# Audio Engine

Critical Requirement:

Metronome timing accuracy.

Never use:

setInterval

or

setTimeout

for scheduling clicks.

Architecture:

Redux

↓

PlaybackService

↓

NativeAudioBridge

↓

Platform Engine

Android:

Oboe / AAudio

iOS:

AVAudioEngine / CoreAudio

Responsibilities:

PlaybackService:

* start
* stop
* seek
* loop

Native Engine:

* sample accurate scheduling
* clock management

Redux must never schedule audio.
