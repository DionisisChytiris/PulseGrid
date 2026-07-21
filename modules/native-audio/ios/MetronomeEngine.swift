import Foundation

final class MetronomeEngine {
  typealias TickHandler = (
    _ sequence: UInt64,
    _ beatIndex: Int,
    _ beatNumber: Int,
    _ beatsPerMeasure: Int,
    _ subdivisionIndex: Int,
    _ isAccent: Bool,
    _ timestampMs: Double
  ) -> Void

  /// Steady-state lookahead floor and scheduled-startup lead (80 ms).
  private static let startupLeadNs: UInt64 = 80_000_000
  private static let minLookaheadNs: UInt64 = startupLeadNs
  private static let logPrefix = "PulseGrid-MetronomeStartup"

  private enum PlaybackPhase {
    case idle
    case preparing
    case scheduledStartup
    case playing
  }

  private let clickSoundPlayer: ClickSoundPlayer?
  private let onTick: TickHandler

  private var generation: UInt64 = 0
  private var phase: PlaybackPhase = .idle
  private var bpm: Double = 120
  private var beatsPerMeasure: Int = 4
  private var ticksPerBeat: Int = 1
  private var accentPattern: [Bool] = [true, false, false, false]
  private var subdivisionAccentMode: SubdivisionAccentMode = .off
  private var subdivisionAccentEveryNth: Int = 4
  private var subdivisionAccentPattern: [Bool] = []
  private var anchorTimeNs: UInt64 = 0

  /// Next subdivision-tick sequence to emit via onTick (UI only).
  private var nextUiSequence: UInt64 = 0

  /// Highest sequence whose audio has been scheduled. Next unpublished is lastPublished + 1.
  private var lastPublishedSequence: Int64 = -1

  /// Sequences handed to ClickSoundPlayer since the last flush/rewind (duplicate guard).
  private var scheduledAudioSequences: Set<UInt64> = []

  private let stateLock = NSLock()
  private let loopQueue = DispatchQueue(label: "NativeMetronomeEngine", qos: .userInteractive)

  private(set) var isRunning: Bool = false

  private struct TickSnapshot {
    let sequence: UInt64
    let beatIndexInBar: Int
    let beatNumber: Int
    let beatsPerMeasure: Int
    let subdivisionIndex: Int
    let isAccent: Bool
    let timestampMs: Double
    let scheduledDeadlineNs: UInt64
  }

  init(
    clickSoundPlayer: ClickSoundPlayer?,
    onTick: @escaping TickHandler
  ) {
    self.clickSoundPlayer = clickSoundPlayer
    self.onTick = onTick
  }

  func start(bpm: Double, beatsPerMeasure: Int, accentPattern: [Bool], ticksPerBeat: Int) {
    // idle → preparing
    stateLock.lock()
    haltLoopLocked()

    self.bpm = max(1, bpm)
    self.beatsPerMeasure = max(1, beatsPerMeasure)
    self.ticksPerBeat = normalizeTicksPerBeat(ticksPerBeat)
    self.accentPattern = accentPattern.isEmpty ? [true] : accentPattern
    nextUiSequence = 0
    lastPublishedSequence = -1
    scheduledAudioSequences.removeAll(keepingCapacity: true)
    anchorTimeNs = 0
    phase = .preparing
    isRunning = false

    let activeGeneration = generation &+ 1
    generation = activeGeneration
    stateLock.unlock()

    print("\(Self.logPrefix) — phase=preparing generation=\(activeGeneration)")

    // Preparing: engine + calibrate only — no publish, no UI.
    clickSoundPlayer?.prepareForPlayback()

    stateLock.lock()
    guard generation == activeGeneration, phase == .preparing else {
      stateLock.unlock()
      print("\(Self.logPrefix) — preparing aborted (stop/restart during prepare)")
      return
    }

    if let player = clickSoundPlayer {
      assert(
        player.isTimelineCalibrated,
        "\(Self.logPrefix) — timeline must be calibrated before scheduledStartup"
      )
    }

    // preparing → scheduledStartup: future anchor, then one lookahead publish.
    let nowNs = DispatchTime.now().uptimeNanoseconds
    anchorTimeNs = nowNs &+ Self.startupLeadNs
    phase = .scheduledStartup
    isRunning = true
    nextUiSequence = 0
    lastPublishedSequence = -1
    scheduledAudioSequences.removeAll(keepingCapacity: true)
    stateLock.unlock()

    print(
      "\(Self.logPrefix) — phase=scheduledStartup anchorTimeNs=\(anchorTimeNs) leadMs=80"
    )

    publishLookaheadEvents(activeGeneration: activeGeneration)

    loopQueue.async { [weak self] in
      self?.runUiLoop(activeGeneration: activeGeneration)
    }
  }

  func updateTempo(_ bpm: Double) {
    applyLiveMusicalMutation(bpm: max(1, bpm), ticksPerBeat: nil)
  }

  func updateAccentPattern(_ accentPattern: [Bool]) {
    stateLock.lock()
    defer { stateLock.unlock() }

    self.accentPattern = accentPattern.isEmpty ? [true] : accentPattern
  }

  func updateSubdivision(_ ticksPerBeat: Int) {
    applyLiveMusicalMutation(bpm: nil, ticksPerBeat: normalizeTicksPerBeat(ticksPerBeat))
  }

  func updateSubdivisionAccentMode(_ mode: SubdivisionAccentMode) {
    stateLock.lock()
    defer { stateLock.unlock() }

    subdivisionAccentMode = mode
  }

  func updateSubdivisionAccentEveryNth(_ everyNth: Int) {
    stateLock.lock()
    defer { stateLock.unlock() }

    subdivisionAccentEveryNth = min(16, max(1, everyNth))
  }

  func updateSubdivisionAccentPattern(_ pattern: [Bool]) {
    stateLock.lock()
    defer { stateLock.unlock() }

    subdivisionAccentPattern = pattern
  }

  func stop() {
    stateLock.lock()
    defer { stateLock.unlock() }

    guard phase != .idle else {
      return
    }

    haltLoopLocked()
  }

  // MARK: - Mutations

  /// During preparing/idle: update params only. During scheduledStartup/playing: flush+rewind+retune+republish once.
  private func applyLiveMusicalMutation(bpm newBpm: Double?, ticksPerBeat newTicks: Int?) {
    stateLock.lock()

    var changed = false
    if let newBpm, newBpm != bpm {
      bpm = newBpm
      changed = true
    }
    if let newTicks, newTicks != ticksPerBeat {
      ticksPerBeat = newTicks
      changed = true
    }

    guard phase == .scheduledStartup || phase == .playing else {
      // idle / preparing: params only — no publish.
      stateLock.unlock()
      return
    }

    guard changed else {
      stateLock.unlock()
      return
    }

    retuneAnchorForContinuityLocked(newBpm: bpm, newTicksPerBeat: ticksPerBeat)
    rewindPublicationCursorLocked()
    scheduledAudioSequences.removeAll(keepingCapacity: true)
    let activeGeneration = generation
    stateLock.unlock()

    clickSoundPlayer?.flushScheduled()
    publishLookaheadEvents(activeGeneration: activeGeneration)
  }

  private func haltLoopLocked() {
    generation &+= 1
    isRunning = false
    phase = .idle
    nextUiSequence = 0
    lastPublishedSequence = -1
    scheduledAudioSequences.removeAll(keepingCapacity: true)
    anchorTimeNs = 0
  }

  // MARK: - UI loop (independent of audio publication)

  private func runUiLoop(activeGeneration: UInt64) {
    while true {
      stateLock.lock()
      let stillActive = isRunning && generation == activeGeneration
      let sequence = nextUiSequence
      let currentPhase = phase
      stateLock.unlock()

      guard stillActive else {
        return
      }

      assert(
        currentPhase == .scheduledStartup || currentPhase == .playing,
        "\(Self.logPrefix) — UI loop active only in scheduledStartup/playing"
      )

      waitUntilDeadlineForSequence(sequence, activeGeneration: activeGeneration)

      stateLock.lock()
      let activeAfterWait = isRunning && generation == activeGeneration
      if !activeAfterWait {
        stateLock.unlock()
        return
      }

      let now = DispatchTime.now().uptimeNanoseconds
      let deadlineNs = deadlineForSequenceLocked(sequence)
      assert(
        now >= deadlineNs,
        "\(Self.logPrefix) — UI tick \(sequence) before deadline (now=\(now) deadline=\(deadlineNs))"
      )

      let timestampMs = Double(now &- anchorTimeNs) / 1_000_000.0
      let snapshot = snapshotForSequenceLocked(sequence, timestampMs: timestampMs)
      nextUiSequence = sequence &+ 1

      if sequence == 0, phase == .scheduledStartup {
        phase = .playing
        print("\(Self.logPrefix) — phase=playing (UI emitted tick 0)")
      }

      let snapshots = collectLookaheadSnapshotsLocked()
      stateLock.unlock()

      if let snapshot {
        emitUiTick(snapshot)
      }
      enqueueAudioSnapshots(snapshots, activeGeneration: activeGeneration)
    }
  }

  // MARK: - Lookahead publication

  private func publishLookaheadEvents(activeGeneration: UInt64) {
    stateLock.lock()
    guard isRunning && generation == activeGeneration else {
      stateLock.unlock()
      return
    }
    assert(
      phase == .scheduledStartup || phase == .playing,
      "\(Self.logPrefix) — publish forbidden outside scheduledStartup/playing"
    )
    if let player = clickSoundPlayer {
      assert(
        player.isTimelineCalibrated,
        "\(Self.logPrefix) — no scheduling before calibration"
      )
    }
    let snapshots = collectLookaheadSnapshotsLocked()
    stateLock.unlock()

    enqueueAudioSnapshots(snapshots, activeGeneration: activeGeneration)
  }

  /// Caller must hold stateLock.
  private func collectLookaheadSnapshotsLocked() -> [TickSnapshot] {
    var snapshots: [TickSnapshot] = []
    let horizonNs = DispatchTime.now().uptimeNanoseconds &+ computeLookaheadNsLocked()
    var sequence = UInt64(bitPattern: lastPublishedSequence &+ 1)

    while true {
      let deadlineNs = deadlineForSequenceLocked(sequence)
      if deadlineNs > horizonNs {
        break
      }

      let expectedNext = lastPublishedSequence &+ 1
      assert(
        Int64(bitPattern: sequence) == expectedNext,
        "\(Self.logPrefix) — non-monotonic publish sequence=\(sequence) expected=\(expectedNext)"
      )

      guard let snapshot = snapshotForSequenceLocked(sequence, timestampMs: 0) else {
        break
      }

      snapshots.append(snapshot)
      lastPublishedSequence = Int64(bitPattern: sequence)
      sequence &+= 1
    }

    return snapshots
  }

  /// Caller must hold stateLock.
  private func snapshotForSequenceLocked(_ sequence: UInt64, timestampMs: Double) -> TickSnapshot? {
    let subdivisionIndex = Int(sequence % UInt64(ticksPerBeat))
    let beatIndexInBar = Int((sequence / UInt64(ticksPerBeat)) % UInt64(beatsPerMeasure))
    let beatNumber = beatIndexInBar + 1
    let isAccent = AccentClassification.resolveTickAccent(
      beatIndexInBar: beatIndexInBar,
      subdivisionIndex: subdivisionIndex,
      accentPattern: accentPattern,
      ticksPerBeat: ticksPerBeat,
      subdivisionAccentMode: subdivisionAccentMode,
      subdivisionAccentEveryNth: subdivisionAccentEveryNth,
      subdivisionAccentPattern: subdivisionAccentPattern
    )
    let scheduledDeadlineNs = deadlineForSequenceLocked(sequence)

    return TickSnapshot(
      sequence: sequence,
      beatIndexInBar: beatIndexInBar,
      beatNumber: beatNumber,
      beatsPerMeasure: beatsPerMeasure,
      subdivisionIndex: subdivisionIndex,
      isAccent: isAccent,
      timestampMs: timestampMs,
      scheduledDeadlineNs: scheduledDeadlineNs
    )
  }

  /// Caller must hold stateLock.
  private func deadlineForSequenceLocked(_ sequence: UInt64) -> UInt64 {
    anchorTimeNs &+ tickOffsetNs(sequence, bpm, ticksPerBeat)
  }

  /// Caller must hold stateLock.
  private func computeLookaheadNsLocked() -> UInt64 {
    let tickIntervalNs = beatDurationNs(bpm) / UInt64(ticksPerBeat)
    let twoTicksNs = tickIntervalNs &* 2
    return max(Self.minLookaheadNs, twoTicksNs)
  }

  /// Caller must hold stateLock. Preserves the musical instant of nextUiSequence across mutations.
  private func retuneAnchorForContinuityLocked(newBpm: Double, newTicksPerBeat: Int) {
    let now = DispatchTime.now().uptimeNanoseconds
    anchorTimeNs = now &- tickOffsetNs(nextUiSequence, newBpm, newTicksPerBeat)
  }

  /// Caller must hold stateLock.
  private func rewindPublicationCursorLocked() {
    lastPublishedSequence = Int64(bitPattern: nextUiSequence) &- 1
  }

  private func enqueueAudioSnapshots(_ snapshots: [TickSnapshot], activeGeneration: UInt64) {
    guard !snapshots.isEmpty else {
      return
    }

    stateLock.lock()
    let stillActive = isRunning && generation == activeGeneration
    let pattern = accentPattern
    let ticks = ticksPerBeat
    let mode = subdivisionAccentMode
    let everyNth = subdivisionAccentEveryNth
    let subPattern = subdivisionAccentPattern

    if stillActive {
      for snapshot in snapshots {
        let inserted = scheduledAudioSequences.insert(snapshot.sequence).inserted
        assert(
          inserted,
          "\(Self.logPrefix) — duplicate sequence scheduling sequence=\(snapshot.sequence)"
        )
      }
    }
    stateLock.unlock()

    guard stillActive else {
      return
    }

    if let player = clickSoundPlayer {
      assert(
        player.isTimelineCalibrated,
        "\(Self.logPrefix) — no scheduling before calibration"
      )
    }

    for snapshot in snapshots {
      playClickForTick(
        beatIndexInBar: snapshot.beatIndexInBar,
        subdivisionIndex: snapshot.subdivisionIndex,
        accentPattern: pattern,
        ticksPerBeat: ticks,
        subdivisionAccentMode: mode,
        subdivisionAccentEveryNth: everyNth,
        subdivisionAccentPattern: subPattern,
        scheduledDeadlineNs: snapshot.scheduledDeadlineNs
      )
    }
  }

  private func emitUiTick(_ snapshot: TickSnapshot) {
    onTick(
      snapshot.sequence,
      snapshot.beatIndexInBar,
      snapshot.beatNumber,
      snapshot.beatsPerMeasure,
      snapshot.subdivisionIndex,
      snapshot.isAccent,
      snapshot.timestampMs
    )
  }

  /// Re-resolves the sequence deadline on each wake so tempo/subdivision retunes can retarget the wait.
  private func waitUntilDeadlineForSequence(_ sequence: UInt64, activeGeneration: UInt64) {
    let spinThresholdNs: UInt64 = 2_000_000
    let maxSleepChunkNs: UInt64 = 5_000_000

    while true {
      stateLock.lock()
      let stillActive = isRunning && generation == activeGeneration
      let deadlineNs = stillActive ? deadlineForSequenceLocked(sequence) : 0
      stateLock.unlock()

      guard stillActive else {
        return
      }

      let now = DispatchTime.now().uptimeNanoseconds
      if now >= deadlineNs {
        return
      }

      let remaining = deadlineNs &- now
      if remaining > spinThresholdNs {
        let sleepNs = min(remaining &- spinThresholdNs, maxSleepChunkNs)
        usleep(useconds_t(sleepNs / 1_000))
      }
    }
  }

  private func playClickForTick(
    beatIndexInBar: Int,
    subdivisionIndex: Int,
    accentPattern: [Bool],
    ticksPerBeat: Int,
    subdivisionAccentMode: SubdivisionAccentMode,
    subdivisionAccentEveryNth: Int,
    subdivisionAccentPattern: [Bool],
    scheduledDeadlineNs: UInt64
  ) {
    switch AccentClassification.resolveClickSoundKind(
      beatIndexInBar: beatIndexInBar,
      subdivisionIndex: subdivisionIndex,
      accentPattern: accentPattern,
      ticksPerBeat: ticksPerBeat,
      subdivisionAccentMode: subdivisionAccentMode,
      subdivisionAccentEveryNth: subdivisionAccentEveryNth,
      subdivisionAccentPattern: subdivisionAccentPattern
    ) {
    case .beatAccent:
      clickSoundPlayer?.playAccent(scheduledDeadlineNs: scheduledDeadlineNs)
    case .subdivisionAccent:
      clickSoundPlayer?.playNormal(scheduledDeadlineNs: scheduledDeadlineNs)
    case .normal:
      clickSoundPlayer?.playNormal(scheduledDeadlineNs: scheduledDeadlineNs)
    case .subdivision:
      clickSoundPlayer?.playSubdivision(scheduledDeadlineNs: scheduledDeadlineNs)
    }
  }

  private func beatDurationNs(_ bpm: Double) -> UInt64 {
    UInt64(max(1, (60_000_000_000.0 / bpm).rounded()))
  }

  private func tickOffsetNs(_ tickCount: UInt64, _ bpm: Double, _ ticksPerBeat: Int) -> UInt64 {
    (beatDurationNs(bpm) * tickCount) / UInt64(ticksPerBeat)
  }

  private func normalizeTicksPerBeat(_ value: Int) -> Int {
    switch value {
    case 2, 3, 4:
      return value
    default:
      return 1
    }
  }
}
