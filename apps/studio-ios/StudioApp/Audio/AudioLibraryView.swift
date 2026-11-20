import StudioKit
import SwiftUI

struct AudioLibraryView: View {
    private struct AssetRoute: Hashable { let id: String }

    private enum Sheet: Identifiable {
        case importAudio(ContentData?)
        case brief, mixer

        var id: String {
            switch self {
            case .importAudio: "import"
            case .brief: "brief"
            case .mixer: "mixer"
            }
        }
    }

    let session: ProjectSession
    var chapter: String?
    @State private var library: ProjectAudioLibrary?
    @State private var loadError: String?
    @State private var error: StudioAlert?
    @State private var query = ""
    @State private var kind = ""
    @State private var sheet: Sheet?
    @State private var busy = false

    private var visibleAssets: [ProjectAudioAsset] {
        let needle = query.trimmingCharacters(in: .whitespacesAndNewlines)
        return (library?.assets ?? []).filter { asset in
            (kind.isEmpty || asset.kind == kind) && (needle.isEmpty ||
                ([asset.name, asset.id, asset.kind] + (asset.labels ?? [])).contains { $0.localizedCaseInsensitiveContains(needle) })
        }
    }

    var body: some View {
        Group {
            if let library, library.state == .ready {
                resources(library)
            }
            else if let library {
                unavailable(library.state)
            }
            else if let loadError {
                ContentUnavailableView("Audio Library Unavailable", systemImage: "exclamationmark.triangle", description: Text(loadError))
            }
            else {
                ProgressView()
            }
        }
        .navigationTitle("Audio Library")
        .toolbar {
            if library?.state == .ready {
                ToolbarItem(placement: .primaryAction) {
                    Menu("Audio Actions", systemImage: "ellipsis.circle") {
                        Button("Import Audio", systemImage: "square.and.arrow.down") { sheet = .importAudio(nil) }
                            .accessibilityIdentifier("audio-import")
                        Button("Music Brief", systemImage: "doc.text") { sheet = .brief }
                            .accessibilityIdentifier("audio-brief")
                        Button("Mixer", systemImage: "slider.horizontal.3") { sheet = .mixer }
                            .accessibilityIdentifier("audio-mixer")
                    }
                    .disabled(busy)
                    .accessibilityIdentifier("audio-actions")
                }
            }
        }
        .task(id: session.lastReloadedAt) { await load() }
        .refreshable { await session.refreshIfChangedOnDisk(); await load() }
        .navigationDestination(for: AssetRoute.self) { route in
            AudioAssetView(session: session, assetID: route.id, chapter: chapter, initialLibrary: library)
                .id(route.id)
        }
        .alert(item: $error) { Alert(title: Text("Audio"), message: Text($0.message)) }
        .sheet(item: $sheet) { route in
            if let library, let revision = library.revision {
                NavigationStack {
                    switch route {
                    case .importAudio(let handoff):
                        AudioMetadataView(session: session, library: library, handoff: handoff) { file, draft in
                            guard let file else { throw ProjectAudioError.missingFile }
                            _ = try await session.importAudio(file, metadata: draft, revision: revision)
                        }
                    case .brief:
                        AudioBriefView(session: session, usages: library.usages) { music in
                            sheet = .importAudio(music)
                        }
                    case .mixer:
                        AudioMixerView(session: session, library: library, revision: revision)
                    }
                }
            }
        }
    }

    private func resources(_ library: ProjectAudioLibrary) -> some View {
        List {
            Picker("Audio Kind", selection: $kind) {
                Text("All Audio").tag("")
                ForEach(library.kinds, id: \.self) { Text(audioKindName($0)).tag($0) }
            }
            .accessibilityIdentifier("audio-filter")
            if visibleAssets.isEmpty {
                if library.assets.isEmpty {
                    Button("Import Audio", systemImage: "square.and.arrow.down") { sheet = .importAudio(nil) }
                        .accessibilityIdentifier("audio-empty-import")
                }
                else {
                    ContentUnavailableView.search(text: query)
                }
            }
            ForEach(visibleAssets) { asset in
                NavigationLink(value: AssetRoute(id: asset.id)) {
                    VStack(alignment: .leading) {
                        Text(asset.name)
                        Text(audioKindName(asset.kind))
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
                .accessibilityIdentifier("audio-asset-\(asset.id)")
            }
        }
        .searchable(text: $query, prompt: "Search Audio")
        .disabled(busy)
    }

    private func unavailable(_ state: ProjectAudioLibrary.State) -> some View {
        ContentUnavailableView {
            Label("Audio Library", systemImage: "waveform")
        } description: {
            Text(state == .legacy ? "Migrate the existing asset catalog in Web Studio before editing audio." :
                    "Initialize the project’s audio catalog to import and bind audio.")
        } actions: {
            if state == .uninitialized {
                Button("Initialize Audio Catalog") { run { try await session.initializeAudioLibrary() } }
                    .buttonStyle(.borderedProminent)
                    .disabled(busy)
                    .accessibilityIdentifier("audio-initialize")
            }
        }
    }

    private func load() async {
        do {
            let result = try await session.audioLibrary()
            guard !Task.isCancelled else { return }
            library = result
            loadError = nil
        }
        catch {
            guard !Task.isCancelled else { return }
            loadError = StudioAlert.describe(error)
            library = nil
        }
    }

    private func run(_ operation: @escaping () async throws -> Void) {
        guard !busy else { return }
        busy = true
        Task {
            defer { busy = false }
            do { try await operation() }
            catch let error as CocoaError where error.code == .userCancelled {}
            catch { self.error = StudioAlert(error) }
        }
    }
}

func audioKindName(_ kind: String) -> String {
    switch kind {
    case "bgm", "music": String(localized: "Background Music")
    case "ambience": String(localized: "Ambience")
    case "voice": String(localized: "Voice")
    case "sfx": String(localized: "Sound Effects")
    case "ui": String(localized: "Interface Sounds")
    case "reference": String(localized: "Reference Audio")
    case "master": String(localized: "Master")
    default: kind
    }
}
