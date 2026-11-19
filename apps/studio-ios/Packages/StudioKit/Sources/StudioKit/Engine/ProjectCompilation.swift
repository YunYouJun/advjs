import Foundation

public struct SourceLocation: Codable, Hashable, Sendable {
    public let path: String
    public let line: Int?
    public let column: Int?
    public let endLine: Int?
    public let endColumn: Int?

    public init(path: String, line: Int? = nil, column: Int? = nil, endLine: Int? = nil, endColumn: Int? = nil) {
        self.path = path
        self.line = line
        self.column = column
        self.endLine = endLine
        self.endColumn = endColumn
    }

    /// Parser columns count UTF-16 code units, as do UIKit's text ranges.
    public func insertionOffset(in text: NSString) -> Int {
        var start = 0
        var end = 0
        var contentsEnd = 0
        for _ in 1..<max(1, line ?? 1) {
            guard start < text.length else { return text.length }
            text.getLineStart(nil, end: &end, contentsEnd: nil, for: NSRange(location: start, length: 0))
            start = end
        }
        if start == text.length { return start }
        text.getLineStart(nil, end: nil, contentsEnd: &contentsEnd, for: NSRange(location: start, length: 0))
        let offset = min(contentsEnd, start + max(0, (column ?? 1) - 1))
        if offset < contentsEnd {
            return text.rangeOfComposedCharacterSequence(at: offset).location
        }
        return offset
    }

    public init(path: String, offset: Int, in text: NSString) {
        let target = min(max(0, offset), text.length)
        var start = 0
        var line = 1
        while start < target {
            var end = 0
            text.getLineStart(nil, end: &end, contentsEnd: nil, for: NSRange(location: start, length: 0))
            if end > target { break }
            if end == text.length, !CharacterSet.newlines.contains(UnicodeScalar(text.character(at: end - 1)) ?? " ") { break }
            start = end
            line += 1
        }
        self.init(path: path, line: line, column: target - start + 1)
    }

    public var display: String {
        guard let line else { return path }
        return "\(path):\(line):\(column ?? 1)"
    }
}

public struct RuntimeAddress: Codable, Equatable, Sendable, Hashable {
    public let chapterId: String
    public let nodeId: String

    public init(chapterId: String, nodeId: String) {
        self.chapterId = chapterId
        self.nodeId = nodeId
    }
}

public struct EngineProgram: Decodable, Equatable, Sendable {
    public struct Chapter: Decodable, Equatable, Sendable {
        public let entry: String
        public let title: String?
        public let order: [String]
    }
    public let entry: RuntimeAddress
    public let chapters: [String: Chapter]
}

public struct EngineSourceMap: Decodable, Sendable {
    public let chapters: [String: [String]]
    public let nodes: [String: SourceLocation]?
}

public struct EngineCompilation: Decodable, Sendable {
    public struct Project: Decodable, Sendable {
        public let program: EngineProgram?
    }
    public let project: Project
    public let diagnostics: [EngineDiagnostic]
    public let sourceMap: EngineSourceMap
}

extension EngineDiagnostic {
    public var location: SourceLocation? {
        file.map { SourceLocation(path: $0, line: line, column: column) }
    }
}

public enum ProjectSourceVersion: Equatable, Sendable {
    case saved
    case draft
}

extension ProjectSession {
    public func sourceInput(_ version: ProjectSourceVersion) throws -> EngineProjectInput {
        guard let snapshot else { throw ProjectLibraryError.unavailable }
        if version == .saved { return snapshot.engineInput }
        var files = snapshot.files
        for draft in drafts {
            files[draft.path] = draft.text
        }
        return EngineProjectInput(files: files, paths: Array(Set(snapshot.paths).union(files.keys)).sorted())
    }

    /// Both callers compile the exact snapshot supplied, independent of edits during compilation.
    public func compile(_ input: EngineProjectInput) async throws -> EngineCompilation {
        struct Input: Encodable {
            let files: [String: String]
            let native = true
        }
        return try await engine.call("project.compile", input: Input(files: input.files), as: EngineCompilation.self)
    }
}

public struct EnginePlayerBuild: Sendable {
    public enum Orientation: String, Decodable, Sendable { case system, portrait, landscape }
    public enum ColorScheme: String, Decodable, Sendable { case light, dark }

    public let diagnostics: [EngineDiagnostic]
    public let program: EngineProgram?
    public let sourceMap: EngineSourceMap
    public let orientation: Orientation
    public let colorScheme: ColorScheme
    public let gameConfigJSON: Data?
    public let programJSON: Data?
}

extension ProjectSession {
    public func buildPlayer(_ source: EngineProjectInput, baseURL: URL) async throws -> EnginePlayerBuild {
        struct Input: Encodable {
            let files: [String: String]
            let baseUrl: String
            let native: Bool
        }
        struct Metadata: Decodable {
            let diagnostics: [EngineDiagnostic]
            let program: EngineProgram?
            let sourceMap: EngineSourceMap
            let orientation: EnginePlayerBuild.Orientation
            let colorScheme: EnginePlayerBuild.ColorScheme
        }
        let input = try JSONEncoder().encode(Input(files: source.files, baseUrl: baseURL.absoluteString, native: true))
        let raw = try await engine.callRaw("project.playerConfig", input: String(decoding: input, as: UTF8.self))
        let data = Data(raw.utf8)
        let envelope = try JSONDecoder().decode(EngineEnvelope<Metadata>.self, from: data)
        guard envelope.apiVersion == EngineBridge.supportedAPIVersion else {
            throw EngineError.incompatibleAPIVersion(envelope.apiVersion)
        }
        if let error = envelope.error { throw EngineError.engine(error) }
        guard envelope.ok, let result = envelope.result,
              let object = try JSONSerialization.jsonObject(with: data) as? [String: Any],
              let payload = object["result"] as? [String: Any] else {
            throw EngineError.malformedResponse("player config")
        }
        return EnginePlayerBuild(
            diagnostics: result.diagnostics, program: result.program, sourceMap: result.sourceMap,
            orientation: result.orientation, colorScheme: result.colorScheme,
            gameConfigJSON: try payload["gameConfig"].map { try JSONSerialization.data(withJSONObject: $0) },
            programJSON: try payload["program"].map { try JSONSerialization.data(withJSONObject: $0) }
        )
    }
}

extension EnginePlayerBuild {
    /// Map a source caret to the containing executable node, then the next one in that file.
    public func startAddress(chapterPath: String?, location: SourceLocation?) -> RuntimeAddress? {
        guard let program else { return nil }
        guard let chapterPath else { return program.entry }
        guard let chapterId = sourceMap.chapters.keys.sorted().first(where: { sourceMap.chapters[$0]?.contains(chapterPath) == true }),
              let chapter = program.chapters[chapterId] else { return nil }

        let entry = RuntimeAddress(chapterId: chapterId, nodeId: chapter.entry)
        guard let location, let line = location.line else { return entry }
        let column = location.column ?? 1
        let candidates = chapter.order.compactMap { id -> (String, SourceLocation)? in
            guard let source = sourceMap.nodes?["\(chapterId)#\(id)"], source.path == location.path, source.line != nil else { return nil }
            return (id, source)
        }
        let containing = candidates.last { _, source in
            guard let start = source.line, let end = source.endLine,
                  (start, source.column ?? 1) <= (line, column) else { return false }
            return (line, column) <= (end, source.endColumn ?? Int.max)
        }
        let next = candidates.first { _, source in
            (source.line ?? 0, source.column ?? 1) >= (line, column)
        }
        guard let id = (containing ?? next)?.0 else { return nil }
        return RuntimeAddress(chapterId: chapterId, nodeId: id)
    }
}
