import StudioKit
import SwiftUI
import UniformTypeIdentifiers

struct AudioMetadataView: View {
    let session: ProjectSession
    let library: ProjectAudioLibrary
    var asset: ProjectAudioAsset?
    var handoff: ContentData?
    let save: (ProjectAudioImport?, ContentData) async throws -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var file: ProjectAudioImport?
    @State private var choosingFile = false
    @State private var title = ""
    @State private var kind = "bgm"
    @State private var labels = ""
    @State private var license = ""
    @State private var loop = false
    @State private var music = MusicFields()
    @State private var busy = false
    @State private var error: StudioAlert?

    init(
        session: ProjectSession, library: ProjectAudioLibrary, asset: ProjectAudioAsset? = nil,
        handoff: ContentData? = nil, save: @escaping (ProjectAudioImport?, ContentData) async throws -> Void
    ) {
        self.session = session
        self.library = library
        self.asset = asset
        self.handoff = handoff
        self.save = save
        let metadata = asset?.music ?? handoff
        let audioKind = asset?.kind ?? "bgm"
        _title = State(initialValue: asset?.title ?? "")
        _kind = State(initialValue: audioKind)
        _labels = State(initialValue: asset?.labels?.joined(separator: ", ") ?? "")
        _license = State(initialValue: asset?.license ?? metadata?["rights"]?.object?["license"]?.string ?? "")
        _loop = State(initialValue: asset?.loop ?? metadata?["brief"]?.object?["loopIntent"]?.boolean ?? (audioKind == "bgm"))
        _music = State(initialValue: MusicFields(metadata))
    }

    var body: some View {
        Form {
            if asset == nil {
                Section {
                    Button("Choose Audio from Files", systemImage: "folder") { choosingFile = true }
                        .accessibilityIdentifier("audio-choose-file")
                    if let file { LabeledContent("Filename", value: file.name) }
                }
            }
            Section("Audio Metadata") {
                TextField("Audio Title", text: $title)
                    .accessibilityIdentifier("audio-title")
                Picker("Audio Kind", selection: $kind) {
                    ForEach(library.kinds, id: \.self) { Text(audioKindName($0)).tag($0) }
                }
                .disabled(asset?.music != nil)
                .accessibilityIdentifier("audio-kind")
                TextField("Labels", text: $labels, prompt: Text("Separate labels with commas"))
                    .accessibilityIdentifier("audio-labels")
                TextField("License", text: $license)
                    .accessibilityIdentifier("audio-license")
                Toggle("Loop Audio", isOn: $loop)
                    .accessibilityIdentifier("audio-loop")
            }
            if hasMusic {
                MusicFieldsView(music: $music, usages: library.usages)
            }
        }
        .disabled(busy)
        .interactiveDismissDisabled(busy)
        .navigationTitle(asset == nil ? "Import Audio" : "Edit Metadata")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() }.disabled(busy) }
            ToolbarItem(placement: .confirmationAction) {
                Button(asset == nil ? "Import" : "Save") { submit() }
                    .disabled(busy || (asset == nil && file == nil) || !library.kinds.contains(kind))
                    .accessibilityIdentifier("audio-save-metadata")
            }
        }
        .fileImporter(isPresented: $choosingFile, allowedContentTypes: [.audio]) { result in
            busy = true
            Task {
                defer { busy = false }
                do {
                    let selected = try await ProjectAudioImport.read(result.get())
                    file = selected
                    if title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                        title = (selected.name as NSString).deletingPathExtension
                    }
                }
                catch let error as CocoaError where error.code == .userCancelled {}
                catch { self.error = StudioAlert(error) }
            }
        }
        .alert(item: $error) { Alert(title: Text("Audio"), message: Text($0.message)) }
    }

    private var hasMusic: Bool { kind == "bgm" && (asset == nil || asset?.music != nil) }

    private var storedLicense: String {
        asset?.license ?? (asset?.music ?? handoff)?["rights"]?.object?["license"]?.string ?? ""
    }

    private func submit() {
        busy = true
        Task {
            defer { busy = false }
            do {
                var seen = Set<String>()
                let keywords = labels.split(whereSeparator: { $0 == "," || $0 == "，" })
                    .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
                    .filter { !$0.isEmpty && seen.insert($0).inserted }
                var draft: ContentData = [
                    "title": title.trimmedValue ?? .null,
                    "kind": .string(kind),
                    "labels": .array(keywords.map(ContentValue.string)),
                    "license": license.trimmedValue ?? .null,
                    "loop": .bool(loop),
                ]
                if hasMusic, asset == nil || music != MusicFields(asset?.music) || license != storedLicense {
                    draft["music"] = .object(try await session.musicBrief(music.data(license: license)).music)
                }
                try await save(file, draft)
                dismiss()
            }
            catch { self.error = StudioAlert(error) }
        }
    }
}

struct MusicFields: Equatable {
    var usage = "background"
    var sourceType = "manual"
    var tool = ""
    var sourceURL = ""
    var summary = ""
    var mood = ""
    var style = ""
    var notes = ""
    var durationSeconds = ""
    var tempo = ""
    var instrumental: Bool?
    var loopIntent: Bool?
    var credit = ""
    var permission = ""

    init(_ metadata: ContentData? = nil) {
        guard let metadata else { return }
        usage = metadata["usage"]?.string ?? usage
        let source = metadata["source"]?.object
        sourceType = source?["type"]?.string ?? sourceType
        tool = source?["tool"]?.string ?? ""
        sourceURL = source?["url"]?.string ?? ""
        let brief = metadata["brief"]?.object
        summary = brief?["summary"]?.string ?? ""
        mood = brief?["mood"]?.string ?? ""
        style = brief?["style"]?.string ?? ""
        notes = brief?["notes"]?.string ?? ""
        if case .number(let value) = brief?["durationSeconds"] { durationSeconds = String(value) }
        if case .number(let value) = brief?["tempoBpm"] { tempo = String(value) }
        instrumental = brief?["instrumental"]?.boolean
        loopIntent = brief?["loopIntent"]?.boolean
        credit = metadata["rights"]?.object?["credit"]?.string ?? ""
        permission = metadata["rights"]?.object?["permissionNote"]?.string ?? ""
    }

    func data(license: String) -> ContentData {
        var source: ContentData = ["type": .string(sourceType)]
        source["tool"] = tool.trimmedValue
        source["url"] = sourceURL.trimmedValue
        var output: ContentData = ["usage": .string(usage), "source": .object(source)]

        var brief: ContentData = [:]
        brief["summary"] = summary.trimmedValue
        brief["mood"] = mood.trimmedValue
        brief["style"] = style.trimmedValue
        brief["durationSeconds"] = durationSeconds.numericValue
        brief["tempoBpm"] = tempo.numericValue
        brief["instrumental"] = instrumental.map(ContentValue.bool)
        brief["loopIntent"] = loopIntent.map(ContentValue.bool)
        brief["notes"] = notes.trimmedValue
        if !brief.isEmpty { output["brief"] = .object(brief) }

        if let license = license.trimmedValue {
            var rights: ContentData = ["license": license]
            rights["credit"] = credit.trimmedValue
            rights["permissionNote"] = permission.trimmedValue
            output["rights"] = .object(rights)
        }
        return output
    }
}

struct MusicFieldsView: View {
    @Binding var music: MusicFields
    let usages: [String]

    var body: some View {
        Section("Music Brief") {
            Picker("Music Usage", selection: $music.usage) {
                ForEach(usages, id: \.self) { Text(usageName($0)).tag($0) }
            }
            Picker("Music Source", selection: $music.sourceType) {
                Text("Manual / Licensed").tag("manual")
                Text("External AI").tag("external-ai")
            }
            TextField("Source Tool", text: $music.tool)
            TextField("Source Page URL", text: $music.sourceURL)
                .keyboardType(.URL)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
            TextField("Music Brief Summary", text: $music.summary, axis: .vertical)
                .lineLimit(2...5)
                .accessibilityIdentifier("music-brief-summary")
            DisclosureGroup("More Music Details") {
                TextField("Mood", text: $music.mood)
                TextField("Style", text: $music.style)
                TextField("Target Duration (seconds)", text: $music.durationSeconds)
                    .keyboardType(.decimalPad)
                TextField("Target Tempo (BPM)", text: $music.tempo)
                    .keyboardType(.decimalPad)
                Picker("Instrumental", selection: $music.instrumental) { intentOptions }
                Picker("Loop Intent", selection: $music.loopIntent) { intentOptions }
                TextField("Credit", text: $music.credit)
                TextField("Permission Note", text: $music.permission)
                TextField("Notes", text: $music.notes, axis: .vertical)
            }
        }
    }

    private var intentOptions: some View {
        Group {
            Text("Unspecified").tag(nil as Bool?)
            Text("Yes").tag(true as Bool?)
            Text("No").tag(false as Bool?)
        }
    }

    private func usageName(_ value: String) -> String {
        switch value {
        case "background": String(localized: "Background Music")
        case "theme": String(localized: "Theme Music")
        case "opening": String(localized: "Opening Music")
        case "ending": String(localized: "Ending Music")
        case "insert": String(localized: "Insert Music")
        default: value
        }
    }
}

private extension String {
    var trimmedValue: ContentValue? {
        let value = trimmingCharacters(in: .whitespacesAndNewlines)
        return value.isEmpty ? nil : .string(value)
    }

    var numericValue: ContentValue? {
        guard let value = trimmedValue?.string else { return nil }
        if let number = Double(value), number.isFinite { return .number(number) }
        if let number = try? Double(value, format: .number), number.isFinite { return .number(number) }
        return .string(value) // Let the shared schema report an invalid target.
    }
}

private extension ContentValue {
    var boolean: Bool? {
        if case .bool(let value) = self { return value }
        return nil
    }
}
