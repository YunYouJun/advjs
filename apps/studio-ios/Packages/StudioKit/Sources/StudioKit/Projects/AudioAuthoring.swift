import AVFoundation
import Foundation

public struct ProjectAudioAsset: Decodable, Equatable, Identifiable, Sendable {
    public struct Review: Decodable, Equatable, Sendable {
        public let status: String
        public let canBind: Bool
    }

    public let id: String
    public let title: String?
    public let kind: String
    public let labels: [String]?
    public let license: String?
    public let loop: Bool?
    public let duration: Double?
    public let bytes: Int?
    public let sha256: String?
    public let mediaPath: String?
    public let music: ContentData?
    public let musicReview: Review

    public var name: String { title ?? id }
}

public struct ProjectAudioLibrary: Decodable, Sendable {
    public enum State: String, Decodable, Sendable { case ready, uninitialized, legacy }

    public let state: State
    public let kinds: [String]
    public let usages: [String]
    public let buses: [String]
    public let assets: [ProjectAudioAsset]
    public let revision: String?
    public let mixer: ProjectAudioMixer
}

public struct ProjectAudioMixer: Codable, Equatable, Sendable {
    public struct Bus: Codable, Equatable, Sendable {
        public var gain: Double?
        public var muted: Bool?
        public var solo: Bool?
        public init() {}
    }

    public struct Ducking: Codable, Equatable, Sendable {
        public var enabled: Bool?
        public var gain: Double?
        public var attackMs: Double?
        public var releaseMs: Double?
        public init() {}
    }

    public var schemaVersion = 1
    public var buses: [String: Bus]?
    public var ducking: Ducking?
    public var sfx: ContentData?
    public var ui: ContentData?

    public init() {}
}

public struct ProjectMusicBrief: Decodable, Sendable {
    public let music: ContentData
    public let text: String
    public let json: String
}

public enum ProjectAudioError: Error, Equatable, Sendable {
    case missingFile
    case unreadableFile
    case invalidAudio
    case audioTooLarge
    case noLocalMedia
    case changedMedia
    case auditionRequired
    case staleProject
    case unsavedChapter
    case incompleteRollback
}

public struct ProjectAudioImport: Sendable {
    // The offline scheme handler can serve this in a single request.
    static let maximumBytes = 64 * 1_048_576

    public let name: String
    public let duration: Double
    let data: Data
    let sha256: String

    public static func read(_ url: URL) async throws -> Self {
        try await Task.detached(priority: .userInitiated) {
            let scoped = url.startAccessingSecurityScopedResource()
            defer { if scoped { url.stopAccessingSecurityScopedResource() } }
            let data = try readAudioBytes(url)
            let player = try? AVAudioPlayer(data: data)
            guard let player, player.duration.isFinite, player.duration > 0, player.prepareToPlay() else {
                throw ProjectAudioError.invalidAudio
            }
            return Self(name: url.lastPathComponent, duration: player.duration, data: data, sha256: DraftStore.sha256(data))
        }.value
    }
}

public struct ProjectMusicBinding: Decodable, Sendable {
    public let path: String
    public let original: String
    public let content: String
    fileprivate let assetId: String
    fileprivate let changes: [AudioFileChange]
}

private struct AudioFileChange: Decodable, Sendable {
    let path: String
    let expected: String?
    let content: String?
}

private struct AudioMaster: Codable, Sendable {
    let sha256: String
    let bytes: Int
}

private struct AudioPlan: Decodable, Sendable {
    struct Media: Decodable, Sendable {
        let path: String
        let candidate: AudioMaster
        let operation: String?
    }

    let changes: [AudioFileChange]
    let media: [Media]?
    let assetId: String?
}

private struct AudioInput: Encodable, Sendable {
    var files: [String: String]?
    var revision: String?
    var id: String?
    var path: String?
    var music: ContentData?
    var metadata: ContentData?
    var master: ContentData?
    var status: String?
    var mixer: ProjectAudioMixer?
}

private func readAudioBytes(_ url: URL, watcher: ProjectWatcher? = nil) throws -> Data {
    do {
        return try CoordinatedFiles.read(url, filePresenter: watcher, maximumBytes: ProjectAudioImport.maximumBytes)
    }
    catch let error as CocoaError where error.code == .fileReadNoSuchFile {
        throw ProjectAudioError.missingFile
    }
    catch CoordinatedFiles.ReadError.sizeLimit {
        throw ProjectAudioError.audioTooLarge
    }
    catch {
        throw ProjectAudioError.unreadableFile
    }
}

extension ProjectSession {
    public func audioLibrary() async throws -> ProjectAudioLibrary {
        guard let snapshot, state == .ready else { throw ProjectLibraryError.unavailable }
        return try await engine.call("audio.library", input: AudioInput(files: snapshot.files), as: ProjectAudioLibrary.self)
    }

    public func initializeAudioLibrary() async throws {
        let baseline = try audioBaseline()
        let name = id.uuidString.lowercased()
        let plan = try await engine.call("audio.initialize", input: AudioInput(files: baseline.files, id: name), as: AudioPlan.self)
        try await applyAudioPlan(plan, baseline: baseline)
    }

    public func musicBrief(_ fields: ContentData) async throws -> ProjectMusicBrief {
        try await engine.call("audio.brief", input: AudioInput(music: fields), as: ProjectMusicBrief.self)
    }

    public func importAudio(_ file: ProjectAudioImport, metadata: ContentData, revision: String) async throws -> String {
        let baseline = try audioBaseline()
        let master: ContentData = [
            "name": .string(file.name), "sha256": .string(file.sha256),
            "bytes": .number(Double(file.data.count)), "duration": .number(file.duration),
        ]
        let plan = try await engine.call(
            "audio.import", input: AudioInput(files: baseline.files, revision: revision, metadata: metadata, master: master), as: AudioPlan.self
        )
        guard let id = plan.assetId else { throw ProjectAudioError.staleProject }
        try await applyAudioPlan(plan, baseline: baseline, imported: file.data)
        return id
    }

    public func updateAudio(_ id: String, metadata: ContentData, revision: String) async throws {
        try await mutateAudio("audio.update", AudioInput(revision: revision, id: id, metadata: metadata))
    }

    public func removeAudio(_ id: String, revision: String) async throws {
        try await mutateAudio("audio.remove", AudioInput(revision: revision, id: id))
    }

    public func saveAudioMixer(_ mixer: ProjectAudioMixer, revision: String) async throws {
        try await mutateAudio("audio.mixer", AudioInput(revision: revision, mixer: mixer))
    }

    public func audioBytes(_ asset: ProjectAudioAsset) async throws -> Data {
        guard let path = asset.mediaPath else { throw ProjectAudioError.noLocalMedia }
        let url = try contentURL(path)
        let watcher = watcher
        return try await Task.detached(priority: .userInitiated) {
            let data = try readAudioBytes(url, watcher: watcher)
            try Self.verifyAudioBytes(data, sha256: asset.sha256, bytes: asset.bytes)
            return data
        }.value
    }

    public func reviewMusic(_ asset: ProjectAudioAsset, approving: Bool, auditionedHash: String?, revision: String) async throws {
        if approving {
            guard let auditionedHash, asset.sha256 == auditionedHash else { throw ProjectAudioError.auditionRequired }
        }
        let data = try await audioBytes(asset)
        let master: ContentData = ["sha256": .string(DraftStore.sha256(data)), "bytes": .number(Double(data.count))]
        try await mutateAudio(
            "audio.review", AudioInput(revision: revision, id: asset.id, master: master, status: approving ? "approved" : "rejected")
        )
    }

    public func prepareMusicBinding(_ asset: ProjectAudioAsset, chapter path: String) async throws -> ProjectMusicBinding {
        guard !hasDraft(path) else { throw ProjectAudioError.unsavedChapter }
        let baseline = try audioBaseline()
        _ = try await audioBytes(asset)
        return try await engine.call(
            "audio.bindMarkdown", input: AudioInput(files: baseline.files, id: asset.id, path: path), as: ProjectMusicBinding.self
        )
    }

    public func applyMusicBinding(_ binding: ProjectMusicBinding) async throws {
        guard !hasDraft(binding.path) else { throw ProjectAudioError.unsavedChapter }
        let baseline = try audioBaseline()
        let library = try await audioLibrary()
        guard let asset = library.assets.first(where: { $0.id == binding.assetId }), asset.musicReview.canBind,
              let path = asset.mediaPath else { throw ProjectAudioError.staleProject }
        let data = try await audioBytes(asset)
        let media = AudioPlan.Media(path: path, candidate: AudioMaster(sha256: DraftStore.sha256(data), bytes: data.count), operation: "verify")
        guard !hasDraft(binding.path) else { throw ProjectAudioError.unsavedChapter }
        try await applyAudioPlan(AudioPlan(changes: binding.changes, media: [media], assetId: nil), baseline: baseline)
    }

    private func audioBaseline() throws -> ProjectSnapshot {
        guard let snapshot, state == .ready else { throw ProjectLibraryError.unavailable }
        return snapshot
    }

    private func mutateAudio(_ operation: String, _ input: AudioInput) async throws {
        let baseline = try audioBaseline()
        var input = input
        input.files = baseline.files
        let plan = try await engine.call(operation, input: input, as: AudioPlan.self)
        try await applyAudioPlan(plan, baseline: baseline)
    }

    private func applyAudioPlan(_ plan: AudioPlan, baseline: ProjectSnapshot, imported: Data? = nil) async throws {
        guard state == .ready, let root, snapshot == baseline else { throw ProjectAudioError.staleProject }
        try Task.checkCancellation()
        let changes = try plan.changes.map { change in
            if change.expected != change.content, hasDraft(change.path) { throw ProjectAudioError.staleProject }
            return CoordinatedFiles.ByteChange(
                url: try contentURL(change.path), expected: change.expected.map { Data($0.utf8) },
                replacement: change.content.map { Data($0.utf8) }
            )
        }
        let media = try (plan.media ?? []).map { item in
            (item, try contentURL(item.path))
        }
        try CoordinatedFiles.changeProjectBytes(root: root, textPaths: Set(baseline.paths.filter(ProjectSnapshot.isTextPath(_:))),
                                                changes: changes, filePresenter: watcher) {
            try media.compactMap { item, url in
                if item.operation == "verify" {
                    let data = try CoordinatedFiles.readBytes(url, maximumBytes: ProjectAudioImport.maximumBytes)
                    try Self.verifyAudioBytes(data, sha256: item.candidate.sha256, bytes: item.candidate.bytes)
                    return nil
                }
                guard let imported else { throw ProjectAudioError.changedMedia }
                try Self.verifyAudioBytes(imported, sha256: item.candidate.sha256, bytes: item.candidate.bytes)
                return CoordinatedFiles.ByteChange(url: url, expected: nil, replacement: imported)
            }
        }
        await reload()
    }

    nonisolated private static func verifyAudioBytes(_ data: Data, sha256: String?, bytes: Int?) throws {
        if let bytes, bytes != data.count { throw ProjectAudioError.changedMedia }
        if let sha256, sha256 != DraftStore.sha256(data) { throw ProjectAudioError.changedMedia }
    }
}
