// SPIKE (P0 feasibility): hosts the restricted player WebView and its log.

import SwiftUI
import WebKit

final class PlayerContainerView: UIView {
    func attach(_ webView: WKWebView) {
        subviews.forEach { $0.removeFromSuperview() }
        webView.frame = bounds
        webView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        addSubview(webView)
    }
}

struct PlayerContainer: UIViewRepresentable {
    let view: PlayerContainerView
    func makeUIView(context: Context) -> PlayerContainerView { view }
    func updateUIView(_ uiView: PlayerContainerView, context: Context) {}
}

struct PlayerSpikeView: View {
    @State private var session = PlayerSession()
    @State private var container = PlayerContainerView()
    @State private var running = false

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                PlayerContainer(view: container)
                    .aspectRatio(16 / 9, contentMode: .fit)
                    .background(.black)
                    .accessibilityIdentifier("player.container")
                List {
                    Section {
                        Button(running ? "Running \(session.step)…" : "Run offline scenario") {
                            Task { await run() }
                        }
                        .disabled(running)
                        if let status = session.report["status"] as? String {
                            LabeledContent("Status", value: status)
                        }
                    }
                    Section("Log") {
                        ForEach(Array(session.log.suffix(80).enumerated()), id: \.offset) { _, line in
                            Text(line).font(.caption2.monospaced())
                        }
                    }
                }
            }
            .navigationTitle("Player spike")
            .navigationBarTitleDisplayMode(.inline)
        }
        .task {
            if SpikeLaunch.has("-autorunPlayer") {
                await run()
            }
        }
    }

    private func run() async {
        running = true
        defer { running = false }
        await session.runScenario { webView in
            container.attach(webView)
        }
    }
}
