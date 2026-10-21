// SPIKE (P0 feasibility): not production code.
//
// Hosts the bundled ADV.JS engine in one JSContext on a private serial queue.
// The engine exposes a single JSON-in/JSON-out entry point, `AdvEngine.call`.

import Foundation
import JavaScriptCore
import Security

enum EngineHostError: Error, CustomStringConvertible {
    case scriptUnreadable(String)
    case evaluationFailed(String)
    case missingEntryPoint
    case rejected(String)
    case unsettled(String)

    var description: String {
        switch self {
        case .scriptUnreadable(let message): "engine script unreadable: \(message)"
        case .evaluationFailed(let message): "engine evaluation failed: \(message)"
        case .missingEntryPoint: "AdvEngine.call is missing"
        case .rejected(let message): "engine promise rejected: \(message)"
        case .unsettled(let operation): "engine promise did not settle synchronously: \(operation)"
        }
    }
}

final class EngineHost: @unchecked Sendable {
    struct LoadMetrics: Sendable, Codable {
        let scriptBytes: Int
        let readSeconds: Double
        let evaluateSeconds: Double
    }

    private let queue = DispatchQueue(label: "org.advjs.studio.spike.engine", qos: .userInitiated)
    private var context: JSContext?
    private var entryPoint: JSValue?
    private(set) var loadMetrics: LoadMetrics?

    static func load(scriptURL: URL) async throws -> EngineHost {
        let host = EngineHost()
        try await host.start(scriptURL: scriptURL)
        return host
    }

    private func start(scriptURL: URL) async throws {
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            queue.async {
                do {
                    try self.startOnQueue(scriptURL: scriptURL)
                    continuation.resume()
                } catch {
                    continuation.resume(throwing: error)
                }
            }
        }
    }

    private func startOnQueue(scriptURL: URL) throws {
        let readStarted = Date()
        let script: String
        do {
            script = try String(contentsOf: scriptURL, encoding: .utf8)
        } catch {
            throw EngineHostError.scriptUnreadable(error.localizedDescription)
        }
        let readSeconds = Date().timeIntervalSince(readStarted)

        let evaluateStarted = Date()
        guard let context = JSContext() else { throw EngineHostError.evaluationFailed("JSContext()") }
        context.name = "ADV.JS Engine (spike)"
        let exceptionBox = ExceptionBox()
        context.exceptionHandler = { _, value in
            exceptionBox.message = value?.toString() ?? "unknown exception"
        }

        // Only secure randomness crosses the bridge; all other Web APIs are pure JS in the bundle.
        let host = JSValue(newObjectIn: context)
        let randomBytes: @convention(block) (Int) -> [UInt8] = { length in
            var bytes = [UInt8](repeating: 0, count: max(0, min(length, 65_536)))
            _ = SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes)
            return bytes
        }
        host?.setObject(randomBytes, forKeyedSubscript: "randomBytes" as NSString)
        context.setObject(host, forKeyedSubscript: "__advHost" as NSString)

        context.evaluateScript(script, withSourceURL: scriptURL)
        if let message = exceptionBox.message {
            throw EngineHostError.evaluationFailed(message)
        }
        guard let entryPoint = context.objectForKeyedSubscript("AdvEngine")?.objectForKeyedSubscript("call"),
              !entryPoint.isUndefined else {
            throw EngineHostError.missingEntryPoint
        }
        self.context = context
        self.entryPoint = entryPoint
        loadMetrics = LoadMetrics(
            scriptBytes: script.utf8.count,
            readSeconds: readSeconds,
            evaluateSeconds: Date().timeIntervalSince(evaluateStarted)
        )
    }

    /// Calls one versioned engine operation. JavaScriptCore drains the microtask
    /// queue when control leaves the VM, so pure-computation promises settle
    /// before `invokeMethod` returns; anything else is reported as a failure.
    func call(_ operation: String, input: String) async throws -> String {
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<String, Error>) in
            queue.async {
                guard let context = self.context, let entryPoint = self.entryPoint else {
                    continuation.resume(throwing: EngineHostError.missingEntryPoint)
                    return
                }
                let outcome = Outcome()
                let fulfilled: @convention(block) (JSValue) -> Void = { value in
                    outcome.result = .success(value.toString())
                }
                let rejected: @convention(block) (JSValue) -> Void = { value in
                    outcome.result = .failure(EngineHostError.rejected(value.toString()))
                }
                let promise = entryPoint.call(withArguments: [operation, input])
                promise?.invokeMethod("then", withArguments: [
                    JSValue(object: fulfilled, in: context) as Any,
                    JSValue(object: rejected, in: context) as Any,
                ])
                continuation.resume(with: outcome.result ?? .failure(EngineHostError.unsettled(operation)))
            }
        }
    }

    /// Drops the context so its heap can be collected.
    func unload() async {
        await withCheckedContinuation { (continuation: CheckedContinuation<Void, Never>) in
            queue.async {
                if let context = self.context {
                    JSGarbageCollect(context.jsGlobalContextRef)
                }
                self.entryPoint = nil
                self.context = nil
                continuation.resume()
            }
        }
    }
}

private final class ExceptionBox: @unchecked Sendable {
    var message: String?
}

private final class Outcome: @unchecked Sendable {
    var result: Result<String, Error>?
}
