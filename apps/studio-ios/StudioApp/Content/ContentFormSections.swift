import StudioKit
import SwiftUI

struct ContentFields {
    @Binding var data: ContentData

    func value(_ path: String) -> ContentValue? {
        let parts = path.split(separator: ".").map(String.init)
        guard let first = parts.first else { return nil }
        return parts.dropFirst().reduce(data[first]) { $0?.object?[$1] }
    }

    func assign(_ value: ContentValue?, at path: String) {
        func update(_ object: inout ContentData, _ keys: ArraySlice<String>) {
            guard let key = keys.first else { return }
            let rest = keys.dropFirst()
            if rest.isEmpty { object[key] = value }
            else {
                var child = object[key]?.object ?? [:]
                update(&child, rest)
                object[key] = child.isEmpty ? nil : .object(child)
            }
        }
        let parts = path.split(separator: ".").map(String.init)
        update(&data, parts[...])
    }

    func text(_ key: String) -> Binding<String> {
        Binding(get: { value(key)?.string ?? "" }, set: { assign($0.isEmpty ? nil : .string($0), at: key) })
    }

    func number(_ key: String) -> Binding<Double?> {
        Binding {
            if case .number(let number) = value(key) { number } else { nil }
        } set: {
            assign($0.map(ContentValue.number), at: key)
        }
    }
}

struct ContentLabeledField: View {
    let title: LocalizedStringKey
    @Binding var text: String

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title)
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .accessibilityHidden(true)
            TextField("", text: $text, axis: .vertical)
                .accessibilityLabel(Text(title))
        }
    }
}

struct ContentFormSections: View {
    let session: ProjectSession
    let kind: ContentKind
    @Binding var data: ContentData
    let entries: [ContentKind: [ContentEntry]]
    let path: String
    private var fields: ContentFields { ContentFields(data: $data) }

    var body: some View {
        switch kind {
        case .character:
            CharacterFormSections(session: session, fields: fields, characters: entries[.character] ?? [])
        case .scene:
            scene
        case .location:
            location
        case .knowledge:
            Section("Knowledge Base") {
                LabeledContent("Domain", value: data["domain"]?.string ?? "")
                TextEditor(text: fields.text("content"))
                    .font(.body.monospaced())
                    .frame(minHeight: 180)
                    .accessibilityLabel("Markdown")
                    .accessibilityIdentifier("knowledge-markdown")
            }
        }
    }

    private var scene: some View {
        let locations = entries[.location] ?? []
        let selection = fields.text("linkedLocation")
        let linked = locations.first { $0.contentID == selection.wrappedValue }
        return Group {
            Section("Scene Details") {
                linkedPicker("Linked Location", selection: Binding(get: { selection.wrappedValue }, set: { id in
                    selection.wrappedValue = id
                    if fields.text("imagePrompt").wrappedValue.isEmpty,
                       let prompt = locations.first(where: { $0.contentID == id })?.data?["defaultImagePrompt"] {
                        fields.assign(prompt, at: "imagePrompt")
                    }
                }), entries: locations)
                if let linked {
                    NavigationLink(value: ContentRoute.entry(.location, linked.path)) { Text(linked.name) }
                }
                field("Description", "description")
                field("Image Prompt", "imagePrompt")
                ContentTagsField(title: "Tags (Comma Separated)", key: "tags", fields: fields)
                Picker("Scene Type", selection: fields.text("type")) {
                    Text("Image").tag("image")
                    Text("Model").tag("model")
                    if let type = data["type"]?.string, type != "image", type != "model" { Text(type).tag(type) }
                }
                TextField("Source Path", text: fields.text("src"))
                    .autocorrectionDisabled()
                    .textInputAutocapitalization(.never)
                if fields.text("type").wrappedValue == "image", let id = data["id"]?.string {
                    ProjectImageControl(session: session, title: "Scene Background", kind: .scene, ownerID: id, fileLabel: "background",
                                        path: data["src"]?.string) { reference in
                        fields.assign(reference.map(ContentValue.string), at: "src")
                    }
                }
            }
        }
    }

    private var location: some View {
        let scenes = entries[.scene] ?? []
        let characters = entries[.character] ?? []
        let linkedScenes = data["linkedScenes"]?.array?.compactMap(\.string) ?? []
        let linkedCharacters = data["linkedCharacters"]?.array?.compactMap(\.string) ?? []
        let locationID = data["id"]?.string
        return Group {
            Section("Location Details") {
                Picker("Location Type", selection: fields.text("type")) {
                    Text("None").tag("")
                    Text("Indoor").tag("indoor")
                    Text("Outdoor").tag("outdoor")
                    Text("Virtual").tag("virtual")
                    Text("Other").tag("other")
                    if let type = data["type"]?.string, !["", "indoor", "outdoor", "virtual", "other"].contains(type) {
                        Text(type).tag(type)
                    }
                }
                field("Description", "description")
                field("Default Image Prompt", "defaultImagePrompt")
                ContentTagsField(title: "Tags (Comma Separated)", key: "tags", fields: fields)
            }
            Section("Linked Scenes") {
                ContentLinkPicker(title: "Edit Linked Scenes", key: "linkedScenes", fields: fields, available: scenes)
                ForEach(scenes.filter { entry in
                    guard let id = entry.contentID else { return false }
                    return linkedScenes.contains(id) || entry.data?["linkedLocation"]?.string == locationID
                }) { entry in
                    NavigationLink(value: ContentRoute.entry(.scene, entry.path)) { Text(entry.name) }
                }
            }
            Section("Linked Characters") {
                ContentLinkPicker(title: "Edit Linked Characters", key: "linkedCharacters", fields: fields, available: characters)
                ForEach(characters.filter { $0.contentID.map(linkedCharacters.contains) == true }) { entry in
                    NavigationLink(value: ContentRoute.entry(.character, entry.path)) { Text(entry.name) }
                }
            }
        }
    }

    private func field(_ title: LocalizedStringKey, _ key: String) -> some View {
        ContentLabeledField(title: title, text: fields.text(key))
            .accessibilityIdentifier("content-\(key)")
    }
}

func linkedPicker(_ title: LocalizedStringKey, selection: Binding<String>, entries: [ContentEntry]) -> some View {
    let candidates = entries.compactMap { entry in entry.contentID.map { (id: $0, name: entry.name) } }
    var seen = Set<String>()
    let options = candidates.filter { seen.insert($0.id).inserted }
    return Picker(title, selection: selection) {
        Text("None").tag("")
        ForEach(options, id: \.id) { item in Text(item.name).tag(item.id) }
        if !selection.wrappedValue.isEmpty, !options.contains(where: { $0.id == selection.wrappedValue }) {
            Text(selection.wrappedValue).tag(selection.wrappedValue)
        }
    }
    .accessibilityIdentifier("content-linked-picker")
}

private struct ContentLinkPicker: View {
    let title: LocalizedStringKey
    let key: String
    let fields: ContentFields
    let available: [ContentEntry]
    @State private var showingOptions = false

    var body: some View {
        Button { showingOptions = true } label: { Text(title) }
            .sheet(isPresented: $showingOptions) {
                NavigationStack {
                    List {
                        ForEach(available) { entry in
                            if let id = entry.contentID {
                                Toggle(entry.name, isOn: selection(id))
                            }
                        }
                    }
                    .navigationTitle(title)
                    .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { showingOptions = false } } }
                }
            }
    }

    private func selection(_ id: String) -> Binding<Bool> {
        Binding {
            fields.value(key)?.array?.contains(.string(id)) == true
        } set: { selected in
            var ids = fields.value(key)?.array ?? []
            ids.removeAll { $0 == .string(id) }
            if selected { ids.append(.string(id)) }
            fields.assign(ids.isEmpty ? nil : .array(ids), at: key)
        }
    }
}

struct ContentTagsField: View {
    let title: LocalizedStringKey
    let key: String
    let fields: ContentFields
    @State private var text = ""

    private var tags: [ContentValue] { fields.value(key)?.array ?? [] }

    var body: some View {
        TextField(title, text: $text)
            .onAppear { follow(tags) }
            .onChange(of: tags) { _, value in follow(value) }
            .onChange(of: text) { _, value in
                let parsed = parse(value)
                if parsed != tags { fields.assign(parsed.isEmpty ? nil : .array(parsed), at: key) }
            }
    }

    private func follow(_ tags: [ContentValue]) {
        if tags != parse(text) { text = tags.compactMap(\.string).joined(separator: ", ") }
    }

    private func parse(_ text: String) -> [ContentValue] {
        text.split(separator: ",").map { $0.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty }.map(ContentValue.string)
    }
}
