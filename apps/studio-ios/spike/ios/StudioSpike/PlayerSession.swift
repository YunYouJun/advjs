// SPIKE (P0 feasibility): owns one restricted WKWebView player and drives an
// automated offline scenario: load → tachie/background/BGM → choice → official
// plugin activity → native save → restore → pause → teardown.

import Foundation
import Observation
import WebKit

struct PlayerMessage: @unchecked Sendable {
    let type: String
    let body: [String: Any]
    let receivedAt: Date
}

@MainActor
@Observable
final class PlayerSession: NSObject, WKScriptMessageHandler, WKNavigationDelegate {
    private(set) var webView: WKWebView?
    private(set) var log: [String] = []
    private(set) var step = "idle"
    private(set) var report: [String: Any] = [:]
    private var schemeHandler: PlayerSchemeHandler?
    private var messages: [PlayerMessage] = []
    private var waiters: [(id: UUID, predicate: (PlayerMessage) -> Bool, continuation: CheckedContinuation<PlayerMessage, Error>)] = []
    private var blockedNavigations: [String] = []

    enum SessionError: Error { case timeout(String), missingResources, engine(String) }

    // MARK: Setup

    static func bundledURL(_ path: String) -> URL? {
        Bundle.main.resourceURL?.appendingPathComponent(path)
    }

    /// Copies the bundled fixture into Documents so the player reads a real project directory.
    static func prepareProject() throws -> URL {
        let documents = try FileManager.default.url(for: .documentDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
        let target = documents.appendingPathComponent("projects/offline-player", isDirectory: true)
        guard let source = bundledURL("fixtures/offline-player") else { throw SessionError.missingResources }
        if FileManager.default.fileExists(atPath: target.path) {
            try FileManager.default.removeItem(at: target)
        }
        try FileManager.default.createDirectory(at: target.deletingLastPathComponent(), withIntermediateDirectories: true)
        try FileManager.default.copyItem(at: source, to: target)
        // A file outside the project root that the player must never be able to read.
        try Data("secret".utf8).write(to: documents.appendingPathComponent("projects/outside-secret.txt"))
        return target
    }

    /// Text sources only; media stays on disk and is streamed by the scheme handler.
    static func readProjectFiles(root: URL) throws -> [String: String] {
        let textExtensions: Set<String> = ["md", "json"]
        var files: [String: String] = [:]
        let enumerator = FileManager.default.enumerator(at: root, includingPropertiesForKeys: [.isRegularFileKey], options: [.skipsHiddenFiles])
        while let url = enumerator?.nextObject() as? URL {
            guard textExtensions.contains(url.pathExtension.lowercased()) else { continue }
            let relative = String(url.standardizedFileURL.path.dropFirst(root.standardizedFileURL.path.count + 1))
            files[relative] = try String(contentsOf: url, encoding: .utf8)
        }
        return files
    }

    func makeWebView(projectRoot: URL) throws -> WKWebView {
        guard let playerRoot = Self.bundledURL("out/player") else { throw SessionError.missingResources }
        let handler = PlayerSchemeHandler(playerRoot: playerRoot, projectRoot: projectRoot)
        let configuration = WKWebViewConfiguration()
        configuration.setURLSchemeHandler(handler, forURLScheme: PlayerSchemeHandler.scheme)
        configuration.websiteDataStore = .nonPersistent()
        configuration.allowsInlineMediaPlayback = true
        configuration.mediaTypesRequiringUserActionForPlayback = []
        configuration.defaultWebpagePreferences.allowsContentJavaScript = true
        configuration.preferences.javaScriptCanOpenWindowsAutomatically = false
        configuration.userContentController.add(WeakMessageHandler(self), name: "advPlayer")
        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = self
        webView.isInspectable = true
        webView.scrollView.isScrollEnabled = false
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.isOpaque = false
        webView.backgroundColor = .black
        schemeHandler = handler
        self.webView = webView
        return webView
    }

    func tearDown() {
        webView?.configuration.userContentController.removeScriptMessageHandler(forName: "advPlayer")
        webView?.stopLoading()
        webView?.removeFromSuperview()
        webView = nil
        schemeHandler = nil
    }

    // MARK: Bridge

    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        let body = message.body as? [String: Any] ?? [:]
        receive(PlayerMessage(type: body["type"] as? String ?? "?", body: body, receivedAt: Date()))
    }

    private func receive(_ message: PlayerMessage) {
        messages.append(message)
        if message.type != "state" || messages.filter({ $0.type == "state" }).count < 40 {
            append("← \(message.type) \(Self.summary(message.body))")
        }
        for waiter in waiters where waiter.predicate(message) {
            waiters.removeAll { $0.id == waiter.id }
            waiter.continuation.resume(returning: message)
        }
    }

    func send(_ message: [String: Any]) async throws {
        let data = try JSONSerialization.data(withJSONObject: message)
        let json = String(decoding: data, as: UTF8.self)
        append("→ \(message["type"] ?? "?")")
        _ = try await webView?.callAsyncJavaScript("advPlayerHost.receive(JSON.parse(json))", arguments: ["json": json], contentWorld: .page)
    }

    func wait(for description: String, timeout: Duration = .seconds(15), where predicate: @escaping (PlayerMessage) -> Bool) async throws -> PlayerMessage {
        if let existing = messages.last(where: predicate) { return existing }
        let id = UUID()
        return try await withCheckedThrowingContinuation { continuation in
            waiters.append((id, predicate, continuation))
            Task { @MainActor in
                try? await Task.sleep(for: timeout)
                if let index = waiters.firstIndex(where: { $0.id == id }) {
                    waiters.remove(at: index).continuation.resume(throwing: SessionError.timeout(description))
                }
            }
        }
    }

    private func clearMessages() { messages.removeAll() }

    // MARK: Navigation policy

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction) async -> WKNavigationActionPolicy {
        let url = navigationAction.request.url
        let allowed = url?.scheme == PlayerSchemeHandler.scheme && url?.host() == PlayerSchemeHandler.host
        if !allowed {
            blockedNavigations.append(url?.absoluteString ?? "nil")
        }
        return allowed ? .allow : .cancel
    }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        append("WebContent process terminated")
    }

    // MARK: Scenario

    func append(_ line: String) {
        let stamped = "\(Date().formatted(.dateTime.hour().minute().second().secondFraction(.fractional(3)))) \(line)"
        log.append(stamped)
        print("SPIKE-PLAYER \(line)")
    }

    private func mark(_ name: String) {
        step = name
        append("STEP \(name)")
        try? Self.writeProgress(name)
    }

    static func writeProgress(_ step: String) throws {
        let documents = try FileManager.default.url(for: .documentDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
        try Data(step.utf8).write(to: documents.appendingPathComponent("player-spike-step.txt"), options: .atomic)
    }

    /// Runs the full offline scenario. `hold` pauses at visual checkpoints for screenshots.
    func runScenario(hold: Duration = .seconds(3), attach: (WKWebView) -> Void) async {
        var result: [String: Any] = [:]
        let footprintBefore = MemoryProbe.physicalFootprint()
        let started = Date()
        do {
            mark("prepare")
            let projectRoot = try Self.prepareProject()
            let files = try Self.readProjectFiles(root: projectRoot)
            result["projectTextFiles"] = files.count

            guard let engineURL = EngineSpikeRunner.resourceURL("engine.min.js") else { throw SessionError.missingResources }
            let engineStarted = Date()
            let engine = try await EngineHost.load(scriptURL: engineURL)
            let input: [String: Any] = ["files": files, "options": ["plugins": ["star-map": "1.0.0", "civilization": "1.0.0"]], "baseUrl": PlayerSchemeHandler.baseURL.absoluteString]
            let response = try await engine.call("project.playerConfig", input: String(decoding: try JSONSerialization.data(withJSONObject: input), as: UTF8.self))
            await engine.unload()
            result["engineLoadAndCompileMs"] = Int(Date().timeIntervalSince(engineStarted) * 1000)
            guard let parsed = try JSONSerialization.jsonObject(with: Data(response.utf8)) as? [String: Any],
                  parsed["ok"] as? Bool == true,
                  let engineResult = parsed["result"] as? [String: Any],
                  let gameConfig = engineResult["gameConfig"] else {
                throw SessionError.engine(String(response.prefix(600)))
            }

            mark("open-player")
            clearMessages()
            let openStarted = Date()
            let webView = try makeWebView(projectRoot: projectRoot)
            attach(webView)
            webView.load(URLRequest(url: PlayerSchemeHandler.entryURL))
            let ready = try await wait(for: "ready") { $0.type == "ready" }
            result["readyMs"] = Int(ready.receivedAt.timeIntervalSince(openStarted) * 1000)
            result["secureContext"] = ready.body["secureContext"]
            result["hasSubtleCrypto"] = ready.body["hasSubtleCrypto"]
            result["userAgent"] = ready.body["userAgent"]

            try await send(["type": "load", "gameConfig": gameConfig])
            let loaded = try await wait(for: "loaded") { $0.type == "loaded" || $0.type == "error" }
            guard loaded.type == "loaded" else { throw SessionError.engine("player error: \(Self.summary(loaded.body))") }
            result["openToFirstNodeMs"] = Int(loaded.receivedAt.timeIntervalSince(openStarted) * 1000)
            result["playerInitMs"] = loaded.body["elapsedMs"]

            mark("first-scene")
            try await Task.sleep(for: hold)
            result["probeAfterLoad"] = try await probe("after-load")

            mark("advance-to-choice")
            var choiceState: PlayerMessage?
            for _ in 0..<12 {
                if let state = messages.last(where: { $0.type == "state" }), let choices = state.body["choices"] as? [String], !choices.isEmpty {
                    choiceState = state
                    break
                }
                clearMessages()
                try await send(["type": "advance"])
                _ = try? await wait(for: "state after advance", timeout: .seconds(3)) { $0.type == "state" }
            }
            guard let choiceState else { throw SessionError.timeout("choices never appeared") }
            result["choiceLabels"] = choiceState.body["choices"]
            result["choiceCursor"] = "\(choiceState.body["chapterId"] ?? "")#\(choiceState.body["nodeId"] ?? "")"
            try await Task.sleep(for: hold)

            mark("save")
            clearMessages()
            try await send(["type": "snapshot.request", "requestId": "slot-1"])
            let snapshot = try await wait(for: "snapshot") { $0.type == "snapshot" }
            let snapshotData = try JSONSerialization.data(withJSONObject: snapshot.body["snapshot"] ?? [:], options: [.sortedKeys])
            let savesDirectory = try FileManager.default.url(for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true).appendingPathComponent("saves", isDirectory: true)
            try FileManager.default.createDirectory(at: savesDirectory, withIntermediateDirectories: true)
            let saveURL = savesDirectory.appendingPathComponent("offline-player-slot-1.json")
            try snapshotData.write(to: saveURL, options: .atomic)
            result["snapshotBytes"] = snapshotData.count

            mark("choose-star-map")
            clearMessages()
            try await send(["type": "choose", "index": 0])
            let activity = try await wait(for: "activity") { $0.type == "state" && ($0.body["activity"] as? String) != nil }
            result["activity"] = activity.body["activity"]
            try await Task.sleep(for: hold)
            result["probeDuringActivity"] = try await probe("activity")

            mark("complete-activity")
            clearMessages()
            try await send(["type": "activity.complete", "result": ["matched": true, "score": 0.93]])
            let afterActivity = try await wait(for: "state after activity") { $0.type == "state" }
            result["afterActivityCursor"] = "\(afterActivity.body["chapterId"] ?? "")#\(afterActivity.body["nodeId"] ?? "")"
            result["probeAfterActivity"] = try await probe("after-activity")

            mark("restore")
            clearMessages()
            let restoredSnapshot = try JSONSerialization.jsonObject(with: Data(contentsOf: saveURL))
            try await send(["type": "restore", "requestId": "slot-1", "snapshot": restoredSnapshot])
            let restored = try await wait(for: "restored") { $0.type == "restored" }
            let restoredCursor = "\(restored.body["chapterId"] ?? "")#\(restored.body["nodeId"] ?? "")"
            result["restoredCursor"] = restoredCursor
            result["restoreMatchesSave"] = restoredCursor == result["choiceCursor"] as? String
            try await Task.sleep(for: hold)
            result["probeAfterRestore"] = try await probe("after-restore")

            mark("boundary")
            result["boundary"] = try await boundaryProbe()

            mark("pause")
            try await send(["type": "pause"])
            try await Task.sleep(for: .seconds(1))
            result["probeAfterPause"] = try await probe("after-pause")

            result["footprintWithPlayerMB"] = MemoryProbe.megabytes(MemoryProbe.physicalFootprint())
            result["servedRequests"] = schemeHandler?.servedLog ?? []
            result["refusedRequests"] = schemeHandler?.refusedLog ?? []
            result["blockedNavigations"] = blockedNavigations
            result["diagnostics"] = messages.filter { $0.type == "diagnostic" || $0.type == "error" }.map(\.body)

            mark("teardown")
            tearDown()
            try await Task.sleep(for: .seconds(2))
            result["footprintBeforeMB"] = MemoryProbe.megabytes(footprintBefore)
            result["footprintAfterCloseMB"] = MemoryProbe.megabytes(MemoryProbe.physicalFootprint())
            result["status"] = "passed"
        } catch {
            result["status"] = "failed"
            result["error"] = String(describing: error)
            result["servedRequests"] = schemeHandler?.servedLog ?? []
            result["refusedRequests"] = schemeHandler?.refusedLog ?? []
            append("FAILED \(error)")
        }
        result["totalMs"] = Int(Date().timeIntervalSince(started) * 1000)
        result["device"] = EngineSpikeRunner.deviceModel()
        result["system"] = ProcessInfo.processInfo.operatingSystemVersionString
        report = result
        persistReport(result)
        mark("done")
    }

    private func probe(_ label: String) async throws -> Any {
        let requestId = "probe-\(label)"
        clearMessages()
        try await send(["type": "probe", "requestId": requestId])
        let message = try await wait(for: requestId) { $0.type == "probe" && $0.body["requestId"] as? String == requestId }
        return message.body["report"] ?? [:]
    }

    /// Asks the page to fetch paths it must not reach and an external origin; records what happens.
    private func boundaryProbe() async throws -> Any {
        let script = """
        const attempts = ['/../outside-secret.txt', '/%2e%2e/outside-secret.txt', '/.git/config', '/__player/../../outside-secret.txt', 'https://example.com/']
        const results = {}
        for (const path of attempts) {
          try {
            const response = await fetch(path)
            results[path] = 'status ' + response.status + ' ' + (await response.text()).slice(0, 20)
          } catch (error) {
            results[path] = 'blocked: ' + error.message
          }
        }
        results.cookie = document.cookie
        results.localStorageKeys = Object.keys(localStorage)
        return results
        """
        return try await webView?.callAsyncJavaScript(script, arguments: [:], contentWorld: .page) ?? [:]
    }

    private func persistReport(_ report: [String: Any]) {
        guard JSONSerialization.isValidJSONObject(report),
              let data = try? JSONSerialization.data(withJSONObject: report, options: [.prettyPrinted, .sortedKeys]),
              let documents = try? FileManager.default.url(for: .documentDirectory, in: .userDomainMask, appropriateFor: nil, create: true) else {
            append("report not serializable")
            return
        }
        try? data.write(to: documents.appendingPathComponent("player-spike-report.json"), options: .atomic)
        print("SPIKE-PLAYER-REPORT \(String(decoding: data, as: UTF8.self))")
    }

    static func summary(_ body: [String: Any]) -> String {
        var trimmed = body
        trimmed.removeValue(forKey: "snapshot")
        trimmed.removeValue(forKey: "report")
        trimmed.removeValue(forKey: "type")
        guard JSONSerialization.isValidJSONObject(trimmed),
              let data = try? JSONSerialization.data(withJSONObject: trimmed, options: [.sortedKeys]) else { return "" }
        return String(String(decoding: data, as: UTF8.self).prefix(240))
    }
}

/// Breaks the WKUserContentController → handler retain cycle.
private final class WeakMessageHandler: NSObject, WKScriptMessageHandler {
    weak var target: (any WKScriptMessageHandler)?
    init(_ target: any WKScriptMessageHandler) { self.target = target }
    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        target?.userContentController(controller, didReceive: message)
    }
}
