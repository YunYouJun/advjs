import AVFoundation
import Observation
import StudioKit

@Observable
final class AudioAudition {
    private var player: AVAudioPlayer?
    private var generation = 0
    private var startTime = 0.0
    private var ownsSession = false
    private(set) var auditionedHash: String?
    private(set) var isPlaying = false
    private(set) var position = 0.0
    private(set) var duration = 0.0

    func toggle(asset: ProjectAudioAsset, in session: ProjectSession) async throws {
        if let player, player.isPlaying {
            player.pause()
            isPlaying = false
            return
        }
        let request = generation
        if player == nil {
            let data = try await session.audioBytes(asset)
            guard generation == request, !Task.isCancelled, session.state == .ready else { return }
            guard let decoded = try? AVAudioPlayer(data: data), decoded.duration > 0,
                  decoded.duration.isFinite, decoded.prepareToPlay() else { throw ProjectAudioError.invalidAudio }
            player = decoded
            duration = decoded.duration
        }
        guard let player else { return }
        let audioSession = AVAudioSession.sharedInstance()
        do {
            try audioSession.setCategory(.playback, mode: .default, options: .mixWithOthers)
            try audioSession.setActive(true)
            ownsSession = true
            startTime = player.currentTime
            guard player.play() else { throw ProjectAudioError.invalidAudio }
            isPlaying = true
        }
        catch {
            stop()
            throw error
        }
    }

    func track(_ asset: ProjectAudioAsset) async {
        while isPlaying && !Task.isCancelled, let player {
            position = player.currentTime
            if player.isPlaying, position - startTime >= min(0.2, duration / 3) {
                auditionedHash = asset.sha256
            }
            isPlaying = player.isPlaying
            if isPlaying { try? await Task.sleep(for: .milliseconds(40)) }
        }
    }

    func seek(_ time: Double) {
        player?.currentTime = time
        startTime = time
        position = time
    }

    func stop() {
        generation += 1
        player?.stop()
        player = nil
        isPlaying = false
        auditionedHash = nil
        position = 0
        duration = 0
        if ownsSession {
            try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
            ownsSession = false
        }
    }
}
