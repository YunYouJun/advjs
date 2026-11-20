import Foundation
@testable import StudioKit
import Testing

@MainActor
@Suite("Native audio authoring")
struct AudioAuthoringTests {
    @Test("A real music master survives review, chapter binding, and reopening")
    func importReviewBindAndReopen() async throws {
        let studio = try TemporaryStudio()
        defer { studio.remove() }
        let store = ProjectStore(directories: studio.directories, engine: EngineBridge())
        let record = try await store.create(name: "Audio", templateID: "visual-novel-starter")
        let session = ProjectSession(id: record.id, name: record.name, store: store, directories: studio.directories)
        await session.open()
        let root = try #require(session.root)
        let chapter = "adv/chapters/01.adv.md"
        let original = try #require(session.snapshot?.files[chapter])

        #expect(try await session.audioLibrary().state == .uninitialized)
        try await session.initializeAudioLibrary()
        let empty = try await session.audioLibrary()
        #expect(empty.state == .ready && empty.assets.isEmpty)

        let fixture = try #require(Bundle.module.url(forResource: "theme", withExtension: "m4a", subdirectory: "Golden"))
        let bytes = try Data(contentsOf: fixture)
        let imported = try await ProjectAudioImport.read(fixture)
        #expect(imported.duration > 10)
        let brief = try await session.musicBrief([
            "usage": .string("background"), "source": .object(["type": .string("manual")]),
            "rights": .object(["license": .string("CC0-1.0")]),
            "brief": .object(["summary": .string("夜雨与钢琴"), "loopIntent": .bool(true)]),
        ])
        #expect(brief.text.contains("夜雨与钢琴"))
        #expect(try JSONDecoder().decode(ContentData.self, from: Data(brief.json.utf8)) == brief.music)
        let id = try await session.importAudio(imported, metadata: [
            "kind": .string("bgm"), "title": .string("Night Music"), "loop": .bool(true),
            "music": .object(brief.music), "license": .string("CC0-1.0"),
        ], revision: try #require(empty.revision))
        #expect(session.externalReloads == 0)

        let pending = try await session.audioLibrary()
        let asset = try #require(pending.assets.first)
        let mediaPath = try #require(asset.mediaPath)
        let mediaURL = root.appending(path: mediaPath)
        #expect(mediaPath == "adv/assets/audio/\(id).m4a")
        #expect(session.snapshot?.paths.contains(mediaPath) == true)
        #expect(try Data(contentsOf: mediaURL) == bytes)
        #expect(try await session.audioBytes(asset) == bytes)
        #expect(asset.musicReview.status == "pending" && !asset.musicReview.canBind)
        await #expect(throws: ProjectAudioError.auditionRequired) {
            try await session.reviewMusic(asset, approving: true, auditionedHash: nil, revision: try #require(pending.revision))
        }
        try await session.reviewMusic(asset, approving: true, auditionedHash: asset.sha256, revision: try #require(pending.revision))
        let reviewed = try await session.audioLibrary()
        let approved = try #require(reviewed.assets.first)
        #expect(approved.musicReview.status == "approved" && approved.musicReview.canBind)
        let plan = try await session.prepareMusicBinding(approved, chapter: chapter)
        #expect(plan.original == original)
        #expect(plan.content.contains(id))
        #expect(try String(contentsOf: root.appending(path: chapter), encoding: .utf8) == original)
        try await session.applyMusicBinding(plan)
        #expect(try String(contentsOf: root.appending(path: chapter), encoding: .utf8) == plan.content)

        try await session.updateAudio(id, metadata: ["title": .string("夜雨"), "labels": .array([.string("雨")])], revision: try #require(try await session.audioLibrary().revision))
        var mixer = ProjectAudioMixer()
        var music = ProjectAudioMixer.Bus()
        music.gain = 0.65
        music.solo = true
        var ambience = ProjectAudioMixer.Bus()
        ambience.muted = true
        mixer.buses = ["music": music, "ambience": ambience]
        var ducking = ProjectAudioMixer.Ducking()
        ducking.enabled = true
        ducking.gain = 0.22
        ducking.attackMs = 80
        ducking.releaseMs = 400
        mixer.ducking = ducking
        try await session.saveAudioMixer(mixer, revision: try #require(try await session.audioLibrary().revision))
        await session.close()
        await session.open()

        let reopened = try await session.audioLibrary()
        let edited = try #require(reopened.assets.first)
        #expect(edited.name == "夜雨" && edited.labels == ["雨"] && edited.musicReview.canBind)
        #expect(reopened.mixer == mixer)
        let player = try await session.buildPlayer(try session.sourceInput(.saved), baseURL: URL(string: "advjs-player://project/")!)
        #expect(player.diagnostics.filter { $0.severity == .error }.isEmpty)
        #expect(String(decoding: try #require(player.programJSON), as: UTF8.self).contains(id))
        let config = try JSONDecoder().decode(ContentData.self, from: try #require(player.gameConfigJSON))
        let runtime = try #require(config["audio"]?.object)
        #expect(runtime["assets"]?.object?[id]?.object?["src"]?.string == "advjs-player://project/\(mediaPath)")
        #expect(runtime["mixer"]?.object?["ducking"]?.object?["gain"] == .number(0.22))

        await #expect(throws: EngineError.self) {
            try await session.removeAudio(id, revision: try #require(reopened.revision))
        }
        try CoordinatedFiles.write(Data("corrupt".utf8), to: mediaURL)
        await #expect(throws: ProjectAudioError.changedMedia) { _ = try await session.audioBytes(edited) }
        try CoordinatedFiles.delete(mediaURL)
        await #expect(throws: ProjectAudioError.missingFile) { _ = try await session.audioBytes(edited) }
        try CoordinatedFiles.write(bytes, to: mediaURL)

        try await session.save(original, to: chapter)
        try await session.reviewMusic(edited, approving: false, auditionedHash: nil, revision: try #require(try await session.audioLibrary().revision))
        await session.close()
        await session.open()
        let rejected = try await session.audioLibrary()
        #expect(rejected.assets.first?.musicReview.status == "rejected")
        try await session.removeAudio(id, revision: try #require(rejected.revision))
        await session.close()
        await session.open()
        #expect(try await session.audioLibrary().assets.isEmpty)
        #expect(try Data(contentsOf: mediaURL) == bytes)
        await session.close()
    }

    @Test("Import distinguishes invalid bytes from a missing file")
    func invalidImport() async throws {
        let studio = try TemporaryStudio()
        defer { studio.remove() }
        let file = studio.directories.projects.appending(path: "Not a recording.m4a")
        await #expect(throws: ProjectAudioError.missingFile) { _ = try await ProjectAudioImport.read(file) }
        try CoordinatedFiles.write(Data("Not audio".utf8), to: file)
        await #expect(throws: ProjectAudioError.invalidAudio) { _ = try await ProjectAudioImport.read(file) }
    }
}
