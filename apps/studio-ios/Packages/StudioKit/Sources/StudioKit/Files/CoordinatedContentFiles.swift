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
        try coordinate(filePresenter: filePresenter) { coordinator, error in
            var result: Result<Void, Error> = .failure(CocoaError(.fileWriteUnknown))
            coordinator.coordinate(writingItemAt: url, options: replacement == nil ? .forDeleting : .forReplacing, error: error) { target in
                result = Result {
                    let current: Data?
                    do {
                        current = try Data(contentsOf: target)
                    }
                    catch let error as CocoaError where error.code == .fileReadNoSuchFile {
                        current = nil
                    }
                    guard current == expected else {
                        throw ContentAuthoringError.sourceChanged
                    }
                    if let bytes = replacement {
                        if current == nil {
                            let temporary = target.deletingLastPathComponent().appending(path: ".content-\(UUID().uuidString)")
                            defer { try? FileManager.default.removeItem(at: temporary) }
                            try bytes.write(to: temporary, options: .withoutOverwriting)
                            try FileManager.default.moveItem(at: temporary, to: target)
                        }
                        else {
                            try bytes.write(to: target, options: .atomic)
                        }
                    }
                    else {
                        try FileManager.default.removeItem(at: target)
                    }
                }
            }
            return result
        }
    }
}
