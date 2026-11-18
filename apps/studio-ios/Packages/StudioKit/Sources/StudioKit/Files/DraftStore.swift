import CryptoKit
import Foundation

/// An unsaved edit to one project file, kept on this device until it is
/// saved or discarded. Drafts survive relaunches and are never written into
/// the project by themselves.
public struct FileDraft: Codable, Sendable, Equatable, Identifiable {
    public var id: String { path }
    public let path: String
    public var text: String
    /// SHA-256 of the file on disk when editing began; `nil` for a new file.
    public let baseSHA256: String?
    public var updatedAt: Date
}

/// A draft whose file changed on disk since editing began.
public struct FileConflict: Sendable, Equatable, Identifiable {
    public var id: String { path }
    public let path: String
    public let mine: String
    /// Current file contents; `nil` if the file was deleted.
    public let theirs: String?
}

/// How an author resolves a ``FileConflict``.
public enum ConflictResolution: Sendable {
    /// Overwrite the file with the draft.
    case keepMine
    /// Drop the draft and keep the file as it is now.
    case keepTheirs
    /// Keep the file and save the draft next to it as a copy.
    case keepBoth
}

/// Drafts of one project, stored under the App's support directory.
public struct DraftStore: Sendable {
    public let directory: URL

    public init(directory: URL) {
        self.directory = directory
    }

    public static func sha256(_ text: String) -> String {
        SHA256.hash(data: Data(text.utf8)).map { String(format: "%02x", $0) }.joined()
    }

    public func all() -> [FileDraft] {
        let items = (try? FileManager.default.contentsOfDirectory(at: directory, includingPropertiesForKeys: nil)) ?? []
        return items
            .filter { $0.pathExtension == "json" }
            .compactMap { try? JSONDecoder().decode(FileDraft.self, from: Data(contentsOf: $0)) }
            .sorted { $0.path < $1.path }
    }

    public func draft(for path: String) -> FileDraft? {
        try? JSONDecoder().decode(FileDraft.self, from: Data(contentsOf: url(for: path)))
    }

    /// Record `text` as the draft of `path`, keeping the base of an existing draft.
    public func save(_ text: String, for path: String, base: String?, now: Date = .now) throws {
        let existing = draft(for: path)
        let draft = FileDraft(
            path: path,
            text: text,
            baseSHA256: existing?.baseSHA256 ?? base.map(Self.sha256),
            updatedAt: now
        )
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        try JSONEncoder().encode(draft).write(to: url(for: path), options: .atomic)
    }

    public func discard(_ path: String) {
        try? FileManager.default.removeItem(at: url(for: path))
    }

    /// Drafts whose file no longer matches the version editing started from.
    public func conflicts(with files: [String: String]) -> [FileConflict] {
        all().compactMap { draft in
            let current = files[draft.path]
            let currentHash = current.map(Self.sha256)
            guard currentHash != draft.baseSHA256, current != draft.text else { return nil }
            return FileConflict(path: draft.path, mine: draft.text, theirs: current)
        }
    }

    /// One file per draft, named by the hash of its path so long paths stay valid file names.
    private func url(for path: String) -> URL {
        directory.appending(path: "\(Self.sha256(path)).json")
    }
}
