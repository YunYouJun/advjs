import Foundation
import Testing
@testable import StudioKit

@MainActor
@Suite("Native content authoring")
struct ContentAuthoringTests {
    private func open(_ studio: TemporaryStudio) async throws -> ProjectSession {
        let store = ProjectStore(directories: studio.directories, engine: EngineBridge())
        let record = try await store.create(name: "Content", templateID: "school-romance")
        let session = ProjectSession(id: record.id, name: record.name, store: store, directories: studio.directories)
        await session.open()
        return session
    }

    @Test("Round trips all four kinds and preserves the character and location source")
    func contentRoundTrip() async throws {
        let studio = try TemporaryStudio()
        defer { studio.remove() }
        let session = try await open(studio)
        let templateCharacters = try await session.contentEntries(.character)
        #expect(Set(templateCharacters.map(\.name)) == ["叶晴", "陆远", "苏小鱼", "班主任"])

        for kind in ContentKind.allCases {
            let original = "原始 \(kind.rawValue)"
            let path = try await session.createContent(kind, data: ["name": .string(original), "domain": .string("law")])
            let baseline = try #require(session.snapshot?.files[path])
            if kind == .character || kind == .location {
                let fixture = baseline.replacingOccurrences(of: "\n---", with: "\nfuture: { extra: true }\n---")
                    + "\n# 自定义正文\n\n原始资料 💡\n"
                try await session.save(fixture, to: path)
            }
            let document = try await session.contentDocument(kind, path: path)
            let renamed = "改名 \(kind.rawValue)"
            let staged = try await session.stageContent(kind, path: path, document: document, changes: ["name": .string(renamed)])
            #expect(session.hasDraft(path))
            #expect(session.snapshot?.files[path] == document.savedSource)
            if kind == .character || kind == .location {
                #expect(staged.contains("future:"))
                #expect(staged.hasSuffix("\n# 自定义正文\n\n原始资料 💡\n"))
            }
            try await session.saveContent(path)
            #expect(!session.hasDraft(path))
            await session.close()
            await session.open()
            let reopened = try await session.contentDocument(kind, path: path)
            #expect(reopened.source == staged)
            #expect(reopened.data["name"] == .string(renamed))
            #expect(reopened.data["id"] == document.data["id"])
            if kind == .knowledge { #expect(reopened.data["domain"] == .string("law")) }
            try await session.deleteContent(path)
            #expect(try await !session.contentEntries(kind).contains { $0.path == path })
        }
        await session.close()
    }

    @Test("External writes refuse a stale save and the structure recovers the draft")
    func conflict() async throws {
        let studio = try TemporaryStudio()
        defer { studio.remove() }
        let session = try await open(studio)
        let path = "adv/characters/ye-qing.character.md"
        let original = try await session.contentDocument(.character, path: path)
        let local = try await session.stageContent(.character, path: path, document: original, changes: ["name": .string("Local")])
        let external = original.source + "\n## 外部修订\n\n外部内容\n"
        let url = try session.fileURL(path)
        // Simulates a writer the watcher has not reloaded yet.
        try Data(external.utf8).write(to: url, options: .atomic)
        await #expect(throws: ContentAuthoringError.sourceChanged) { try await session.saveContent(path) }
        #expect(try String(contentsOf: url, encoding: .utf8) == external)
        await session.close()
        await session.open()
        #expect(try await session.contentDocument(.character, path: path).source == local)
        let conflict = try #require(session.conflicts.first { $0.path == path })
        try await session.resolveContent(conflict, with: .keepTheirs)
        #expect(session.text(at: path) == external)
        await session.close()
    }

    @Test("Source and form edits share one draft")
    func sourceAndFormDraft() async throws {
        let studio = try TemporaryStudio()
        defer { studio.remove() }
        let session = try await open(studio)
        let path = "adv/characters/ye-qing.character.md"
        let original = try await session.contentDocument(.character, path: path)
        let body = "\n## 手记\n\n源码草稿 💡\n"
        let raw = original.source + body
        session.stageDraft(raw, for: path, basedOn: original.savedSource)

        let document = try await session.contentDocument(.character, path: path)
        #expect(document.source == raw)
        let revised = try await session.stageContent(.character, path: path, document: document,
                                                     changes: ["name": .string("新的名字")])
        #expect(revised.hasSuffix(body))
        #expect(session.text(at: path) == revised)
        #expect(session.snapshot?.files[path] == original.savedSource)
        try await session.saveContent(path)
        let saved = try await session.contentDocument(.character, path: path)
        #expect(saved.source == revised)
        #expect(saved.data["name"] == .string("新的名字"))
        #expect(!session.hasDraft(path))
        await session.close()
    }

    @Test("Batch preview is read-only and reports invalid rows and ID conflicts")
    func batch() async throws {
        let studio = try TemporaryStudio()
        defer { studio.remove() }
        let session = try await open(studio)
        let csv = "id,name,personality\nye-qing,晴,\n, ,\nnew-person,新人,\"安静, 温和\"\n"
        let skipped = try await session.planContentImport(.character, text: csv, format: "csv", strategy: .skip)
        #expect(skipped.map(\.status) == [.skipped, .invalid, .created])
        let renamed = try await session.planContentImport(.character, text: csv, format: "csv", strategy: .rename)
        #expect(renamed.map(\.status) == [.renamed, .invalid, .created])
        #expect(!(session.snapshot?.paths.contains("adv/characters/ye-qing-2.character.md") ?? true))
        #expect(await session.applyContentImport(renamed).map(\.status) == [.renamed, .invalid, .created])
        let json = #"[{"id":"room","name":"Room"},{"id":"room","name":"Room two"},null]"#
        let scenes = try await session.planContentImport(.scene, text: json, format: "json", strategy: .overwrite)
        #expect(await session.applyContentImport(scenes).map(\.status) == [.created, .overwritten, .invalid])
        let scene = try await session.contentDocument(.scene, path: "adv/scenes/room.md")
        #expect(scene.data["name"] == .string("Room two"))
        let exports = try await session.characterCSVs()
        #expect(exports.characters.contains("new-person,新人"))
        #expect(exports.relationships.hasPrefix("sourceId,sourceName,targetId,type,description"))
        await session.close()
    }
}
