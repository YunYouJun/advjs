import StudioKit
import StudioUI
import SwiftUI
import UniformTypeIdentifiers

/// The project list on iPhone: search, swipe actions, create and import.
struct LibraryView: View {
    var open: (UUID) -> Void
    @Environment(AppModel.self) private var model
    @State private var search = ""
    @State private var isSearching = false
    @State private var findID = UUID()
    @State private var actions = LibraryActions()

    var body: some View {
        List {
            ProjectRows(search: search, actions: actions, open: open)
            if !model.library.recentlyDeleted.isEmpty {
                Section {
                    NavigationLink {
                        RecentlyDeletedView()
                    } label: {
                        Label("Recently Deleted", systemImage: "trash")
                            .badge(model.library.recentlyDeleted.count)
                    }
                }
            }
        }
        .overlay {
            if model.library.hasLoaded, model.library.projects.isEmpty {
                LibraryEmptyState(actions: actions)
            }
        }
        .navigationTitle("Projects")
        .searchable(text: $search, isPresented: $isSearching, prompt: Text("Search projects"))
        .refreshable { await model.refresh() }
        .toolbar { LibraryToolbar(actions: actions) }
        .libraryActions(actions, open: open)
        .focusedSceneValue(\.libraryActions, actions)
        .focusedSceneValue(\.findProjects, FindAction(id: findID) { isSearching = true })
    }
}

/// Sidebar of the iPad layout: projects, Recently Deleted, settings.
struct SidebarView: View {
    @Binding var selection: SidebarItem?
    @Environment(AppModel.self) private var model
    @State private var search = ""
    @State private var isSearching = false
    @State private var findID = UUID()
    @State private var actions = LibraryActions()

    var body: some View {
        List(selection: $selection) {
            Section("Projects") {
                ProjectRows(search: search, actions: actions, open: nil)
            }
            Section {
                Label("Recently Deleted", systemImage: "trash")
                    .badge(model.library.recentlyDeleted.count)
                    .tag(SidebarItem.recentlyDeleted)
                Label("Settings", systemImage: "gearshape")
                    .tag(SidebarItem.settings)
            }
        }
        .navigationTitle("ADV.JS Studio")
        .searchable(text: $search, isPresented: $isSearching, placement: .sidebar, prompt: Text("Search projects"))
        .refreshable { await model.refresh() }
        .toolbar { LibraryToolbar(actions: actions) }
        .libraryActions(actions) { id in selection = .project(id) }
        .focusedSceneValue(\.libraryActions, actions)
        .focusedSceneValue(\.findProjects, FindAction(id: findID) { isSearching = true })
        .onChange(of: model.library.projects) { _, projects in
            if case .project(let id) = selection, !projects.contains(where: { $0.id == id }) {
                selection = nil
            }
        }
    }
}

/// Rows for the visible projects, shared by the iPhone list and the iPad sidebar.
struct ProjectRows: View {
    let search: String
    let actions: LibraryActions
    /// Push navigation on iPhone; `nil` when rows are selection-driven (iPad).
    let open: ((UUID) -> Void)?
    @Environment(AppModel.self) private var model
    @Environment(\.openWindow) private var openWindow
    @Environment(\.supportsMultipleWindows) private var supportsMultipleWindows

    private var projects: [ProjectSummary] {
        let all = model.library.projects
        let query = search.trimmingCharacters(in: .whitespaces)
        guard !query.isEmpty else { return all }
        return all.filter { $0.name.localizedStandardContains(query) || ($0.summary?.localizedStandardContains(query) ?? false) }
    }

    var body: some View {
        ForEach(projects) { project in
            row(project)
                .tag(SidebarItem.project(project.id))
                .swipeActions(edge: .trailing) {
                    Button(role: .destructive) {
                        actions.delete(project, model: model)
                    } label: {
                        Label("Delete", systemImage: "trash")
                    }
                    if !project.isExternal {
                        Button {
                            actions.beginRename(project)
                        } label: {
                            Label("Rename", systemImage: "pencil")
                        }
                        .tint(.indigo)
                    }
                }
                .contextMenu {
                    if supportsMultipleWindows {
                        Button {
                            openWindow(id: "project", value: project.id)
                        } label: {
                            Label("Open in New Window", systemImage: "macwindow.badge.plus")
                        }
                    }
                    if !project.isExternal {
                        Button {
                            actions.beginRename(project)
                        } label: {
                            Label("Rename", systemImage: "pencil")
                        }
                    }
                    Button {
                        actions.export(project, model: model)
                    } label: {
                        Label("Export Package", systemImage: "square.and.arrow.up")
                    }
                    Divider()
                    Button(role: .destructive) {
                        actions.delete(project, model: model)
                    } label: {
                        Label(project.isExternal ? "Remove from List" : "Delete", systemImage: project.isExternal ? "minus.circle" : "trash")
                    }
                }
        }
        if projects.isEmpty, !search.isEmpty {
            ContentUnavailableView.search(text: search)
        }
    }

    @ViewBuilder
    private func row(_ project: ProjectSummary) -> some View {
        if let open {
            Button {
                open(project.id)
            } label: {
                ProjectRowLabel(project: project)
            }
            .buttonStyle(.plain)
            .disabled(project.availability == .missing)
            .accessibilityIdentifier("project-\(project.name)")
        }
        else {
            ProjectRowLabel(project: project)
                .accessibilityIdentifier("project-\(project.name)")
        }
    }
}

struct ProjectRowLabel: View {
    let project: ProjectSummary

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: project.isExternal ? "folder.badge.person.crop" : "doc.richtext")
                .font(.title3)
                .foregroundStyle(.tint)
                .frame(width: 32)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 2) {
                Text(project.name)
                    .font(.body.weight(.medium))
                    .lineLimit(1)
                if let summary = project.summary {
                    Text(summary)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
                HStack(spacing: 6) {
                    if project.availability == .missing {
                        Label("Unavailable", systemImage: "exclamationmark.triangle.fill")
                            .foregroundStyle(.orange)
                    }
                    else if let date = project.modifiedAt ?? project.lastOpenedAt {
                        Text("Edited \(date, format: .relative(presentation: .named))")
                    }
                    if project.isExternal {
                        Text("Opened in Place")
                    }
                }
                .font(.caption)
                .foregroundStyle(.secondary)
            }
            Spacer(minLength: 0)
        }
        .contentShape(.rect)
        .accessibilityElement(children: .combine)
    }
}

struct LibraryEmptyState: View {
    let actions: LibraryActions

    var body: some View {
        ContentUnavailableView {
            Label("No Projects Yet", systemImage: "square.stack.3d.up")
        } description: {
            Text("Create a project from a template, or import one you made in Web Studio or the desktop Editor.")
        } actions: {
            Button("New Project") { actions.isCreating = true }
                .buttonStyle(.borderedProminent)
            Button("Import Package") { actions.importing = .package }
        }
    }
}

struct LibraryToolbar: ToolbarContent {
    let actions: LibraryActions

    var body: some ToolbarContent {
        ToolbarItem(placement: .primaryAction) {
            Button {
                actions.isCreating = true
            } label: {
                Label("New Project", systemImage: "plus")
            }
            .keyboardShortcut("n", modifiers: .command)
            .accessibilityIdentifier("new-project")
        }
        ToolbarItem(placement: .secondaryAction) {
            Menu {
                Button {
                    actions.importing = .package
                } label: {
                    Label("Import Package…", systemImage: "shippingbox")
                }
                Button {
                    actions.importing = .folderCopy
                } label: {
                    Label("Import Folder…", systemImage: "folder.badge.plus")
                }
                Button {
                    actions.importing = .folderInPlace
                } label: {
                    Label("Open Folder in Place…", systemImage: "folder")
                }
            } label: {
                Label("Import", systemImage: "square.and.arrow.down")
            }
            .accessibilityIdentifier("import-menu")
        }
    }
}
