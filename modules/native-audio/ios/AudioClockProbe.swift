import AVFoundation
import Foundation

/**
 Isolated clock-domain probe for iOS metronome scheduling.

 MetronomeEngine deadlines use `DispatchTime.now().uptimeNanoseconds`.
 AVAudioEngine scheduling uses `AVAudioTime` (hostTime / sampleTime).

 This type does **not** implement metronome lookahead scheduling. It only
 measures whether those clocks can be related safely before we migrate clicks
 off AVAudioPlayer.
 */
enum AudioClockProbe {
  private static let logPrefix = "PulseGrid-AudioClockProbe"

  struct Snapshot: CustomStringConvertible {
    let dispatchUptimeNs: UInt64
    let coreAudioHostTime: UInt64
    let coreAudioHostNs: UInt64
    let renderHostTime: UInt64?
    let renderHostNs: UInt64?
    let renderSampleTime: AVAudioFramePosition?
    let sampleRate: Double?

    var dispatchMinusCoreAudioHostNs: Int64 {
      Int64(bitPattern: dispatchUptimeNs) - Int64(bitPattern: coreAudioHostNs)
    }

    var description: String {
      let renderHost = renderHostNs.map(String.init) ?? "nil"
      let renderSample = renderSampleTime.map(String.init) ?? "nil"
      let rate = sampleRate.map { String(format: "%.3f", $0) } ?? "nil"
      return """
      dispatchUptimeNs=\(dispatchUptimeNs)
      coreAudioHostTime=\(coreAudioHostTime)
      coreAudioHostNs=\(coreAudioHostNs)
      dispatch-coreAudioHostNs=\(dispatchMinusCoreAudioHostNs)
      renderHostNs=\(renderHost)
      renderSampleTime=\(renderSample)
      sampleRate=\(rate)
      """
    }
  }

  struct MappingCheck: CustomStringConvertible {
    let futureDeadlineNs: UInt64
    let predictedHostTime: UInt64
    let predictedSampleTime: AVAudioFramePosition
    let sampleRate: Double
    let hostNsAtAnchor: UInt64
    let sampleAtAnchor: AVAudioFramePosition
    let dispatchMinusHostNsAtCapture: Int64
    let mappingAssumesSameDomain: Bool

    var description: String {
      """
      futureDeadlineNs=\(futureDeadlineNs)
      predictedHostTime=\(predictedHostTime)
      predictedSampleTime=\(predictedSampleTime)
      sampleRate=\(sampleRate)
      hostNsAtAnchor=\(hostNsAtAnchor)
      sampleAtAnchor=\(sampleAtAnchor)
      dispatchMinusHostNsAtCapture=\(dispatchMinusHostNsAtCapture)
      mappingAssumesSameDomain=\(mappingAssumesSameDomain)
      """
    }
  }

  /// Runs session + engine probes and prints structured diagnostics.
  static func runAndLog() {
    print("\(logPrefix) — begin")

    activateSessionForProbe()

    let beforeEngine = captureWithoutEngine()
    print("\(logPrefix) — snapshot(no engine):\n\(beforeEngine)")

    do {
      let engineResult = try captureWithRunningEngine()
      print("\(logPrefix) — snapshot(engine running):\n\(engineResult.snapshot)")
      print("\(logPrefix) — mapping check:\n\(engineResult.mapping)")
      print("\(logPrefix) — verdict:\n\(engineResult.verdict)")
    } catch {
      print("\(logPrefix) — engine probe failed: \(error)")
    }

    print("\(logPrefix) — end")
  }

  // MARK: - Captures

  private static func captureWithoutEngine() -> Snapshot {
    let dispatchUptimeNs = DispatchTime.now().uptimeNanoseconds
    let hostTime = CoreHostTime.current()
    let hostNs = CoreHostTime.toNanos(hostTime)
    return Snapshot(
      dispatchUptimeNs: dispatchUptimeNs,
      coreAudioHostTime: hostTime,
      coreAudioHostNs: hostNs,
      renderHostTime: nil,
      renderHostNs: nil,
      renderSampleTime: nil,
      sampleRate: nil
    )
  }

  private struct EngineProbeResult {
    let snapshot: Snapshot
    let mapping: MappingCheck
    let verdict: String
  }

  private static func captureWithRunningEngine() throws -> EngineProbeResult {
    let engine = AVAudioEngine()
    let player = AVAudioPlayerNode()
    engine.attach(player)
    let format = engine.outputNode.outputFormat(forBus: 0)
    engine.connect(player, to: engine.mainMixerNode, format: format)

    try engine.start()
    player.play()

    // Let the render thread produce at least one timestamp.
    usleep(30_000)

    let dispatchUptimeNs = DispatchTime.now().uptimeNanoseconds
    let hostTime = CoreHostTime.current()
    let hostNs = CoreHostTime.toNanos(hostTime)

    guard let lastRender = player.lastRenderTime,
          lastRender.isHostTimeValid,
          lastRender.isSampleTimeValid else {
      engine.stop()
      throw ProbeError.missingRenderTime
    }

    let renderHost = lastRender.hostTime
    let renderHostNs = CoreHostTime.toNanos(renderHost)
    let renderSample = lastRender.sampleTime

    let snapshot = Snapshot(
      dispatchUptimeNs: dispatchUptimeNs,
      coreAudioHostTime: hostTime,
      coreAudioHostNs: hostNs,
      renderHostTime: renderHost,
      renderHostNs: renderHostNs,
      renderSampleTime: renderSample,
      sampleRate: format.sampleRate
    )

    let mapping = buildMappingCheck(
      dispatchUptimeNs: dispatchUptimeNs,
      hostNs: hostNs,
      renderTime: lastRender,
      sampleRate: format.sampleRate
    )

    let verdict = evaluate(
      snapshot: snapshot,
      mapping: mapping,
      renderTime: lastRender
    )

    // Soft-stop probe engine; does not affect production AVAudioPlayer path.
    player.stop()
    engine.stop()

    return EngineProbeResult(snapshot: snapshot, mapping: mapping, verdict: verdict)
  }

  private static func buildMappingCheck(
    dispatchUptimeNs: UInt64,
    hostNs: UInt64,
    renderTime: AVAudioTime,
    sampleRate: Double
  ) -> MappingCheck {
    // Synthetic MetronomeEngine-style deadline: "now + 100ms" in Dispatch uptime domain.
    let leadNs: UInt64 = 100_000_000
    let futureDeadlineNs = dispatchUptimeNs &+ leadNs

    let dispatchMinusHost = Int64(bitPattern: dispatchUptimeNs) - Int64(bitPattern: hostNs)
    let sameDomain = abs(dispatchMinusHost) < 5_000_000 // < 5ms skew at capture

    // Candidate mapping A (ONLY valid if Dispatch uptime ≈ Core Audio host ns):
    // deadlineHostNs = futureDeadlineNs - dispatchMinusHost
    let deadlineHostNs = UInt64(Int64(bitPattern: futureDeadlineNs) - dispatchMinusHost)
    let predictedHostTime = CoreHostTime.fromNanos(deadlineHostNs)

    // Candidate mapping B from render anchor:
    // sample = renderSample + (deadlineHostNs - renderHostNs) * sr / 1e9
    let renderHostNs = CoreHostTime.toNanos(renderTime.hostTime)
    let deltaHostNs = Int64(bitPattern: deadlineHostNs) - Int64(bitPattern: renderHostNs)
    let deltaSamples = Int64((Double(deltaHostNs) * sampleRate) / 1_000_000_000.0)
    let predictedSample = renderTime.sampleTime + deltaSamples

    return MappingCheck(
      futureDeadlineNs: futureDeadlineNs,
      predictedHostTime: predictedHostTime,
      predictedSampleTime: predictedSample,
      sampleRate: sampleRate,
      hostNsAtAnchor: renderHostNs,
      sampleAtAnchor: renderTime.sampleTime,
      dispatchMinusHostNsAtCapture: dispatchMinusHost,
      mappingAssumesSameDomain: sameDomain
    )
  }

  private static func evaluate(
    snapshot: Snapshot,
    mapping: MappingCheck,
    renderTime: AVAudioTime
  ) -> String {
    var lines: [String] = []

    let skewMs = Double(snapshot.dispatchMinusCoreAudioHostNs) / 1_000_000.0
    if abs(snapshot.dispatchMinusCoreAudioHostNs) < 1_000_000 {
      lines.append(
        "OK: DispatchTime.uptimeNanoseconds ≈ CoreHostTime.toNanos(CoreHostTime.current()) (skew \(String(format: "%.3f", skewMs)) ms). Offset bridging is plausible."
      )
    } else if abs(snapshot.dispatchMinusCoreAudioHostNs) < 5_000_000 {
      lines.append(
        "WARN: small skew \(String(format: "%.3f", skewMs)) ms between Dispatch uptime and Core Audio host ns — use measured offset, do not treat as identical."
      )
    } else {
      lines.append(
        "FAIL: Dispatch uptime and Core Audio host ns differ by \(String(format: "%.3f", skewMs)) ms — do NOT map deadlineNs directly to AVAudioTime.hostTime without a calibrated offset (or redefine MetronomeEngine anchor in host-ns)."
      )
    }

    if renderTime.isSampleTimeValid && renderTime.isHostTimeValid {
      lines.append(
        "OK: player.lastRenderTime provides both hostTime and sampleTime — AVAudioTime(sampleTime:atRate:) can be derived from host-domain deadlines via render anchor."
      )
    } else {
      lines.append(
        "FAIL: lastRenderTime missing valid host/sample — cannot confirm sample-frame mapping yet."
      )
    }

    if mapping.mappingAssumesSameDomain {
      lines.append(
        "PROBE MAP: future deadlineNs +\(100)ms → predictedSampleTime=\(mapping.predictedSampleTime) at sr=\(mapping.sampleRate). Safe to implement scheduling only if FAIL lines above are absent."
      )
    } else {
      lines.append(
        "PROBE MAP: blocked — calibrate deadline domain to Core Audio host ns before predicting sample frames."
      )
    }

    lines.append(
      "NOTE: This probe does not schedule metronome clicks. Confirm logs on a real device/simulator before AVAudioEngine migration."
    )

    return lines.map { "  - \($0)" }.joined(separator: "\n")
  }

  // MARK: - Session

  private static func activateSessionForProbe() {
    let session = AVAudioSession.sharedInstance()
    do {
      try session.setCategory(.playback, mode: .default, options: [.mixWithOthers])
      try session.setActive(true)
    } catch {
      print("\(logPrefix) — session activate failed: \(error)")
    }
  }

  private enum ProbeError: Error {
    case missingRenderTime
  }
}
