import StudioKit
import SwiftUI

/// Plain text editing for any project text file (W10). Edits are kept as a
/// local draft until saved; if another app changes the file meanwhile, both
/// versions are kept and the author chooses.
struct FileEditorView: View {
    let session: ProjectSession
    let path: String
    @Environment(AppModel.self) private var model
    @State private var text = ""
    @State private var loaded = false
    @State private var pendingDraft: Task<Void, Never>?

    private var conflict: FileConflict? {
        session.conflicts.first { $0.path == path }
    }

    var body: some View {
        editor
            .safeAreaInset(edge: .top) { conflictBanner }
            .navigationTitle((path as NSString).lastPathComponent)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { toolbarContent }
            .focusedSceneValue(\.saveFile, session.hasDraft(path) ? SaveAction(path: path, perform: save) : nil)
            .onAppear(perform: load)
            .onChange(of: text) { _, newValue in scheduleDraft(newValue) }
            .onChange(of: session.snapshot?.files[path]) { _, newValue in follow(newValue) }
            .onDisappear(perform: flush)
    }

    private var editor: some View {
        TextEditor(text: $text)
            .font(.body.monospaced())
            .autocorrectionDisabled()
            .textInputAutocapitalization(.never)
            .scrollDismissesKeyboard(.interactively)
            .accessibilityIdentifier("file-editor")
    }

    @ViewBuilder
    private var conflictBanner: some View {
        if let conflict {
            ConflictBanner(conflict: conflict) { resolution in
                resolve(conflict, with: resolution)
            }
        }
    }

    @ToolbarContentBuilder
    private var toolbarContent: some ToolbarContent {
        ToolbarItem(placement: .primaryAction) {
            Button("Save", action: save)
                .keyboardShortcut("s", modifiers: .command)
                .disabled(!session.hasDraft(path) || conflict != nil)
                .accessibilityIdentifier("save-file")
        }
        ToolbarItem(placement: .secondaryAction) {
            Button(role: .destructive, action: discard) {
                Label("Discard Changes", systemImage: "arrow.uturn.backward")
            }
            .disabled(!session.hasDraft(path))
        }
    }

    private func load() {
        text = session.text(at: path) ?? ""
        loaded = true
    }

    private func scheduleDraft(_ newValue: String) {
        guard loaded else { return }
        pendingDraft?.cancel()
        pendingDraft = Task {
            try? await Task.sleep(for: .milliseconds(400))
            guard !Task.isCancelled else { return }
            session.updateDraft(newValue, for: path)
        }
    }

    /// Without a draft, follow changes made elsewhere.
    private func follow(_ newValue: String?) {
        if !session.hasDraft(path), let newValue, newValue != text {
            text = newValue
        }
    }

    private func flush() {
        pendingDraft?.cancel()
        if loaded, text != session.text(at: path) {
            session.updateDraft(text, for: path)
        }
    }

    private func discard() {
        pendingDraft?.cancel()
        session.discardDraft(path)
        text = session.text(at: path) ?? ""
    }

    private func resolve(_ conflict: FileConflict, with resolution: ConflictResolution) {
        Task {
            do {
                try await session.resolve(conflict, with: resolution)
                text = session.text(at: path) ?? ""
            }
            catch {
                model.report(error)
            }
        }
    }

    private func save() {
        pendingDraft?.cancel()
        let current = text
        Task {
            do { try await session.save(current, to: path) }
            catch { model.report(error) }
        }
    }
}

struct ConflictBanner: View {
    let conflict: FileConflict
    let resolve: (ConflictResolution) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Label(conflict.theirs == nil ? "This file was deleted in another app." : "This file changed in another app while you were editing.", systemImage: "exclamationmark.arrow.triangle.2.circlepath")
                .font(.subheadline.weight(.semibold))
            Text("Your edits are kept. Choose which version to keep.")
                .font(.caption)
                .foregroundStyle(.secondary)
            HStack {
                Button("Keep Mine") { resolve(.keepMine) }
                    .accessibilityIdentifier("conflict-keep-mine")
                Button("Use Theirs") { resolve(.keepTheirs) }
                    .accessibilityIdentifier("conflict-keep-theirs")
                Button("Keep Both") { resolve(.keepBoth) }
                    .accessibilityIdentifier("conflict-keep-both")
            }
            .buttonStyle(.bordered)
            .controlSize(.small)
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(.orange.opacity(0.12))
    }
}

/// Problems the engine found, grouped like Web Studio's health panel, each
/// pointing at a file and line. Broken links in frontmatter can be fixed here.
struct ProjectHealthView: View {
    let session: ProjectSession
    @Environment(AppModel.self) private var model
    @State private var fixedMessage: String?

    private static let categories: [(id: String, title: LocalizedStringKey)] = [
        ("syntax", "Syntax"),
        ("character", "Characters"),
        ("scene", "Scenes"),
        ("location", "Locations"),
        ("audio", "Audio"),
        ("runtime", "Runtime"),
    ]

    var body: some View {
        let issues = session.validation?.issues ?? []
        List {
            if let index = session.index, !index.issues.isEmpty {
                Section("Unreadable Files") {
                    ForEach(index.issues, id: \.self) { issue in
                        NavigationLink(value: ProjectRoute.file(issue.file)) {
                            IssueRow(isError: true, message: issue.message, location: issue.file)
                        }
                    }
                }
            }
            ForEach(Self.categories, id: \.id) { category in
                let group = issues.filter { $0.category == category.id }
                if !group.isEmpty {
                    Section {
                        ForEach(group, id: \.self) { issue in
                            NavigationLink(value: ProjectRoute.file(issue.file)) {
                                IssueRow(isError: issue.type == .error, message: message(issue), location: location(issue))
                            }
                            .swipeActions {
                                if issue.isFixable {
                                    Button("Fix") { fix([issue]) }
                                        .tint(.indigo)
                                }
                            }
                        }
                    } header: {
                        HStack {
                            Text(category.title)
                            Spacer()
                            if group.contains(where: \.isFixable) {
                                Button("Fix All") { fix(group.filter(\.isFixable)) }
                                    .font(.caption.weight(.semibold))
                                    .textCase(nil)
                                    .accessibilityIdentifier("fix-all-\(category.id)")
                            }
                        }
                    }
                }
            }
        }
        .overlay {
            if session.validation == nil {
                ContentUnavailableView("Check Unavailable", systemImage: "exclamationmark.triangle", description: Text("adv/settings/game.json could not be read. Fix it in Files to check this project."))
            }
            else if issues.isEmpty, session.index?.issues.isEmpty ?? true {
                ContentUnavailableView("No Problems Found", systemImage: "checkmark.seal", description: Text("All checks passed — no issues found"))
            }
        }
        .navigationTitle("Project Health")
        .refreshable { await session.reload() }
        .alert(fixedMessage ?? "", isPresented: Binding(get: { fixedMessage != nil }, set: { if !$0 { fixedMessage = nil } })) {
            Button("OK", role: .cancel) {}
        }
    }

    /// Character and scene checks report only the unknown name.
    private func message(_ issue: EngineValidation.Issue) -> String {
        switch issue.category {
        case "character" where !issue.message.contains("\""):
            String(localized: "Unknown character: \(issue.message)")
        case "scene" where !issue.message.contains("\""):
            String(localized: "Unknown scene: \(issue.message)")
        default:
            issue.message
        }
    }

    private func location(_ issue: EngineValidation.Issue) -> String {
        guard let line = issue.line else { return issue.file }
        return "\(issue.file):\(line)"
    }

    private func fix(_ issues: [EngineValidation.Issue]) {
        Task {
            do {
                let count = try await session.fixReferences(issues)
                fixedMessage = String(localized: "Fixed \(count) issue(s)")
            }
            catch {
                model.report(error)
            }
        }
    }
}

struct IssueRow: View {
    let isError: Bool
    let message: String
    let location: String

    var body: some View {
        Label {
            VStack(alignment: .leading, spacing: 2) {
                Text(message)
                Text(location)
                    .font(.caption.monospaced())
                    .foregroundStyle(.secondary)
            }
        } icon: {
            Image(systemName: isError ? "xmark.octagon.fill" : "exclamationmark.triangle.fill")
                .foregroundStyle(isError ? .red : .orange)
        }
    }
}
