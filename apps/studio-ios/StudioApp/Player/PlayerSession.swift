import Foundation
import Observation
import OSLog
import StudioKit
import WebKit

struct PlayerIssue: Identifiable {
    let id = UUID()
    let code: String
    let message: String
    let location: SourceLocation?

    init(code: String, message: String, location: SourceLocation? = nil) {
        self.code = code
        self.message = message
        self.location = location
    }

    init(_ diagnostic: EngineDiagnostic) {
        self.init(code: diagnostic.code, message: diagnostic.message, location: diagnostic.location)
    }
}

struct PlayerLaunch: Identifiable {
    let id = UUID()
    let projectRoot: URL
    let paths: [String]
    let build: EnginePlayerBuild
    let start: RuntimeAddress
}

nonisolated struct PlayerFold: Equatable, Sendable {
    enum Axis: String { case horizontal, vertical }

    let axis: Axis
    let start: Double
    let end: Double

    init?(frame: CGRect, bounds: CGSize) {
        let horizontal = frame.width > frame.height
        let length = horizontal ? bounds.height : bounds.width
        let lower = horizontal ? frame.minY : frame.minX
        let upper = horizontal ? frame.maxY : frame.maxX
        // A reserved region can touch an edge on the closed display.
        guard lower > 0, lower <= upper, upper < length else { return nil }
        axis = horizontal ? .horizontal : .vertical
        start = lower / length
        end = upper / length
    }

    var properties: [String: Any] { ["axis": axis.rawValue, "start": start, "end": end] }
}

@MainActor
@Observable
final class PlayerSession: NSObject, WKScriptMessageHandler, WKNavigationDelegate {
    enum Command: String { case restart, back, chapter, pause, resume, dispose }
    enum StartupStage: Int, CaseIterable {
        case preparing, openingWebView, loadingResources, renderingScene

        var title: LocalizedStringResource {
            switch self {
            case .preparing: "Preparing the offline player"
            case .openingWebView: "Opening the game view"
            case .loadingResources: "Loading the bundled runtime"
            case .renderingScene: "Rendering the first scene"
            }
        }
    }

    private enum Phase: Equatable {
        case idle, starting(StartupStage), playing, closed
    }

    var startupStage: StartupStage? {
        switch phase {
        case .idle: .preparing
        case .starting(let stage): stage
        case .playing, .closed: nil
        }
    }

    private struct Event: Decodable {
        enum Kind: String, Decodable { case ready, loaded, diagnostic }
        let type: Kind
        let `protocol`: Int
        let chapterId: String?
        let nodeId: String?
        let code: String?
        let severity: EngineDiagnostic.Severity?
        let message: String?
    }

    private struct Request: Encodable {
        let `protocol` = 1
        let type: String
        let chapterId: String?
    }

    let launch: PlayerLaunch
    private(set) var webView: WKWebView?
    private(set) var isPlaying = false
    private(set) var issue: PlayerIssue?
    private(set) var address: RuntimeAddress?
    private var phase = Phase.idle
    private var schemeHandler: PlayerSchemeHandler?
    private var timeout: Task<Void, Never>?
    private var active = true
    private var mediaSuspended = false
    @ObservationIgnored private var fold: PlayerFold?
    @ObservationIgnored private var loadedFold: PlayerFold?
    // Safe to share across windows. The rules contain no project/session data.
    private static var cachedRules: WKContentRuleList?
    private let logger = Logger(subsystem: "org.advjs.studio", category: "OfflinePlayer")

    init(launch: PlayerLaunch) {
        self.launch = launch
    }

    func open() async {
        guard phase == .idle else { return }
        phase = .starting(.preparing)
        logger.info("Preparing WebKit player")
        Self.logFootprint("before WebView", with: logger)
        guard let resourceRoot = Bundle.main.resourceURL?.appending(path: "OfflinePlayer.bundle"),
              let html = try? String(contentsOf: resourceRoot.appending(path: "index.html"), encoding: .utf8) else {
            fail("PLAYER_BUNDLE_MISSING", String(localized: "The offline player is missing from this build."))
            return
        }
        trackStartupProgress()
        do {
            let rules = try await Self.contentRules()
            guard !Task.isCancelled, phase == .starting(.preparing) else { return }
            let handler = PlayerSchemeHandler(playerRoot: resourceRoot, projectRoot: launch.projectRoot, projectPaths: launch.paths) {
                [weak self] code, path in
                self?.issue = PlayerIssue(code: code, message: String(localized: "Couldn’t load resource “\(path)”."))
            }
            let configuration = WKWebViewConfiguration()
            configuration.websiteDataStore = .nonPersistent()
            configuration.setURLSchemeHandler(handler, forURLScheme: PlayerSchemeHandler.scheme)
            configuration.allowsInlineMediaPlayback = true
            configuration.mediaTypesRequiringUserActionForPlayback = []
            configuration.defaultWebpagePreferences.allowsContentJavaScript = true
            configuration.preferences.javaScriptCanOpenWindowsAutomatically = false
            configuration.userContentController.add(rules)
            configuration.userContentController.add(WeakPlayerHandler(self), name: "advPlayer")
            configuration.userContentController.addUserScript(WKUserScript(
                source: """
                const report = (code, message) => window.webkit.messageHandlers.advPlayer.postMessage(
                    { protocol: 1, type: 'diagnostic', severity: 'error', code, message }
                );
                window.addEventListener('error', event => {
                    if (event.target?.tagName === 'SCRIPT')
                        report('PLAYER_BUNDLE_SCRIPT', 'The bundled player script could not be loaded.');
                }, true);
                """,
                injectionTime: .atDocumentStart, forMainFrameOnly: true
            ))
            let webView = WKWebView(frame: .zero, configuration: configuration)
            webView.navigationDelegate = self
            webView.scrollView.contentInsetAdjustmentBehavior = .never
            webView.scrollView.isScrollEnabled = false
            webView.isOpaque = false
            webView.backgroundColor = .black
            schemeHandler = handler
            self.webView = webView
            startNavigation(in: webView, html: html)
            setActive(active)
        }
        catch {
            fail("PLAYER_RESTRICTIONS", String(localized: "Couldn’t initialize offline playback."))
        }
    }

    private static func contentRules() async throws -> WKContentRuleList {
        if let cachedRules { return cachedRules }
        guard let store = WKContentRuleListStore.default() else { throw URLError(.cannotLoadFromNetwork) }
        let identifier = "advjs-offline-player-v1"
        if let existing = try? await store.contentRuleList(forIdentifier: identifier) {
            cachedRules = existing
            return existing
        }
        guard let rules = try await store.compileContentRuleList(
            forIdentifier: identifier,
            encodedContentRuleList: #"[{"trigger":{"url-filter":"^http"},"action":{"type":"block"}},{"trigger":{"url-filter":"^ws"},"action":{"type":"block"}},{"trigger":{"url-filter":"^ftp:"},"action":{"type":"block"}},{"trigger":{"url-filter":"^file:"},"action":{"type":"block"}}]"#
        ) else { throw URLError(.cannotLoadFromNetwork) }
        cachedRules = rules
        return rules
    }

    private func startNavigation(in webView: WKWebView, html: String) {
        phase = .starting(.openingWebView)
        logger.info("Loading bundled player page")
        let request = URLRequest(url: PlayerSchemeHandler.entryURL)
        // Serve the trusted entry document directly, with its original URL for
        // relative bundled assets. Project media still uses the restricted scheme.
        webView.loadSimulatedRequest(request, responseHTML: html)
        trackStartupProgress()
    }

    /// Allow time for each launch milestone while still detecting a stalled WebKit process.
    private func trackStartupProgress() {
        timeout?.cancel()
        timeout = Task { [weak self] in
            try? await Task.sleep(for: .seconds(30))
            guard !Task.isCancelled, let self, case .starting(let stage) = phase else { return }
            logger.error("Offline player timed out in launch step \(stage.rawValue + 1, privacy: .public)")
            fail("PLAYER_TIMEOUT", String(localized: "The offline player took too long to start."))
        }
    }

    func close() {
        guard phase != .closed else { return }
        phase = .closed
        timeout?.cancel()
        timeout = nil
        if let webView {
            webView.setAllMediaPlaybackSuspended(true, completionHandler: nil)
            webView.evaluateJavaScript("globalThis.advPlayerHost?.receive({type:'dispose',protocol:1})", completionHandler: nil)
            webView.configuration.userContentController.removeScriptMessageHandler(forName: "advPlayer")
            webView.stopLoading()
            webView.navigationDelegate = nil
            webView.removeFromSuperview()
        }
        schemeHandler?.close()
        schemeHandler = nil
        Task { [weak releasedView = webView, logger] in
            try? await Task.sleep(for: .seconds(2))
            logger.info("WebView retained after close: \(releasedView != nil, privacy: .public)")
            Self.logFootprint("2 seconds after close", with: logger)
        }
        webView = nil
        logger.info("Closed offline player session")
    }

    func setActive(_ active: Bool) {
        self.active = active
        if let webView, mediaSuspended == active {
            mediaSuspended = !active
            let suspended = mediaSuspended
            webView.setAllMediaPlaybackSuspended(suspended) { [logger] in
                logger.info("WebKit media suspension completed: \(suspended, privacy: .public)")
            }
        }
        if phase == .playing { send(active ? .resume : .pause) }
    }

    func send(_ command: Command, chapterId: String? = nil) {
        guard isPlaying, phase == .playing else { return }
        Task {
            do {
                let data = try JSONEncoder().encode(Request(type: command.rawValue, chapterId: chapterId))
                try await dispatch(String(decoding: data, as: UTF8.self))
            }
            catch {
                guard isPlaying else { return }
                fail("PLAYER_BRIDGE", String(localized: "The offline player couldn’t complete the command."))
            }
        }
    }

    func updateFold(_ newValue: PlayerFold?) {
        guard fold != newValue else { return }
        fold = newValue
        sendFold()
    }

    private func sendFold() {
        guard phase == .playing else { return }
        let value = fold
        Task {
            guard phase == .playing, fold == value else { return }
            do {
                let data = try JSONSerialization.data(withJSONObject: [
                    "type": "fold", "protocol": 1, "fold": value?.properties as Any? ?? NSNull(),
                ])
                try await dispatch(String(decoding: data, as: UTF8.self))
            }
            catch { logger.debug("Could not update the player fold layout") }
        }
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard phase != .closed, message.name == "advPlayer", message.webView === webView,
              message.frameInfo.isMainFrame,
              webView?.url == PlayerSchemeHandler.entryURL || message.frameInfo.request.url == PlayerSchemeHandler.entryURL else { return }
        guard let data = try? JSONSerialization.data(withJSONObject: message.body, options: [.fragmentsAllowed]),
              let event = try? JSONDecoder().decode(Event.self, from: data), event.protocol == 1 else {
            fail("PLAYER_PROTOCOL", String(localized: "The offline player sent an invalid message."))
            return
        }
        switch event.type {
        case .ready:
            guard phase == .starting(.openingWebView) || phase == .starting(.loadingResources) else { return }
            phase = .starting(.renderingScene)
            logger.info("Offline player bridge ready")
            trackStartupProgress()
            Task { await load() }
        case .loaded:
            guard phase == .starting(.renderingScene), let chapter = event.chapterId, let node = event.nodeId else { return }
            timeout?.cancel()
            address = RuntimeAddress(chapterId: chapter, nodeId: node)
            phase = .playing
            isPlaying = true
            if issue?.code == "PLAYER_TIMEOUT" { issue = nil }
            logger.info("Offline player rendered its first node")
            Self.logFootprint("first node", with: logger)
            setActive(active)
            // The display may have changed while the first node was rendering.
            if fold != loadedFold { sendFold() }
        case .diagnostic:
            guard let code = event.code, let text = event.message, let severity = event.severity else { return }
            if code == "PLAYER_BUNDLE_SCRIPT" {
                fail(code, String(localized: "Couldn’t load the offline player."))
            }
            else if severity == .error && !isPlaying { fail(code, text) }
            else { issue = PlayerIssue(code: code, message: text) }
        }
    }

    private func load() async {
        do {
            guard let config = launch.build.gameConfigJSON, let program = launch.build.programJSON else {
                fail("PLAYER_BUILD", String(localized: "The project couldn’t be prepared for playback."))
                return
            }
            loadedFold = fold
            let locale = Bundle.main.preferredLocalizations.first?.hasPrefix("zh") == true ? "zh-CN" : "en"
            let properties = try JSONSerialization.data(withJSONObject: [
                "type": "load", "protocol": 1, "colorScheme": launch.build.colorScheme.rawValue,
                "locale": locale,
                "fold": fold?.properties as Any? ?? NSNull(),
                "gameConfig": JSONSerialization.jsonObject(with: config),
                "program": JSONSerialization.jsonObject(with: program),
                "address": ["chapterId": launch.start.chapterId, "nodeId": launch.start.nodeId],
            ])
            try await dispatch(String(decoding: properties, as: UTF8.self))
        }
        catch {
            fail("PLAYER_BRIDGE", String(localized: "The offline player couldn’t start the game."))
        }
    }

    private func dispatch(_ json: String) async throws {
        guard let webView, phase != .closed else { return }
        _ = try await webView.callAsyncJavaScript(
            "return await globalThis.advPlayerHost.receive(JSON.parse(json))",
            arguments: ["json": json], in: nil, contentWorld: .page
        )
    }

    private static func logFootprint(_ point: String, with logger: Logger) {
        guard let bytes = ProcessMemory.footprint() else { return }
        logger.info("StudioApp footprint \(point, privacy: .public): \(bytes, privacy: .public) bytes")
    }

    private func fail(_ code: String, _ text: String) {
        guard phase != .closed else { return }
        logger.error("Offline player reported \(code, privacy: .public)")
        issue = PlayerIssue(code: code, message: text)
        if !isPlaying { timeout?.cancel() }
    }

    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction,
                 decisionHandler: @escaping @MainActor (WKNavigationActionPolicy) -> Void) {
        let allowed = phase == .starting(.openingWebView) && action.request.url == PlayerSchemeHandler.entryURL
            && action.targetFrame?.isMainFrame == true
        logger.info("Bundled navigation policy: \(allowed, privacy: .public)")
        if allowed { trackStartupProgress() }
        decisionHandler(allowed ? .allow : .cancel)
    }

    func webView(_ webView: WKWebView, didCommit navigation: WKNavigation!) {
        logger.info("Bundled player page committed")
        if phase == .starting(.openingWebView) {
            phase = .starting(.loadingResources)
            trackStartupProgress()
        }
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        logger.info("Bundled player page navigation finished")
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: any Error) {
        fail("PLAYER_NAVIGATION", String(localized: "Couldn’t load the offline player."))
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: any Error) {
        fail("PLAYER_NAVIGATION", String(localized: "Couldn’t load the offline player."))
    }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        isPlaying = false
        fail("PLAYER_TERMINATED", String(localized: "The game stopped. Close the player and try again."))
    }
}

private final class WeakPlayerHandler: NSObject, WKScriptMessageHandler {
    weak var session: PlayerSession?

    init(_ session: PlayerSession) { self.session = session }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        session?.userContentController(userContentController, didReceive: message)
    }
}
