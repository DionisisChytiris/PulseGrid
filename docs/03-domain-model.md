# Domain Model

## Song

Represents a musical piece.

Fields:

id
title
description
createdAt
updatedAt

## Bar

Represents a measure.

Fields:

id
songId
orderIndex
numerator
denominator

Example:

7/8

numerator = 7
denominator = 8

## Accent Pattern

Represents subdivisions.

Example:

3+2+2

Stored as:

[3,2,2]

## Tempo Event

Fields:

measureIndex
bpm
transitionType

Transition Types:

* instant
* linearRamp

## Playback State

Fields:

currentBar
currentBeat
isPlaying
loopEnabled
loopStart
loopEnd
