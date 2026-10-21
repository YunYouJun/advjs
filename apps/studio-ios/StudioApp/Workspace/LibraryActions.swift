import StudioKit
import SwiftUI
import UniformTypeIdentifiers

/// Sheets, prompts and undo for project-list actions, shared by the iPhone
/// list and the iPad sidebar.
@Observable
final class LibraryActions {
    enum ImportKind: Identifiable {
        case package
        case folderCopy
        case folderInPlace

        var id: Self { self }

        var contentTypes: [UTType] {
            switch self {
            case .package: [.zip]
            case .folderCopy, .folderInPlace: [.folder]
            }
        }
    }

    var isCreating = false
    var importing: ImportKind?
    var renaming: ProjectSummary?
    var renameText = ""
    var exported: ExportedPackage?
    var undoable: DeletedProject?
    var isWorking = false
    /// Called with a project that was created or imported, to show it.
    var onOpen: ((UUID) -> Void)?

    func beginRename(_ project: ProjectSummary) {
        renameText = project.name
        renaming = project
    }

    func commitRename(model: AppModel) {
        guard let project = renaming else { return }
        let name = renameText
        renaming = nil
        Task {
            do {
                try await model.library.rename(project.id, to: name)
                if let session = model.sessions[project.id] {
                    await session.reload()
                }
            }
            catch {
                model.report(error)
            }
        }
    }

    func delete(_ project: ProjectSummary, model: AppModel) {
        Task {
            do {
                model.closeSession(project.id)
                let deleted = try await model.library.delete(project.id)
                withAnimation { undoable = deleted }
                try? await Task.sleep(for: .seconds(6))
                if undoable?.id == deleted.id {
                    withAnimation { undoable = nil }
                }
            }
            catch {
                model.report(error)
            }
        }
    }

    func undoDelete(model: AppModel) {
        guard let deleted = undoable else { return }
        withAnimation { undoable = nil }
        Task {
            do {
                try await model.library.restore(deleted.id)
            }
            catch {
                model.report(error)
            }
        }
    }

    func export(_ project: ProjectSummary, model: AppModel) {
        Task {
            isWorking = true
            defer { isWorking = false }
            do {
                let url = try await model.library.exportPackage(project.id)
                exported = ExportedPackage(url: url)
            }
            catch {
                model.report(error)
            }
        }
    }

    func importItems(_ result: Result<[URL], Error>, kind: ImportKind, model: AppModel) {
        guard case .success(let urls) = result, let url = urls.first else {
            if case .failure(let error) = result { model.report(error) }
            return
        }
        Task {
            isWorking = true
            defer { isWorking = false }
            do {
                let record: ProjectRecord
                switch kind {
                case .package: record = try await model.library.importPackage(at: url)
                case .folderCopy: record = try await model.library.importFolder(at: url)
                case .folderInPlace: record = try await model.library.openInPlace(at: url)
                }
                onOpen?(record.id)
            }
            catch {
                model.report(error)
            }
        }
    }
}

struct ExportedPackage: Identifiable {
    let url: URL
    var id: URL { url }
}

extension View {
    func libraryActions(_ actions: LibraryActions, open: ((UUID) -> Void)? = nil) -> some View {
        modifier(LibraryActionsModifier(actions: actions, open: open))
    }
}

private struct LibraryActionsModifier: ViewModifier {
    @Bindable var actions: LibraryActions
    let open: ((UUID) -> Void)?
    @Environment(AppModel.self) private var model
    @Environment(\.undoManager) private var undoManager

    func body(content: Content) -> some View {
        content
            .sheet(isPresented: $actions.isCreating) {
                NewProjectView { id in
                    open?(id)
                }
            }
            .fileImporter(
                isPresented: Binding(get: { actions.importing != nil }, set: { if !$0 { actions.importing = nil } }),
                allowedContentTypes: actions.importing?.contentTypes ?? [.zip]
            ) { result in
                if let kind = actions.importing {
                    actions.importItems(result.map { [$0] }, kind: kind, model: model)
                }
            }
            .alert("Rename Project", isPresented: Binding(get: { actions.renaming != nil }, set: { if !$0 { actions.renaming = nil } })) {
                TextField("Name", text: $actions.renameText)
                    .accessibilityIdentifier("rename-field")
                Button("Cancel", role: .cancel) { actions.renaming = nil }
                Button("Rename") { actions.commitRename(model: model) }
            } message: {
                Text("The project folder in the Files app is renamed too.")
            }
            .sheet(item: $actions.exported) { exported in
                ShareSheet(items: [exported.url])
                    .presentationDetents([.medium, .large])
            }
            .overlay(alignment: .bottom) {
                if let deleted = actions.undoable {
                    UndoBanner(deleted: deleted) {
                        actions.undoDelete(model: model)
                    }
                    .padding()
                    .transition(.move(edge: .bottom).combined(with: .opacity))
                }
            }
            .overlay {
                if actions.isWorking {
                    ProgressView()
                        .padding()
                        .background(.regularMaterial, in: .rect(cornerRadius: 12))
                }
            }
            .onAppear {
                if let open { actions.onOpen = open }
            }
            .onChange(of: actions.undoable) { _, deleted in
                // ⌘Z and shake-to-undo restore the last deletion as well.
                guard let deleted, let undoManager else { return }
                undoManager.registerUndo(withTarget: actions) { target in
                    if target.undoable?.id == deleted.id {
                        target.undoDelete(model: model)
                    }
                    else {
                        Task { try? await model.library.restore(deleted.id) }
                    }
                }
                undoManager.setActionName(String(localized: "Delete Project"))
            }
    }
}

struct UndoBanner: View {
    let deleted: DeletedProject
    let undo: () -> Void

    var body: some View {
        HStack {
            Text(deleted.trashFolder == nil ? "Removed “\(deleted.name)” from the list" : "Moved “\(deleted.name)” to Recently Deleted")
                .font(.subheadline)
                .lineLimit(2)
            Spacer()
            Button("Undo", action: undo)
                .font(.subheadline.weight(.semibold))
                .accessibilityIdentifier("undo-delete")
        }
        .padding()
        .background(.regularMaterial, in: .rect(cornerRadius: 14))
        .shadow(radius: 8, y: 2)
    }
}

/// The system share sheet, for exported packages.
struct ShareSheet: UIViewControllerRepresentable {
    let items: [Any]

    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: items, applicationActivities: nil)
    }

    func updateUIViewController(_ controller: UIActivityViewController, context: Context) {}
}
