import Foundation
@testable import StudioKit
import Testing

@MainActor
@Suite("Project session", .serialized)
struct ProjectSessionTests {
    private func openSession(_ studio: TemporaryStudio, template: String = "visual-novel-starter", readSnapshot: ProjectSession.SnapshotReader? = nil) async throws -> (ProjectSession, URL) {
        let store = ProjectStore(directories: studio.directories, engine: EngineBridge())
        let record = try await store.create(name: "Session", templateID: template)
        _ = try await store.refresh()
        let session = ProjectSession(id: record.id, name: record.name, store: store, directories: studio.directories, readSnapshot: readSnapshot ?? ProjectSession.readSnapshot)
        await session.open()
        return (session, studio.directories.projects.appending(path: "Session", directoryHint: .isDirectory))
    }

    private func waitUntil(_ condition: @MainActor () async -> Bool, timeout: Duration = .seconds(10)) async {
        let clock = ContinuousClock()
        let deadline = clock.now + timeout
        while !(await condition()), clock.now < deadline {
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

    @Test("A delayed notification after saving does not reload the same files as external")
    func delayedOwnWriteNotification() async throws {
        let studio = try TemporaryStudio()
        defer { studio.remove() }
        let (session, folder) = try await openSession(studio)
        try await session.save("saved here", to: "adv/world.md")
        // Deliver a presenter notification after the save's snapshot has committed.
        await session.handle(.changed([folder.appending(path: "adv/world.md")]))?.value
        #expect(session.externalReloads == 0)
        #expect(session.snapshot?.files["adv/world.md"] == "saved here")
        await session.close()
    }

    @Test("A delayed older read cannot erase an external edit or its draft conflict")
    func olderReadCannotEraseConflict() async throws {
        let studio = try TemporaryStudio()
        defer { studio.remove() }
        let reader = PausedSnapshotReader()
        let (session, folder) = try await openSession(studio, readSnapshot: reader.read)
        let path = "adv/world.md"
        let original = try #require(session.snapshot?.files[path])
        session.updateDraft("my draft", for: path)
        let olderReload = PausedSnapshotReader.$pauses.withValue(true) {
            session.handle(.changed([folder.appending(path: path)]))
        }
        do {
            await waitUntil { await reader.isPaused }
            try #require(await reader.isPaused)
            try CoordinatedFiles.write(Data("external edit".utf8), to: folder.appending(path: path))
            await session.handle(.changed([folder.appending(path: path)]))?.value
            await waitUntil { session.conflicts.first?.theirs == "external edit" }
            #expect(session.conflicts.first?.theirs == "external edit")
            await reader.resume()
            await olderReload?.value
            #expect(session.snapshot?.files[path] == "external edit")
            #expect(session.conflicts.first?.mine == "my draft")
            #expect(session.conflicts.first?.theirs == "external edit")
            #expect(session.text(at: path) == "my draft")
            #expect(original != "external edit")
        } catch {
            await reader.resume()
            await olderReload?.value
            await session.close()
            throw error
        }
        await session.close()
    }

    @Test("An explicit reload publishes its snapshot before a later notification can return stale state")
    func explicitReloadCannotBeSuperseded() async throws {
        let studio = try TemporaryStudio()
        defer { studio.remove() }
        let reader = PausedSnapshotReader()
        let (session, folder) = try await openSession(studio, readSnapshot: reader.read)
        let path = "adv/world.md"
        let url = folder.appending(path: path)
        let date = Date(timeIntervalSince1970: 1_700_000_000)
        try Data("read explicitly".utf8).write(to: url)
        try FileManager.default.setAttributes([.modificationDate: date], ofItemAtPath: url.path(percentEncoded: false))
        #expect(try FileManager.default.attributesOfItem(atPath: url.path(percentEncoded: false))[.modificationDate] as? Date == date)
        let requested = PausedSnapshotReader.$pauses.withValue(true) {
            Task { await session.reload() }
        }
        var notification: Task<Void, Never>?
        do {
            await waitUntil { await reader.isPaused }
            try #require(await reader.isPaused)
            notification = PausedSnapshotReader.$slot.withValue(1) {
                PausedSnapshotReader.$pauses.withValue(true) {
                    session.handle(.changed([folder.appending(path: path)]))
                }
            }
            await waitUntil { await reader.isPaused(1) || session.hasWaitingReload }
            let notificationStarted = await reader.isPaused(1) || session.hasWaitingReload
            try #require(notificationStarted)
            await reader.resume()
            await requested.value
            #expect(session.snapshot?.files[path] == "read explicitly")
            #expect(session.snapshot?.modificationDates[path] == date)
            await reader.resume(1)
            await notification?.value
            #expect(session.snapshot?.files[path] == "read explicitly")
            #expect(session.externalReloads == 0)
        } catch {
            await reader.resume()
            await reader.resume(1)
            await requested.value
            await notification?.value
            await session.close()
            throw error
        }
        await session.close()
    }

    @Test("An in-flight notification cannot overwrite a newer save or count it as external")
    func notificationOverlappingSave() async throws {
        let studio = try TemporaryStudio()
        defer { studio.remove() }
        let reader = PausedSnapshotReader()
        let (session, folder) = try await openSession(studio, readSnapshot: reader.read)
        let notification = PausedSnapshotReader.$pauses.withValue(true) {
            session.handle(.changed([folder.appending(path: "adv/world.md")]))
        }
        await waitUntil { await reader.isPaused }
        let paused = await reader.isPaused
        do {
            try await session.save("latest save", to: "adv/world.md")
        } catch {
            await reader.resume()
            await notification?.value
            await session.close()
            throw error
        }
        await reader.resume()
        await notification?.value
        #expect(paused)
        #expect(session.snapshot?.files["adv/world.md"] == "latest save")
        #expect(session.externalReloads == 0)
        await session.close()
    }

    @Test("Changed bytes with an unchanged timestamp produce one conflict despite duplicate notifications")
    func duplicateNotificationsWithPreservedTimestamp() async throws {
        let studio = try TemporaryStudio()
        defer { studio.remove() }
        let (session, folder) = try await openSession(studio)
        let path = "adv/world.md"
        let url = folder.appending(path: path)
        // A whole-second baseline survives file-system timestamp rounding.
        let date = Date(timeIntervalSince1970: 1_700_000_000)
        try FileManager.default.setAttributes([.modificationDate: date], ofItemAtPath: url.path(percentEncoded: false))
        #expect(try FileManager.default.attributesOfItem(atPath: url.path(percentEncoded: false))[.modificationDate] as? Date == date)
        await session.reload()
        #expect(session.snapshot?.modificationDates[path] == date)
        session.updateDraft("my draft", for: path)
        try CoordinatedFiles.write(Data("external edit".utf8), to: url)
        try FileManager.default.setAttributes([.modificationDate: date], ofItemAtPath: url.path(percentEncoded: false))
        #expect(try FileManager.default.attributesOfItem(atPath: url.path(percentEncoded: false))[.modificationDate] as? Date == date)
        #expect(session.snapshot?.isOutdated(at: folder) == false)
        await session.handle(.changed([url]))?.value
        await waitUntil { session.conflicts.first?.theirs == "external edit" }
        #expect(session.conflicts.first?.mine == "my draft")
        #expect(session.conflicts.first?.theirs == "external edit")
        #expect(session.externalReloads == 1)
        // A burst, followed by a late duplicate after the first load finished.
        for _ in 0..<20 { session.handle(.changed([url])) }
        await session.handle(.changed([url]))?.value
        #expect(session.externalReloads == 1)
        #expect(session.conflicts.first?.theirs == "external edit")
        await session.close()
    }

    @Test("Notifications during local changes wait for their snapshot and still preserve external conflicts", arguments: [false, true], [false, true])
    func notificationsDuringLocalReload(deletesFile: Bool, externalEdit: Bool) async throws {
        let studio = try TemporaryStudio()
        defer { studio.remove() }
        let reader = PausedSnapshotReader()
        let (session, folder) = try await openSession(studio, readSnapshot: reader.read)
        try await session.createFile("adv/notes.md", contents: "before")
        session.updateDraft("my world draft", for: "adv/world.md")
        let localChange = PausedSnapshotReader.$pauses.withValue(true) {
            Task {
                if deletesFile { try await session.deleteFile("adv/notes.md") }
                else { try await session.save("saved here", to: "adv/notes.md") }
            }
        }
        await waitUntil { await reader.isPaused }
        var notification: Task<Void, Never>?
        do {
            try #require(await reader.isPaused)
            if externalEdit {
                try CoordinatedFiles.write(Data("external world".utf8), to: folder.appending(path: "adv/world.md"))
            }
            notification = session.handle(.changed([folder.appending(path: externalEdit ? "adv/world.md" : "adv/notes.md")]))
            // Stage the adverse ordering explicitly: the notification has
            // reached reload processing while the local snapshot is held.
            await waitUntil { session.hasWaitingReload || session.externalReloads > 0 }
            #expect(session.hasWaitingReload || session.externalReloads > 0)
            await reader.resume()
            try await localChange.value
            #expect(session.snapshot?.files["adv/notes.md"] == (deletesFile ? nil : "saved here"))
            await notification?.value
            if externalEdit {
                await waitUntil { session.conflicts.first?.theirs == "external world" }
                #expect(session.conflicts.first?.mine == "my world draft")
                #expect(session.conflicts.first?.theirs == "external world")
            } else {
                #expect(session.conflicts.isEmpty)
            }
            #expect(session.externalReloads == (externalEdit ? 1 : 0))
        } catch {
            await reader.resume()
            try? await localChange.value
            await notification?.value
            await session.close()
            throw error
        }
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

    @Test("A read finishing after close cannot reopen or fail the session")
    func readAfterClose() async throws {
        let studio = try TemporaryStudio()
        defer { studio.remove() }
        let reader = PausedSnapshotReader()
        let (session, _) = try await openSession(studio, readSnapshot: reader.read)
        let reload = PausedSnapshotReader.$pauses.withValue(true) {
            Task { await session.reload() }
        }
        await waitUntil { await reader.isPaused }
        let paused = await reader.isPaused
        await session.close()
        await reader.resume()
        await reload.value
        #expect(paused)
        #expect(session.state == .closed)
        #expect(session.snapshot == nil)
        #expect(session.index == nil)
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

/// Captures a real coordinated disk snapshot, then controls when it reaches
/// the session. No file contents, engine calls, or presenter logic are mocked.
private actor PausedSnapshotReader {
    // Scope the gate to the intended operation, so an unrelated real
    // presenter callback cannot accidentally consume the pause.
    @TaskLocal static var pauses = false
    @TaskLocal static var slot = 0
    private var continuations: [Int: CheckedContinuation<Void, Never>] = [:]
    private var released: Set<Int> = []
    var isPaused: Bool { isPaused(0) }

    func isPaused(_ slot: Int) -> Bool { continuations[slot] != nil }

    func read(_ root: URL, presenter: ProjectWatcher?) async throws -> ProjectSnapshot {
        let snapshot = try await ProjectSession.readSnapshot(root, presenter: presenter)
        let slot = Self.slot
        if Self.pauses, !released.contains(slot) {
            await withCheckedContinuation { continuations[slot] = $0 }
        }
        return snapshot
    }

    func resume(_ slot: Int = 0) {
        released.insert(slot)
        continuations.removeValue(forKey: slot)?.resume()
    }
}
