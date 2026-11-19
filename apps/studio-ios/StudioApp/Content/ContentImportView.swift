import StudioKit
import SwiftUI
import UniformTypeIdentifiers

struct ContentImportView: View {
    let session: ProjectSession
    let kind: ContentKind
    @Environment(\.dismiss) private var dismiss
    @Environment(AppModel.self) private var model
    @State private var source: String?
    @State private var format = "csv"
    @State private var name = ""
    @State private var strategy = ContentImportStrategy.skip
    @State private var rows: [ContentImportRow] = []
    @State private var selecting = false
    @State private var running = false
    @State private var completed = false

    var body: some View {
        NavigationStack {
            List {
                Button { selecting = true } label: { Label("Select CSV or JSON…", systemImage: "folder") }
                    .disabled(running)
                    .accessibilityIdentifier("pick-content-import")
                if source != nil {
                    LabeledContent("File", value: name)
                    if !completed {
                        Picker("ID Conflicts", selection: $strategy) {
                            Text("Skip").tag(ContentImportStrategy.skip)
                            Text("Overwrite").tag(ContentImportStrategy.overwrite)
                            Text("Rename Imported Entry").tag(ContentImportStrategy.rename)
                        }
                        .disabled(running)
                    }
                    Section(completed ? "Import Results" : "Import Preview") {
                        ForEach(Array(rows.enumerated()), id: \.offset) { index, row in
                            LabeledContent {
                                Text(status(row.status))
                            } label: {
                                if row.name.isEmpty { Text("Row \(index + 1, format: .number)") }
                                else { Text(row.name) }
                            }
                        }
                    }
                }
            }
            .navigationTitle("Batch Import")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Done") { dismiss() }.disabled(running) }
                ToolbarItem(placement: .confirmationAction) {
                    if !completed, !rows.isEmpty {
                        Button("Import", action: apply).disabled(running)
                            .accessibilityIdentifier("apply-content-import")
                    }
                }
            }
            .fileImporter(isPresented: $selecting, allowedContentTypes: [.commaSeparatedText, .json]) { result in
                do {
                    let url = try result.get()
                    let accessed = url.startAccessingSecurityScopedResource()
                    defer { if accessed { url.stopAccessingSecurityScopedResource() } }
                    let bytes = try CoordinatedFiles.read(url)
                    guard let text = String(data: bytes, encoding: .utf8) else { throw ContentAuthoringError.unreadable }
                    format = url.pathExtension.lowercased() == "json" ? "json" : "csv"
                    name = url.lastPathComponent
                    source = text
                    completed = false
                    preview()
                }
                catch { model.report(error) }
            }
            .onChange(of: strategy) { _, _ in preview() }
            .interactiveDismissDisabled(running)
        }
    }

    private func status(_ value: ContentImportRow.Status) -> LocalizedStringKey {
        switch value {
        case .created: completed ? "Created" : "Create"
        case .skipped: completed ? "Skipped" : "Skip"
        case .overwritten: completed ? "Overwritten" : "Overwrite"
        case .renamed: completed ? "Renamed" : "Rename Imported Entry"
        case .invalid: "Invalid Entry"
        case .failed: "Write Failed"
        }
    }

    private func preview() {
        guard let source else { return }
        running = true
        rows = []
        Task {
            defer { running = false }
            do { rows = try await session.planContentImport(kind, text: source, format: format, strategy: strategy) }
            catch { model.report(error) }
        }
    }

    private func apply() {
        running = true
        Task {
            rows = await session.applyContentImport(rows)
            running = false
            completed = true
        }
    }
}
