import ExpoModulesCore

public class NativeAudioModule: Module {
  private lazy var metronomeEngine: MetronomeEngine = createMetronomeEngine()
  private let clickSoundPlayer = ClickSoundPlayer()

  public func definition() -> ModuleDefinition {
    Name("NativeAudioModule")

    Events("onTick")

    Function("initialize") {
      self.clickSoundPlayer.initialize()
    }

    Function("areSoundsReady") { () -> Bool in
      self.clickSoundPlayer.areReady
    }

    Function("start") { (options: [String: Any]) in
      let bpm = (options["bpm"] as? NSNumber)?.doubleValue ?? 120
      let beatsPerMeasure = (options["beatsPerMeasure"] as? NSNumber)?.intValue ?? 4
      let accentPattern = self.readAccentPattern(
        options["accentPattern"],
        beatsPerMeasure: beatsPerMeasure
      )
      let ticksPerBeat = self.readTicksPerBeat(options["subdivision"])

      self.metronomeEngine.start(
        bpm: bpm,
        beatsPerMeasure: beatsPerMeasure,
        accentPattern: accentPattern,
        ticksPerBeat: ticksPerBeat
      )
    }

    Function("stop") {
      self.metronomeEngine.stop()
    }

    Function("setTempo") { (bpm: Double) in
      self.metronomeEngine.updateTempo(bpm)
    }

    Function("setAccentPattern") { (accentPattern: [Bool]) in
      self.metronomeEngine.updateAccentPattern(accentPattern)
    }

    Function("setSubdivision") { (subdivision: String) in
      self.metronomeEngine.updateSubdivision(self.readTicksPerBeat(subdivision))
    }

    Function("setSubdivisionAccentMode") { (mode: String) in
      self.metronomeEngine.updateSubdivisionAccentMode(self.readSubdivisionAccentMode(mode))
    }

    Function("setSubdivisionAccentEveryNth") { (everyNth: Int) in
      self.metronomeEngine.updateSubdivisionAccentEveryNth(everyNth)
    }

    Function("setSubdivisionAccentPattern") { (pattern: [Bool]) in
      self.metronomeEngine.updateSubdivisionAccentPattern(pattern)
    }

    Function("setNormalClickSound") { (soundId: String) in
      self.clickSoundPlayer.setNormalClickSound(soundId)
    }

    Function("setAccentClickSound") { (soundId: String) in
      self.clickSoundPlayer.setAccentClickSound(soundId)
    }

    Function("setSubdivisionClickSound") { (soundId: String) in
      self.clickSoundPlayer.setSubdivisionClickSound(soundId)
    }

    Function("previewNormalClick") {
      self.clickSoundPlayer.previewNormalClick()
    }

    Function("previewAccentClick") {
      self.clickSoundPlayer.previewAccentClick()
    }

    Function("previewSubdivisionClick") {
      self.clickSoundPlayer.previewSubdivisionClick()
    }
  }

  private func createMetronomeEngine() -> MetronomeEngine {
    MetronomeEngine(
      clickSoundPlayer: clickSoundPlayer,
      onTick: { [weak self] sequence, beatIndex, beatNumber, beatsPerMeasure, subdivisionIndex, isAccent, timestampMs in
        self?.sendEvent(
          "onTick",
          [
            "sequence": Int(sequence),
            "beatIndex": beatIndex,
            "beatNumber": beatNumber,
            "beatsPerMeasure": beatsPerMeasure,
            "subdivisionIndex": subdivisionIndex,
            "isAccent": isAccent,
            "timestamp": timestampMs,
          ]
        )
      }
    )
  }

  private func readTicksPerBeat(_ value: Any?) -> Int {
    guard let subdivision = value as? String else {
      return 1
    }

    switch subdivision {
    case "eighth":
      return 2
    case "triplet":
      return 3
    case "sixteenth":
      return 4
    default:
      return 1
    }
  }

  private func readAccentPattern(_ value: Any?, beatsPerMeasure: Int) -> [Bool] {
    let pattern: [Bool]? = {
      if let bools = value as? [Bool], !bools.isEmpty {
        return bools
      }

      if let numbers = value as? [NSNumber], !numbers.isEmpty {
        return numbers.map { $0.boolValue }
      }

      return nil
    }()

    guard let pattern else {
      return (0..<beatsPerMeasure).map { index in index == 0 }
    }

    return (0..<beatsPerMeasure).map { index in
      pattern[index % pattern.count]
    }
  }

  private func readSubdivisionAccentMode(_ value: String) -> SubdivisionAccentMode {
    switch value {
    case "group_start":
      return .groupStart
    case "every_nth":
      return .everyNth
    case "custom":
      return .custom
    default:
      return .off
    }
  }
}
