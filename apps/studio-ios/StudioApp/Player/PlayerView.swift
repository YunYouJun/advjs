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
        NavigationStack {
            ZStack {
                Color.black.ignoresSafeArea()
                if let webView = session.webView {
                    PlayerSurface(webView: webView, orientation: session.launch.build.orientation)
                        .id(ObjectIdentifier(webView))
                        .allowsHitTesting(session.isPlaying)
                        .accessibilityHidden(!session.isPlaying)
                        .onGeometryChange(for: PlayerFold?.self) { geometry in
                            #if compiler(>=6.4) && !ADVJS_NO_FOLD_GEOMETRY
                            guard #available(iOS 27.1, *) else { return nil }
                            return geometry.reservedRegions(kind: .division, layoutDirectionBehavior: .fixed)
                                .lazy.compactMap { PlayerFold(frame: $0.frame, bounds: geometry.size) }.first
                            #else
                            return nil
                            #endif
                        } action: { session.updateFold($0) }
                        .ignoresSafeArea(.container)
                }
                if let stage = session.startupStage, session.issue == nil {
                    startupProgress(stage)
                }
            }
            .safeAreaInset(edge: .top, spacing: 0) {
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
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackgroundVisibility(.hidden, for: .navigationBar)
            .toolbar { controls }
        }
        .persistentSystemOverlays(.hidden)
        .task(id: ObjectIdentifier(session)) {
            session.setActive(phase == .active)
            await session.open()
        }
        .onDisappear { session.close() }
        .onChange(of: phase, initial: true) { _, phase in session.setActive(phase == .active) }
    }

    private func startupProgress(_ stage: PlayerSession.StartupStage) -> some View {
        let total = PlayerSession.StartupStage.allCases.count
        let step = Text("Step \(stage.rawValue + 1) of \(total)")
        return VStack(alignment: .leading, spacing: 12) {
            Text("Starting Game…")
                .font(.headline)
            ProgressView(value: Double(stage.rawValue), total: Double(total)) {
                Text(stage.title)
                    .foregroundStyle(.white)
            } currentValueLabel: {
                step
                    .monospacedDigit()
                    .foregroundStyle(.white.opacity(0.75))
            }
            .progressViewStyle(.linear)
            .accessibilityValue(step)
            .tint(.white)
        }
        .foregroundStyle(.white)
        .padding(20)
        .frame(maxWidth: 360)
        .background(.black, in: .rect(cornerRadius: 12))
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("player-loading")
    }

    @ToolbarContentBuilder
    private var controls: some ToolbarContent {
        ToolbarItem(placement: .topBarLeading) {
            Button("Close Player", systemImage: "xmark") {
                session.close()
                dismiss()
            }
            .labelStyle(.iconOnly)
            .accessibilityIdentifier("close-player")
        }
        ToolbarItemGroup(placement: .topBarTrailing) {
            Button("Step Back", systemImage: "backward.end") { session.send(.back) }
                .labelStyle(.iconOnly)
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
                Label("Playback Options", systemImage: "ellipsis")
                    .labelStyle(.iconOnly)
            }
            .accessibilityIdentifier("player-options")
            .disabled(!session.isPlaying)
        }
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
