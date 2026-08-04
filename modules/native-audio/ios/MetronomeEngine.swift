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
  private var barStartEnabled: Bool = true
  private var anchorTimeNs: UInt64 = 0

  /// Precompiled song timeline (empty = Quick Metronome).
  private var timelineEvents: [TimelinePlaybackEvent] = []
  /// Cumulative deadline offsets for [timelineEvents] (length = events.count + 1).
  private var timelineDeadlineOffsetNs: [UInt64] = []
  /// When true, song timeline wraps forever with continuous deadlines.
  private var timelineLoops = false
  /// Duration of one full song cycle (last deadline offset).
  private var timelineCycleDurationNs: UInt64 = 0
  /// When loops is turned off mid-cycle, halt at this exclusive sequence.
  private var timelineLoopEndExclusive: UInt64? = nil

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

  func start(
    bpm: Double,
    beatsPerMeasure: Int,
    accentPattern: [Bool],
    ticksPerBeat: Int,
    timelineEvents: [TimelinePlaybackEvent] = [],
    timelineLoops: Bool = false,
    timelineStartSequence: UInt64 = 0
  ) {
    // idle → preparing
    stateLock.lock()
    haltLoopLocked()

    self.bpm = max(1, bpm)
    self.beatsPerMeasure = max(1, beatsPerMeasure)
    self.ticksPerBeat = normalizeTicksPerBeat(ticksPerBeat)
    self.accentPattern = accentPattern.isEmpty ? [true] : accentPattern
    self.timelineEvents = timelineEvents
    self.timelineDeadlineOffsetNs = Self.buildDeadlineOffsets(timelineEvents)
    self.timelineLoops = timelineLoops && !timelineEvents.isEmpty
    self.timelineCycleDurationNs = timelineDeadlineOffsetNs.last ?? 0
    let startSequence = timelineEvents.isEmpty ? UInt64(0) : timelineStartSequence
    nextUiSequence = startSequence
    lastPublishedSequence = Int64(bitPattern: startSequence) &- 1
    scheduledAudioSequences.removeAll(keepingCapacity: true)
    anchorTimeNs = 0
    phase = .preparing
    isRunning = false

    let activeGeneration = generation &+ 1
    generation = activeGeneration
    stateLock.unlock()

    let modeLabel = timelineEvents.isEmpty ? "QUICK_METRONOME" : "SONG_TIMELINE"
    print(
      "\(Self.logPrefix) — phase=preparing generation=\(activeGeneration) mode=\(modeLabel) " +
        "events=\(timelineEvents.count) loops=\(self.timelineLoops) startSeq=\(startSequence)"
    )

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
    let startOffset = timelineOffsetNsLocked(startSequence)
    anchorTimeNs = nowNs &+ Self.startupLeadNs &- startOffset
    phase = .scheduledStartup
    isRunning = true
    nextUiSequence = startSequence
    lastPublishedSequence = Int64(bitPattern: startSequence) &- 1
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

  func setTimelineLoops(_ enabled: Bool) {
    stateLock.lock()
    defer { stateLock.unlock() }

    guard !timelineEvents.isEmpty else {
      timelineLoops = false
      timelineLoopEndExclusive = nil
      return
    }

    if enabled {
      timelineLoops = true
      timelineLoopEndExclusive = nil
      return
    }

    timelineLoops = false
    let count = UInt64(timelineEvents.count)
    timelineLoopEndExclusive = ((nextUiSequence / count) &+ 1) &* count
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

  func updateBarStartEnabled(_ enabled: Bool) {
    stateLock.lock()
    defer { stateLock.unlock() }

    // TEMP debug — remove after native barStart propagation diagnosis
    NSLog(
      "[BarStartDebug] iOS MetronomeEngine.updateBarStartEnabled previous=%@ new=%@",
      barStartEnabled ? "true" : "false",
      enabled ? "true" : "false"
    )
    barStartEnabled = enabled
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

    // Song timeline accents/timing come from compiled events — ignore live QM mutations.
    if !timelineEvents.isEmpty {
      stateLock.unlock()
      return
    }

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
    timelineEvents = []
    timelineDeadlineOffsetNs = []
    timelineLoops = false
    timelineCycleDurationNs = 0
    timelineLoopEndExclusive = nil
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

      // Song timeline finished — stop the loop (finite event stream / end of cycle).
      if !timelineEvents.isEmpty, shouldHaltTimelineSequenceLocked(sequence) {
        haltLoopLocked()
        stateLock.unlock()
        print("\(Self.logPrefix) — song timeline complete sequence=\(sequence)")
        return
      }

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
    if !timelineEvents.isEmpty {
      guard let index = timelineEventIndexLocked(sequence) else {
        return nil
      }

      let event = timelineEvents[index]
      return TickSnapshot(
        sequence: sequence,
        beatIndexInBar: event.beatIndexInBar,
        beatNumber: event.beatIndexInBar + 1,
        beatsPerMeasure: event.beatsPerMeasure,
        subdivisionIndex: event.subdivisionIndex,
        isAccent: event.accent,
        timestampMs: timestampMs,
        scheduledDeadlineNs: deadlineForSequenceLocked(sequence)
      )
    }

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
    if !timelineEvents.isEmpty {
      return anchorTimeNs &+ timelineOffsetNsLocked(sequence)
    }

    return anchorTimeNs &+ tickOffsetNs(sequence, bpm, ticksPerBeat)
  }

  /// Absolute offset from score start for [sequence], supporting seamless loop cycles.
  private func timelineOffsetNsLocked(_ sequence: UInt64) -> UInt64 {
    let count = timelineEvents.count
    guard count > 0, !timelineDeadlineOffsetNs.isEmpty else {
      return 0
    }

    let wrapping = timelineLoops || timelineLoopEndExclusive != nil
    if wrapping {
      let cycle = sequence / UInt64(count)
      let indexInCycle = Int(sequence % UInt64(count))
      return cycle &* timelineCycleDurationNs &+ timelineDeadlineOffsetNs[indexInCycle]
    }

    let index = Int(sequence)
    if index < 0 {
      return 0
    }
    if index >= timelineDeadlineOffsetNs.count {
      return timelineDeadlineOffsetNs.last ?? 0
    }
    return timelineDeadlineOffsetNs[index]
  }

  private func timelineEventIndexLocked(_ sequence: UInt64) -> Int? {
    let count = timelineEvents.count
    guard count > 0 else {
      return nil
    }

    if let end = timelineLoopEndExclusive, sequence >= end {
      return nil
    }

    if timelineLoops || timelineLoopEndExclusive != nil {
      return Int(sequence % UInt64(count))
    }

    let index = Int(sequence)
    guard index >= 0, index < count else {
      return nil
    }
    return index
  }

  private func shouldHaltTimelineSequenceLocked(_ sequence: UInt64) -> Bool {
    if timelineLoops {
      return false
    }

    if let end = timelineLoopEndExclusive {
      return sequence >= end
    }

    return Int(sequence) >= timelineEvents.count
  }

  private static func buildDeadlineOffsets(_ events: [TimelinePlaybackEvent]) -> [UInt64] {
    guard !events.isEmpty else {
      return []
    }

    var offsets = [UInt64](repeating: 0, count: events.count + 1)
    var running: UInt64 = 0

    for index in events.indices {
      offsets[index] = running
      let bpm = max(1, events[index].bpm)
      let beatDurationNs = UInt64(max(1, (60_000_000_000.0 / bpm).rounded()))
      running &+= beatDurationNs
    }

    offsets[events.count] = running
    return offsets
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
    let barStart = barStartEnabled
    let songTimeline = !timelineEvents.isEmpty

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
      if songTimeline {
        // TEMP debug — remove after native barStart propagation diagnosis
        if snapshot.beatIndexInBar == 0 && snapshot.subdivisionIndex == 0 {
          NSLog(
            "[BarStartDebug] iOS classify song beat1 barStartEnabled=%@",
            barStart ? "true" : "false"
          )
        }
        playClickForSongTick(
          isAccent: snapshot.isAccent,
          beatIndexInBar: snapshot.beatIndexInBar,
          subdivisionIndex: snapshot.subdivisionIndex,
          barStartEnabled: barStart,
          scheduledDeadlineNs: snapshot.scheduledDeadlineNs
        )
      } else {
        // TEMP debug — remove after native barStart propagation diagnosis
        if snapshot.beatIndexInBar == 0 && snapshot.subdivisionIndex == 0 {
          NSLog(
            "[BarStartDebug] iOS classify qm beat1 barStartEnabled=%@",
            barStart ? "true" : "false"
          )
        }
        playClickForTick(
          beatIndexInBar: snapshot.beatIndexInBar,
          subdivisionIndex: snapshot.subdivisionIndex,
          accentPattern: pattern,
          ticksPerBeat: ticks,
          subdivisionAccentMode: mode,
          subdivisionAccentEveryNth: everyNth,
          subdivisionAccentPattern: subPattern,
          barStartEnabled: barStart,
          scheduledDeadlineNs: snapshot.scheduledDeadlineNs
        )
      }
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

  private func playClickForSongTick(
    isAccent: Bool,
    beatIndexInBar: Int,
    subdivisionIndex: Int,
    barStartEnabled: Bool,
    scheduledDeadlineNs: UInt64
  ) {
    switch AccentClassification.resolveClickSoundKindFromTickAccent(
      isAccent: isAccent,
      beatIndexInBar: beatIndexInBar,
      subdivisionIndex: subdivisionIndex,
      barStartEnabled: barStartEnabled
    ) {
    case .bar:
      clickSoundPlayer?.playBar(scheduledDeadlineNs: scheduledDeadlineNs)
    case .accent:
      clickSoundPlayer?.playAccent(scheduledDeadlineNs: scheduledDeadlineNs)
    case .click:
      clickSoundPlayer?.playNormal(scheduledDeadlineNs: scheduledDeadlineNs)
    case .subdivision:
      // Compatibility: subdivision bank unused; route to Click.
      clickSoundPlayer?.playNormal(scheduledDeadlineNs: scheduledDeadlineNs)
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
    barStartEnabled: Bool,
    scheduledDeadlineNs: UInt64
  ) {
    switch AccentClassification.resolveClickSoundKind(
      beatIndexInBar: beatIndexInBar,
      subdivisionIndex: subdivisionIndex,
      accentPattern: accentPattern,
      ticksPerBeat: ticksPerBeat,
      subdivisionAccentMode: subdivisionAccentMode,
      subdivisionAccentEveryNth: subdivisionAccentEveryNth,
      subdivisionAccentPattern: subdivisionAccentPattern,
      barStartEnabled: barStartEnabled
    ) {
    case .bar:
      clickSoundPlayer?.playBar(scheduledDeadlineNs: scheduledDeadlineNs)
    case .accent:
      clickSoundPlayer?.playAccent(scheduledDeadlineNs: scheduledDeadlineNs)
    case .click:
      clickSoundPlayer?.playNormal(scheduledDeadlineNs: scheduledDeadlineNs)
    case .subdivision:
      // Compatibility: subdivision bank unused; route to Click.
      clickSoundPlayer?.playNormal(scheduledDeadlineNs: scheduledDeadlineNs)
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
