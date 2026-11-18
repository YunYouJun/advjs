import StudioKit
import SwiftUI

struct CharacterFormSections: View {
    let session: ProjectSession
    let fields: ContentFields
    let characters: [ContentEntry]

    var body: some View {
        Section("Character Details") {
            csv("Aliases (Comma Separated)", "aliases")
            csv("Tags (Comma Separated)", "tags")
            group([("Faction", "faction"), ("Language", "language"), ("Actor", "actor"), ("Voice Actor", "cv")])
            group([("Appearance", "appearance"), ("Personality", "personality"), ("Background", "background"),
                   ("Concept", "concept"), ("Speech Style", "speechStyle"), ("Knowledge Domain", "knowledgeDomain"),
                   ("Expertise Prompt", "expertisePrompt"), ("Image Prompt", "imagePrompt")])
        }
        CharacterImagesSection(session: session, fields: fields)
        attributes
        CharacterRelationships(fields: fields, characters: characters)
        voice
    }

    private var attributes: some View {
        let template = fields.text("attributes.template")
        return Section("Attributes") {
            Picker("Attribute Template", selection: template) {
                Text("Default").tag("")
                Text("Universal").tag("universal")
                Text("Romance").tag("galgame")
                Text("RPG").tag("rpg")
                Text("Mystery").tag("mystery")
            }
            group([("Age", "age"), ("Gender", "gender"), ("Occupation", "occupation"),
                   ("Appearance Summary", "appearanceSummary")], prefix: "attributes.profile.")
            csv("Personality Tags (Comma Separated)", "attributes.profile.personalityTags")
            switch template.wrappedValue {
            case "galgame":
                group([("Birthday", "birthday"), ("Blood Type", "bloodType"), ("Zodiac", "zodiac"), ("Height", "height")], prefix: "attributes.galgame.")
                csv("Likes (Comma Separated)", "attributes.galgame.likes")
                csv("Dislikes (Comma Separated)", "attributes.galgame.dislikes")
                number("Initial Affinity", "attributes.galgame.affinityInitial")
            case "rpg":
                group([("Species", "race"), ("Class", "class"), ("Alignment", "alignment")], prefix: "attributes.rpg.")
                number("Level", "attributes.rpg.level")
                number("Initial HP", "attributes.rpg.hpInitial")
                number("Initial MP", "attributes.rpg.mpInitial")
                number("Strength", "attributes.rpg.stats.str")
                number("Dexterity", "attributes.rpg.stats.dex")
                number("Intelligence", "attributes.rpg.stats.int")
                number("Constitution", "attributes.rpg.stats.con")
                number("Wisdom", "attributes.rpg.stats.wis")
                number("Charisma", "attributes.rpg.stats.cha")
                csv("Skills (Comma Separated)", "attributes.rpg.skills")
                csv("Equipment (Comma Separated)", "attributes.rpg.equipment")
            case "mystery":
                group([("Public Identity", "publicIdentity"), ("Secret", "secret"), ("Motive", "motive"), ("Alibi", "alibi")], prefix: "attributes.mystery.")
                csv("Clues (Comma Separated)", "attributes.mystery.clues")
                csv("Red Herrings (Comma Separated)", "attributes.mystery.redHerrings")
                number("Initial Suspicion", "attributes.mystery.suspicionInitial")
            default: EmptyView()
            }
            CharacterCustomFields(fields: fields)
        }
    }

    private var voice: some View {
        Section("Voice Profile") {
            group([("Age Impression", "ageImpression"), ("Gender Expression", "genderExpression"),
                   ("Speaking Style", "speakingStyle")], prefix: "voiceProfile.intent.")
            csv("Temperament (Comma Separated)", "voiceProfile.intent.temperament")
            Picker("Pitch", selection: fields.text("voiceProfile.intent.pitch")) {
                Text("Default").tag("")
                Text("Low").tag("low")
                Text("Medium").tag("medium")
                Text("High").tag("high")
            }
            Picker("Pace", selection: fields.text("voiceProfile.intent.pace")) {
                Text("Default").tag("")
                Text("Slow").tag("slow")
                Text("Medium").tag("medium")
                Text("Fast").tag("fast")
            }
            VoiceBindingsView(session: session, fields: fields)
        }
    }

    private func group(_ labels: [(LocalizedStringKey, String)], prefix: String = "") -> some View {
        ForEach(labels, id: \.1) { title, key in
            ContentLabeledField(title: title, text: fields.text(prefix + key))
        }
    }

    private func csv(_ title: LocalizedStringKey, _ path: String) -> some View {
        ContentTagsField(title: title, key: path, fields: fields)
    }

    private func number(_ title: LocalizedStringKey, _ path: String) -> some View {
        TextField(title, value: fields.number(path), format: .number)
            .keyboardType(.numbersAndPunctuation)
    }
}

private struct CharacterCustomFields: View {
    let fields: ContentFields
    @State private var adding = false
    @State private var label = ""

    var body: some View {
        let existing = fields.value("attributes.custom")?.object ?? [:]
        ForEach(existing.keys.sorted(), id: \.self) { key in
            let field = existing[key]?.object ?? [:]
            let label = field["label"]?.string ?? key
            LabeledContent {
                TextField("Custom Value", text: customValue(key, field: field))
                    .accessibilityLabel(Text(label))
                    .multilineTextAlignment(.trailing)
            } label: {
                Text(label)
            }
            .swipeActions {
                Button("Delete", role: .destructive) { update(key, value: nil) }
            }
        }
        Button("Add Custom Field") { label = ""; adding = true }
            .alert("Add Custom Field", isPresented: $adding) {
                TextField("Field Label", text: $label)
                Button("Cancel", role: .cancel) {}
                Button("Add") {
                    let name = label.trimmingCharacters(in: .whitespacesAndNewlines)
                    guard !name.isEmpty else { return }
                    update(UUID().uuidString.lowercased(), value: .object(["label": .string(name), "value": .string("")]))
                }
            }
    }

    private func customValue(_ key: String, field: ContentData) -> Binding<String> {
        Binding {
            let value = field["value"]
            return value?.string ?? value?.array?.compactMap(\.string).joined(separator: ", ") ?? ""
        } set: { text in
            var result = fields.value("attributes.custom")?.object?[key]?.object ?? field
            if field["value"]?.array != nil {
                result["value"] = .array(text.split(separator: ",").map { .string($0.trimmingCharacters(in: .whitespaces)) })
            }
            else if case .number = field["value"], let number = Double(text), number.isFinite {
                result["value"] = .number(number)
            }
            else {
                result["value"] = .string(text)
            }
            update(key, value: .object(result))
        }
    }

    private func update(_ key: String, value: ContentValue?) {
        var values = fields.value("attributes.custom")?.object ?? [:]
        values[key] = value
        fields.assign(values.isEmpty ? nil : .object(values), at: "attributes.custom")
    }
}

private struct CharacterRelationships: View {
    let fields: ContentFields
    let characters: [ContentEntry]

    private var relations: [ContentValue] { fields.value("relationships")?.array ?? [] }
    private var candidates: [ContentEntry] { characters.filter { $0.contentID != fields.value("id")?.string } }

    var body: some View {
        Section("Relationships") {
            ForEach(Array(relations.indices), id: \.self) { index in
                linkedPicker("Character", selection: field("targetId", index), entries: candidates)
                TextField("Relationship Type", text: field("type", index))
                TextField("Description", text: field("description", index), axis: .vertical)
                Button("Remove Relationship", role: .destructive) {
                    var list = relations
                    list.remove(at: index)
                    fields.assign(list.isEmpty ? nil : .array(list), at: "relationships")
                }
            }
            Menu("Add Relationship") {
                ForEach(candidates) { character in
                    if let id = character.contentID {
                        Button(character.name) {
                            fields.assign(.array(relations + [.object(["targetId": .string(id), "type": .string("")])]), at: "relationships")
                        }
                    }
                }
            }
            .disabled(candidates.isEmpty)
        }
    }

    private func field(_ key: String, _ index: Int) -> Binding<String> {
        Binding {
            guard relations.indices.contains(index) else { return "" }
            return relations[index].object?[key]?.string ?? ""
        } set: { value in
            var current = relations
            guard current.indices.contains(index), var relation = current[index].object else { return }
            relation[key] = .string(value)
            current[index] = .object(relation)
            fields.assign(.array(current), at: "relationships")
        }
    }
}
