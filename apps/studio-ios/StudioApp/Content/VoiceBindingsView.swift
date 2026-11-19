import StudioKit
import SwiftUI

struct VoiceBindingsView: View {
    let session: ProjectSession
    let fields: ContentFields
    @State private var editing: VoiceBinding?

    private var locales: ContentData { fields.value("voiceProfile.locales")?.object ?? [:] }

    var body: some View {
        ForEach(bindings) { binding in
            Button {
                editing = binding
            } label: {
                LabeledContent("\(binding.locale) · \(binding.provider)", value: binding.data["voiceId"]?.string ?? "")
            }
            .swipeActions {
                Button("Remove", role: .destructive) { update(removing: binding, adding: nil) }
            }
        }
        Button("Add Voice Binding") { editing = VoiceBinding() }
        .sheet(item: $editing) { binding in
            VoiceBindingEditor(session: session, binding: binding) { updated in
                if let collision = bindings.first(where: { $0.locale == updated.locale && $0.provider == updated.provider }),
                   collision.id != binding.id {
                    throw ProjectLibraryError.nameTaken(updated.provider)
                }
                update(removing: binding, adding: updated)
            }
        }
    }

    private var bindings: [VoiceBinding] {
        locales.keys.sorted().flatMap { locale in
            let providers = locales[locale]?.object?["providers"]?.object ?? [:]
            return providers.keys.sorted().map { VoiceBinding(locale: locale, provider: $0, data: providers[$0]?.object ?? [:]) }
        }
    }

    private func update(removing old: VoiceBinding, adding new: VoiceBinding?) {
        var updated = locales
        if var local = updated[old.locale]?.object, var providers = local["providers"]?.object {
            providers[old.provider] = nil
            local["providers"] = .object(providers)
            updated[old.locale] = providers.isEmpty ? nil : .object(local)
        }
        if let new {
            var local = updated[new.locale]?.object ?? [:]
            var providers = local["providers"]?.object ?? [:]
            providers[new.provider] = .object(new.data)
            local["providers"] = .object(providers)
            updated[new.locale] = .object(local)
        }
        fields.assign(updated.isEmpty ? nil : .object(updated), at: "voiceProfile.locales")
    }
}

private struct VoiceBinding: Identifiable {
    var id: ID { ID(locale: locale, provider: provider) }
    var locale = ""
    var provider = ""
    var data: ContentData = ["source": .string("system")]

    struct ID: Hashable {
        let locale: String
        let provider: String
    }
}

private struct VoiceBindingEditor: View {
    let session: ProjectSession
    let didSave: (VoiceBinding) throws -> Void
    @State private var binding: VoiceBinding
    @State private var saving = false
    @State private var message: String?
    @Environment(\.dismiss) private var dismiss

    init(session: ProjectSession, binding: VoiceBinding, didSave: @escaping (VoiceBinding) throws -> Void) {
        self.session = session
        self.didSave = didSave
        _binding = State(initialValue: binding)
    }

    var body: some View {
        let fields = ContentFields(data: $binding.data)
        NavigationStack {
            Form {
                TextField("Locale", text: $binding.locale)
                    .textInputAutocapitalization(.never).autocorrectionDisabled()
                TextField("Provider ID", text: $binding.provider)
                    .textInputAutocapitalization(.never).autocorrectionDisabled()
                TextField("Voice ID", text: fields.text("voiceId"))
                    .textInputAutocapitalization(.never).autocorrectionDisabled()
                TextField("Model", text: fields.text("model"))
                Picker("Voice Source", selection: fields.text("source")) {
                    Text("System").tag("system")
                    Text("Designed").tag("designed")
                    Text("Recorded").tag("recorded")
                    Text("Cloned").tag("cloned")
                }
                Section("Voice Rights") {
                    TextField("License", text: fields.text("rights.license"))
                    TextField("Subject", text: fields.text("rights.subject"))
                    TextField("Consent Record", text: fields.text("rights.consentRecord"))
                }
                if let message {
                    Label(message, systemImage: "exclamationmark.circle")
                }
            }
            .disabled(saving)
            .navigationTitle("Voice Binding")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() }.disabled(saving) }
                ToolbarItem(placement: .confirmationAction) { Button("Apply", action: apply).disabled(saving) }
            }
        }
        .interactiveDismissDisabled(saving)
    }

    private func apply() {
        saving = true
        Task {
            defer { saving = false }
            do {
                var updated = binding
                updated.provider = updated.provider.trimmingCharacters(in: .whitespacesAndNewlines)
                updated.locale = try await session.prepareVoiceBinding(locale: updated.locale, provider: updated.provider, data: updated.data)
                try didSave(updated)
                dismiss()
            }
            catch {
                message = StudioAlert.describe(error)
            }
        }
    }
}
