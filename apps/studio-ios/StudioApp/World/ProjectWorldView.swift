import StudioKit
import SwiftUI

struct ProjectWorldView: View {
    let session: ProjectSession
    @Environment(AppModel.self) private var model
    @State private var characters: [ContentEntry] = []
    @State private var locations: [ContentEntry] = []
    @State private var loaded = false
    @State private var kind = ContentKind.character
    @AppStorage private var date: Double
    @AppStorage private var period: WorldPeriod
    @AppStorage private var perspective: WorldPerspective
    @AppStorage private var player: String

    init(session: ProjectSession) {
        self.session = session
        let key = "world.\(session.id.uuidString)"
        _date = AppStorage(wrappedValue: Calendar.current.startOfDay(for: .now).timeIntervalSince1970, "\(key).date")
        _period = AppStorage(wrappedValue: .morning, "\(key).period")
        _perspective = AppStorage(wrappedValue: .visitor, "\(key).perspective")
        _player = AppStorage(wrappedValue: "", "\(key).player")
    }

    private var nodes: [ContentEntry] {
        (kind == .character ? characters : locations).filter { $0.contentID != nil }
    }

    private var edges: [WorldRelationship] {
        switch kind {
        case .character: WorldRelationships.characters(nodes)
        case .location: WorldRelationships.locations(nodes, characters: characters)
        default: []
        }
    }

    var body: some View {
        List {
            Section("World Clock") {
                DatePicker("World Date", selection: Binding(
                    get: { Date(timeIntervalSince1970: date) },
                    set: { date = $0.timeIntervalSince1970 }
                ), displayedComponents: .date)
                Picker("Time of Day", selection: $period) {
                    ForEach(WorldPeriod.allCases, id: \.self) { Text($0.title).tag($0) }
                }
                Button("Advance Time") { advanceTime() }
            }
            Section("Perspective") {
                Picker("Perspective", selection: $perspective) {
                    ForEach(WorldPerspective.allCases, id: \.self) { Text($0.title).tag($0) }
                }
                if perspective == .character {
                    linkedPicker("Player Character", selection: $player, entries: characters)
                }
            }
            Section("Relationship Graph") {
                Picker("Relationship Graph", selection: $kind) {
                    Text("Characters").tag(ContentKind.character)
                    Text("Locations").tag(ContentKind.location)
                }
                .pickerStyle(.segmented)
                .accessibilityIdentifier("world-graph-kind")
                if !loaded {
                    ProgressView()
                }
                else if nodes.isEmpty {
                    ContentUnavailableView("No Entries", systemImage: kind.icon)
                }
                else {
                    RelationshipMap(kind: kind, nodes: nodes, edges: edges)
                        .id(kind)
                }
            }
            if !nodes.isEmpty {
                Section(kind.title) {
                    ForEach(nodes) { entry in
                        let related = edges.filter { $0.source == entry.path || $0.target == entry.path }
                        NavigationLink(value: ContentRoute.entry(kind, entry.path)) {
                            VStack(alignment: .leading) {
                                Text(entry.name)
                                ForEach(Array(related.enumerated()), id: \.offset) { _, edge in
                                    let path = edge.source == entry.path ? edge.target : edge.source
                                    if let neighbor = nodes.first(where: { $0.path == path }) {
                                        Text(edge.label.isEmpty ? neighbor.name : "\(neighbor.name) · \(edge.label)")
                                            .font(.caption)
                                            .foregroundStyle(.secondary)
                                    }
                                }
                            }
                            .accessibilityElement(children: .combine)
                        }
                        .accessibilityIdentifier("world-record-\(entry.path)")
                    }
                }
            }
        }
        .navigationTitle("World")
        .task(id: session.snapshot) {
            do {
                let characters = try await session.contentEntries(.character)
                let locations = try await session.contentEntries(.location)
                try Task.checkCancellation()
                self.characters = characters
                self.locations = locations
                loaded = true
            }
            catch is CancellationError {}
            catch { model.report(error) }
        }
    }

    private func advanceTime() {
        let periods = WorldPeriod.allCases
        guard let index = periods.firstIndex(of: period) else { return }
        period = periods[(index + 1) % periods.count]
        if period == .morning,
           let next = Calendar.current.date(byAdding: .day, value: 1, to: Date(timeIntervalSince1970: date)) {
            date = next.timeIntervalSince1970
        }
    }
}

private enum WorldPeriod: String, CaseIterable {
    case morning, afternoon, evening, night

    var title: LocalizedStringKey {
        switch self {
        case .morning: "Morning"
        case .afternoon: "Afternoon"
        case .evening: "Evening"
        case .night: "Night"
        }
    }
}

private enum WorldPerspective: String, CaseIterable {
    case visitor, character, god

    var title: LocalizedStringKey {
        switch self {
        case .visitor: "Visitor"
        case .character: "Character"
        case .god: "Omniscient"
        }
    }
}
