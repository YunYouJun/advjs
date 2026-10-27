import Foundation

/// An error envelope returned by the engine (`{ ok: false, error }`).
///
/// Branch and localize on `code`; `message` is English for logs only and may
/// differ between JavaScript engines.
public struct EngineFailure: Error, Codable, Equatable, Hashable, Sendable {
    public let code: String
    public let message: String
    /// Input field the failure refers to, as a dotted path.
    public let field: String?

    public init(code: String, message: String, field: String? = nil) {
        self.code = code
        self.message = message
        self.field = field
    }
}

public enum EngineError: Error, Equatable, Sendable, CustomStringConvertible {
    /// `engine.js` is not in the bundle. Run `pnpm -C apps/studio-ios build:engine`.
    case scriptMissing
    case scriptUnreadable(String)
    case evaluationFailed(String)
    case missingEntryPoint
    /// The bundled engine speaks a different wire version than this App.
    case incompatibleAPIVersion(Int)
    /// The bridge was never started or has been shut down.
    case notRunning
    /// The engine promise was still pending when control returned to the host.
    case unsettled(operation: String)
    case rejected(String)
    case malformedResponse(String)
    case engine(EngineFailure)

    public var description: String {
        switch self {
        case .scriptMissing: "engine.js is missing from the bundle"
        case .scriptUnreadable(let message): "engine.js is unreadable: \(message)"
        case .evaluationFailed(let message): "engine evaluation failed: \(message)"
        case .missingEntryPoint: "AdvEngine.call is missing"
        case .incompatibleAPIVersion(let version): "engine API version \(version) is not supported"
        case .notRunning: "the engine is not running"
        case .unsettled(let operation): "engine promise did not settle: \(operation)"
        case .rejected(let message): "engine promise rejected: \(message)"
        case .malformedResponse(let message): "engine response is malformed: \(message)"
        case .engine(let failure): "\(failure.code): \(failure.message)"
        }
    }
}
