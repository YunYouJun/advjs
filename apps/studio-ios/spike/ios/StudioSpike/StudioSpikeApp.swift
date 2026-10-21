// SPIKE (P0 feasibility): a throwaway harness for the engine, player and
// sign-in probes. Production UI starts in P2 under apps/studio-ios/StudioApp.

import SwiftUI

@main
struct StudioSpikeApp: App {
    @State private var selection = SpikeLaunch.has("-autorunPlayer") ? "player" : SpikeLaunch.has("-openSignIn") || SpikeLaunch.has("-autorunSignIn") || SpikeLaunch.has("-autorunSignInNative") || SpikeLaunch.has("-autorunSignInScheme") ? "signin" : "engine"

    var body: some Scene {
        WindowGroup {
            TabView(selection: $selection) {
                Tab("Engine", systemImage: "gearshape.2", value: "engine") {
                    EngineSpikeView()
                }
                Tab("Player", systemImage: "play.rectangle", value: "player") {
                    PlayerSpikeView()
                }
                Tab("Sign In", systemImage: "person.badge.key", value: "signin") {
                    SignInSpikeView()
                }
            }
        }
    }
}

enum SpikeLaunch {
    static func has(_ flag: String) -> Bool {
        ProcessInfo.processInfo.arguments.contains(flag)
    }
}

struct EngineSpikeView: View {
    @State private var report: EngineSpikeReport?
    @State private var failure: String?
    @State private var running = false

    var body: some View {
        NavigationStack {
            List {
                Section {
                    Button(running ? "Running…" : "Run golden cases (minified)") {
                        Task { await run(script: "engine.min.js") }
                    }
                    .disabled(running)
                    Button("Run golden cases (unminified)") {
                        Task { await run(script: "engine.js") }
                    }
                    .disabled(running)
                }
                if let failure {
                    Section("Failure") { Text(failure).font(.footnote.monospaced()) }
                }
                if let report {
                    Section("Parity") {
                        LabeledContent("Cases", value: "\(report.caseCount)")
                        LabeledContent("Mismatches", value: "\(report.mismatches.count)")
                            .accessibilityIdentifier("engine.mismatches")
                        ForEach(report.mismatches, id: \.self) { Text($0).font(.caption.monospaced()) }
                    }
                    Section("Load") {
                        LabeledContent("Script", value: "\(report.script) · \(report.load.scriptBytes / 1024) KiB")
                        LabeledContent("Evaluate", value: String(format: "%.1f ms", report.load.evaluateSeconds * 1000))
                        LabeledContent("Cold run", value: String(format: "%.1f ms", report.coldRunMilliseconds))
                        LabeledContent("Warm run", value: String(format: "%.1f ms", report.warmRunMilliseconds))
                    }
                    Section("Footprint (MB)") {
                        LabeledContent("Baseline", value: "\(report.footprintBaselineMB)")
                        LabeledContent("After load", value: "\(report.footprintAfterLoadMB)")
                        LabeledContent("After cold run", value: "\(report.footprintAfterColdRunMB)")
                        LabeledContent("After warm run", value: "\(report.footprintAfterWarmRunMB)")
                        LabeledContent("After unload", value: "\(report.footprintAfterUnloadMB)")
                    }
                    Section("Compile") {
                        ForEach(report.compileTimings, id: \.name) { timing in
                            LabeledContent(timing.name, value: String(format: "%.1f / %.1f ms", timing.coldMilliseconds, timing.warmMilliseconds))
                                .font(.caption)
                        }
                    }
                }
            }
            .navigationTitle("Engine spike")
        }
        .task {
            if SpikeLaunch.has("-autorunEngine") {
                await run(script: "engine.min.js")
            }
        }
    }

    private func run(script: String) async {
        running = true
        defer { running = false }
        do {
            report = try await EngineSpikeRunner.run(script: script)
            failure = nil
        } catch {
            failure = String(describing: error)
        }
    }
}
