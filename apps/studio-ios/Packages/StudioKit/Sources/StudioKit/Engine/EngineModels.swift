import Foundation

/// Result of `engine.info`.
public struct EngineInfo: Codable, Equatable, Sendable {
    public let apiVersion: Int
    public let operations: [String]
    /// Official runtime plugins bundled with the App, by name and exact version.
    public let plugins: [String: String]
}

/// One located problem, normalized across every engine source.
public struct EngineDiagnostic: Codable, Equatable, Hashable, Sendable {
    public enum Severity: String, Codable, Sendable {
        case error
        case warning
    }

    public let code: String
    public let severity: Severity
    public let message: String
    /// Project-relative path.
    public let file: String?
    /// 1-based.
    public let line: Int?
    /// 1-based.
    public let column: Int?
    public let suggestion: String?
}

/// `{ ok, apiVersion, result | error }`, the only shape the engine returns.
struct EngineEnvelope<Result: Decodable>: Decodable {
    let ok: Bool
    let apiVersion: Int
    let result: Result?
    let error: EngineFailure?
}

/// Operations take one JSON object. Use this when an operation needs no fields.
public struct EmptyEngineInput: Encodable, Sendable {
    public init() {}
}
