import AVFoundation
import Foundation

final class ClickSoundPlayer {
  private static let barPoolSize = 2
  private static let accentPoolSize = 2
  private static let normalPoolSize = 4
  private static let subdivisionPoolSize = 12
  private static let assetsBundleName = "NativeAudioModuleAssets"
  private static let logPrefix = "PulseGrid-ClickSchedule"

  private let engine = AVAudioEngine()
  private let timeline = AudioTimelineMapper()
  private let lock = NSLock()

  private var barNodes: [AVAudioPlayerNode] = []
  private var accentNodes: [AVAudioPlayerNode] = []
  private var normalNodes: [AVAudioPlayerNode] = []
  private var subdivisionNodes: [AVAudioPlayerNode] = []

  private var barIndex = 0
  private var accentIndex = 0
  private var normalIndex = 0
  private var subdivisionIndex = 0

  private var barBuffer: AVAudioPCMBuffer?
  private var accentBuffer: AVAudioPCMBuffer?
  private var normalBuffer: AVAudioPCMBuffer?
  private var subdivisionBuffer: AVAudioPCMBuffer?

  private var selectedBarSound = "classic"
  private var selectedNormalSound = "classic"
  private var selectedAccentSound = "classic"
  private var selectedSubdivisionSound = "classic"

  private var barGain: Float = 0.70
  private var accentGain: Float = 0.65
  private var normalGain: Float = 0.60

  private var engineStarted = false
  private var sessionConfigured = false
  private var sessionActivated = false

  var areReady: Bool {
    lock.lock()
    defer { lock.unlock() }
    return buffersLoadedLocked
  }

  var isTimelineCalibrated: Bool {
    timeline.calibrated
  }

  func initialize() {
    lock.lock()
    defer { lock.unlock() }

    if isFullyReadyLocked() {
      return
    }

    ensureReadyLocked()
  }

  func prepareForPlayback() {
    lock.lock()
    defer { lock.unlock() }

    ensureReadyLocked()
  }

  func flushScheduled() {
    lock.lock()
    flushScheduledLocked()
    lock.unlock()
  }

  func stopPlayback() {
    lock.lock()
    flushScheduledLocked()
    lock.unlock()
  }

  func setNormalClickSound(_ soundId: String) {
    let nextSound = Self.normalResourceName(for: soundId)
    lock.lock()
    defer { lock.unlock() }
    guard nextSound != selectedNormalSound else {
      return
    }
    selectedNormalSound = nextSound
    normalBuffer = loadBuffer(
      named: Self.normalFileName(for: nextSound),
      volume: 1.0
    )
  }

  func setAccentClickSound(_ soundId: String) {
    let nextSound = Self.accentResourceName(for: soundId)
    lock.lock()
    defer { lock.unlock() }
    guard nextSound != selectedAccentSound else {
      return
    }
    selectedAccentSound = nextSound
    accentBuffer = loadBuffer(
      named: Self.accentFileName(for: nextSound),
      volume: 1.0
    )
  }

  func setBarClickSound(_ soundId: String) {
    let nextSound = Self.barResourceName(for: soundId)
    lock.lock()
    defer { lock.unlock() }
    guard nextSound != selectedBarSound else {
      return
    }
    selectedBarSound = nextSound
    barBuffer = loadBuffer(
      named: Self.barFileName(for: nextSound),
      volume: 1.0
    )
  }

  func setSubdivisionClickSound(_ soundId: String) {
    let nextSound = Self.normalResourceName(for: soundId)
    lock.lock()
    defer { lock.unlock() }
    guard nextSound != selectedSubdivisionSound else {
      return
    }
    selectedSubdivisionSound = nextSound
    subdivisionBuffer = loadBuffer(
      named: Self.subdivisionFileName(for: nextSound),
      volume: 0.65
    )
  }

  func setBarClickVolume(_ volume: Float) {
    lock.lock()
    defer { lock.unlock() }
    barGain = Self.clampGain(volume)
    Self.applyGain(barGain, to: barNodes)
  }

  func setAccentClickVolume(_ volume: Float) {
    lock.lock()
    defer { lock.unlock() }
    accentGain = Self.clampGain(volume)
    Self.applyGain(accentGain, to: accentNodes)
  }

  func setNormalClickVolume(_ volume: Float) {
    lock.lock()
    defer { lock.unlock() }
    normalGain = Self.clampGain(volume)
    Self.applyGain(normalGain, to: normalNodes)
  }

  func previewNormalClick() {
    scheduleImmediate(kind: .normal)
  }

  func previewAccentClick() {
    scheduleImmediate(kind: .accent)
  }

  func previewBarClick() {
    scheduleImmediate(kind: .bar)
  }

  func previewSubdivisionClick() {
    scheduleImmediate(kind: .subdivision)
  }

  func playBar(scheduledDeadlineNs: UInt64) {
    schedule(kind: .bar, deadlineNs: scheduledDeadlineNs)
  }

  func playAccent(scheduledDeadlineNs: UInt64) {
    schedule(kind: .accent, deadlineNs: scheduledDeadlineNs)
  }

  func playNormal(scheduledDeadlineNs: UInt64) {
    schedule(kind: .normal, deadlineNs: scheduledDeadlineNs)
  }

  func playSubdivision(scheduledDeadlineNs: UInt64) {
    schedule(kind: .subdivision, deadlineNs: scheduledDeadlineNs)
  }

  // MARK: - Engine

  private enum ClickKind {
    case bar
    case accent
    case normal
    case subdivision
  }

  private var buffersLoadedLocked: Bool {
    barBuffer != nil && accentBuffer != nil && normalBuffer != nil && subdivisionBuffer != nil
  }

  private func isFullyReadyLocked() -> Bool {
    sessionActivated && engine.isRunning && !barNodes.isEmpty && buffersLoadedLocked
  }

  /// Session, graph, engine, and buffers. No-op when already fully ready.
  /// Does not flush scheduled player nodes (stop() owns that).
  private func ensureReadyLocked() {
    if isFullyReadyLocked() {
      return
    }

    let engineWasRunning = engine.isRunning
    if !sessionActivated || !engineWasRunning {
      activateAudioSessionLocked(forceActive: true)
    }

    setupEngineGraphIfNeeded()
    startEngineLocked()
    if !buffersLoadedLocked {
      reloadBuffersLocked()
    }
  }

  private func setupEngineGraphIfNeeded() {
    guard barNodes.isEmpty else {
      return
    }

    let format = engine.mainMixerNode.outputFormat(forBus: 0)
    barNodes = makeNodePool(count: Self.barPoolSize, format: format)
    accentNodes = makeNodePool(count: Self.accentPoolSize, format: format)
    normalNodes = makeNodePool(count: Self.normalPoolSize, format: format)
    subdivisionNodes = makeNodePool(count: Self.subdivisionPoolSize, format: format)
    Self.applyGain(barGain, to: barNodes)
    Self.applyGain(accentGain, to: accentNodes)
    Self.applyGain(normalGain, to: normalNodes)
  }

  private func makeNodePool(count: Int, format: AVAudioFormat) -> [AVAudioPlayerNode] {
    var nodes: [AVAudioPlayerNode] = []
    nodes.reserveCapacity(count)
    for _ in 0..<count {
      let node = AVAudioPlayerNode()
      engine.attach(node)
      engine.connect(node, to: engine.mainMixerNode, format: format)
      nodes.append(node)
    }
    return nodes
  }

  private func startEngineLocked() {
    if !engine.isRunning {
      do {
        try engine.start()
        engineStarted = true
      } catch {
        engineStarted = false
        print("\(Self.logPrefix) — engine start failed: \(error)")
        return
      }
    }

    for node in barNodes + accentNodes + normalNodes + subdivisionNodes where !node.isPlaying {
      node.play()
    }

    if !timeline.calibrated {
      timeline.calibrate(sampleRate: engine.mainMixerNode.outputFormat(forBus: 0).sampleRate)
    }
  }

  private func flushScheduledLocked() {
    for node in barNodes + accentNodes + normalNodes + subdivisionNodes {
      node.stop()
      node.reset()
      if engine.isRunning {
        node.play()
      }
    }
  }

  private func reloadBuffersLocked() {
    barBuffer = loadBuffer(
      named: Self.barFileName(for: selectedBarSound),
      volume: 1.0
    )
    accentBuffer = loadBuffer(
      named: Self.accentFileName(for: selectedAccentSound),
      volume: 1.0
    )
    normalBuffer = loadBuffer(
      named: Self.normalFileName(for: selectedNormalSound),
      volume: 1.0
    )
    subdivisionBuffer = loadBuffer(
      named: Self.subdivisionFileName(for: selectedSubdivisionSound),
      volume: 0.65
    )

    if barBuffer == nil || accentBuffer == nil || normalBuffer == nil || subdivisionBuffer == nil {
      print("ClickSoundPlayer.initialize() — missing one or more click samples")
    }
  }

  private func scheduleImmediate(kind: ClickKind) {
    let leadNs: UInt64 = 5_000_000
    let deadline = DispatchTime.now().uptimeNanoseconds &+ leadNs
    schedule(kind: kind, deadlineNs: deadline)
  }

  private func schedule(kind: ClickKind, deadlineNs: UInt64) {
    lock.lock()
    defer { lock.unlock() }

    assert(
      timeline.calibrated,
      "\(Self.logPrefix) — no scheduling before AudioTimelineMapper calibration"
    )

    setupEngineGraphIfNeeded()
    startEngineLocked()

    guard let buffer = buffer(for: kind) else {
      print("\(Self.logPrefix) — dropped schedule (\(label(for: kind))) sample not loaded deadlineNs=\(deadlineNs)")
      return
    }

    guard let when = timeline.audioTime(forDeadlineNs: deadlineNs) else {
      print("\(Self.logPrefix) — dropped schedule (\(label(for: kind))) timeline not calibrated deadlineNs=\(deadlineNs)")
      return
    }

    let nowHostNs = CoreHostTime.toNanos(CoreHostTime.current())
    let scheduleHostNs = CoreHostTime.toNanos(when.hostTime)
    let lateByNs = Int64(bitPattern: nowHostNs) - Int64(bitPattern: scheduleHostNs)

    let renderAnchor = (barNodes.first ?? accentNodes.first ?? normalNodes.first)?.lastRenderTime
    let estimatedSample = timeline.debugSampleEstimate(
      forDeadlineNs: deadlineNs,
      renderAnchor: renderAnchor
    )

    if lateByNs > 2_000_000 {
      print(
        "\(Self.logPrefix) — LATE deadlineNs=\(deadlineNs) lateByMs=\(String(format: "%.3f", Double(lateByNs) / 1_000_000.0)) sample≈\(estimatedSample.map(String.init) ?? "nil") — scheduling ASAP"
      )
    } else {
      print(
        "\(Self.logPrefix) — schedule \(label(for: kind)) deadlineNs=\(deadlineNs) hostTime=\(when.hostTime) sample≈\(estimatedSample.map(String.init) ?? "nil")"
      )
    }

    let node = nextNode(for: kind)
    let at: AVAudioTime? = lateByNs > 2_000_000 ? nil : when
    node.scheduleBuffer(buffer, at: at, options: [])
    if !node.isPlaying {
      node.play()
    }
  }

  private static func clampGain(_ volume: Float) -> Float {
    min(max(volume, 0), 1)
  }

  private static func applyGain(_ gain: Float, to nodes: [AVAudioPlayerNode]) {
    for node in nodes {
      node.volume = gain
    }
  }

  private func buffer(for kind: ClickKind) -> AVAudioPCMBuffer? {
    switch kind {
    case .bar:
      return barBuffer
    case .accent:
      return accentBuffer
    case .normal:
      return normalBuffer
    case .subdivision:
      return subdivisionBuffer
    }
  }

  private func nextNode(for kind: ClickKind) -> AVAudioPlayerNode {
    switch kind {
    case .bar:
      let node = barNodes[barIndex % barNodes.count]
      barIndex = (barIndex + 1) % barNodes.count
      return node
    case .accent:
      let node = accentNodes[accentIndex % accentNodes.count]
      accentIndex = (accentIndex + 1) % accentNodes.count
      return node
    case .normal:
      let node = normalNodes[normalIndex % normalNodes.count]
      normalIndex = (normalIndex + 1) % normalNodes.count
      return node
    case .subdivision:
      let node = subdivisionNodes[subdivisionIndex % subdivisionNodes.count]
      subdivisionIndex = (subdivisionIndex + 1) % subdivisionNodes.count
      return node
    }
  }

  private func label(for kind: ClickKind) -> String {
    switch kind {
    case .bar:
      return "bar"
    case .accent:
      return "accent"
    case .normal:
      return "normal"
    case .subdivision:
      return "subdivision"
    }
  }

  // MARK: - Buffers / assets

  private func loadBuffer(named name: String, volume: Float) -> AVAudioPCMBuffer? {
    guard let url = resourceURL(named: name) else {
      return nil
    }

    do {
      let file = try AVAudioFile(forReading: url)
      let format = engine.mainMixerNode.outputFormat(forBus: 0)
      let frameCount = AVAudioFrameCount(file.length)
      guard let sourceBuffer = AVAudioPCMBuffer(pcmFormat: file.processingFormat, frameCapacity: frameCount) else {
        return nil
      }
      try file.read(into: sourceBuffer)

      let converted: AVAudioPCMBuffer
      let needsConvert = !Self.formatsMatch(file.processingFormat, format)
        || file.processingFormat.commonFormat != .pcmFormatFloat32
      if !needsConvert {
        converted = sourceBuffer
      } else if let converter = AVAudioConverter(from: file.processingFormat, to: format) {
        let ratio = format.sampleRate / max(file.processingFormat.sampleRate, 1)
        let capacity = AVAudioFrameCount(Double(sourceBuffer.frameLength) * ratio) + 32
        guard let out = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: capacity) else {
          return nil
        }
        var error: NSError?
        var provided = false
        let inputBlock: AVAudioConverterInputBlock = { _, outStatus in
          if provided {
            outStatus.pointee = .noDataNow
            return nil
          }
          provided = true
          outStatus.pointee = .haveData
          return sourceBuffer
        }
        converter.convert(to: out, error: &error, withInputFrom: inputBlock)
        if let error {
          print("ClickSoundPlayer — convert \(name).wav failed: \(error)")
          return nil
        }
        converted = out
      } else {
        print("ClickSoundPlayer — cannot convert \(name).wav to engine format")
        return nil
      }

      applyVolume(converted, volume: volume)
      return converted
    } catch {
      print("ClickSoundPlayer — failed to load \(name).wav: \(error)")
      return nil
    }
  }

  private static func formatsMatch(_ a: AVAudioFormat, _ b: AVAudioFormat) -> Bool {
    a.sampleRate == b.sampleRate
      && a.channelCount == b.channelCount
      && a.commonFormat == b.commonFormat
  }

  private func applyVolume(_ buffer: AVAudioPCMBuffer, volume: Float) {
    guard volume != 1.0, let channels = buffer.floatChannelData else {
      return
    }
    let frames = Int(buffer.frameLength)
    let channelCount = Int(buffer.format.channelCount)
    for channel in 0..<channelCount {
      let data = channels[channel]
      for frame in 0..<frames {
        data[frame] *= volume
      }
    }
  }

  private func activateAudioSessionLocked(forceActive: Bool) {
    let session = AVAudioSession.sharedInstance()
    do {
      if !sessionConfigured {
        try session.setCategory(.playback, mode: .default, options: [.mixWithOthers])
        sessionConfigured = true
      }
      if forceActive || !sessionActivated {
        try session.setActive(true)
        sessionActivated = true
      }
    } catch {
      print("ClickSoundPlayer — failed to activate audio session: \(error)")
    }
  }

  private func resourceURL(named name: String) -> URL? {
    let filename = "\(name).wav"
    var checkedLocations: [String] = []

    for candidate in Self.resourceSearchBundles() {
      checkedLocations.append(candidate.label)

      if let url = candidate.bundle.url(forResource: name, withExtension: "wav") {
        return url
      }

      if let url = candidate.bundle.url(
        forResource: name,
        withExtension: "wav",
        subdirectory: "Assets"
      ) {
        return url
      }
    }

    print(
      "ClickSoundPlayer — missing resource \(filename); checked: \(checkedLocations.joined(separator: ", "))"
    )
    return nil
  }

  private static func resourceSearchBundles() -> [(label: String, bundle: Bundle)] {
    var results: [(label: String, bundle: Bundle)] = []
    var seen = Set<ObjectIdentifier>()

    func append(_ label: String, _ bundle: Bundle?) {
      guard let bundle else {
        return
      }
      let id = ObjectIdentifier(bundle)
      guard !seen.contains(id) else {
        return
      }
      seen.insert(id)
      results.append((label, bundle))
    }

    let classBundle = Bundle(for: ClickSoundPlayer.self)

    if let url = classBundle.url(forResource: assetsBundleName, withExtension: "bundle"),
       let assetsBundle = Bundle(url: url) {
      append("\(assetsBundleName).bundle via class bundle", assetsBundle)
    }

    if let url = Bundle.main.url(forResource: assetsBundleName, withExtension: "bundle"),
       let assetsBundle = Bundle(url: url) {
      append("\(assetsBundleName).bundle via Bundle.main", assetsBundle)
    }

    if let resourceURL = classBundle.resourceURL?
      .appendingPathComponent("\(assetsBundleName).bundle"),
       let assetsBundle = Bundle(url: resourceURL) {
      append("\(assetsBundleName).bundle via class resourceURL", assetsBundle)
    }

    append("Bundle.main", Bundle.main)
    append("Bundle(for: ClickSoundPlayer.self)", classBundle)

    return results
  }

  /// Maps ClickSoundCatalog IDs → resource stem (classic | clave | bongo).
  private static func normalResourceName(for soundId: String) -> String {
    switch soundId {
    case "clave":
      return "clave"
    case "bongo":
      return "bongo"
    default:
      return "classic"
    }
  }

  private static func accentResourceName(for soundId: String) -> String {
    switch soundId {
    case "clave_accent":
      return "clave"
    case "bongo_accent":
      return "bongo"
    default:
      return "classic"
    }
  }

  private static func barResourceName(for soundId: String) -> String {
    switch soundId {
    case "clave_bar":
      return "clave"
    case "bongo_bar":
      return "bongo"
    default:
      return "classic"
    }
  }

  private static func normalFileName(for resource: String) -> String {
    "click_normal_\(resource)"
  }

  private static func accentFileName(for resource: String) -> String {
    "click_accent_\(resource)"
  }

  /// Classic bar reuses click_accent_classic.wav; other sets use click_bar_<stem>.wav.
  private static func barFileName(for resource: String) -> String {
    switch resource {
    case "clave":
      return "click_bar_clave"
    case "bongo":
      return "click_bar_bongo"
    default:
      return "click_accent_classic"
    }
  }

  /// Clave/bongo subdivision reuse click_normal_*.wav (no dedicated subdivision assets).
  private static func subdivisionFileName(for normalResource: String) -> String {
    switch normalResource {
    case "clave":
      return "click_normal_clave"
    case "bongo":
      return "click_normal_bongo"
    default:
      return "click_subdivision_classic"
    }
  }
}
