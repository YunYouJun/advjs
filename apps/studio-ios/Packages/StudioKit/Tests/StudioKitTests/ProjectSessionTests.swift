import Foundation
import StudioKit
import Testing

@MainActor
@Suite("Project session", .serialized)
struct ProjectSessionTests {
    private func openSession(_ studio: TemporaryStudio, template: String = "visual-novel-starter") async throws -> (ProjectSession, URL) {
        let store = ProjectStore(directories: studio.directories, engine: EngineBridge())
        let record = try await store.create(name: "Session", templateID: template)
        _ = try await store.refresh()
        let session = ProjectSession(id: record.id, name: record.name, store: store, directories: studio.directories)
        await session.open()
        return (session, studio.directories.projects.appending(path: "Session", directoryHint: .isDirectory))
    }

    private func waitUntil(_ condition: @MainActor () -> Bool, timeout: Duration = .seconds(10)) async {
        let clock = ContinuousClock()
        let deadline = clock.now + timeout
        while !condition(), clock.now < deadline {
            try? await Task.sleep(for: .milliseconds(50))
        }
    }

    @Test("Opens with the engine's index and validation")
    func opens() async throws {
        let studio = try TemporaryStudio()
        defer { studio.remove() }
        let (session, _) = try await openSession(studio, template: "quick-start")
        #expect(session.state == .ready)
        let index = try #require(session.index)
        #expect(!index.chapters.isEmpty)
        #expect(!index.characters.isEmpty)
        #expect(session.validation != nil)
        await session.close()
        #expect(session.state == .closed)
    }

    @Test("A project that no longer exists is gone, not failed")
    func missingProject() async throws {
        let studio = try TemporaryStudio()
        defer { studio.remove() }
        let store = ProjectStore(directories: studio.directories, engine: EngineBridge())
        _ = try await store.refresh()
        let session = ProjectSession(id: UUID(), name: "Missing", store: store, directories: studio.directories)
        await session.open()
        #expect(session.state == .gone)
    }

    @Test("Reloads after another process changes a file")
    func externalChange() async throws {
        let studio = try TemporaryStudio()
        defer { studio.remove() }
        let (session, folder) = try await openSession(studio)
        let path = "adv/chapters/extra.adv.md"
        // A coordinated write without the session's presenter, as the Files App would do.
        try CoordinatedFiles.write(Data("@旁白\n外部写入。\n".utf8), to: folder.appending(path: path))
        await waitUntil { session.snapshot?.files[path] != nil }
        #expect(session.snapshot?.files[path] == "@旁白\n外部写入。\n")
        #expect(session.externalReloads >= 1)
        await session.close()
    }

    @Test("Notices uncoordinated changes when asked to check the disk")
    func uncoordinatedChange() async throws {
        let studio = try TemporaryStudio()
        defer { studio.remove() }
        let (session, folder) = try await openSession(studio)
        let path = "adv/direct.md"
        // A direct write: no file coordination, so no presenter callback.
        try Data("written directly".utf8).write(to: folder.appending(path: path))
        try await Task.sleep(for: .milliseconds(600))
        #expect(session.snapshot?.files[path] == nil)
        await session.refreshIfChangedOnDisk()
        #expect(session.snapshot?.files[path] == "written directly")
        let reloads = session.externalReloads
        await session.refreshIfChangedOnDisk()
        #expect(session.externalReloads == reloads)
        await session.close()
    }

    @Test("Saves atomically without reporting its own writes as external")
    func ownWrites() async throws {
        let studio = try TemporaryStudio()
        defer { studio.remove() }
        let (session, folder) = try await openSession(studio)
        try await session.createFile("adv/notes.md", contents: "first")
        try await session.save("second", to: "adv/notes.md")
        #expect(try String(contentsOf: folder.appending(path: "adv/notes.md"), encoding: .utf8) == "second")
        try await Task.sleep(for: .seconds(1))
        #expect(session.externalReloads == 0)
        let copy = try await session.duplicateFile("adv/notes.md")
        #expect(copy == "adv/notes copy.md")
        try await session.renameFile(copy, to: "adv/archive.md")
        try await session.deleteFile("adv/archive.md")
        #expect(session.snapshot?.files["adv/archive.md"] == nil)
        await #expect(throws: ProjectLibraryError.invalidName) {
            try await session.createFile("../outside.md")
        }
        await session.close()
    }

    @Test("Treats file names that differ only in case as the same name, on any volume")
    func caseInsensitiveNames() async throws {
        let studio = try TemporaryStudio()
        defer { studio.remove() }
        let (session, _) = try await openSession(studio)
        try await session.createFile("adv/notes.md", contents: "first")
        await #expect(throws: ProjectLibraryError.nameTaken("Notes.md")) {
            try await session.createFile("adv/Notes.md")
        }
        try await session.createFile("adv/other.md")
        await #expect(throws: ProjectLibraryError.nameTaken("NOTES.md")) {
            try await session.renameFile("adv/other.md", to: "adv/NOTES.md")
        }
        // Changing only the letter case of a file's own name is a rename, not a clash.
        try await session.renameFile("adv/notes.md", to: "adv/Notes.md")
        #expect(session.snapshot?.files["adv/Notes.md"] == "first")
        #expect(session.snapshot?.files["adv/notes.md"] == nil)
        await session.close()
    }

    @Test("Keeps drafts and offers both versions when the file changes underneath")
    func draftConflict() async throws {
        let studio = try TemporaryStudio()
        defer { studio.remove() }
        let (session, folder) = try await openSession(studio)
        let path = "adv/world.md"
        let original = try #require(session.snapshot?.files[path])

        session.updateDraft("\(original)\n我的修改", for: path)
        #expect(session.hasDraft(path))
        #expect(session.conflicts.isEmpty)

        try CoordinatedFiles.write(Data("他人的修改\n".utf8), to: folder.appending(path: path))
        await waitUntil { !session.conflicts.isEmpty }
        let conflict = try #require(session.conflicts.first)
        #expect(conflict.mine == "\(original)\n我的修改")
        #expect(conflict.theirs == "他人的修改\n")
        // The draft is still what the author sees.
        #expect(session.text(at: path) == "\(original)\n我的修改")

        try await session.resolve(conflict, with: .keepBoth)
        #expect(session.conflicts.isEmpty)
        #expect(!session.hasDraft(path))
        #expect(try String(contentsOf: folder.appending(path: path), encoding: .utf8) == "他人的修改\n")
        #expect(try String(contentsOf: folder.appending(path: "adv/world (mine).md"), encoding: .utf8) == "\(original)\n我的修改")
        await session.close()
    }

    @Test("Writes the game description through the shared patch rules")
    func gameDescription() async throws {
        let studio = try TemporaryStudio()
        defer { studio.remove() }
        let (session, folder) = try await openSession(studio)
        try await session.setGameDescription("一个关于星星的故事")
        let data = try Data(contentsOf: folder.appending(path: "adv/settings/game.json"))
        let object = try #require(try JSONSerialization.jsonObject(with: data) as? [String: Any])
        #expect(object["description"] as? String == "一个关于星星的故事")
        await session.close()
    }
}
