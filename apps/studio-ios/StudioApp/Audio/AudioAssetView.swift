import AVFoundation
import StudioKit
import SwiftUI

struct AudioAssetView: View {
    private enum Sheet: Identifiable {
        case edit(ProjectAudioAsset, String)
        case chapters
        case binding(ProjectMusicBinding)

        var id: String {
            switch self {
            case .edit: "edit"
            case .chapters: "chapters"
            case .binding: "binding"
            }
        }
    }

    let session: ProjectSession
    let assetID: String
    let chapter: String?
    let initialLibrary: ProjectAudioLibrary?

    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.dismiss) private var dismiss
    @State private var audition = AudioAudition()
    @State private var refreshedLibrary: ProjectAudioLibrary?
    @State private var confirmed = false
    @State private var busy = false
    @State private var error: StudioAlert?
    @State private var sheet: Sheet?
    @State private var deleting = false

    private var library: ProjectAudioLibrary? { refreshedLibrary ?? initialLibrary }
    private var asset: ProjectAudioAsset? { library?.assets.first { $0.id == assetID } }

    var body: some View {
        Group {
            if let asset, let library, let revision = library.revision {
                Form {
                    information(asset)
                    playback(asset)
                    if asset.kind == "bgm" { review(asset, revision: revision) }
                    Section {
                        Button("Edit Metadata", systemImage: "pencil") {
                            stop()
                            sheet = .edit(asset, revision)
                        }
                        .accessibilityIdentifier("audio-edit")
                        Button("Remove Audio from Library", systemImage: "trash", role: .destructive) { deleting = true }
                            .accessibilityIdentifier("audio-delete")
                    }
                }
                .disabled(busy)
                .navigationTitle(asset.name)
                .confirmationDialog("Remove this audio resource?", isPresented: $deleting, titleVisibility: .visible) {
                    Button("Remove Audio from Library", role: .destructive) {
                        stop()
                        run {
                            try await session.removeAudio(asset.id, revision: revision)
                            dismiss()
                        }
                    }
                    .accessibilityIdentifier("audio-confirm-delete")
                } message: {
                    Text("This removes the catalog entry and keeps the original audio file in the project.")
                }
                .sheet(item: $sheet) { route in
                    NavigationStack {
                        switch route {
                        case .edit(let current, let version):
                            AudioMetadataView(session: session, library: library, asset: current) { _, draft in
                                try await session.updateAudio(current.id, metadata: draft, revision: version)
                            }
                        case .chapters:
                            chapterPicker(asset)
                        case .binding(let binding):
                            MusicBindingView(session: session, binding: binding)
                        }
                    }
                }
                .task(id: audition.isPlaying) { if audition.isPlaying { await audition.track(asset) } }
            }
            else {
                ContentUnavailableView("Audio Resource Unavailable", systemImage: "waveform.slash")
            }
        }
        .navigationBarTitleDisplayMode(.inline)
        .task(id: session.lastReloadedAt) {
            do {
                let latest = try await session.audioLibrary()
                if !Task.isCancelled { refreshedLibrary = latest }
            }
            catch {
                if !Task.isCancelled { self.error = StudioAlert(error) }
            }
        }
        .onDisappear { stop() }
        .onChange(of: scenePhase) { _, phase in if phase != .active { stop() } }
        .onChange(of: session.state) { _, state in if state != .ready { stop() } }
        .onChange(of: library?.revision) { stop() }
        .onReceive(NotificationCenter.default.publisher(for: AVAudioSession.interruptionNotification)) { note in
            if note.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt == AVAudioSession.InterruptionType.began.rawValue {
                stop()
            }
        }
        .alert(item: $error) { Alert(title: Text("Audio"), message: Text($0.message)) }
    }

    private func information(_ asset: ProjectAudioAsset) -> some View {
        Section {
            LabeledContent("Audio Kind", value: audioKindName(asset.kind))
            if let duration = asset.duration {
                LabeledContent("Duration", value: Duration.seconds(duration).formatted(.units(allowed: [.minutes, .seconds], width: .abbreviated)))
            }
            if let labels = asset.labels, !labels.isEmpty {
                LabeledContent("Labels", value: labels.joined(separator: ", "))
            }
            if let license = asset.license { LabeledContent("License", value: license) }
            if let bytes = asset.bytes { LabeledContent("Size", value: Int64(bytes), format: .byteCount(style: .file)) }
            if let path = asset.mediaPath {
                Text(path).font(.caption.monospaced()).textSelection(.enabled)
                    .accessibilityIdentifier("audio-media-path")
            }
        }
    }

    private func playback(_ asset: ProjectAudioAsset) -> some View {
        Section("Audition") {
            Button {
                run { try await audition.toggle(asset: asset, in: session) }
            } label: {
                if audition.isPlaying { Label("Pause Audio", systemImage: "pause.fill") }
                else { Label("Play Audio", systemImage: "play.fill") }
            }
            .accessibilityIdentifier("audio-play-pause")
            if audition.duration > 0 {
                Slider(value: Binding(get: { audition.position }, set: { audition.seek($0) }), in: 0...audition.duration) {
                    Text("Playback Position")
                }
                .accessibilityValue(audition.position.formatted(.number.precision(.fractionLength(1))))
                .accessibilityIdentifier("audio-progress")
            }
        }
    }

    private func review(_ asset: ProjectAudioAsset, revision: String) -> some View {
        Section("Music Review") {
            LabeledContent("Review Status", value: reviewName(asset.musicReview.status))
                .accessibilityIdentifier("music-review-status")
            if let music = asset.music {
                if let summary = music["brief"]?.object?["summary"]?.string { Text(summary) }
                Toggle("I Have Listened", isOn: $confirmed)
                    .disabled(asset.sha256 == nil || audition.auditionedHash != asset.sha256)
                    .accessibilityIdentifier("music-listened")
                Button("Approve Music", systemImage: "checkmark.circle") {
                    let hash = audition.auditionedHash
                    stop()
                    run { try await session.reviewMusic(asset, approving: true, auditionedHash: hash, revision: revision) }
                }
                .disabled(!confirmed || music["rights"]?.object?["license"]?.string == nil)
                .accessibilityIdentifier("music-approve")
                Button("Reject Music", systemImage: "xmark.circle", role: .destructive) {
                    stop()
                    run { try await session.reviewMusic(asset, approving: false, auditionedHash: nil, revision: revision) }
                }
                .accessibilityIdentifier("music-reject")
            }
            Button("Bind to Chapter", systemImage: "link") {
                stop()
                if let chapter {
                    run { sheet = .binding(try await session.prepareMusicBinding(asset, chapter: chapter)) }
                }
                else {
                    sheet = .chapters
                }
            }
            .disabled(!asset.musicReview.canBind)
            .accessibilityIdentifier("music-bind")
        }
    }

    private func chapterPicker(_ asset: ProjectAudioAsset) -> some View {
        List((session.index?.chapters ?? []).filter { $0.file.hasSuffix(".adv.md") }, id: \.file) { chapter in
            NavigationLink {
                MusicBindingLoader(session: session, asset: asset, path: chapter.file)
            } label: {
                Text(chapter.title ?? chapter.name)
            }
        }
        .navigationTitle("Bind to Chapter")
    }

    private func stop() {
        audition.stop()
        confirmed = false
    }

    private func run(_ operation: @escaping () async throws -> Void) {
        guard !busy else { return }
        busy = true
        Task {
            defer { busy = false }
            do { try await operation() }
            catch { self.error = StudioAlert(error) }
        }
    }

    private func reviewName(_ status: String) -> String {
        switch status {
        case "legacy": String(localized: "Legacy Music")
        case "pending": String(localized: "Pending Review")
        case "approved": String(localized: "Approved")
        case "rejected": String(localized: "Rejected")
        default: String(localized: "Invalid Review")
        }
    }
}

private struct MusicBindingLoader: View {
    let session: ProjectSession
    let asset: ProjectAudioAsset
    let path: String
    @State private var binding: ProjectMusicBinding?
    @State private var error: String?

    var body: some View {
        Group {
            if let binding { MusicBindingView(session: session, binding: binding) }
            else if let error {
                ContentUnavailableView("Cannot Bind Music", systemImage: "exclamationmark.triangle", description: Text(error))
            }
            else { ProgressView() }
        }
        .task {
            do { binding = try await session.prepareMusicBinding(asset, chapter: path) }
            catch { self.error = StudioAlert.describe(error) }
        }
    }
}

private struct MusicBindingView: View {
    let session: ProjectSession
    let binding: ProjectMusicBinding
    @Environment(\.dismiss) private var dismiss
    @State private var busy = false
    @State private var error: StudioAlert?

    var body: some View {
        let excerpts = changedLines
        List {
            Section("Chapter") { Text(binding.path).font(.caption.monospaced()) }
            source("Before", text: excerpts.before)
            source("After", text: excerpts.after)
        }
        .navigationTitle("Preview Music Binding")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .confirmationAction) {
                Button("Apply Binding") {
                    busy = true
                    Task {
                        defer { busy = false }
                        do {
                            try await session.applyMusicBinding(binding)
                            dismiss()
                        }
                        catch { self.error = StudioAlert(error) }
                    }
                }
                .disabled(busy)
                .accessibilityIdentifier("music-apply-binding")
            }
        }
        .alert(item: $error) { Alert(title: Text("Cannot Bind Music"), message: Text($0.message)) }
    }

    private var changedLines: (before: String, after: String) {
        let before = binding.original.replacingOccurrences(of: "\r\n", with: "\n").components(separatedBy: "\n")
        let after = binding.content.replacingOccurrences(of: "\r\n", with: "\n").components(separatedBy: "\n")
        let prefix = zip(before, after).prefix { $0.0 == $0.1 }.count
        let suffix = zip(before.dropFirst(prefix).reversed(), after.dropFirst(prefix).reversed())
            .prefix { $0.0 == $0.1 }.count
        let start = max(0, prefix - 2)
        func excerpt(_ lines: [String]) -> String {
            let end = lines.count - max(0, suffix - 2)
            return lines[start..<end].joined(separator: "\n")
        }
        return (excerpt(before), excerpt(after))
    }

    private func source(_ title: LocalizedStringKey, text: String) -> some View {
        Section(title) {
            Text(text).font(.caption.monospaced()).textSelection(.enabled)
        }
    }
}
