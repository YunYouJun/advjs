import Foundation

public enum ContentKind: String, Codable, CaseIterable, Sendable, Identifiable {
    case character, scene, location, knowledge
    public var id: Self { self }
}

/// JSON values from the shared parser. Keeping nested values intact lets a
/// form update one field without dropping fields it does not present.
public enum ContentValue: Codable, Equatable, Sendable {
    case string(String), number(Double), bool(Bool), array([ContentValue]), object(ContentData), null

    public init(from decoder: any Decoder) throws {
        let value = try decoder.singleValueContainer()
        if value.decodeNil() { self = .null }
        else if let bool = try? value.decode(Bool.self) { self = .bool(bool) }
        else if let number = try? value.decode(Double.self) { self = .number(number) }
        else if let string = try? value.decode(String.self) { self = .string(string) }
        else if let array = try? value.decode([Self].self) { self = .array(array) }
        else { self = .object(try value.decode(ContentData.self)) }
    }

    public func encode(to encoder: any Encoder) throws {
        var output = encoder.singleValueContainer()
        switch self {
        case .string(let value): try output.encode(value)
        case .number(let value): try output.encode(value)
        case .bool(let value): try output.encode(value)
        case .array(let value): try output.encode(value)
        case .object(let value): try output.encode(value)
        case .null: try output.encodeNil()
        }
    }

    public var string: String? {
        switch self {
        case .string(let value): value
        case .number(let value): value.formatted(.number.locale(Locale(identifier: "en_US_POSIX")).grouping(.never))
        default: nil
        }
    }

    public var array: [Self]? {
        if case .array(let value) = self { return value }
        return nil
    }

    public var object: ContentData? {
        if case .object(let value) = self { return value }
        return nil
    }
}

public typealias ContentData = [String: ContentValue]

public struct ContentEntry: Decodable, Equatable, Sendable, Identifiable {
    public var id: String { path }
    public let path: String
    public let name: String
    public let data: ContentData?

    public var contentID: String? { data?["id"]?.string }
}

public struct ContentDocument: Sendable {
    public let data: ContentData
    public let source: String
    public let savedSource: String?

    public init(data: ContentData, source: String, savedSource: String?) {
        self.data = data
        self.source = source
        self.savedSource = savedSource
    }
}

public struct ContentWrite: Decodable, Sendable {
    public let path: String
    public let text: String
}

public enum ContentImportStrategy: String, CaseIterable, Codable, Identifiable, Sendable {
    case skip, overwrite, rename
    public var id: Self { self }
}

public struct ContentImportRow: Decodable, Sendable {
    public enum Status: String, Decodable, Sendable {
        case created, skipped, overwritten, renamed, invalid, failed
    }

    public let name: String
    public let status: Status
    public let path: String?
    let text: String?
    let source: String?
}

public struct CharacterCSVs: Decodable, Sendable {
    public let characters: String
    public let relationships: String
}

public enum ContentAuthoringError: Error {
    case sourceChanged
    case unreadable
}

private struct ContentInput: Encodable, Sendable {
    var kind: ContentKind?
    var path: String?
    var source: String?
    var data: ContentData?
    var files: [String: String]?
    var paths: [String]?
    var format: String?
    var strategy: ContentImportStrategy?
    var locale: String?
    var provider: String?
}

extension ProjectSession {
    public func contentEntries(_ kind: ContentKind) async throws -> [ContentEntry] {
        guard let snapshot else { throw ProjectLibraryError.unavailable }
        // Include recoverable drafts whose original file was deleted elsewhere.
        let draftFiles = Dictionary(uniqueKeysWithValues: drafts.map { ($0.path, $0.text) })
        let files = snapshot.files.merging(draftFiles) { _, draft in draft }
        return try await engine.call(
            "authoring.list",
            input: ContentInput(kind: kind, files: files, paths: Array(Set(snapshot.paths).union(draftFiles.keys))),
            as: [ContentEntry].self
        )
    }

    public func contentDocument(_ kind: ContentKind, path: String) async throws -> ContentDocument {
        guard let source = text(at: path) else { throw ContentAuthoringError.unreadable }
        let savedSource = snapshot?.files[path]
        let data = try await engine.call(
            "authoring.read",
            input: ContentInput(kind: kind, path: path, source: source),
            as: ContentData.self
        )
        return ContentDocument(data: data, source: source, savedSource: savedSource)
    }

    public func createContent(_ kind: ContentKind, data: ContentData) async throws -> String {
        let write = try await engine.call("authoring.create", input: ContentInput(kind: kind, data: data), as: ContentWrite.self)
        let url = try contentURL(write.path)
        guard !hasDraft(write.path),
              !ProjectFolderName.isTaken(url.lastPathComponent, in: url.deletingLastPathComponent()) else {
            throw ProjectLibraryError.nameTaken(url.lastPathComponent)
        }
        try CoordinatedFiles.changeContent(at: url, from: nil, to: write.text, filePresenter: watcher)
        await reload()
        return write.path
    }

    public func stageContent(_ kind: ContentKind, path: String, document: ContentDocument, changes: ContentData) async throws -> String {
        let write = try await engine.call(
            "authoring.update",
            input: ContentInput(kind: kind, path: path, source: document.source, data: changes),
            as: ContentWrite.self
        )
        try Task.checkCancellation()
        if write.text != document.source {
            // A form can progress over its own draft; the caller updates its
            // document source after each successfully staged version.
            guard text(at: path) == document.source || !hasDraft(path) else {
                throw ContentAuthoringError.sourceChanged
            }
            stageDraft(write.text, for: path, basedOn: document.savedSource)
            try flushDrafts()
        }
        return write.text
    }

    public func saveContent(_ path: String) async throws {
        guard let draft = drafts.first(where: { $0.path == path }) else { return }
        try flushDrafts()
        let baseline = snapshot?.files[path]
        guard draft.baseSHA256 == baseline.map(DraftStore.sha256) else {
            throw ContentAuthoringError.sourceChanged
        }
        do {
            try CoordinatedFiles.changeContent(at: try contentURL(path), from: baseline, to: draft.text, filePresenter: watcher)
        }
        catch ContentAuthoringError.sourceChanged {
            await reload()
            throw ContentAuthoringError.sourceChanged
        }
        discardDraft(path)
        await reload()
    }

    public func resolveContent(_ conflict: FileConflict, with resolution: ConflictResolution) async throws {
        let url = try contentURL(conflict.path)
        do {
            switch resolution {
            case .keepMine:
                try CoordinatedFiles.changeContent(at: url, from: conflict.theirs, to: conflict.mine, filePresenter: watcher)
            case .keepTheirs:
                break
            case .keepBoth:
                // A copy outside the index avoids introducing a second document
                // with the same stable content ID.
                let directory = url.deletingLastPathComponent()
                let ext = url.pathExtension
                let base = url.deletingPathExtension().lastPathComponent
                let name = ProjectFolderName.unique("\(base) (mine).\(ext).txt", in: directory)
                try CoordinatedFiles.changeContent(at: directory.appending(path: name), from: nil, to: conflict.mine, filePresenter: watcher)
            }
        }
        catch ContentAuthoringError.sourceChanged {
            await reload()
            throw ContentAuthoringError.sourceChanged
        }
        discardDraft(conflict.path)
        await reload()
    }

    public func deleteContent(_ path: String) async throws {
        guard let baseline = snapshot?.files[path], !hasDraft(path) else { throw ContentAuthoringError.sourceChanged }
        do {
            try CoordinatedFiles.changeContent(at: try contentURL(path), from: baseline, to: nil, filePresenter: watcher)
        }
        catch ContentAuthoringError.sourceChanged {
            await reload()
            throw ContentAuthoringError.sourceChanged
        }
        await reload()
    }

    public func planContentImport(_ kind: ContentKind, text: String, format: String, strategy: ContentImportStrategy) async throws -> [ContentImportRow] {
        guard let snapshot else { throw ProjectLibraryError.unavailable }
        return try await engine.call(
            "authoring.import",
            input: ContentInput(kind: kind, source: text, files: snapshot.files, paths: snapshot.paths, format: format, strategy: strategy),
            as: [ContentImportRow].self
        )
    }

    public func applyContentImport(_ plan: [ContentImportRow]) async -> [ContentImportRow] {
        let results = plan.map { row in
            guard let path = row.path, let text = row.text else { return row }
            do {
                guard !hasDraft(path) else { throw ContentAuthoringError.sourceChanged }
                try CoordinatedFiles.changeContent(at: try contentURL(path), from: row.source, to: text, filePresenter: watcher)
                return row
            }
            catch {
                return ContentImportRow(name: row.name, status: .failed, path: path, text: nil, source: nil)
            }
        }
        await reload()
        return results
    }

    public func characterCSVs() async throws -> CharacterCSVs {
        guard let snapshot else { throw ProjectLibraryError.unavailable }
        return try await engine.call("authoring.characterCSV", input: ContentInput(files: snapshot.files), as: CharacterCSVs.self)
    }

    public func characterSummary(_ source: String) async throws -> String {
        try await engine.call("authoring.characterSummary", input: ContentInput(source: source), as: String.self)
    }

    public func prepareVoiceBinding(locale: String, provider: String, data: ContentData) async throws -> String {
        try await engine.call(
            "authoring.voiceBinding",
            input: ContentInput(data: data, locale: locale, provider: provider),
            as: String.self
        )
    }

    func contentURL(_ path: String) throws -> URL {
        let url = try fileURL(path)
        guard let root else { throw ProjectLibraryError.unavailable }
        let base = root.resolvingSymlinksInPath().standardizedFileURL.pathComponents
        let rootDepth = root.standardizedFileURL.pathComponents.count
        // Check ancestors as the destination directories may not exist yet.
        var item = url
        while item.standardizedFileURL.pathComponents.count > rootDepth {
            let components = item.resolvingSymlinksInPath().standardizedFileURL.pathComponents
            guard components.count > base.count, components.starts(with: base) else {
                throw ProjectLibraryError.invalidName
            }
            item.deleteLastPathComponent()
        }
        return url
    }
}
