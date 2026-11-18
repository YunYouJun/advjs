import Foundation

/// Where the App keeps projects and its own local data.
///
/// Projects live directly in Documents, so they appear in the Files App under
/// "On My iPhone/iPad → ADV.JS Studio". Everything else is local to this
/// device and can be rebuilt or discarded: the project list, Recently Deleted,
/// unsaved drafts and staging areas.
public struct StudioDirectories: Sendable, Equatable {
    /// Project folders, visible in the Files App.
    public let projects: URL
    /// App-private data that is not part of any project.
    public let support: URL
    /// Scratch space for imports and new projects before they are moved into place.
    public let staging: URL

    public var libraryIndex: URL { support.appending(path: "projects.json") }
    public var recentlyDeleted: URL { support.appending(path: "Recently Deleted", directoryHint: .isDirectory) }
    public var drafts: URL { support.appending(path: "Drafts", directoryHint: .isDirectory) }
    public var exports: URL { staging.appending(path: "Exports", directoryHint: .isDirectory) }

    public init(projects: URL, support: URL, staging: URL) {
        self.projects = projects
        self.support = support
        self.staging = staging
    }

    /// Directories under one root, for tests and previews.
    public init(root: URL) {
        self.init(
            projects: root.appending(path: "Documents", directoryHint: .isDirectory),
            support: root.appending(path: "Support", directoryHint: .isDirectory),
            staging: root.appending(path: "Staging", directoryHint: .isDirectory)
        )
    }

    /// The App's real container directories.
    public static func standard(fileManager: FileManager = .default) throws -> StudioDirectories {
        let documents = try fileManager.url(for: .documentDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
        let applicationSupport = try fileManager.url(for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
        return StudioDirectories(
            projects: documents,
            support: applicationSupport.appending(path: "Studio", directoryHint: .isDirectory),
            staging: fileManager.temporaryDirectory.appending(path: "Studio", directoryHint: .isDirectory)
        )
    }

    /// Create every directory; safe to call repeatedly.
    public func prepare(fileManager: FileManager = .default) throws {
        for directory in [projects, support, staging, recentlyDeleted, drafts, exports] {
            try fileManager.createDirectory(at: directory, withIntermediateDirectories: true)
        }
    }
}
