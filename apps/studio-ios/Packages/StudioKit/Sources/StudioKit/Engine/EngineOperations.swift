import Foundation

/// Typed inputs and results for the engine operations the App calls.
/// Field names mirror `apps/studio-ios/engine/src/operations.ts`.
public enum EngineOperations {}

// MARK: - Snapshots

/// Project files as the engine sees them: text by project-relative path, plus every path.
public struct EngineProjectInput: Encodable, Sendable {
    public let files: [String: String]
    public let paths: [String]

    public init(files: [String: String], paths: [String]) {
        self.files = files
        self.paths = paths
    }
}

// MARK: - Templates

public struct EngineTemplateList: Decodable, Sendable, Equatable {
    public let templates: [String]
    public let quickStart: String
}

public struct EngineTemplateInput: Encodable, Sendable {
    public let templateId: String
    public let name: String

    public init(templateId: String, name: String) {
        self.templateId = templateId
        self.name = name
    }
}

public struct EngineTemplateFiles: Decodable, Sendable {
    public let files: [String: String]
}

// MARK: - Index

public struct EngineProjectIndex: Decodable, Sendable, Equatable {
    public struct Chapter: Decodable, Sendable, Equatable, Hashable {
        public let file: String
        public let name: String
        public let preview: String
        public let format: String?
    }

    public struct Named: Decodable, Sendable, Equatable, Hashable {
        public let file: String
        public let name: String
        public let id: String?
    }

    public struct Character: Decodable, Sendable, Equatable, Hashable {
        public let id: String
        public let name: String
    }

    public struct Issue: Decodable, Sendable, Equatable, Hashable {
        public let code: String
        public let file: String
        public let message: String
    }

    public let format: String
    public let chapters: [Chapter]
    public let characters: [Character]
    public let scenes: [Named]
    public let locations: [Named]
    public let audios: [Named]
    public let issues: [Issue]
}

// MARK: - Validation

public struct EngineValidation: Decodable, Sendable, Equatable {
    public struct Issue: Codable, Sendable, Equatable, Hashable {
        public enum Kind: String, Codable, Sendable {
            case error
            case warning
        }

        /// Warnings about broken links in frontmatter, which `project.fixReferences` can remove.
        public var isFixable: Bool {
            type == .warning && ["audio", "location", "character", "scene"].contains(category)
        }

        public let type: Kind
        public let category: String
        public let file: String
        public let message: String
        public let code: String?
        public let line: Int?
        public let column: Int?
    }

    public struct Stats: Decodable, Sendable, Equatable {
        public let scripts: Int
        public let characters: Int
        public let scenes: Int
        public let locations: Int
        public let audios: Int
    }

    public let issues: [Issue]
    public let passed: Bool
    public let stats: Stats
}

// MARK: - Packages

public struct EnginePackagePlanInput: Encodable, Sendable {
    public let files: [String: String]
    public let paths: [String]
    public let name: String
    public let exportedAt: String

    public init(files: [String: String], paths: [String], name: String, exportedAt: String) {
        self.files = files
        self.paths = paths
        self.name = name
        self.exportedAt = exportedAt
    }
}

public struct EnginePackagePlan: Decodable, Sendable {
    public struct Entry: Decodable, Sendable, Equatable {
        public let path: String
        public let sha256: String?
        public let bytes: Int?
    }

    public let entries: [Entry]
    public let manifestText: String
}

public struct EnginePackageInspectInput: Encodable, Sendable {
    public let manifest: String?
    public let paths: [String]

    public init(manifest: String?, paths: [String]) {
        self.manifest = manifest
        self.paths = paths
    }
}

public struct EnginePackageInspection: Decodable, Sendable {
    public struct Manifest: Decodable, Sendable, Equatable {
        public let name: String
        public let version: String
    }

    public let manifest: Manifest
    public let unsafePaths: [String]
}

// MARK: - Patches

public struct EnginePatchInput: Encodable, Sendable {
    public struct Patch: Encodable, Sendable {
        public let kind: String
        public let path: String
        public let key: String
        public let value: String?

        public static func jsonSet(path: String, key: String, value: String?) -> Patch {
            Patch(kind: "json-set", path: path, key: key, value: value)
        }
    }

    public let files: [String: String]
    public let patches: [Patch]

    public init(files: [String: String], patches: [Patch]) {
        self.files = files
        self.patches = patches
    }
}

public struct EnginePatchResult: Decodable, Sendable {
    public let changedPaths: [String]
    public let files: [String: String]
}

public struct EngineFixInput: Encodable, Sendable {
    public let files: [String: String]
    public let issues: [EngineValidation.Issue]
}

public struct EngineFixResult: Decodable, Sendable {
    public let writes: [String: String]
    public let fixed: [EngineValidation.Issue]
}
