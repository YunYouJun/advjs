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

@MainActor
@Observable
final class PlayerSession: NSObject, WKScriptMessageHandler, WKNavigationDelegate {
    enum Command: String { case restart, back, chapter, pause, resume, dispose }
    private enum Phase { case idle, waiting, loading, playing, closed }

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
    #if DEBUG
    private var audioMeasurement: Task<Void, Never>?
    #endif
    private var active = true
    private var mediaSuspended = false
    private let logger = Logger(subsystem: "org.advjs.studio", category: "OfflinePlayer")

    init(launch: PlayerLaunch) {
        self.launch = launch
    }

    func open() async {
        guard phase == .idle else { return }
        phase = .waiting
        guard let resourceRoot = Bundle.main.resourceURL?.appending(path: "OfflinePlayer.bundle"),
              FileManager.default.fileExists(atPath: resourceRoot.appending(path: "index.html").path) else {
            fail("PLAYER_BUNDLE_MISSING", String(localized: "The offline player is missing from this build."))
            return
        }
        do {
            guard let rules = try await WKContentRuleListStore.default().compileContentRuleList(
                forIdentifier: "advjs-offline-player-v1",
                encodedContentRuleList: #"[{"trigger":{"url-filter":"^http"},"action":{"type":"block"}},{"trigger":{"url-filter":"^ws"},"action":{"type":"block"}},{"trigger":{"url-filter":"^ftp:"},"action":{"type":"block"}},{"trigger":{"url-filter":"^file:"},"action":{"type":"block"}}]"#
            ) else { throw URLError(.cannotLoadFromNetwork) }
            guard !Task.isCancelled, phase == .waiting else { return }
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
            #if DEBUG
            if PlayerAudioTestProbe.enabled {
                configuration.userContentController.addUserScript(PlayerAudioTestProbe.script)
            }
            #endif
            let webView = WKWebView(frame: .zero, configuration: configuration)
            webView.navigationDelegate = self
            webView.scrollView.contentInsetAdjustmentBehavior = .never
            webView.scrollView.isScrollEnabled = false
            webView.isOpaque = false
            webView.backgroundColor = .black
            schemeHandler = handler
            self.webView = webView
            webView.load(URLRequest(url: PlayerSchemeHandler.entryURL))
            logger.info("Loading bundled player page")
            timeout = Task { [weak self] in
                try? await Task.sleep(for: .seconds(30))
                guard !Task.isCancelled, let self, !isPlaying else { return }
                fail("PLAYER_TIMEOUT", String(localized: "The offline player took too long to start."))
            }
            setActive(active)
        }
        catch {
            fail("PLAYER_RESTRICTIONS", String(localized: "Couldn’t initialize offline playback."))
        }
    }

    func close() {
        guard phase != .closed else { return }
        phase = .closed
        timeout?.cancel()
        timeout = nil
        #if DEBUG
        audioMeasurement?.cancel()
        audioMeasurement = nil
        #endif
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
        webView = nil
    }

    func setActive(_ active: Bool) {
        self.active = active
        if let webView, mediaSuspended == active {
            mediaSuspended = !active
            webView.setAllMediaPlaybackSuspended(mediaSuspended, completionHandler: nil)
        }
        if phase == .playing { send(active ? .resume : .pause) }
    }

    func send(_ command: Command, chapterId: String? = nil) {
        guard phase == .playing else { return }
        Task {
            do {
                let data = try JSONEncoder().encode(Request(type: command.rawValue, chapterId: chapterId))
                try await dispatch(String(decoding: data, as: UTF8.self))
            }
            catch {
                fail("PLAYER_BRIDGE", String(localized: "The offline player couldn’t complete the command."))
            }
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
            guard phase == .waiting else { return }
            phase = .loading
            logger.info("Offline player bridge ready")
            Task { await load() }
        case .loaded:
            guard phase == .loading, let chapter = event.chapterId, let node = event.nodeId else { return }
            timeout?.cancel()
            address = RuntimeAddress(chapterId: chapter, nodeId: node)
            phase = .playing
            isPlaying = true
            if issue?.code == "PLAYER_TIMEOUT" { issue = nil }
            logger.info("Offline player rendered its first node")
            #if DEBUG
            if PlayerAudioTestProbe.enabled, let webView {
                audioMeasurement = Task { await PlayerAudioTestProbe.measure(in: webView) }
            }
            #endif
            setActive(active)
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
            let properties = try JSONSerialization.data(withJSONObject: [
                "type": "load", "protocol": 1, "colorScheme": launch.build.colorScheme.rawValue,
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

    private func fail(_ code: String, _ text: String) {
        guard phase != .closed else { return }
        logger.error("Offline player reported \(code, privacy: .public)")
        issue = PlayerIssue(code: code, message: text)
        if !isPlaying { timeout?.cancel() }
    }

    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction) async -> WKNavigationActionPolicy {
        let allowed = phase == .waiting && action.request.url == PlayerSchemeHandler.entryURL
            && action.targetFrame?.isMainFrame != false
        logger.info("Bundled navigation policy: \(allowed, privacy: .public)")
        return allowed ? .allow : .cancel
    }

    func webView(_ webView: WKWebView, didCommit navigation: WKNavigation!) {
        logger.info("Bundled player page committed")
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
