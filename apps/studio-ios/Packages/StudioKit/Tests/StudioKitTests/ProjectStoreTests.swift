import Foundation
import StudioKit
import Testing
import ZIPFoundation

/// A throwaway root with its own Documents, support and staging folders.
struct TemporaryStudio {
    let root: URL
    let directories: StudioDirectories

    init() throws {
        root = FileManager.default.temporaryDirectory.appending(path: "studiokit-\(UUID().uuidString)", directoryHint: .isDirectory)
        directories = StudioDirectories(root: root)
        try directories.prepare()
    }

    func remove() {
        try? FileManager.default.removeItem(at: root)
    }

    func write(_ text: String, to path: String, in folder: URL) throws {
        let url = folder.appending(path: path)
        try FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
        try Data(text.utf8).write(to: url)
    }
}

@Suite("Project store", .serialized)
struct ProjectStoreTests {
    @Test("Creates a project from a shared template, visible in Documents")
    func createFromTemplate() async throws {
        let studio = try TemporaryStudio()
        defer { studio.remove() }
        let store = ProjectStore(directories: studio.directories, engine: EngineBridge())

        let record = try await store.create(name: "星海 Story", templateID: "school-romance")
        #expect(record.name == "星海 Story")
        let folder = studio.directories.projects.appending(path: "星海 Story")
        #expect(ProjectSnapshot.isProject(at: folder))
        let readme = try String(contentsOf: folder.appending(path: "README.md"), encoding: .utf8)
        #expect(readme.hasPrefix("# 星海 Story"))

        let second = try await store.create(name: "星海 Story", templateID: "school-romance")
        #expect(second.name == "星海 Story 2")
        let list = try await store.refresh()
        #expect(Set(list.map(\.name)) == ["星海 Story", "星海 Story 2"])
        // Nothing is left in staging after a successful install.
        let staged = try FileManager.default.contentsOfDirectory(atPath: studio.directories.staging.path(percentEncoded: false))
        #expect(staged.filter { $0 != "Exports" }.isEmpty)
    }

    @Test("Rediscovers projects added through the Files App and forgets removed ones")
    func rediscovery() async throws {
        let studio = try TemporaryStudio()
        defer { studio.remove() }
        let store = ProjectStore(directories: studio.directories, engine: EngineBridge())
        try studio.write("{}", to: "adv.config.json", in: studio.directories.projects.appending(path: "From Files"))
        try FileManager.default.createDirectory(at: studio.directories.projects.appending(path: "Not a project"), withIntermediateDirectories: true)

        #expect(try await store.refresh().map(\.name) == ["From Files"])
        try FileManager.default.removeItem(at: studio.directories.projects.appending(path: "From Files"))
        #expect(try await store.refresh().isEmpty)
    }

    @Test("Renames folders, including a change of letter case only")
    func rename() async throws {
        let studio = try TemporaryStudio()
        defer { studio.remove() }
        let store = ProjectStore(directories: studio.directories, engine: EngineBridge())
        let record = try await store.create(name: "draft", templateID: "visual-novel-starter")
        _ = try await store.create(name: "Other", templateID: "visual-novel-starter")

        #expect(try await store.rename(record.id, to: "Draft").name == "Draft")
        #expect(try await store.rename(record.id, to: "  Final: Cut  ").name == "Final Cut")
        await #expect(throws: ProjectLibraryError.nameTaken("other")) {
            _ = try await store.rename(record.id, to: "other")
        }
        await #expect(throws: ProjectLibraryError.invalidName) {
            _ = try await store.rename(record.id, to: " / ")
        }
        #expect(FileManager.default.fileExists(atPath: studio.directories.projects.appending(path: "Final Cut/adv").path(percentEncoded: false)))
    }

    @Test("Deletes to Recently Deleted, restores, and purges after 30 days")
    func recentlyDeleted() async throws {
        let studio = try TemporaryStudio()
        defer { studio.remove() }
        let store = ProjectStore(directories: studio.directories, engine: EngineBridge())
        let record = try await store.create(name: "Keep Me", templateID: "visual-novel-starter")

        let deleted = try await store.delete(record.id)
        #expect(try await store.refresh().isEmpty)
        #expect(try await store.recentlyDeleted().map(\.id) == [record.id])

        // A new project took the name meanwhile; the restored one is numbered.
        _ = try await store.create(name: "Keep Me", templateID: "visual-novel-starter")
        let restored = try await store.restore(deleted.id)
        #expect(restored.id == record.id)
        #expect(restored.name == "Keep Me 2")
        #expect(try await store.recentlyDeleted().isEmpty)

        _ = try await store.delete(record.id, now: .now.addingTimeInterval(-31 * 24 * 60 * 60))
        _ = try await store.refresh()
        #expect(try await store.recentlyDeleted().isEmpty)
    }

    @Test("Exported packages import back with identical files")
    func exportImportRoundTrip() async throws {
        let studio = try TemporaryStudio()
        defer { studio.remove() }
        let store = ProjectStore(directories: studio.directories, engine: EngineBridge())
        let record = try await store.create(name: "Round Trip", templateID: "mystery-detective")
        let folder = studio.directories.projects.appending(path: "Round Trip")
        try Data([0x89, 0x50, 0x4E, 0x47, 0x00, 0xFF]).write(to: folder.appending(path: "adv/assets/cover.png").creatingParent())
        try studio.write("private", to: "notes/todo.md", in: folder)

        let package = try await store.exportPackage(record.id)
        #expect(package.lastPathComponent == "Round Trip.advpkg.zip")
        let archive = try Archive(url: package, accessMode: .read)
        let paths = Set(archive.map(\.path))
        #expect(paths.contains("manifest.json"))
        #expect(paths.contains("adv/assets/cover.png"))
        #expect(!paths.contains("notes/todo.md"))

        let imported = try await store.importPackage(at: package)
        #expect(imported.name == "Round Trip 2")
        let original = try ProjectSnapshot.read(at: folder)
        let copy = try ProjectSnapshot.read(at: studio.directories.projects.appending(path: "Round Trip 2"))
        #expect(copy.files == original.files.filter { $0.key.hasPrefix("adv/") })
        #expect(try Data(contentsOf: studio.directories.projects.appending(path: "Round Trip 2/adv/assets/cover.png")) == Data([0x89, 0x50, 0x4E, 0x47, 0x00, 0xFF]))
    }

    @Test("Imports Web Studio packages and refuses unsafe ones")
    func webPackages() async throws {
        let studio = try TemporaryStudio()
        defer { studio.remove() }
        let store = ProjectStore(directories: studio.directories, engine: EngineBridge())
        let manifest = #"{"name":"来自 Web","version":"1.0.0","exportedAt":"2026-10-21T00:00:00.000Z","stats":{}}"#

        let web = studio.root.appending(path: "web.advpkg.zip")
        try makeArchive(at: web, entries: ["manifest.json": manifest, "adv/chapters/one.adv.md": "@小云\n你好。\n"])
        let record = try await store.importPackage(at: web)
        #expect(record.name == "来自 Web")

        let unsafe = studio.root.appending(path: "unsafe.advpkg.zip")
        try makeArchive(at: unsafe, entries: ["manifest.json": manifest, "../escape.md": "x", "adv/one.md": "y"])
        await #expect(throws: ProjectLibraryError.unsafePackage(["../escape.md"])) {
            _ = try await store.importPackage(at: unsafe)
        }

        let noManifest = studio.root.appending(path: "plain.zip")
        try makeArchive(at: noManifest, entries: ["adv/one.md": "y"])
        await #expect(throws: ProjectLibraryError.invalidPackage("Invalid .advpkg: no manifest.json found")) {
            _ = try await store.importPackage(at: noManifest)
        }
        #expect(try await store.refresh().map(\.name) == ["来自 Web"])
    }

    @Test("Opens folders in place without copying them")
    func openInPlace() async throws {
        let studio = try TemporaryStudio()
        defer { studio.remove() }
        let store = ProjectStore(directories: studio.directories, engine: EngineBridge())
        let external = studio.root.appending(path: "iCloud/Shared Story", directoryHint: .isDirectory)
        try studio.write("@小云\n你好。\n", to: "adv/chapters/one.adv.md", in: external)

        let record = try await store.openInPlace(at: external)
        #expect(record.isExternal)
        #expect(try await store.openInPlace(at: external).id == record.id)
        let access = try await store.resolve(record.id)
        #expect(access.url.standardizedFileURL == external.standardizedFileURL)
        access.stopAccessing()
        await #expect(throws: ProjectLibraryError.renameUnsupportedForExternal) {
            _ = try await store.rename(record.id, to: "Renamed")
        }
        // Forgetting a project opened in place never touches its files.
        _ = try await store.delete(record.id)
        #expect(FileManager.default.fileExists(atPath: external.appending(path: "adv/chapters/one.adv.md").path(percentEncoded: false)))
        await #expect(throws: ProjectLibraryError.notAProject) {
            _ = try await store.openInPlace(at: studio.root.appending(path: "iCloud"))
        }
    }

    private func makeArchive(at url: URL, entries: [String: String]) throws {
        let archive = try Archive(url: url, accessMode: .create)
        for (path, text) in entries.sorted(by: { $0.key < $1.key }) {
            let data = Data(text.utf8)
            try archive.addEntry(with: path, type: .file, uncompressedSize: Int64(data.count)) { position, size in
                data.subdata(in: Int(position)..<Int(position) + size)
            }
        }
    }
}

extension URL {
    func creatingParent() throws -> URL {
        try FileManager.default.createDirectory(at: deletingLastPathComponent(), withIntermediateDirectories: true)
        return self
    }
}
