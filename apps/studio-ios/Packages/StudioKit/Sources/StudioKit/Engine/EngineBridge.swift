import Foundation
import JavaScriptCore
import os
import Security

/// Hosts the bundled ADV.JS engine (`engine.js`) in JavaScriptCore.
///
/// The engine is the same TypeScript Web Studio, the desktop Editor and the
/// CLI run, bundled into one script. Swift never calls engine internals: every
/// request is one versioned operation with a JSON object in and a JSON
/// envelope out.
///
/// Each bridge owns its own `JSVirtualMachine`, so shutting a bridge down
/// releases that project's whole JavaScript heap. All JavaScript runs on the
/// bridge's private serial queue, never on the main thread.
public actor EngineBridge {
    /// Engine wire version this App understands (`ENGINE_API_VERSION`).
    public static let supportedAPIVersion = 1

    public struct LoadMetrics: Codable, Equatable, Sendable {
        public let scriptBytes: Int
        public let readSeconds: Double
        public let evaluateSeconds: Double
    }

    /// The engine shipped in the StudioKit resource bundle.
    public static var bundledScriptURL: URL? {
        Bundle.module.url(forResource: "engine", withExtension: "js", subdirectory: "EngineBundle")
    }

    private static let logger = Logger(subsystem: "org.advjs.studio", category: "engine")

    private let queue: DispatchSerialQueue
    private let scriptURL: URL?
    private var machine: JSVirtualMachine?
    private var context: JSContext?
    private var entryPoint: JSValue?
    public private(set) var loadMetrics: LoadMetrics?
    public private(set) var info: EngineInfo?

    public nonisolated var unownedExecutor: UnownedSerialExecutor {
        queue.asUnownedSerialExecutor()
    }

    public init(scriptURL: URL? = EngineBridge.bundledScriptURL, label: String = "org.advjs.studio.engine") {
        self.scriptURL = scriptURL
        self.queue = DispatchSerialQueue(label: label, qos: .userInitiated)
    }

    public var isRunning: Bool { entryPoint != nil }

    /// Load and evaluate the engine, then check its wire version. Idempotent.
    @discardableResult
    public func start() throws -> LoadMetrics {
        if let loadMetrics, isRunning {
            return loadMetrics
        }
        guard let scriptURL else { throw EngineError.scriptMissing }

        let clock = ContinuousClock()
        let readStarted = clock.now
        let script: String
        do {
            script = try String(contentsOf: scriptURL, encoding: .utf8)
        } catch {
            throw EngineError.scriptUnreadable(error.localizedDescription)
        }
        let readDuration = clock.now - readStarted

        let evaluateStarted = clock.now
        guard let machine = JSVirtualMachine(), let context = JSContext(virtualMachine: machine) else {
            throw EngineError.evaluationFailed("JSContext could not be created")
        }
        context.name = "ADV.JS Engine"
        let exception = ExceptionBox()
        context.exceptionHandler = { _, value in
            exception.message = value?.toString() ?? "unknown exception"
        }
        Self.installHost(in: context)
        context.evaluateScript(script, withSourceURL: scriptURL)
        if let message = exception.message {
            throw EngineError.evaluationFailed(message)
        }
        guard let entryPoint = context.objectForKeyedSubscript("AdvEngine")?.objectForKeyedSubscript("call"),
              entryPoint.isObject else {
            throw EngineError.missingEntryPoint
        }
        self.machine = machine
        self.context = context
        self.entryPoint = entryPoint

        let info: EngineInfo
        do {
            info = try Self.decode(EngineInfo.self, from: invoke("engine.info", input: "{}"))
        } catch {
            shutdown()
            throw error
        }
        guard info.apiVersion == Self.supportedAPIVersion else {
            shutdown()
            throw EngineError.incompatibleAPIVersion(info.apiVersion)
        }
        self.info = info

        let metrics = LoadMetrics(
            scriptBytes: script.utf8.count,
            readSeconds: Self.seconds(readDuration),
            evaluateSeconds: Self.seconds(clock.now - evaluateStarted)
        )
        loadMetrics = metrics
        return metrics
    }

    /// Run one operation with a raw JSON input and return the raw response
    /// envelope. Parity tests compare these strings byte for byte.
    public func callRaw(_ operation: String, input: String) throws -> String {
        try invoke(operation, input: input)
    }

    /// Run one operation and decode its result; engine failures throw
    /// ``EngineError/engine(_:)`` with a stable code.
    public func call<Input: Encodable & Sendable, Result: Decodable & Sendable>(
        _ operation: String,
        input: Input,
        as type: Result.Type = Result.self
    ) throws -> Result {
        let data = try JSONEncoder().encode(input)
        let raw = try invoke(operation, input: String(decoding: data, as: UTF8.self))
        return try Self.decode(type, from: raw)
    }

    /// Release the context and its virtual machine so the heap can be reclaimed.
    public func shutdown() {
        if let context {
            JSGarbageCollect(context.jsGlobalContextRef)
        }
        entryPoint = nil
        context = nil
        machine = nil
        info = nil
        loadMetrics = nil
    }

    // MARK: - Private

    /// JavaScriptCore drains the microtask queue when control leaves the VM,
    /// so the engine's computation-only promises settle before `invokeMethod`
    /// returns. A promise still pending afterwards is reported as a failure.
    private func invoke(_ operation: String, input: String) throws -> String {
        guard let context, let entryPoint else { throw EngineError.notRunning }
        let outcome = PromiseOutcome()
        let fulfilled: @convention(block) (JSValue) -> Void = { value in
            outcome.result = .success(value.toString())
        }
        let rejected: @convention(block) (JSValue) -> Void = { value in
            outcome.result = .failure(value.toString())
        }
        let promise = entryPoint.call(withArguments: [operation, input])
        promise?.invokeMethod("then", withArguments: [
            JSValue(object: fulfilled, in: context) as Any,
            JSValue(object: rejected, in: context) as Any,
        ])
        switch outcome.result {
        case .success(let response):
            return response
        case .failure(let message):
            throw EngineError.rejected(message)
        case nil:
            throw EngineError.unsettled(operation: operation)
        }
    }

    private static func decode<Result: Decodable>(_ type: Result.Type, from raw: String) throws -> Result {
        let envelope: EngineEnvelope<Result>
        do {
            envelope = try JSONDecoder().decode(EngineEnvelope<Result>.self, from: Data(raw.utf8))
        } catch {
            throw EngineError.malformedResponse(String(describing: error))
        }
        if envelope.ok, let result = envelope.result {
            return result
        }
        if let failure = envelope.error {
            throw EngineError.engine(failure)
        }
        throw EngineError.malformedResponse("envelope has neither result nor error")
    }

    /// Secure randomness and log forwarding are the only host capabilities;
    /// every other Web API the engine needs is pure JavaScript in its prelude.
    private static func installHost(in context: JSContext) {
        guard let host = JSValue(newObjectIn: context) else { return }
        let randomBytes: @convention(block) (Int) -> [UInt8] = { length in
            var bytes = [UInt8](repeating: 0, count: max(0, min(length, 65_536)))
            if SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes) != errSecSuccess {
                return []
            }
            return bytes
        }
        let log: @convention(block) (String, String) -> Void = { level, message in
            switch level {
            case "error": logger.error("\(message, privacy: .private)")
            case "warn": logger.warning("\(message, privacy: .private)")
            default: logger.debug("\(message, privacy: .private)")
            }
        }
        host.setObject(randomBytes, forKeyedSubscript: "randomBytes" as NSString)
        host.setObject(log, forKeyedSubscript: "log" as NSString)
        context.setObject(host, forKeyedSubscript: "__advHost" as NSString)
    }

    private static func seconds(_ duration: Duration) -> Double {
        let components = duration.components
        return Double(components.seconds) + Double(components.attoseconds) / 1e18
    }
}

/// Written only by JavaScriptCore callbacks on the bridge queue.
private final class ExceptionBox {
    var message: String?
}

/// Written only by JavaScriptCore callbacks on the bridge queue.
private final class PromiseOutcome {
    enum Result {
        case success(String)
        case failure(String)
    }

    var result: Result?
}
