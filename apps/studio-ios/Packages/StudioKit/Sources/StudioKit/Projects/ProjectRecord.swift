import Foundation

/// One entry in the project list. The list is local to this device and can be
/// rebuilt: projects in Documents are rediscovered on launch; only folders
/// opened in place elsewhere (iCloud Drive, other providers) depend on it.
public struct ProjectRecord: Codable, Sendable, Identifiable, Hashable {
    public enum Storage: Codable, Sendable, Hashable {
        /// A folder in the App's Documents directory.
        case local(folder: String)
        /// A folder elsewhere, opened in place through a security-scoped bookmark.
        case external(bookmark: Data, name: String)
    }

    public let id: UUID
    public var storage: Storage
    public var createdAt: Date
    public var lastOpenedAt: Date?

    public init(id: UUID = UUID(), storage: Storage, createdAt: Date = .now, lastOpenedAt: Date? = nil) {
        self.id = id
        self.storage = storage
        self.createdAt = createdAt
        self.lastOpenedAt = lastOpenedAt
    }

    public var isExternal: Bool {
        if case .external = storage { return true }
        return false
    }

    /// The folder name authors see.
    public var name: String {
        switch storage {
        case .local(let folder): folder
        case .external(_, let name): name
        }
    }
}

/// What the project list shows for one record.
public struct ProjectSummary: Sendable, Identifiable, Hashable {
    public enum Availability: Sendable, Hashable {
        case available
        /// The folder moved or its bookmark no longer resolves; the author can locate it again.
        case missing
    }

    public let id: UUID
    public let name: String
    public let isExternal: Bool
    public let availability: Availability
    public let modifiedAt: Date?
    public let lastOpenedAt: Date?
    public let createdAt: Date
    /// `adv/settings/game.json` description, if any.
    public let summary: String?

    public init(
        id: UUID,
        name: String,
        isExternal: Bool,
        availability: Availability,
        modifiedAt: Date?,
        lastOpenedAt: Date?,
        createdAt: Date,
        summary: String?
    ) {
        self.id = id
        self.name = name
        self.isExternal = isExternal
        self.availability = availability
        self.modifiedAt = modifiedAt
        self.lastOpenedAt = lastOpenedAt
        self.createdAt = createdAt
        self.summary = summary
    }
}

/// A project moved to Recently Deleted. Deleting is undoable for 30 days.
public struct DeletedProject: Codable, Sendable, Identifiable, Hashable {
    public let id: UUID
    public let record: ProjectRecord
    public let deletedAt: Date
    /// Folder inside Recently Deleted holding the project; `nil` for projects
    /// opened in place, whose files were never touched.
    public let trashFolder: String?

    public var name: String { record.name }
}

public enum ProjectLibraryError: Error, Equatable, Sendable, LocalizedError {
    case notFound
    case notAProject
    case unavailable
    case nameTaken(String)
    case invalidName
    case unsafePackage([String])
    case invalidPackage(String)
    case missingMedia(String)
    case mediaMismatch(String)
    case renameUnsupportedForExternal

    public var errorDescription: String? {
        switch self {
        case .notFound: "The project no longer exists."
        case .notAProject: "This folder is not an ADV.JS project. It needs an adv folder or adv.config.json."
        case .unavailable: "The project folder cannot be reached."
        case .nameTaken(let name): "A project named \(name) already exists."
        case .invalidName: "Enter a project name."
        case .unsafePackage(let paths): "The package contains unsafe paths: \(paths.joined(separator: ", "))"
        case .invalidPackage(let message): "The package is not an ADV.JS project: \(message)"
        case .missingMedia(let path): "A file the project lists is missing: \(path)"
        case .mediaMismatch(let path): "A media file does not match its recorded checksum: \(path)"
        case .renameUnsupportedForExternal: "Rename projects opened from another location in the Files App."
        }
    }
}
