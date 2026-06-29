# System Architecture

Architecture Style:

Clean Architecture with Feature Modules.

Layers:

Presentation Layer

↓

Application Layer

↓

Domain Layer

↓

Infrastructure Layer

## Presentation Layer

Contains:

* Screens
* Components
* Hooks

Responsibilities:

* Render UI
* Dispatch actions
* Consume state

No business logic allowed.

## Application Layer

Contains:

* Services
* Use Cases

Examples:

PlaybackService
SongService

## Domain Layer

Contains:

Business entities.

Examples:

Song
Bar
TempoEvent

## Infrastructure Layer

Contains:

* SQLite
* Native Audio
* RevenueCat
* File System

## Dependency Direction

Presentation

depends on

Application

depends on

Domain

depends on

Infrastructure interfaces
