import StudioKit
import SwiftUI

extension ContentKind {
    var title: LocalizedStringKey {
        switch self {
        case .character: "Characters"
        case .scene: "Scenes"
        case .location: "Locations"
        case .knowledge: "Knowledge Base"
        }
    }

    var icon: String {
        switch self {
        case .character: "person.2"
        case .scene: "photo"
        case .location: "map"
        case .knowledge: "books.vertical"
        }
    }
}

struct ContentLibraryView: View {
    var body: some View {
        List(ContentKind.allCases) { kind in
            NavigationLink(value: ContentRoute.list(kind)) {
                Label(kind.title, systemImage: kind.icon)
            }
            .accessibilityIdentifier("content-list-\(kind.rawValue)")
        }
        .navigationTitle("Story Content")
    }
}

enum ContentRoute: Hashable {
    case list(ContentKind)
    case entry(ContentKind, String)
}

extension View {
    func contentDestinations(_ session: ProjectSession) -> some View {
        navigationDestination(for: ContentRoute.self) { route in
            switch route {
            case .list(let kind):
                ContentListView(session: session, kind: kind)
            case .entry(let kind, let path):
                ContentEditorView(session: session, kind: kind, path: path)
                    .id(path)
            }
        }
    }
}

struct ContentListView: View {
    let session: ProjectSession
    let kind: ContentKind

    @Environment(AppModel.self) private var model
    @State private var entries: [ContentEntry] = []
    @State private var query = ""
    @State private var domain = ""
    @State private var ascending = true
    @State private var loaded = false
    @State private var showingCreate = false
    @State private var showingImport = false
    @State private var createdPath: String?
    @State private var share: ContentShare?

    private var domains: [String] {
        Array(Set(entries.compactMap { $0.data?["domain"]?.string })).sorted()
    }

    private var visibleEntries: [ContentEntry] {
        let search = query.trimmingCharacters(in: .whitespacesAndNewlines)
        return entries.filter { entry in
            guard domain.isEmpty || entry.data?["domain"]?.string == domain else { return false }
            if search.isEmpty { return true }
            let aliases = entry.data?["aliases"]?.array?.compactMap(\.string) ?? []
            let tags = entry.data?["tags"]?.array?.compactMap(\.string) ?? []
            let text = entry.data?["content"]?.string ?? entry.data?["description"]?.string ?? ""
            return ([entry.name, entry.contentID ?? "", text] + aliases + tags).contains { $0.localizedStandardContains(search) }
        }
        .sorted {
            let order = $0.name.localizedStandardCompare($1.name)
            return order == .orderedSame ? $0.path < $1.path : order == (ascending ? .orderedAscending : .orderedDescending)
        }
    }

    var body: some View {
        List {
            if kind == .knowledge, !domains.isEmpty {
                Picker("Domain", selection: $domain) {
                    Text("All Domains").tag("")
                    ForEach(domains, id: \.self) { Text($0).tag($0) }
                }
                .accessibilityIdentifier("knowledge-domain-filter")
            }
            ForEach(visibleEntries) { entry in
                NavigationLink(value: ContentRoute.entry(kind, entry.path)) {
                    VStack(alignment: .leading) {
                        Text(entry.name)
                        if let detail = entry.contentID ?? entry.data?["domain"]?.string {
                            Text(detail).font(.caption).foregroundStyle(.secondary)
                        }
                        if session.hasDraft(entry.path) {
                            Text("Draft").font(.caption).foregroundStyle(.secondary)
                        }
                    }
                    .accessibilityElement(children: .combine)
                }
                .accessibilityIdentifier("content-entry-\(entry.path)")
            }
        }
        .overlay {
            if !loaded { ProgressView() }
            else if visibleEntries.isEmpty {
                if entries.isEmpty {
                    ContentUnavailableView {
                        Label("No Entries", systemImage: kind.icon)
                    } actions: {
                        Button("New Entry") { showingCreate = true }
                    }
                }
                else if !query.isEmpty {
                    ContentUnavailableView.search(text: query)
                }
            }
        }
        .navigationTitle(kind.title)
        .searchable(text: $query)
        .toolbar { actions }
        .task(id: LoadKey(snapshot: session.snapshot, drafts: session.drafts)) { await load() }
        .refreshable { await session.reload() }
        .sheet(isPresented: $showingCreate) {
            ContentCreateView(session: session, kind: kind, domain: domain) { createdPath = $0 }
        }
        .sheet(isPresented: $showingImport) {
            ContentImportView(session: session, kind: kind)
        }
        .sheet(item: $share) { item in
            ShareSheet(items: item.items).onDisappear { item.cleanUp() }
        }
        .navigationDestination(item: $createdPath) { path in
            ContentEditorView(session: session, kind: kind, path: path).id(path)
        }
    }

    @ToolbarContentBuilder
    private var actions: some ToolbarContent {
        ToolbarItem(placement: .primaryAction) {
            Button { showingCreate = true } label: { Label("New Entry", systemImage: "plus") }
                .accessibilityIdentifier("new-content")
        }
        ToolbarItem(placement: .secondaryAction) {
            Menu {
                Picker("Sort by Name", selection: $ascending) {
                    Text("Ascending").tag(true)
                    Text("Descending").tag(false)
                }
                if kind == .character || kind == .scene {
                    Button { showingImport = true } label: { Label("Batch Import…", systemImage: "square.and.arrow.down") }
                        .accessibilityIdentifier("content-import")
                }
                if kind == .character {
                    Button("Share Characters CSV…") { exportCSV(relationships: false) }
                    Button("Share Relationships CSV…") { exportCSV(relationships: true) }
                }
            } label: {
                Label("Content Options", systemImage: "ellipsis.circle")
            }
        }
    }

    private func load() async {
        do {
            let result = try await session.contentEntries(kind)
            try Task.checkCancellation()
            entries = result
            if !domain.isEmpty, !domains.contains(domain) { domain = "" }
            loaded = true
        }
        catch is CancellationError {}
        catch {
            loaded = true
            model.report(error)
        }
    }

    private func exportCSV(relationships: Bool) {
        Task {
            do {
                let csv = try await session.characterCSVs()
                let name = relationships ? "relationships.csv" : "characters.csv"
                let text = relationships ? csv.relationships : csv.characters
                share = try .file(name: name, data: Data(text.utf8))
            }
            catch { model.report(error) }
        }
    }

    private struct LoadKey: Equatable {
        var snapshot: ProjectSnapshot?
        var drafts: [FileDraft]
    }
}

private struct ContentCreateView: View {
    let session: ProjectSession
    let kind: ContentKind
    let domain: String
    let didCreate: (String) -> Void

    @Environment(\.dismiss) private var dismiss
    @Environment(AppModel.self) private var model
    @State private var name = ""
    @State private var id = ""
    @State private var selectedDomain = ""
    @State private var saving = false

    var body: some View {
        NavigationStack {
            Form {
                TextField("Name", text: $name)
                    .accessibilityIdentifier("new-content-name")
                if kind == .knowledge {
                    TextField("Domain", text: $selectedDomain)
                        .accessibilityIdentifier("new-content-domain")
                }
                else {
                    TextField("Content ID (Optional)", text: $id)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .accessibilityIdentifier("new-content-id")
                }
            }
            .navigationTitle("New Entry")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() }.disabled(saving) }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Create", action: create)
                        .disabled(saving || name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                        .accessibilityIdentifier("create-content")
                }
            }
        }
        .onAppear { selectedDomain = domain.isEmpty ? "general" : domain }
        .interactiveDismissDisabled(saving)
    }

    private func create() {
        saving = true
        Task {
            defer { saving = false }
            do {
                let path = try await session.createContent(kind, data: ["name": .string(name), "id": .string(id), "domain": .string(selectedDomain)])
                dismiss()
                didCreate(path)
            }
            catch { model.report(error) }
        }
    }
}
