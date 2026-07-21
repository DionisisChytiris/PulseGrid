import AVFoundation
import Foundation

final class ClickSoundPlayer {
  private static let accentPoolSize = 2
  private static let normalPoolSize = 4
  private static let subdivisionPoolSize = 12
  private static let assetsBundleName = "NativeAudioModuleAssets"

  private var accentPlayers: [AVAudioPlayer] = []
  private var normalPlayers: [AVAudioPlayer] = []
  private var subdivisionPlayers: [AVAudioPlayer] = []

  private var accentIndex = 0
  private var normalIndex = 0
  private var subdivisionIndex = 0

  private var selectedNormalSound = "classic"
  private var selectedAccentSound = "classic"
  private var selectedSubdivisionSound = "classic"

  var areReady: Bool {
    !accentPlayers.isEmpty && !normalPlayers.isEmpty && !subdivisionPlayers.isEmpty
  }

  func initialize() {
    activateAudioSession()
    reloadPools()
  }

  func setNormalClickSound(_ soundId: String) {
    let nextSound = Self.normalResourceName(for: soundId)
    guard nextSound != selectedNormalSound else {
      return
    }

    selectedNormalSound = nextSound
    normalPlayers = loadPlayerPool(
      named: Self.normalFileName(for: nextSound),
      count: Self.normalPoolSize,
      volume: 0.85
    )
  }

  func setAccentClickSound(_ soundId: String) {
    let nextSound = Self.accentResourceName(for: soundId)
    guard nextSound != selectedAccentSound else {
      return
    }

    selectedAccentSound = nextSound
    accentPlayers = loadPlayerPool(
      named: Self.accentFileName(for: nextSound),
      count: Self.accentPoolSize,
      volume: 1.0
    )
  }

  func setSubdivisionClickSound(_ soundId: String) {
    let nextSound = Self.normalResourceName(for: soundId)
    guard nextSound != selectedSubdivisionSound else {
      return
    }

    selectedSubdivisionSound = nextSound
    subdivisionPlayers = loadPlayerPool(
      named: Self.subdivisionFileName(for: nextSound),
      count: Self.subdivisionPoolSize,
      volume: 0.65
    )
  }

  func previewNormalClick() {
    playFromPool(&normalPlayers, index: &normalIndex, label: "normal-preview")
  }

  func previewAccentClick() {
    playFromPool(&accentPlayers, index: &accentIndex, label: "accent-preview")
  }

  func previewSubdivisionClick() {
    playFromPool(&subdivisionPlayers, index: &subdivisionIndex, label: "subdivision-preview")
  }

  func playAccent(scheduledDeadlineNs: UInt64) {
    playFromPool(&accentPlayers, index: &accentIndex, label: "accent")
  }

  func playNormal(scheduledDeadlineNs: UInt64) {
    playFromPool(&normalPlayers, index: &normalIndex, label: "normal")
  }

  func playSubdivision(scheduledDeadlineNs: UInt64) {
    playFromPool(&subdivisionPlayers, index: &subdivisionIndex, label: "subdivision")
  }

  private func reloadPools() {
    accentPlayers = loadPlayerPool(
      named: Self.accentFileName(for: selectedAccentSound),
      count: Self.accentPoolSize,
      volume: 1.0
    )
    normalPlayers = loadPlayerPool(
      named: Self.normalFileName(for: selectedNormalSound),
      count: Self.normalPoolSize,
      volume: 0.85
    )
    subdivisionPlayers = loadPlayerPool(
      named: Self.subdivisionFileName(for: selectedSubdivisionSound),
      count: Self.subdivisionPoolSize,
      volume: 0.65
    )

    if !areReady {
      print("ClickSoundPlayer.initialize() — missing one or more click samples")
    }
  }

  private func playFromPool(
    _ players: inout [AVAudioPlayer],
    index: inout Int,
    label: String
  ) {
    guard !players.isEmpty else {
      print("ClickSoundPlayer.play\(label)() — sample not loaded")
      return
    }

    let player = players[index]
    index = (index + 1) % players.count
    player.currentTime = 0
    if !player.play() {
      print("ClickSoundPlayer.play\(label)() — AVAudioPlayer.play() returned false")
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

  private func loadPlayerPool(named name: String, count: Int, volume: Float) -> [AVAudioPlayer] {
    guard let url = resourceURL(named: name) else {
      return []
    }

    var players: [AVAudioPlayer] = []
    players.reserveCapacity(count)

    for _ in 0..<count {
      do {
        let player = try AVAudioPlayer(contentsOf: url)
        player.volume = volume
        player.prepareToPlay()
        players.append(player)
      } catch {
        print("ClickSoundPlayer — failed to load \(name).wav: \(error)")
        return []
      }
    }

    return players
  }

  private func resourceURL(named name: String) -> URL? {
    let filename = "\(name).wav"
    var checkedLocations: [String] = []

    for candidate in Self.resourceSearchBundles() {
      let label = candidate.label
      checkedLocations.append(label)

      if let url = candidate.bundle.url(forResource: name, withExtension: "wav") {
        return url
      }

      // Some packaging layouts nest files under an Assets subdirectory inside the bundle.
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

  /// Ordered lookup: CocoaPods resource bundle first, then main / class bundles.
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

    // Static-framework fallback: bundle may sit next to the class module resources.
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
