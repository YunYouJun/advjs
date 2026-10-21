import CryptoKit
import Foundation
import ZIPFoundation

/// File-system side of the project list. Runs off the main thread; the
/// observable ``ProjectLibrary`` is its UI-facing wrapper.
///
/// New projects and imports are assembled in staging and moved into
/// Documents in one step, so a failure never leaves half a project behind.
/// Deleting moves a project into Recently Deleted, from which it can be
/// restored for 30 days.
public actor ProjectStore {
    public static let retention: TimeInterval = 30 * 24 * 60 * 60

    public let directories: StudioDirectories
    private let engine: EngineBridge
    private let fileManager = FileManager.default
    private var records: [ProjectRecord] = []
    private var loaded = false

    public init(directories: StudioDirectories, engine: EngineBridge) {
        self.directories = directories
        self.engine = engine
    }

    // MARK: - Listing

    /// Load the list, rediscovering projects in Documents and dropping local
    /// entries whose folder disappeared. Also purges expired Recently Deleted items.
    public func refresh(now: Date = .now) throws -> [ProjectSummary] {
        try directories.prepare()
        if !loaded {
            records = (try? JSONDecoder().decode([ProjectRecord].self, from: Data(contentsOf: directories.libraryIndex))) ?? []
            loaded = true
        }
        let folders = try localProjectFolders()
        let known = Set(records.compactMap { record -> String? in
            if case .local(let folder) = record.storage { return folder.lowercased() }
            return nil
        })
        records.removeAll { record in
            if case .local(let folder) = record.storage {
                return !folders.contains { $0.lowercased() == folder.lowercased() }
            }
            return false
        }
        for folder in folders where !known.contains(folder.lowercased()) {
            let created = (try? directories.projects.appending(path: folder).resourceValues(forKeys: [.creationDateKey]).creationDate) ?? now
            records.append(ProjectRecord(storage: .local(folder: folder), createdAt: created))
        }
        try save()
        try purgeExpired(now: now)
        return records.map(summary).sorted(by: Self.listOrder)
    }

    public func record(_ id: UUID) throws -> ProjectRecord {
        guard let record = records.first(where: { $0.id == id }) else { throw ProjectLibraryError.notFound }
        return record
    }

    /// Resolve a record's folder. Callers must call `stopAccessing` on the
    /// returned access when done with an external folder.
    public func resolve(_ id: UUID) throws -> ProjectFolderAccess {
        let record = try record(id)
        switch record.storage {
        case .local(let folder):
            let url = directories.projects.appending(path: folder, directoryHint: .isDirectory)
            guard fileManager.fileExists(atPath: url.path(percentEncoded: false)) else { throw ProjectLibraryError.notFound }
            return ProjectFolderAccess(url: url, isSecurityScoped: false)
        case .external(let bookmark, _):
            var stale = false
            guard let url = try? URL(resolvingBookmarkData: bookmark, options: [], relativeTo: nil, bookmarkDataIsStale: &stale) else {
                throw ProjectLibraryError.unavailable
            }
            let scoped = url.startAccessingSecurityScopedResource()
            if stale, let refreshed = try? url.bookmarkData(options: [], includingResourceValuesForKeys: nil, relativeTo: nil) {
                update(id) { $0.storage = .external(bookmark: refreshed, name: url.lastPathComponent) }
            }
            return ProjectFolderAccess(url: url, isSecurityScoped: scoped)
        }
    }

    public func markOpened(_ id: UUID, at date: Date = .now) throws {
        update(id) { $0.lastOpenedAt = date }
        try save()
    }

    // MARK: - Creating

    /// Create a project from a shared template (`project.fromTemplate`).
    public func create(name: String, templateID: String) async throws -> ProjectRecord {
        let displayName = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !displayName.isEmpty else { throw ProjectLibraryError.invalidName }
        try await engine.start()
        let template = try await engine.call(
            "project.fromTemplate",
            input: EngineTemplateInput(templateId: templateID, name: displayName),
            as: EngineTemplateFiles.self
        )
        return try install(named: displayName) { folder in
            for (path, content) in template.files {
                let url = folder.appending(path: path)
                try fileManager.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
                try Data(content.utf8).write(to: url)
            }
        }
    }

    // MARK: - Renaming and deleting

    public func rename(_ id: UUID, to newName: String) throws -> ProjectRecord {
        let record = try record(id)
        guard case .local(let folder) = record.storage else { throw ProjectLibraryError.renameUnsupportedForExternal }
        let sanitized = ProjectFolderName.sanitize(newName, fallback: "")
        guard !sanitized.isEmpty else { throw ProjectLibraryError.invalidName }
        if sanitized == folder {
            return record
        }
        // Allow changing only the letter case of the same folder.
        if sanitized.lowercased() != folder.lowercased(),
           fileManager.fileExists(atPath: directories.projects.appending(path: sanitized).path(percentEncoded: false)) {
            throw ProjectLibraryError.nameTaken(sanitized)
        }
        let source = directories.projects.appending(path: folder, directoryHint: .isDirectory)
        let destination = directories.projects.appending(path: sanitized, directoryHint: .isDirectory)
        if sanitized.lowercased() == folder.lowercased() {
            // A case-only rename on a case-insensitive volume needs an intermediate name.
            let intermediate = directories.projects.appending(path: ".rename-\(UUID().uuidString)", directoryHint: .isDirectory)
            try CoordinatedFiles.move(source, to: intermediate)
            try CoordinatedFiles.move(intermediate, to: destination)
        }
        else {
            try CoordinatedFiles.move(source, to: destination)
        }
        update(id) { $0.storage = .local(folder: sanitized) }
        try save()
        return try self.record(id)
    }

    /// Move a local project to Recently Deleted, or forget a project opened in place.
    public func delete(_ id: UUID, now: Date = .now) throws -> DeletedProject {
        let record = try record(id)
        var trashFolder: String?
        if case .local(let folder) = record.storage {
            let container = directories.recentlyDeleted.appending(path: record.id.uuidString, directoryHint: .isDirectory)
            try fileManager.createDirectory(at: container, withIntermediateDirectories: true)
            try CoordinatedFiles.move(
                directories.projects.appending(path: folder, directoryHint: .isDirectory),
                to: container.appending(path: folder, directoryHint: .isDirectory)
            )
            trashFolder = folder
        }
        let deleted = DeletedProject(id: record.id, record: record, deletedAt: now, trashFolder: trashFolder)
        try writeDeleted(deleted)
        records.removeAll { $0.id == id }
        try save()
        return deleted
    }

    public func recentlyDeleted() throws -> [DeletedProject] {
        try directories.prepare()
        let items = try fileManager.contentsOfDirectory(at: directories.recentlyDeleted, includingPropertiesForKeys: nil)
        return items
            .filter { $0.pathExtension == "json" }
            .compactMap { try? JSONDecoder().decode(DeletedProject.self, from: Data(contentsOf: $0)) }
            .sorted { $0.deletedAt > $1.deletedAt }
    }

    /// Put a deleted project back; a clashing name gets a number appended.
    public func restore(_ id: UUID) throws -> ProjectRecord {
        guard let deleted = try recentlyDeleted().first(where: { $0.id == id }) else { throw ProjectLibraryError.notFound }
        var record = deleted.record
        if let trashFolder = deleted.trashFolder {
            let folder = ProjectFolderName.unique(trashFolder, in: directories.projects)
            try CoordinatedFiles.move(
                directories.recentlyDeleted.appending(path: id.uuidString).appending(path: trashFolder, directoryHint: .isDirectory),
                to: directories.projects.appending(path: folder, directoryHint: .isDirectory)
            )
            record.storage = .local(folder: folder)
        }
        try removeDeleted(id)
        records.removeAll { $0.id == id }
        records.append(record)
        try save()
        return record
    }

    public func deletePermanently(_ id: UUID) throws {
        try removeDeleted(id)
    }

    // MARK: - Importing and opening in place

    /// Import a `.advpkg.zip` exported by Web Studio or this App. `name`
    /// overrides the manifest name, as when installing a bundled sample.
    public func importPackage(at url: URL, name: String? = nil) async throws -> ProjectRecord {
        let scoped = url.startAccessingSecurityScopedResource()
        defer { if scoped { url.stopAccessingSecurityScopedResource() } }

        let local = directories.staging.appending(path: "import-\(UUID().uuidString).zip")
        try fileManager.createDirectory(at: directories.staging, withIntermediateDirectories: true)
        defer { try? fileManager.removeItem(at: local) }
        try CoordinatedFiles.copy(url, to: local)

        let (paths, manifestText) = try Self.readPackageListing(local)
        try await engine.start()
        let inspection: EnginePackageInspection
        do {
            inspection = try await engine.call(
                "package.inspect",
                input: EnginePackageInspectInput(manifest: manifestText, paths: paths),
                as: EnginePackageInspection.self
            )
        }
        catch let EngineError.engine(failure) {
            throw ProjectLibraryError.invalidPackage(failure.message)
        }
        guard inspection.unsafePaths.isEmpty else { throw ProjectLibraryError.unsafePackage(inspection.unsafePaths) }

        return try install(named: name ?? inspection.manifest.name) { folder in
            let archive = try Archive(url: local, accessMode: .read)
            for entry in archive where entry.type == .file && entry.path != "manifest.json" {
                let destination = folder.appending(path: entry.path)
                try fileManager.createDirectory(at: destination.deletingLastPathComponent(), withIntermediateDirectories: true)
                _ = try archive.extract(entry, to: destination)
            }
        }
    }

    /// Copy a project folder into Documents.
    public func importFolder(at url: URL) throws -> ProjectRecord {
        let scoped = url.startAccessingSecurityScopedResource()
        defer { if scoped { url.stopAccessingSecurityScopedResource() } }
        guard ProjectSnapshot.isProject(at: url) else { throw ProjectLibraryError.notAProject }
        return try install(named: url.lastPathComponent) { folder in
            try fileManager.removeItem(at: folder)
            try CoordinatedFiles.copy(url, to: folder)
        }
    }

    /// Keep a folder where it is (iCloud Drive or another provider) and edit it in place.
    public func openInPlace(at url: URL) throws -> ProjectRecord {
        let scoped = url.startAccessingSecurityScopedResource()
        defer { if scoped { url.stopAccessingSecurityScopedResource() } }
        guard ProjectSnapshot.isProject(at: url) else { throw ProjectLibraryError.notAProject }
        let path = url.standardizedFileURL.path(percentEncoded: false)
        for record in records {
            if case .external(let bookmark, _) = record.storage {
                var stale = false
                if let existing = try? URL(resolvingBookmarkData: bookmark, options: [], relativeTo: nil, bookmarkDataIsStale: &stale),
                   existing.standardizedFileURL.path(percentEncoded: false) == path {
                    return record
                }
            }
        }
        let bookmark = try url.bookmarkData(options: [], includingResourceValuesForKeys: nil, relativeTo: nil)
        let record = ProjectRecord(storage: .external(bookmark: bookmark, name: url.lastPathComponent))
        records.append(record)
        try save()
        return record
    }

    // MARK: - Exporting

    /// Write a `.advpkg.zip` with the layout Web Studio uses and return its URL.
    public func exportPackage(_ id: UUID, now: Date = .now) async throws -> URL {
        let access = try resolve(id)
        defer { access.stopAccessing() }
        let snapshot = try ProjectSnapshot.read(at: access.url)
        let name = try record(id).name
        try await engine.start()
        let plan = try await engine.call(
            "package.plan",
            input: EnginePackagePlanInput(files: snapshot.files, paths: snapshot.paths, name: name, exportedAt: now.formatted(Date.ISO8601FormatStyle(includingFractionalSeconds: true))),
            as: EnginePackagePlan.self
        )

        let directory = directories.exports.appending(path: UUID().uuidString, directoryHint: .isDirectory)
        try fileManager.createDirectory(at: directory, withIntermediateDirectories: true)
        let output = directory.appending(path: "\(name)\(Self.packageExtension)")
        let archive = try Archive(url: output, accessMode: .create)
        for entry in plan.entries {
            let data: Data
            if let text = snapshot.files[entry.path] {
                data = Data(text.utf8)
            }
            else {
                let url = access.url.appending(path: entry.path)
                guard fileManager.fileExists(atPath: url.path(percentEncoded: false)) else { throw ProjectLibraryError.missingMedia(entry.path) }
                data = try CoordinatedFiles.read(url)
            }
            if let sha256 = entry.sha256, Self.sha256(data) != sha256 || (entry.bytes != nil && entry.bytes != data.count) {
                throw ProjectLibraryError.mediaMismatch(entry.path)
            }
            try Self.addEntry(entry.path, data: data, to: archive)
        }
        try Self.addEntry("manifest.json", data: Data(plan.manifestText.utf8), to: archive)
        return output
    }

    public static let packageExtension = ".advpkg.zip"

    /// File entries (except the manifest) and the manifest text of a package.
    private static func readPackageListing(_ url: URL) throws -> ([String], String?) {
        let archive: Archive
        do {
            archive = try Archive(url: url, accessMode: .read)
        }
        catch {
            throw ProjectLibraryError.invalidPackage("not a ZIP archive")
        }
        var manifestText: String?
        if let manifest = archive["manifest.json"] {
            var data = Data()
            _ = try archive.extract(manifest) { data.append($0) }
            manifestText = String(data: data, encoding: .utf8)
        }
        let paths = archive.filter { $0.type == .file && $0.path != "manifest.json" }.map(\.path)
        return (paths, manifestText)
    }

    private static func addEntry(_ path: String, data: Data, to archive: Archive) throws {
        try archive.addEntry(with: path, type: .file, uncompressedSize: Int64(data.count), compressionMethod: .deflate) { position, size in
            let start = Int(position)
            return data.subdata(in: start..<min(start + size, data.count))
        }
    }

    // MARK: - Private

    private func install(named name: String, populate: (URL) throws -> Void) throws -> ProjectRecord {
        try directories.prepare()
        let staging = directories.staging.appending(path: UUID().uuidString, directoryHint: .isDirectory)
        let stagedFolder = staging.appending(path: "project", directoryHint: .isDirectory)
        try fileManager.createDirectory(at: stagedFolder, withIntermediateDirectories: true)
        defer { try? fileManager.removeItem(at: staging) }
        try populate(stagedFolder)
        let folder = ProjectFolderName.unique(ProjectFolderName.sanitize(name), in: directories.projects)
        try CoordinatedFiles.move(stagedFolder, to: directories.projects.appending(path: folder, directoryHint: .isDirectory))
        let record = ProjectRecord(storage: .local(folder: folder))
        records.append(record)
        try save()
        return record
    }

    private func localProjectFolders() throws -> [String] {
        let items = try fileManager.contentsOfDirectory(
            at: directories.projects,
            includingPropertiesForKeys: [.isDirectoryKey],
            options: [.skipsHiddenFiles]
        )
        return items.compactMap { url in
            guard (try? url.resourceValues(forKeys: [.isDirectoryKey]).isDirectory) == true,
                  ProjectSnapshot.isProject(at: url) else { return nil }
            return url.lastPathComponent
        }
    }

    private func summary(_ record: ProjectRecord) -> ProjectSummary {
        var availability = ProjectSummary.Availability.available
        var modified: Date?
        var description: String?
        if let access = try? resolve(record.id) {
            defer { access.stopAccessing() }
            modified = Self.latestModification(in: access.url, fileManager: fileManager)
            description = Self.gameDescription(in: access.url)
        }
        else {
            availability = .missing
        }
        let current = records.first { $0.id == record.id } ?? record
        return ProjectSummary(
            id: current.id,
            name: current.name,
            isExternal: current.isExternal,
            availability: availability,
            modifiedAt: modified,
            lastOpenedAt: current.lastOpenedAt,
            createdAt: current.createdAt,
            summary: description
        )
    }

    private static func listOrder(_ left: ProjectSummary, _ right: ProjectSummary) -> Bool {
        let leftDate = left.lastOpenedAt ?? left.modifiedAt ?? left.createdAt
        let rightDate = right.lastOpenedAt ?? right.modifiedAt ?? right.createdAt
        if leftDate != rightDate {
            return leftDate > rightDate
        }
        return left.name.localizedStandardCompare(right.name) == .orderedAscending
    }

    /// Newest modification among the project's content, without reading files.
    static func latestModification(in root: URL, fileManager: FileManager) -> Date? {
        let adv = root.appending(path: "adv", directoryHint: .isDirectory)
        guard let enumerator = fileManager.enumerator(at: adv, includingPropertiesForKeys: [.contentModificationDateKey], options: [.skipsHiddenFiles]) else {
            return nil
        }
        var latest: Date?
        for case let url as URL in enumerator {
            if let date = try? url.resourceValues(forKeys: [.contentModificationDateKey]).contentModificationDate, date > (latest ?? .distantPast) {
                latest = date
            }
        }
        return latest
    }

    static func gameDescription(in root: URL) -> String? {
        guard let data = try? Data(contentsOf: root.appending(path: "adv/settings/game.json")),
              let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let description = object["description"] as? String,
              !description.isEmpty else { return nil }
        return description
    }

    static func sha256(_ data: Data) -> String {
        SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined()
    }

    private func update(_ id: UUID, _ change: (inout ProjectRecord) -> Void) {
        guard let index = records.firstIndex(where: { $0.id == id }) else { return }
        change(&records[index])
    }

    private func save() throws {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        try encoder.encode(records).write(to: directories.libraryIndex, options: .atomic)
    }

    private func writeDeleted(_ deleted: DeletedProject) throws {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        try encoder.encode(deleted).write(to: directories.recentlyDeleted.appending(path: "\(deleted.id.uuidString).json"), options: .atomic)
    }

    private func removeDeleted(_ id: UUID) throws {
        let container = directories.recentlyDeleted.appending(path: id.uuidString, directoryHint: .isDirectory)
        if fileManager.fileExists(atPath: container.path(percentEncoded: false)) {
            try fileManager.removeItem(at: container)
        }
        let metadata = directories.recentlyDeleted.appending(path: "\(id.uuidString).json")
        if fileManager.fileExists(atPath: metadata.path(percentEncoded: false)) {
            try fileManager.removeItem(at: metadata)
        }
    }

    private func purgeExpired(now: Date) throws {
        for deleted in try recentlyDeleted() where now.timeIntervalSince(deleted.deletedAt) > Self.retention {
            try removeDeleted(deleted.id)
        }
    }
}

/// A resolved project folder. External folders stay accessible until `stopAccessing()`.
public struct ProjectFolderAccess: Sendable {
    public let url: URL
    let isSecurityScoped: Bool

    public func stopAccessing() {
        if isSecurityScoped {
            url.stopAccessingSecurityScopedResource()
        }
    }
}
