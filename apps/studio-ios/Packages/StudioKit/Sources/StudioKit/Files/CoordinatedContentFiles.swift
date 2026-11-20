import Foundation

extension CoordinatedFiles {
    /// Recheck the bytes after acquiring write coordination. A missing expected
    /// source denotes creation. A missing replacement denotes deletion.
    static func changeContent(
        at url: URL,
        from expected: String?,
        to replacement: String?,
        filePresenter: NSFilePresenter?
    ) throws {
        try changeBytes(at: url, from: expected.map { Data($0.utf8) }, to: replacement.map { Data($0.utf8) }, filePresenter: filePresenter)
    }

    static func changeBytes(
        at url: URL,
        from expected: Data?,
        to replacement: Data?,
        filePresenter: NSFilePresenter?
    ) throws {
        if replacement != nil {
            try FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
        }
        let change = ByteChange(url: url, expected: expected, replacement: replacement)
        try coordinate(filePresenter: filePresenter) { coordinator, error in
            var result: Result<Void, Error> = .failure(CocoaError(.fileWriteUnknown))
            coordinator.coordinate(writingItemAt: url, options: replacement == nil ? .forDeleting : .forReplacing, error: error) { target in
                result = Result {
                    let coordinated = ByteChange(url: target, expected: change.expected, replacement: change.replacement)
                    try verify(coordinated)
                    try apply(coordinated)
                }
            }
            return result
        }
    }

    struct ByteChange {
        let url: URL
        let expected: Data?
        let replacement: Data?
    }

    /// Coordinate the containing project once for the media and all catalog
    /// guards. Publish the catalog only after the immutable master exists.
    static func changeProjectBytes(
        root: URL, textPaths: Set<String>, changes: [ByteChange], filePresenter: NSFilePresenter?,
        prepareMedia: () throws -> [ByteChange]
    ) throws {
        try coordinate(filePresenter: filePresenter) { coordinator, error in
            var result: Result<Void, Error> = .failure(CocoaError(.fileWriteUnknown))
            coordinator.coordinate(writingItemAt: root, options: .forMerging, error: error) { target in
                result = Result {
                    guard target.standardizedFileURL == root.standardizedFileURL else {
                        throw ProjectAudioError.staleProject
                    }
                    let paths = try ProjectSnapshot.enumerate(root: target, fileManager: .default).map { $0.0 }
                    guard Set(paths.filter(ProjectSnapshot.isTextPath(_:))) == textPaths else {
                        throw ProjectAudioError.staleProject
                    }
                    let entries = try prepareMedia() + changes
                    for change in entries { try verify(change) }
                    var applied: [ByteChange] = []
                    do {
                        for change in entries where change.expected != change.replacement {
                            try apply(change)
                            applied.append(change)
                        }
                    }
                    catch {
                        var restored = true
                        for entry in applied.reversed() {
                            let undo = ByteChange(url: entry.url, expected: entry.replacement, replacement: entry.expected)
                            do {
                                try verify(undo)
                                try apply(undo)
                            }
                            catch { restored = false }
                        }
                        guard restored else { throw ProjectAudioError.incompleteRollback }
                        throw error
                    }
                }
            }
            return result
        }
    }

    private static func verify(_ change: ByteChange) throws {
        let current: Data?
        do { current = try Data(contentsOf: change.url) }
        catch let error as CocoaError where error.code == .fileReadNoSuchFile { current = nil }
        guard current == change.expected else { throw ContentAuthoringError.sourceChanged }
    }

    private static func apply(_ change: ByteChange) throws {
        let directory = change.url.deletingLastPathComponent()
        guard let bytes = change.replacement else {
            try FileManager.default.removeItem(at: change.url)
            return
        }
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        if change.expected == nil {
            let temporary = directory.appending(path: ".content-\(UUID().uuidString)")
            defer { try? FileManager.default.removeItem(at: temporary) }
            try bytes.write(to: temporary, options: .withoutOverwriting)
            try FileManager.default.moveItem(at: temporary, to: change.url)
        }
        else {
            try bytes.write(to: change.url, options: .atomic)
        }
    }
}
