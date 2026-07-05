import AVFoundation
import Foundation

final class ClickSoundPlayer {
  private static let accentPoolSize = 2
  private static let normalPoolSize = 4
  private static let subdivisionPoolSize = 12

  private var accentPlayers: [AVAudioPlayer] = []
  private var normalPlayers: [AVAudioPlayer] = []
  private var subdivisionPlayers: [AVAudioPlayer] = []

  private var accentIndex = 0
  private var normalIndex = 0
  private var subdivisionIndex = 0

  var areReady: Bool {
    !accentPlayers.isEmpty && !normalPlayers.isEmpty && !subdivisionPlayers.isEmpty
  }

  func initialize() {
    if areReady {
      return
    }

    activateAudioSession()

    accentPlayers = loadPlayerPool(named: "click_accent", count: Self.accentPoolSize, volume: 1.0)
    normalPlayers = loadPlayerPool(named: "click_normal", count: Self.normalPoolSize, volume: 0.85)
    subdivisionPlayers = loadPlayerPool(
      named: "click_subdivision",
      count: Self.subdivisionPoolSize,
      volume: 0.65
    )

    if !areReady {
      print("ClickSoundPlayer.initialize() — missing one or more click samples")
    }
  }

  func playAccent() {
    playFromPool(&accentPlayers, index: &accentIndex, label: "accent")
  }

  func playNormal() {
    playFromPool(&normalPlayers, index: &normalIndex, label: "normal")
  }

  func playSubdivision() {
    playFromPool(&subdivisionPlayers, index: &subdivisionIndex, label: "subdivision")
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
    player.play()
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
      print("ClickSoundPlayer — missing resource \(name).wav")
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
    if let url = Bundle.main.url(forResource: name, withExtension: "wav") {
      return url
    }

    return Bundle(for: ClickSoundPlayer.self).url(forResource: name, withExtension: "wav")
  }
}
