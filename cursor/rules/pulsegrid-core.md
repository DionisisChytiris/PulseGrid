# PulseGrid Architecture Rules

## ABSOLUTE RULES

### 1. No audio logic outside infrastructure/audio
Any scheduling, timing, or beat logic MUST live in:
infrastructure/audio

---

### 2. No business logic in UI
React components MUST NOT:
- compute beats
- calculate timing
- trigger scheduling logic

UI is presentation only.

---

### 3. Redux is UI state only
Redux MUST NOT:
- control audio
- store playback engine state
- compute timing

It may only store:
- bpm (UI intent)
- isPlaying (UI state)
- selected settings

---

### 4. Application layer is orchestration only
application/services:
- coordinates domain + infrastructure
- contains NO UI code
- contains NO rendering logic

---

### 5. Domain is pure
domain:
- no side effects
- no Redux
- no database
- no audio

---

### 6. Audio system is isolated runtime engine
infrastructure/audio:
- owns timing loop
- owns scheduling
- must NOT depend on React or Redux

---

### 7. Dependency direction is strict

presentation → features → application → domain → infrastructure

NEVER reverse direction.

---

### 8. If unsure:
Ask: “Does this affect timing or sound?”

If YES → it belongs in audio or domain, NOT UI.