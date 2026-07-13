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

  private let clickSoundPlayer: ClickSoundPlayer?
  private let onTick: TickHandler

  private var generation: UInt64 = 0
  private var bpm: Double = 120
  private var beatsPerMeasure: Int = 4
  private var ticksPerBeat: Int = 1
  private var accentPattern: [Bool] = [true, false, false, false]
  private var subdivisionAccentMode: SubdivisionAccentMode = .off
  private var subdivisionAccentEveryNth: Int = 4
  private var subdivisionAccentPattern: [Bool] = []
  private var totalTickCount: UInt64 = 0
  private var anchorTimeNs: UInt64 = 0
  private let stateLock = NSLock()

  private(set) var isRunning: Bool = false

  init(
    clickSoundPlayer: ClickSoundPlayer?,
    onTick: @escaping TickHandler
  ) {
    self.clickSoundPlayer = clickSoundPlayer
    self.onTick = onTick
  }

  func start(bpm: Double, beatsPerMeasure: Int, accentPattern: [Bool], ticksPerBeat: Int) {
    stateLock.lock()
    let wasRunning = isRunning
    haltLoopLocked(logStop: wasRunning)

    self.bpm = max(1, bpm)
    self.beatsPerMeasure = max(1, beatsPerMeasure)
    self.ticksPerBeat = normalizeTicksPerBeat(ticksPerBeat)
    self.accentPattern = accentPattern.isEmpty ? [true] : accentPattern
    totalTickCount = 0
    anchorTimeNs = DispatchTime.now().uptimeNanoseconds

    let activeGeneration = generation &+ 1
    generation = activeGeneration
    isRunning = true
    stateLock.unlock()

    let queue = DispatchQueue(label: "NativeMetronomeEngine", qos: .userInteractive)

    queue.async { [weak self] in
      self?.runLoop(activeGeneration: activeGeneration)
    }
  }

  func updateTempo(_ bpm: Double) {
    stateLock.lock()
    defer { stateLock.unlock() }

    guard isRunning else {
      return
    }

    let safeBpm = max(1, bpm)
    let now = DispatchTime.now().uptimeNanoseconds
    anchorTimeNs = now &- tickOffsetNs(totalTickCount, safeBpm, ticksPerBeat)
    self.bpm = safeBpm
  }

  func updateAccentPattern(_ accentPattern: [Bool]) {
    stateLock.lock()
    defer { stateLock.unlock() }

    self.accentPattern = accentPattern.isEmpty ? [true] : accentPattern
  }

  func updateSubdivision(_ ticksPerBeat: Int) {
    stateLock.lock()
    defer { stateLock.unlock() }

    let safeTicksPerBeat = normalizeTicksPerBeat(ticksPerBeat)
    if safeTicksPerBeat == self.ticksPerBeat {
      return
    }

    let oldTicksPerBeat = self.ticksPerBeat
    let beatPosition = totalTickCount / UInt64(oldTicksPerBeat)
    totalTickCount = beatPosition * UInt64(safeTicksPerBeat)
    self.ticksPerBeat = safeTicksPerBeat

    if isRunning {
      let now = DispatchTime.now().uptimeNanoseconds
      anchorTimeNs = now &- tickOffsetNs(totalTickCount, bpm, safeTicksPerBeat)
    }
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

    guard isRunning else {
      return
    }

    haltLoopLocked(logStop: true)
  }

  private func haltLoopLocked(logStop: Bool) {
    generation &+= 1
    isRunning = false
    totalTickCount = 0
    anchorTimeNs = 0
  }

  private func runLoop(activeGeneration: UInt64) {
    while true {
      stateLock.lock()
      let stillActive = isRunning && generation == activeGeneration
      let currentBpm = bpm
      let currentBeatsPerMeasure = beatsPerMeasure
      let currentTicksPerBeat = ticksPerBeat
      let currentAccentPattern = accentPattern
      let currentSubdivisionAccentMode = subdivisionAccentMode
      let currentSubdivisionAccentEveryNth = subdivisionAccentEveryNth
      let currentSubdivisionAccentPattern = subdivisionAccentPattern
      let tickCount = totalTickCount
      let anchor = anchorTimeNs
      stateLock.unlock()

      guard stillActive else {
        return
      }

      let deadlineNs = anchor &+ tickOffsetNs(tickCount, currentBpm, currentTicksPerBeat)
      waitUntilDeadlineNs(deadlineNs)

      let tickTime = DispatchTime.now().uptimeNanoseconds

      stateLock.lock()
      let activeAfterWait = isRunning && generation == activeGeneration
      if !activeAfterWait {
        stateLock.unlock()
        return
      }

      let subdivisionIndex = Int(tickCount % UInt64(currentTicksPerBeat))
      let beatIndexInBar = Int((tickCount / UInt64(currentTicksPerBeat)) % UInt64(currentBeatsPerMeasure))
      let beatNumber = beatIndexInBar + 1
      let isAccent = AccentClassification.resolveTickAccent(
        beatIndexInBar: beatIndexInBar,
        subdivisionIndex: subdivisionIndex,
        accentPattern: currentAccentPattern,
        ticksPerBeat: currentTicksPerBeat,
        subdivisionAccentMode: currentSubdivisionAccentMode,
        subdivisionAccentEveryNth: currentSubdivisionAccentEveryNth,
        subdivisionAccentPattern: currentSubdivisionAccentPattern
      )
      let sequence = tickCount
      let timestampMs = Double(tickTime &- anchor) / 1_000_000.0

      totalTickCount &+= 1
      stateLock.unlock()

      playClickForTick(
        beatIndexInBar: beatIndexInBar,
        subdivisionIndex: subdivisionIndex,
        accentPattern: currentAccentPattern,
        ticksPerBeat: currentTicksPerBeat,
        subdivisionAccentMode: currentSubdivisionAccentMode,
        subdivisionAccentEveryNth: currentSubdivisionAccentEveryNth,
        subdivisionAccentPattern: currentSubdivisionAccentPattern,
        scheduledDeadlineNs: deadlineNs
      )
      onTick(
        sequence,
        beatIndexInBar,
        beatNumber,
        currentBeatsPerMeasure,
        subdivisionIndex,
        isAccent,
        timestampMs
      )
    }
  }

  private func waitUntilDeadlineNs(_ deadlineNs: UInt64) {
    let spinThresholdNs: UInt64 = 2_000_000

    while true {
      let now = DispatchTime.now().uptimeNanoseconds
      if now >= deadlineNs {
        return
      }

      let remaining = deadlineNs &- now
      if remaining > spinThresholdNs {
        usleep(useconds_t(remaining / 1_000))
        continue
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
