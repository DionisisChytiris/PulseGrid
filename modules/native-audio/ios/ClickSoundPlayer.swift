import AVFoundation
import Foundation

final class ClickSoundPlayer {
  private static let accentPoolSize = 2
  private static let normalPoolSize = 4
  private static let subdivisionPoolSize = 12
  private static let assetsBundleName = "NativeAudioModuleAssets"
  private static let logPrefix = "PulseGrid-ClickSchedule"

  private let engine = AVAudioEngine()
  private let timeline = AudioTimelineMapper()
  private let lock = NSLock()

  private var accentNodes: [AVAudioPlayerNode] = []
  private var normalNodes: [AVAudioPlayerNode] = []
  private var subdivisionNodes: [AVAudioPlayerNode] = []

  private var accentIndex = 0
  private var normalIndex = 0
  private var subdivisionIndex = 0

  private var accentBuffer: AVAudioPCMBuffer?
  private var normalBuffer: AVAudioPCMBuffer?
  private var subdivisionBuffer: AVAudioPCMBuffer?

  private var selectedNormalSound = "classic"
  private var selectedAccentSound = "classic"
  private var selectedSubdivisionSound = "classic"

  private var engineStarted = false

  var areReady: Bool {
    lock.lock()
    defer { lock.unlock() }
    return accentBuffer != nil && normalBuffer != nil && subdivisionBuffer != nil
  }

  var isTimelineCalibrated: Bool {
    timeline.calibrated
  }

  func initialize() {
    activateAudioSession()
    lock.lock()
    setupEngineGraphIfNeeded()
    startEngineLocked()
    reloadBuffersLocked()
    lock.unlock()
  }

  func prepareForPlayback() {
    lock.lock()
    setupEngineGraphIfNeeded()
    startEngineLocked()
    if accentBuffer == nil || normalBuffer == nil || subdivisionBuffer == nil {
      reloadBuffersLocked()
    }
    flushScheduledLocked()
    timeline.calibrate(sampleRate: engine.mainMixerNode.outputFormat(forBus: 0).sampleRate)
    lock.unlock()
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
      volume: 0.85
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

  func previewNormalClick() {
    scheduleImmediate(kind: .normal)
  }

  func previewAccentClick() {
    scheduleImmediate(kind: .accent)
  }

  func previewSubdivisionClick() {
    scheduleImmediate(kind: .subdivision)
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
    case accent
    case normal
    case subdivision
  }

  private func setupEngineGraphIfNeeded() {
    guard accentNodes.isEmpty else {
      return
    }

    let format = engine.mainMixerNode.outputFormat(forBus: 0)
    accentNodes = makeNodePool(count: Self.accentPoolSize, format: format)
    normalNodes = makeNodePool(count: Self.normalPoolSize, format: format)
    subdivisionNodes = makeNodePool(count: Self.subdivisionPoolSize, format: format)
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

    for node in accentNodes + normalNodes + subdivisionNodes where !node.isPlaying {
      node.play()
    }

    if !timeline.calibrated {
      timeline.calibrate(sampleRate: engine.mainMixerNode.outputFormat(forBus: 0).sampleRate)
    }
  }

  private func flushScheduledLocked() {
    for node in accentNodes + normalNodes + subdivisionNodes {
      node.stop()
      node.reset()
      if engine.isRunning {
        node.play()
      }
    }
  }

  private func reloadBuffersLocked() {
    accentBuffer = loadBuffer(
      named: Self.accentFileName(for: selectedAccentSound),
      volume: 1.0
    )
    normalBuffer = loadBuffer(
      named: Self.normalFileName(for: selectedNormalSound),
      volume: 0.85
    )
    subdivisionBuffer = loadBuffer(
      named: Self.subdivisionFileName(for: selectedSubdivisionSound),
      volume: 0.65
    )

    if accentBuffer == nil || normalBuffer == nil || subdivisionBuffer == nil {
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

    let renderAnchor = (accentNodes.first ?? normalNodes.first)?.lastRenderTime
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

  private func buffer(for kind: ClickKind) -> AVAudioPCMBuffer? {
    switch kind {
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

  private func activateAudioSession() {
    let session = AVAudioSession.sharedInstance()
    do {
      try session.setCategory(.playback, mode: .default, options: [.mixWithOthers])
      try session.setActive(true)
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

  private static func normalResourceName(for soundId: String) -> String {
    switch soundId {
    case "soft":
      return "soft"
    case "digital":
      return "digital"
    case "bright":
      return "bright"
    case "cowbell":
      return "cowbell"
    default:
      return "classic"
    }
  }

  private static func accentResourceName(for soundId: String) -> String {
    switch soundId {
    case "strong_accent":
      return "strong"
    case "digital_accent":
      return "digital"
    case "cowbell_accent":
      return "cowbell"
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

  private static func subdivisionFileName(for normalResource: String) -> String {
    "click_subdivision_\(normalResource)"
  }
}
