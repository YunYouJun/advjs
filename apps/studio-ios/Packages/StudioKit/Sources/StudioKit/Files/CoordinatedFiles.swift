import Foundation

/// File access that cooperates with the Files App, iCloud and other
/// processes through `NSFileCoordinator`. Pass the caller's own presenter so
/// its writes do not come back to it as external changes.
public enum CoordinatedFiles {
    public static func read(_ url: URL, filePresenter: NSFilePresenter? = nil) throws -> Data {
        try coordinate(filePresenter: filePresenter) { coordinator, error in
            var result: Result<Data, Error> = .failure(CocoaError(.fileReadUnknown))
            coordinator.coordinate(readingItemAt: url, options: [], error: error) { readURL in
                result = Result { try Data(contentsOf: readURL) }
            }
            return result
        }
    }

    /// Replace `url` atomically: the new bytes go to a temporary file in the
    /// same directory, which then replaces the original in one step.
    public static func write(_ data: Data, to url: URL, filePresenter: NSFilePresenter? = nil) throws {
        try FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
        try coordinate(filePresenter: filePresenter) { coordinator, error in
            var result: Result<Void, Error> = .failure(CocoaError(.fileWriteUnknown))
            coordinator.coordinate(writingItemAt: url, options: .forReplacing, error: error) { writeURL in
                result = Result { try data.write(to: writeURL, options: .atomic) }
            }
            return result
        }
    }

    public static func move(_ source: URL, to destination: URL, filePresenter: NSFilePresenter? = nil) throws {
        try coordinate(filePresenter: filePresenter) { coordinator, error in
            var result: Result<Void, Error> = .failure(CocoaError(.fileWriteUnknown))
            coordinator.coordinate(writingItemAt: source, options: .forMoving, writingItemAt: destination, options: .forReplacing, error: error) { from, to in
                result = Result {
                    try FileManager.default.createDirectory(at: to.deletingLastPathComponent(), withIntermediateDirectories: true)
                    try FileManager.default.moveItem(at: from, to: to)
                    coordinator.item(at: from, didMoveTo: to)
                }
            }
            return result
        }
    }

    /// Move within the same folder. A change of letter case only goes through an
    /// intermediate name, since a case-insensitive volume sees the target as taken.
    public static func rename(_ source: URL, to destination: URL, filePresenter: NSFilePresenter? = nil) throws {
        guard source.lastPathComponent.lowercased() == destination.lastPathComponent.lowercased(),
              source.deletingLastPathComponent() == destination.deletingLastPathComponent() else {
            try move(source, to: destination, filePresenter: filePresenter)
            return
        }
        let intermediate = source.deletingLastPathComponent().appending(path: ".rename-\(UUID().uuidString)")
        try move(source, to: intermediate, filePresenter: filePresenter)
        try move(intermediate, to: destination, filePresenter: filePresenter)
    }

    public static func copy(_ source: URL, to destination: URL, filePresenter: NSFilePresenter? = nil) throws {
        try coordinate(filePresenter: filePresenter) { coordinator, error in
            var result: Result<Void, Error> = .failure(CocoaError(.fileWriteUnknown))
            coordinator.coordinate(readingItemAt: source, options: [], writingItemAt: destination, options: .forReplacing, error: error) { from, to in
                result = Result {
                    try FileManager.default.createDirectory(at: to.deletingLastPathComponent(), withIntermediateDirectories: true)
                    try FileManager.default.copyItem(at: from, to: to)
                }
            }
            return result
        }
    }

    public static func delete(_ url: URL, filePresenter: NSFilePresenter? = nil) throws {
        try coordinate(filePresenter: filePresenter) { coordinator, error in
            var result: Result<Void, Error> = .failure(CocoaError(.fileWriteUnknown))
            coordinator.coordinate(writingItemAt: url, options: .forDeleting, error: error) { deleteURL in
                result = Result { try FileManager.default.removeItem(at: deleteURL) }
            }
            return result
        }
    }

    private static func coordinate<T>(
        filePresenter: NSFilePresenter?,
        _ body: (NSFileCoordinator, NSErrorPointer) -> Result<T, Error>
    ) throws -> T {
        let coordinator = NSFileCoordinator(filePresenter: filePresenter)
        var coordinationError: NSError?
        let result = body(coordinator, &coordinationError)
        if let coordinationError {
            throw coordinationError
        }
        return try result.get()
    }
}
