import StudioKit
import SwiftUI
import WebKit

struct PlayerView: View {
    @State private var session: PlayerSession
    @Environment(\.dismiss) private var dismiss
    @Environment(\.scenePhase) private var phase

    init(launch: PlayerLaunch) {
        _session = State(initialValue: PlayerSession(launch: launch))
    }

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()
            if let webView = session.webView {
                PlayerSurface(webView: webView, orientation: session.launch.build.orientation)
                    .id(ObjectIdentifier(webView))
                    .ignoresSafeArea(edges: [.horizontal, .bottom])
            }
            if !session.isPlaying, session.issue == nil {
                ProgressView("Starting Game…").tint(.white).foregroundStyle(.white)
                    .accessibilityIdentifier("player-loading")
            }
        }
        .persistentSystemOverlays(.hidden)
        .safeAreaInset(edge: .top, spacing: 0) {
            VStack(spacing: 0) {
                controls
                if let issue = session.issue {
                    VStack(alignment: .leading, spacing: 8) {
                        IssueRow(isError: true, message: issue.message, location: issue.code)
                            .accessibilityIdentifier("player-diagnostic")
                        if issue.code == "PLAYER_TIMEOUT" || issue.code == "PLAYER_TERMINATED" {
                            Button("Try Again") {
                                let launch = session.launch
                                session.close()
                                session = PlayerSession(launch: launch)
                            }
                            .accessibilityIdentifier("player-retry")
                        }
                    }
                    .padding()
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(.bar)
                }
            }
        }
        .task(id: ObjectIdentifier(session)) {
            session.setActive(phase == .active)
            await session.open()
        }
        .onDisappear { session.close() }
        .onChange(of: phase, initial: true) { _, phase in session.setActive(phase == .active) }
    }

    private var controls: some View {
        HStack {
            Button("Close Player", systemImage: "xmark") {
                session.close()
                dismiss()
            }
            .accessibilityIdentifier("close-player")
            Spacer()
            Button("Step Back", systemImage: "backward.end") { session.send(.back) }
                .accessibilityIdentifier("player-back")
                .disabled(!session.isPlaying)
            Menu {
                Button("Restart", systemImage: "arrow.counterclockwise") { session.send(.restart) }
                    .accessibilityIdentifier("player-restart")
                if let program = session.launch.build.program {
                    Section("Chapters") {
                        ForEach(program.chapters.keys.sorted(), id: \.self) { id in
                            Button(program.chapters[id]?.title ?? id) { session.send(.chapter, chapterId: id) }
                                .accessibilityIdentifier("player-chapter-\(id)")
                        }
                    }
                }
            } label: {
                Label("Playback Options", systemImage: "ellipsis.circle")
            }
            .accessibilityIdentifier("player-options")
            .disabled(!session.isPlaying)
        }
        .labelStyle(.iconOnly)
        .buttonStyle(.bordered)
        .padding(.horizontal)
        .padding(.vertical, 6)
        .background(.bar)
    }
}

private struct PlayerSurface: UIViewControllerRepresentable {
    let webView: WKWebView
    let orientation: EnginePlayerBuild.Orientation

    func makeUIViewController(context: Context) -> Controller {
        Controller(webView: webView, orientation: orientation)
    }

    func updateUIViewController(_ controller: Controller, context: Context) {}

    final class Controller: UIViewController {
        let webView: WKWebView
        let orientation: EnginePlayerBuild.Orientation
        private var previous: UIInterfaceOrientationMask?

        init(webView: WKWebView, orientation: EnginePlayerBuild.Orientation) {
            self.webView = webView
            self.orientation = orientation
            super.init(nibName: nil, bundle: nil)
        }

        @available(*, unavailable)
        required init?(coder: NSCoder) { fatalError() }

        override func loadView() { view = webView }

        override var prefersHomeIndicatorAutoHidden: Bool { true }

        override func viewDidAppear(_ animated: Bool) {
            super.viewDidAppear(animated)
            guard orientation != .system, let scene = view.window?.windowScene else { return }
            let current = scene.effectiveGeometry.interfaceOrientation
            previous = UIInterfaceOrientationMask(rawValue: 1 << current.rawValue)
            scene.requestGeometryUpdate(.iOS(interfaceOrientations: orientation == .landscape ? .landscape : .portrait))
        }

        override func viewWillDisappear(_ animated: Bool) {
            super.viewWillDisappear(animated)
            if let previous {
                view.window?.windowScene?.requestGeometryUpdate(.iOS(interfaceOrientations: previous))
            }
        }
    }
}
