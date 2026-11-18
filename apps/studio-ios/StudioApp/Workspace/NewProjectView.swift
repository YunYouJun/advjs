import StudioKit
import SwiftUI

/// Create a project from a shared template or a bundled sample.
struct NewProjectView: View {
    var created: (UUID) -> Void
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    @State private var selection: StarterChoice = .template("visual-novel-starter")
    @State private var isCreating = false
    @State private var error: StudioAlert?
    @FocusState private var nameFocused: Bool

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("My Visual Novel", text: $name)
                        .focused($nameFocused)
                        .submitLabel(.done)
                        .accessibilityIdentifier("project-name")
                } header: {
                    Text("Project Name")
                } footer: {
                    Text("Also the folder name in the Files app.")
                }

                Section("Choose a Template") {
                    ForEach(StarterTemplate.all(templates: model.library.templates)) { template in
                        StarterRow(title: template.title, detail: template.detail, systemImage: template.systemImage, isSelected: selection == .template(template.id)) {
                            selection = .template(template.id)
                        }
                        .accessibilityIdentifier("template-\(template.id)")
                    }
                }

                if !SampleProject.bundled.isEmpty {
                    Section {
                        ForEach(SampleProject.bundled) { sample in
                            StarterRow(title: sample.title, detail: sample.detail, systemImage: "sparkles", isSelected: selection == .sample(sample.id)) {
                                selection = .sample(sample.id)
                                if name.isEmpty { name = String(localized: sample.title) }
                            }
                        }
                    } header: {
                        Text("Samples")
                    } footer: {
                        Text("Complete projects from the ADV.JS contest, ready to play and change.")
                    }
                }
            }
            .navigationTitle("New Project")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Create") { create() }
                        .disabled(name.trimmingCharacters(in: .whitespaces).isEmpty || isCreating)
                        .accessibilityIdentifier("create-project")
                }
            }
            .disabled(isCreating)
            .overlay {
                if isCreating { ProgressView() }
            }
            .alert(item: $error) { alert in
                Alert(title: Text("Couldn’t Create Project"), message: Text(alert.message))
            }
            .task {
                nameFocused = true
                try? await model.library.loadTemplates()
            }
        }
    }

    private func create() {
        isCreating = true
        Task {
            defer { isCreating = false }
            do {
                let record: ProjectRecord
                switch selection {
                case .template(let id):
                    record = try await model.library.create(name: name, templateID: id)
                case .sample(let id):
                    guard let sample = SampleProject.bundled.first(where: { $0.id == id }) else { return }
                    record = try await model.library.importPackage(at: sample.url, name: name)
                }
                dismiss()
                created(record.id)
            }
            catch {
                self.error = StudioAlert(error)
            }
        }
    }
}

enum StarterChoice: Hashable {
    case template(String)
    case sample(String)
}

struct StarterRow: View {
    let title: LocalizedStringResource
    let detail: LocalizedStringResource
    let systemImage: String
    let isSelected: Bool
    let select: () -> Void

    var body: some View {
        Button(action: select) {
            HStack(spacing: 12) {
                Image(systemName: systemImage)
                    .font(.title3)
                    .foregroundStyle(.tint)
                    .frame(width: 28)
                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .foregroundStyle(.primary)
                    Text(detail)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                if isSelected {
                    Image(systemName: "checkmark")
                        .foregroundStyle(.tint)
                        .fontWeight(.semibold)
                }
            }
            .contentShape(.rect)
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }
}

/// Display metadata for the engine's template IDs (`project.templates`).
struct StarterTemplate: Identifiable {
    let id: String
    let title: LocalizedStringResource
    let detail: LocalizedStringResource
    let systemImage: String

    static func all(templates: EngineTemplateList?) -> [StarterTemplate] {
        let ids = templates.map { $0.templates + [$0.quickStart] } ?? known.map(\.id)
        return ids.compactMap { id in known.first { $0.id == id } }
    }

    static let known: [StarterTemplate] = [
        StarterTemplate(id: "visual-novel-starter", title: "Visual Novel Starter", detail: "World setting, outline, and a sample chapter", systemImage: "book"),
        StarterTemplate(id: "school-romance", title: "School Romance", detail: "A youth story at Sakura Academy with characters and scenes", systemImage: "heart"),
        StarterTemplate(id: "mystery-detective", title: "Mystery Detective", detail: "A detective’s investigation into a bizarre disappearance", systemImage: "magnifyingglass"),
        StarterTemplate(id: "fantasy-adventure", title: "Fantasy Adventure", detail: "A magical quest to collect star fragments and save the realm", systemImage: "globe.asia.australia"),
        StarterTemplate(id: "modern-urban", title: "Modern Urban", detail: "A heartwarming tale of city life, coffee, and finding direction", systemImage: "building.2"),
        StarterTemplate(id: "quick-start", title: "Quick Start", detail: "Two ready-made characters in a seaside town, ready to play", systemImage: "bolt"),
    ]
}

/// Contest sample projects packaged into the App bundle at build time
/// (`Samples/<slug>.advpkg.zip`, `pnpm -C apps/studio-ios build:samples`);
/// absent in builds without them.
struct SampleProject: Identifiable {
    let id: String
    let title: LocalizedStringResource
    let detail: LocalizedStringResource
    let url: URL

    static let bundled: [SampleProject] = {
        let metadata: [(String, LocalizedStringResource, LocalizedStringResource)] = [
            ("life-story", "Grandma’s Life", "Life-story ADV · AI for Good · Memory Station"),
            ("history-talk", "Cross-time Conversations", "Talk to Confucius, Turing and da Vinci"),
            ("murder-mystery", "Snowy Manor", "AI murder mystery · 6 NPCs · multiple endings"),
        ]
        return metadata.compactMap { id, title, detail in
            guard let url = Bundle.main.url(forResource: id, withExtension: "advpkg.zip") else { return nil }
            return SampleProject(id: id, title: title, detail: detail, url: url)
        }
    }()
}
