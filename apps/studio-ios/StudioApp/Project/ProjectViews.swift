import StudioKit
import StudioUI
import SwiftUI

/// iPhone: the project's sections as a list, pushed from the project list.
struct ProjectHomeView: View {
    let session: ProjectSession

    var body: some View {
        List {
            ProjectSummaryHeader(session: session)
            Section {
                ForEach(ProjectSection.allCases) { section in
                    NavigationLink(value: ProjectRoute.section(section)) {
                        ProjectSectionLabel(session: session, section: section)
                    }
                }
            }
        }
        .navigationTitle(session.name)
        .projectDestinations(session)
        .toolbar { ProjectToolbar(session: session) }
        .refreshable { await session.reload() }
    }
}

/// iPad content column: the project's sections.
struct ProjectSectionList: View {
    let session: ProjectSession
    @Binding var selection: ProjectSection?

    var body: some View {
        List(selection: $selection) {
            ProjectSummaryHeader(session: session) { _ in selection = .files }
            Section {
                ForEach(ProjectSection.allCases) { section in
                    ProjectSectionLabel(session: session, section: section)
                        .tag(section)
                }
            }
        }
        .navigationTitle(session.name)
        .toolbar { ProjectToolbar(session: session) }
        .refreshable { await session.reload() }
    }
}

struct ProjectSectionLabel: View {
    let session: ProjectSession
    let section: ProjectSection

    var body: some View {
        Label(section.title, systemImage: section.systemImage)
            .badge(badge)
    }

    private var badge: Int {
        switch section {
        case .overview: 0
        case .files: session.snapshot?.paths.count ?? 0
        case .health: session.validation?.issues.count ?? 0
        }
    }
}

/// The selected section's content.
struct ProjectSectionView: View {
    let session: ProjectSession
    let section: ProjectSection

    var body: some View {
        switch section {
        case .overview:
            ProjectOverviewView(session: session)
        case .files:
            FileBrowserView(session: session)
        case .health:
            ProjectHealthView(session: session)
        }
    }
}

extension View {
    /// Destinations for links inside a project, for the stack that shows them.
    func projectDestinations(_ session: ProjectSession) -> some View {
        navigationDestination(for: ProjectRoute.self) { route in
            switch route {
            case .section(let section):
                ProjectSectionView(session: session, section: section)
            case .folder(let path):
                FileBrowserView(session: session, folder: path)
            case .file(let path):
                FileDetailView(session: session, path: path)
            }
        }
    }
}

/// Unresolved conflicts at the top of a project.
struct ProjectSummaryHeader: View {
    let session: ProjectSession
    /// iPad selects a section instead of pushing; `nil` pushes the file.
    var select: ((FileConflict) -> Void)?

    var body: some View {
        if !session.conflicts.isEmpty {
            Section {
                ForEach(session.conflicts) { conflict in
                    if let select {
                        Button { select(conflict) } label: { label(conflict) }
                    }
                    else {
                        NavigationLink(value: ProjectRoute.file(conflict.path)) { label(conflict) }
                    }
                }
            }
        }
    }

    private func label(_ conflict: FileConflict) -> some View {
                        Label {
                            VStack(alignment: .leading) {
                                Text("Changed in another app")
                                Text(conflict.path)
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                        } icon: {
                            Image(systemName: "exclamationmark.arrow.triangle.2.circlepath")
                                .foregroundStyle(.orange)
                        }
    }
}

struct ProjectToolbar: ToolbarContent {
    let session: ProjectSession
    @Environment(AppModel.self) private var model

    var body: some ToolbarContent {
        ToolbarItem(placement: .primaryAction) {
            ExportMenu(session: session)
        }
    }
}

/// Export as `.advpkg.zip`, through the share sheet or into Files.
struct ExportMenu: View {
    let session: ProjectSession
    @Environment(AppModel.self) private var model
    @State private var exported: ExportedPackage?
    @State private var saving: ExportedPackage?
    @State private var isExporting = false

    var body: some View {
        Menu {
            Button {
                export { exported = ExportedPackage(url: $0) }
            } label: {
                Label("Share Package…", systemImage: "square.and.arrow.up")
            }
            Button {
                export { saving = ExportedPackage(url: $0) }
            } label: {
                Label("Save Package to Files…", systemImage: "folder")
            }
        } label: {
            if isExporting {
                ProgressView()
            }
            else {
                Label("Export", systemImage: "square.and.arrow.up")
            }
        }
        .accessibilityIdentifier("export-menu")
        .sheet(item: $exported) { package in
            ShareSheet(items: [package.url])
                .presentationDetents([.medium, .large])
        }
        .fileMover(isPresented: Binding(get: { saving != nil }, set: { if !$0 { saving = nil } }), file: saving?.url) { result in
            if case .failure(let error) = result {
                model.report(error)
            }
        }
    }

    private func export(_ done: @escaping (URL) -> Void) {
        isExporting = true
        Task {
            defer { isExporting = false }
            do {
                done(try await model.library.exportPackage(session.id))
            }
            catch {
                model.report(error)
            }
        }
    }
}

/// Counts and health at a glance, plus the game description.
struct ProjectOverviewView: View {
    let session: ProjectSession
    @Environment(AppModel.self) private var model
    @State private var description = ""
    @FocusState private var editingDescription: Bool

    private let columns = [GridItem(.adaptive(minimum: 150), spacing: 12)]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Description")
                        .font(.headline)
                    TextField("What is this story about?", text: $description, axis: .vertical)
                        .lineLimit(2...6)
                        .textFieldStyle(.roundedBorder)
                        .focused($editingDescription)
                        .onSubmit(saveDescription)
                        .accessibilityIdentifier("project-description")
                    Text("Saved to adv/settings/game.json and shared with Web Studio and the desktop Editor.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                if let index = session.index {
                    LazyVGrid(columns: columns, spacing: 12) {
                        StatTile("Chapters", value: index.chapters.count, systemImage: "book.pages")
                        StatTile("Characters", value: index.characters.count, systemImage: "person.2")
                        StatTile("Scenes", value: index.scenes.count, systemImage: "photo")
                        StatTile("Locations", value: index.locations.count, systemImage: "map")
                        StatTile("Audio", value: index.audios.count, systemImage: "music.note")
                        StatTile("Files", value: session.snapshot?.paths.count ?? 0, systemImage: "doc.on.doc")
                    }
                }

                HealthSummaryCard(session: session)

                if let date = session.lastReloadedAt {
                    Text("Updated \(date, format: .dateTime.hour().minute().second())")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            .padding()
        }
        .navigationTitle("Overview")
        .onAppear { description = currentDescription }
        .onChange(of: session.snapshot?.files["adv/settings/game.json"]) { _, _ in
            if !editingDescription { description = currentDescription }
        }
        .onChange(of: editingDescription) { _, editing in
            if !editing { saveDescription() }
        }
    }

    private var currentDescription: String {
        guard let text = session.snapshot?.files["adv/settings/game.json"],
              let object = try? JSONSerialization.jsonObject(with: Data(text.utf8)) as? [String: Any] else { return "" }
        return object["description"] as? String ?? ""
    }

    private func saveDescription() {
        let text = description.trimmingCharacters(in: .whitespacesAndNewlines)
        guard text != currentDescription else { return }
        Task {
            do { try await session.setGameDescription(text) }
            catch { model.report(error) }
        }
    }
}

struct HealthSummaryCard: View {
    let session: ProjectSession

    var body: some View {
        let issues = session.validation?.issues ?? []
        let errors = issues.filter { $0.type == .error }.count
        let warnings = issues.count - errors
        NavigationLink(value: ProjectRoute.section(.health)) {
            HStack {
                Image(systemName: errors > 0 ? "xmark.octagon.fill" : warnings > 0 ? "exclamationmark.triangle.fill" : "checkmark.seal.fill")
                    .font(.title2)
                    .foregroundStyle(errors > 0 ? StudioTheme.danger : warnings > 0 ? StudioTheme.gold : StudioTheme.success)
                VStack(alignment: .leading) {
                    Text("Project Health")
                        .font(.headline)
                    if session.validation == nil {
                        Text("Check unavailable: game settings could not be read.")
                    }
                    else if issues.isEmpty {
                        Text("No problems found")
                    }
                    else {
                        Text("\(errors) errors, \(warnings) warnings")
                    }
                }
                .foregroundStyle(.primary)
                Spacer()
                Image(systemName: "chevron.forward")
                    .foregroundStyle(.tertiary)
            }
            .padding()
            .background(.background.secondary, in: .rect(cornerRadius: 12))
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("health-summary")
    }
}
