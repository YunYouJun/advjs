import Foundation

public struct ChapterForm: Equatable, Sendable {
    public var title: String
    public var plotSummary: String
    public var body: String

    public init(title: String = "", plotSummary: String = "", body: String = "") {
        self.title = title
        self.plotSummary = plotSummary
        self.body = body
    }
}

extension ProjectSession {
    public func chapterForm(path: String, source: String) async throws -> ChapterForm {
        struct Input: Encodable { let type = "chapter"; let filename: String; let content: String }
        struct Result: Decodable { let title: String; let plotSummary: String; let body: String }
        let result = try await engine.call("content.parse", input: Input(filename: chapterFilename(path), content: source), as: Result.self)
        return ChapterForm(title: result.title, plotSummary: result.plotSummary, body: result.body)
    }

    public func chapterSource(path: String, form: ChapterForm, source: String, initialBody: String?) async throws -> String {
        struct Data: Encodable {
            let filename: String
            let title: String
            let plotSummary: String
            let content: String
            let body: String?
        }
        struct Input: Encodable { let type = "chapter"; let data: Data }
        let data = Data(filename: chapterFilename(path), title: form.title, plotSummary: form.plotSummary,
                        content: source, body: initialBody == form.body ? nil : form.body)
        return try await engine.call("content.stringify", input: Input(data: data), as: String.self)
    }

    public func chapterPath(filename: String, currentPath: String? = nil) async throws -> String {
        struct Input: Encodable { let filename: String; let currentPath: String? }
        struct Result: Decodable { let path: String }
        do {
            let result = try await engine.call("chapter.path", input: Input(filename: filename.trimmingCharacters(in: .whitespaces), currentPath: currentPath), as: Result.self)
            return result.path
        }
        catch let error as EngineError {
            if case .engine(let failure) = error, failure.code == "ENGINE_CONTENT_INVALID" { throw ProjectLibraryError.invalidName }
            throw error
        }
    }

    private func chapterFilename(_ path: String) -> String {
        (path as NSString).lastPathComponent
    }
}
