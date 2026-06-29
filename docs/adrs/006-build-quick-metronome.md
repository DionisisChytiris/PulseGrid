Step 1 — Create the screen

Tell Cursor:

Create a new QuickMetronomeScreen.tsx inside presentation/screens/. This screen should use React Native and TypeScript. For now, render a simple layout with:

A title "Quick Metronome"
A BPM display showing 120
A Start button
A Stop button
Leave TODO comments where the slider and time signature picker will go later.
Keep the screen purely presentational with no playback logic.

When this is finished, run the app and make sure the screen displays correctly.

Step 2 — Add navigation

Prompt Cursor:

Add QuickMetronomeScreen as the application's initial screen using the existing navigation structure. Do not add any playback functionality yet. Only ensure the app launches directly into the Quick Metronome screen.

Verify that opening the app lands on the screen.

Step 3 — Create the domain model

Prompt:

Create a domain/entities/Metronome.ts entity that represents the metronome state. It should contain:

bpm
isPlaying
timeSignature

Do not include any React or Redux code. This should be a plain TypeScript class or interface.

This introduces the domain layer early.

Step 4 — Create the application service

Prompt:

Create application/services/MetronomeService.ts.

This service should expose:

start()
stop()
setBpm(bpm:number)
setTimeSignature(...)

For now, these methods can contain TODO comments. Do not implement audio yet.

The screen will eventually call this service.

Step 5 — Connect the screen

Prompt:

Update QuickMetronomeScreen so that:

Pressing Start calls metronomeService.start()
Pressing Stop calls metronomeService.stop()
Do not implement playback yet.
Use dependency injection or instantiate the service in a simple way appropriate for the current project structure.

Now the UI talks to the application layer.

Step 6 — Build the BPM slider

Prompt:

Add a BPM slider below the BPM display.

Requirements:

Range 30–240 BPM
Display the current BPM above the slider
Updating the slider should call metronomeService.setBpm()
Keep playback unimplemented for now.

extra info:
slider is not smooth working ...  can you add - and + left and right of the bpm number to decrease increase.  also i want to tap staight away on bpm and be able to edit manually typing on it. alse metronome range i want from 30 to 600


After this, you should be able to move the slider.

Step 7 — Add the time signature picker

Prompt:

Create a reusable TimeSignaturePicker component in presentation/components/.

Support:

2/4
3/4
4/4
5/4
6/8

Selecting a value should call metronomeService.setTimeSignature().

Now the UI is complete.

Implement the application flow between the UI, Redux, and PlaybackService without adding audio playback.

Requirements:

* Pressing the Start button should dispatch the appropriate Redux action to mark playback as started.
* Pressing the Stop button should dispatch the appropriate Redux action to mark playback as stopped.
* Changing the BPM slider should update the Redux playback state.
* Changing the time signature should update the Redux playback state.
* PlaybackService should be responsible for coordinating these actions.
* QuickMetronomeScreen should not contain business logic.

For now, PlaybackService methods should log messages such as:

* "Playback started"
* "Playback stopped"
* "Tempo changed to X BPM"
* "Time signature changed to 4/4"

Verify that:

* Redux state updates correctly.
* The UI reflects the current playback state.
* No audio code is introduced yet.

<!-- 
Step 8 — Create the audio layer

Prompt:

Create infrastructure/audio/AudioEngine.ts.

It should expose:

initialize()
start()
stop()
playClick()

Do not implement scheduling yet. Use placeholder methods with TODO comments. -->

This establishes the infrastructure layer.

Step 9 — Create the NativeAudioBridge

This is the missing piece between your PlaybackService and the future native implementation.

Ask Cursor to do this:

Create the audio bridge according to docs/adrs/007-create audio architecture.md.

Requirements:

Create:

infrastructure/
    audio/
        NativeAudioBridge.ts
        INativeAudioBridge.ts

Define an interface named INativeAudioBridge with the following methods:

- initialize()
- start()
- stop()
- setTempo(bpm:number)
- setTimeSignature(numerator:number, denominator:number)
- dispose()

Create a NativeAudioBridge class that implements this interface.

For now every method should only log its action, for example:

"NativeAudioBridge.start()"

Do not implement playback.

Do not use setInterval, setTimeout or requestAnimationFrame.

This bridge is only a placeholder for the future native implementation.


Step 10 — Implement basic playback
Then update PlaybackService.

Instead of:

start() {
    console.log("Playback started");
}

it becomes

start() {
    this.nativeAudioBridge.start();
}

Likewise:

stop()

↓

this.nativeAudioBridge.stop();
setTempo()

↓

this.nativeAudioBridge.setTempo(...)

Now your architecture becomes

QuickMetronomeScreen
        ↓
Redux
        ↓
PlaybackService
        ↓
NativeAudioBridge

Everything still works...

except instead of logging

Playback started

you'll see

PlaybackService.start()

↓

NativeAudioBridge.start()

which proves the entire call chain is wired correctly.