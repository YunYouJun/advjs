import StudioKit
import SwiftUI

/// Tab bar on iPhone and in compact iPad widths; three columns otherwise.
struct RootView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass

    var body: some View {
        @Bindable var model = model
        Group {
            if horizontalSizeClass == .compact {
                CompactRootView()
            }
            else {
                RegularRootView()
            }
        }
        .task {
            await model.refresh()
        }
        .onOpenURL { url in
            Task { await importOpenedFile(url) }
        }
        .alert(item: $model.lastError) { alert in
            Alert(title: Text("Something went wrong"), message: Text(alert.message))
        }
    }

    /// Files shared to the App ("Open in ADV.JS Studio") are imported as projects.
    private func importOpenedFile(_ url: URL) async {
        do {
            if url.pathExtension.lowercased() == "zip" {
                try await model.library.importPackage(at: url)
            }
            else if url.hasDirectoryPath {
                try await model.library.openInPlace(at: url)
            }
        }
        catch {
            model.report(error)
        }
    }
}

struct CompactRootView: View {
    @Environment(AppModel.self) private var model
    @SceneStorage("compact.tab") private var tab = RootTab.workspace
    @SceneStorage("compact.project") private var restoredProject = ""
    @State private var path = NavigationPath()

    var body: some View {
        TabView(selection: $tab) {
            Tab("Workspace", systemImage: "square.stack.3d.up", value: RootTab.workspace) {
                NavigationStack(path: $path) {
                    LibraryView { id in open(id) }
                        .navigationDestination(for: UUID.self) { id in
                            ProjectContainer(projectID: id) { session in
                                ProjectHomeView(session: session)
                            }
                        }
                }
            }
            Tab("Me", systemImage: "person.crop.circle", value: RootTab.me) {
                NavigationStack {
                    SettingsView()
                }
            }
        }
        .onChange(of: path) { _, newValue in
            if newValue.isEmpty {
                restoredProject = ""
            }
        }
        .task(id: model.library.hasLoaded) {
            // Scene restoration: reopen the project this window showed last time.
            guard model.library.hasLoaded, path.isEmpty, let id = UUID(uuidString: restoredProject),
                  model.library.summary(id) != nil else { return }
            path.append(id)
        }
    }

    private func open(_ id: UUID) {
        path = NavigationPath([id])
        restoredProject = id.uuidString
    }
}

struct RegularRootView: View {
    @Environment(AppModel.self) private var model
    @SceneStorage("regular.sidebar") private var restoredSidebar = ""
    @SceneStorage("regular.section") private var restoredSection = ProjectSection.overview.rawValue
    @State private var sidebar: SidebarItem?
    @State private var section: ProjectSection? = .overview
    @State private var columns = NavigationSplitViewVisibility.all

    var body: some View {
        NavigationSplitView(columnVisibility: $columns) {
            SidebarView(selection: $sidebar)
        } content: {
            switch sidebar {
            case .project(let id):
                ProjectContainer(projectID: id) { session in
                    ProjectSectionList(session: session, selection: $section)
                }
                .id(id)
            case .recentlyDeleted:
                RecentlyDeletedView()
            case .settings:
                SettingsView()
            case nil:
                ContentUnavailableView("Choose a Project", systemImage: "square.stack.3d.up", description: Text("Select a project in the sidebar, or create a new one."))
            }
        } detail: {
            if case .project(let id) = sidebar {
                ProjectContainer(projectID: id) { session in
                    NavigationStack {
                        ProjectSectionView(session: session, section: section ?? .overview)
                            .projectDestinations(session)
                    }
                }
                .id(id)
            }
            else {
                Color.clear
            }
        }
        .onChange(of: sidebar) { _, newValue in
            if case .project(let id) = newValue {
                restoredSidebar = id.uuidString
            }
        }
        .onChange(of: section) { _, newValue in
            restoredSection = newValue?.rawValue ?? ProjectSection.overview.rawValue
        }
        .task(id: model.library.hasLoaded) {
            guard model.library.hasLoaded, sidebar == nil else { return }
            section = ProjectSection(rawValue: restoredSection) ?? .overview
            if let id = UUID(uuidString: restoredSidebar), model.library.summary(id) != nil {
                sidebar = .project(id)
            }
        }
        .focusedSceneValue(\.selectedProject, sidebar.flatMap { if case .project(let id) = $0 { id } else { nil } })
    }
}

/// A second window that shows one project (iPad).
struct ProjectWindowView: View {
    let projectID: UUID
    @SceneStorage("window.section") private var restoredSection = ProjectSection.overview.rawValue
    @State private var section: ProjectSection? = .overview

    var body: some View {
        ProjectContainer(projectID: projectID) { session in
            NavigationSplitView {
                ProjectSectionList(session: session, selection: $section)
            } detail: {
                NavigationStack {
                    ProjectSectionView(session: session, section: section ?? .overview)
                        .projectDestinations(session)
                }
            }
        }
        .onAppear { section = ProjectSection(rawValue: restoredSection) ?? .overview }
        .onChange(of: section) { _, newValue in restoredSection = newValue?.rawValue ?? ProjectSection.overview.rawValue }
        .focusedSceneValue(\.selectedProject, projectID)
    }
}

/// Shows a project's session, opening it on first use.
struct ProjectContainer<Content: View>: View {
    let projectID: UUID
    @ViewBuilder var content: (ProjectSession) -> Content
    @Environment(AppModel.self) private var model
    @Environment(\.scenePhase) private var scenePhase
    @State private var session: ProjectSession?

    var body: some View {
        Group {
            if let session {
                switch session.state {
                case .ready:
                    content(session)
                case .loading:
                    ProgressView()
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                case .closed:
                    // Closed as idle while hidden; reopen now that it is shown again.
                    ProgressView()
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                        .onAppear { self.session = model.session(for: projectID) }
                case .failed(let message):
                    ContentUnavailableView {
                        Label("Can’t Open Project", systemImage: "exclamationmark.triangle")
                    } description: {
                        Text(message)
                    } actions: {
                        Button("Try Again") { Task { await session.open() } }
                    }
                case .gone:
                    ContentUnavailableView("Project Not Found", systemImage: "questionmark.folder", description: Text("The project folder was moved or deleted."))
                }
            }
            else {
                ProgressView()
            }
        }
        .onAppear {
            // Sessions outlive this view (pushing a page hides it); the model closes idle ones.
            session = model.session(for: projectID)
        }
        .onChange(of: scenePhase) { _, phase in
            if phase == .active, let session {
                Task { await session.refreshIfChangedOnDisk() }
            }
        }
    }
}
