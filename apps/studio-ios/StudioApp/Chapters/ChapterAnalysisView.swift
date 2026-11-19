import StudioKit
import SwiftUI

struct ChapterAnalysisView: View {
    let session: ProjectSession
    @Environment(PlaytestCoordinator.self) private var playtest
    @State private var compilation: EngineCompilation?
    @State private var failed = false

    private var input: EngineProjectInput? { try? session.sourceInput(.draft) }

    var body: some View {
        List {
            if let compilation {
                Section("Diagnostics") {
                    if compilation.diagnostics.isEmpty {
                        Text("No Problems Found").foregroundStyle(.secondary)
                    }
                    ForEach(Array(compilation.diagnostics.enumerated()), id: \.offset) { _, issue in
                        if let location = issue.location {
                            NavigationLink(value: location.path.hasSuffix(".adv.md") ? ProjectRoute.source(location) : ProjectRoute.file(location.path)) { row(issue) }
                                .accessibilityIdentifier("diagnostic-\(issue.code)")
                        }
                        else { row(issue) }
                    }
                }
                if let program = compilation.project.program {
                    Section("Program Nodes") {
                        ForEach(program.chapters.keys.sorted(), id: \.self) { chapter in
                            ForEach(program.chapters[chapter]?.order ?? [], id: \.self) { node in
                                if let location = compilation.sourceMap.nodes?["\(chapter)#\(node)"] {
                                    NavigationLink(value: location.path.hasSuffix(".adv.md") ? ProjectRoute.source(location) : ProjectRoute.file(location.path)) {
                                        LabeledContent(node, value: location.display)
                                    }
                                    .accessibilityIdentifier("program-node-\(chapter)-\(node)")
                                    .contextMenu {
                                        Button("Play from This Node", systemImage: "play") {
                                            playtest.offer(session, start: .node(RuntimeAddress(chapterId: chapter, nodeId: node), location))
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
            else if failed {
                Text("Check Unavailable")
            }
            else {
                ProgressView()
            }
        }
        .task(id: input) {
            compilation = nil
            failed = false
            guard let input else { return }
            do {
                let result = try await session.compile(input)
                guard !Task.isCancelled, self.input == input else { return }
                compilation = result
            }
            catch { if !Task.isCancelled { failed = true } }
        }
        .navigationTitle("Diagnostics and Program")
        .navigationBarTitleDisplayMode(.inline)
    }

    private func row(_ issue: EngineDiagnostic) -> some View {
        IssueRow(isError: issue.severity == .error, message: issue.message, location: issue.location?.display ?? issue.code)
    }
}
