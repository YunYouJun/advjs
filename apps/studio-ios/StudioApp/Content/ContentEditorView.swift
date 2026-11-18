import StudioKit
import SwiftUI
import UIKit

struct ContentEditorView: View {
    let session: ProjectSession
    let kind: ContentKind
    let path: String

    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    @State private var document: ContentDocument?
    @State private var data: ContentData = [:]
    @State private var entries: [ContentKind: [ContentEntry]] = [:]
    @State private var pending: Task<Void, Never>?
    @State private var loading = true
    @State private var busy = false
    @State private var confirmingDelete = false
    @State private var share: ContentShare?

    private var conflict: FileConflict? { session.conflicts.first { $0.path == path } }
    private var validName: Bool { !(data["name"]?.string ?? "").trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
    private var changed: Bool { document.map { $0.data != data } ?? false }

    var body: some View {
        Group {
            if let document {
                Form {
                    if session.hasDraft(path) {
                        Label("Draft", systemImage: "doc.badge.clock")
                    }
                    Section {
                        TextField("Name", text: ContentFields(data: $data).text("name"))
                            .accessibilityIdentifier("content-name")
                        if let id = document.data["id"]?.string { LabeledContent("Content ID", value: id) }
                    }
                    ContentFormSections(session: session, kind: kind, data: $data, entries: entries, path: path)
                    Section {
                        NavigationLink(value: ProjectRoute.file(path)) { Label("Open Source File", systemImage: "doc.text") }
                            .disabled(changed)
                        Button("Delete Entry", role: .destructive) { confirmingDelete = true }
                            .disabled(changed || session.hasDraft(path))
                            .accessibilityIdentifier("delete-content")
                    }
                }
                .disabled(busy)
                .scrollDismissesKeyboard(.interactively)
            }
            else if loading {
                ProgressView()
            }
            else {
                ContentUnavailableView {
                    Label("Entry Unavailable", systemImage: "doc.badge.exclamationmark")
                } actions: {
                    NavigationLink("Open Source File", value: ProjectRoute.file(path))
                }
            }
        }
        .navigationTitle(document?.data["name"]?.string ?? "")
        .navigationBarTitleDisplayMode(.inline)
        .safeAreaInset(edge: .top) {
            if let conflict {
                ConflictBanner(conflict: conflict) { resolve(conflict, as: $0) }
            }
        }
        .toolbar { toolbar }
        .focusedSceneValue(\.saveFile, SaveAction(path: path, perform: save))
        .task { await load() }
        .onChange(of: data) { _, _ in draft() }
        .onChange(of: session.snapshot?.files[path]) { _, _ in
            if !busy, !changed, !session.hasDraft(path) {
                Task { await load() }
            }
        }
        .confirmationDialog("Delete this entry?", isPresented: $confirmingDelete, titleVisibility: .visible) {
            Button("Delete Entry", role: .destructive, action: delete)
        }
        .sheet(item: $share) { item in
            ShareSheet(items: item.items).onDisappear { item.cleanUp() }
        }
    }

    @ToolbarContentBuilder
    private var toolbar: some ToolbarContent {
        ToolbarItem(placement: .primaryAction) {
            Button("Save", action: save)
                .disabled(!canSave)
                .accessibilityIdentifier("save-content")
        }
        if kind == .character, document != nil {
            ToolbarItem(placement: .secondaryAction) {
                Menu {
                    Button("Share Character Markdown…") { shareCharacter(.markdown) }
                    Button("Share Character Card…") { shareCharacter(.image) }
                    Button("Copy Character Information") { shareCharacter(.clipboard) }
                    if let prompt = data["imagePrompt"]?.string, !prompt.isEmpty {
                        Button("Copy Image Prompt") { UIPasteboard.general.string = prompt }
                    }
                } label: {
                    Label("Share", systemImage: "square.and.arrow.up")
                }
                .disabled(busy || changed || session.hasDraft(path))
            }
        }
        if session.hasDraft(path), conflict == nil {
            ToolbarItem(placement: .secondaryAction) {
                Button("Discard Changes", role: .destructive, action: discard)
                    .disabled(busy)
            }
        }
    }

    private var canSave: Bool {
        document != nil && validName && (changed || session.hasDraft(path)) && conflict == nil && !busy
    }

    private func load() async {
        defer { loading = false }
        do {
            let loaded = try await session.contentDocument(kind, path: path)
            try Task.checkCancellation()
            document = loaded
            data = loaded.data
            switch kind {
            case .character:
                entries[.character] = try await session.contentEntries(.character)
            case .scene:
                entries[.location] = try await session.contentEntries(.location)
            case .location:
                entries[.scene] = try await session.contentEntries(.scene)
                entries[.character] = try await session.contentEntries(.character)
            case .knowledge: break
            }
        }
        catch is CancellationError {}
        catch { model.report(error) }
    }

    private func stage() async throws {
        guard let document else { return }
        let edited = data
        var changes = edited.filter { document.data[$0.key] != $0.value }
        for key in document.data.keys where edited[key] == nil { changes[key] = .null }
        guard !changes.isEmpty else { return }
        let source = try await session.stageContent(kind, path: path, document: document, changes: changes)
        var staged = edited
        if kind == .knowledge {
            let parsed = try await session.contentDocument(kind, path: path)
            staged["name"] = parsed.data["name"]
            staged["content"] = parsed.data["content"]
            if data == edited { data = staged }
        }
        self.document = ContentDocument(data: staged, source: source, savedSource: document.savedSource)
    }

    private func draft() {
        guard !busy, changed, validName else { return }
        pending?.cancel()
        pending = Task {
            do {
                try await Task.sleep(for: .milliseconds(300))
                try await stage()
            }
            catch is CancellationError {}
            catch { model.report(error) }
        }
    }

    private func save() {
        guard canSave else { return }
        run {
            try await stage()
            try await session.saveContent(path)
            await load()
        }
    }

    private func discard() {
        run {
            session.discardDraft(path)
            await load()
        }
    }

    private func resolve(_ conflict: FileConflict, as resolution: ConflictResolution) {
        run {
            try await stage()
            guard let current = session.conflicts.first(where: { $0.path == conflict.path }) else { return }
            try await session.resolveContent(current, with: resolution)
            if session.text(at: path) == nil { dismiss() }
            else { await load() }
        }
    }

    private func delete() {
        run {
            try await session.deleteContent(path)
            dismiss()
        }
    }

    private func run(_ operation: @escaping () async throws -> Void) {
        pending?.cancel()
        busy = true
        Task {
            defer { busy = false }
            do { try await operation() }
            catch { model.report(error) }
        }
    }

    private enum CharacterShare { case markdown, image, clipboard }

    private func shareCharacter(_ format: CharacterShare) {
        guard let document else { return }
        run {
            switch format {
            case .markdown:
                share = try .file(name: URL(filePath: path).lastPathComponent, data: Data(document.source.utf8))
            case .clipboard:
                UIPasteboard.general.string = try await session.characterSummary(document.source)
            case .image:
                let avatar = document.data["avatar"]?.string
                    .flatMap { session.localImageURL($0) }
                    .flatMap { UIImage(contentsOfFile: $0.path(percentEncoded: false)) }
                let renderer = ImageRenderer(content: CharacterProfileCard(
                    name: document.data["name"]?.string ?? "",
                    details: document.data["personality"]?.string ?? document.data["appearance"]?.string ?? "",
                    avatar: avatar
                ))
                renderer.scale = 2
                guard let png = renderer.uiImage?.pngData() else { throw ContentAuthoringError.unreadable }
                share = try .file(name: "character.png", data: png)
            }
        }
    }
}
