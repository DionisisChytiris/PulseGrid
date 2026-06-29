# Database

Storage:

SQLite

Architecture:

UI

↓

Service

↓

Repository

↓

SQLite

Tables:

songs
bars
tempo_events
accent_patterns

Database is source of truth.

Never access SQLite directly from components.

Repositories:

SongRepository
PlaybackRepository
SettingsRepository
