import StudioKit
import SwiftUI

struct AudioMixerView: View {
    let session: ProjectSession
    let library: ProjectAudioLibrary
    @Environment(\.dismiss) private var dismiss
    @State private var revision: String
    @State private var draft: ProjectAudioMixer
    @State private var busy = false
    @State private var error: StudioAlert?

    init(session: ProjectSession, library: ProjectAudioLibrary, revision: String) {
        self.session = session
        self.library = library
        _revision = State(initialValue: revision)
        _draft = State(initialValue: library.mixer)
    }

    var body: some View {
        Form {
            ForEach(library.buses, id: \.self) { bus in
                Section(audioKindName(bus)) {
                    gain(busValue(bus, \.gain, default: 1), title: "Gain")
                        .accessibilityIdentifier("mixer-gain-\(bus)")
                    Toggle("Mute", isOn: busValue(bus, \.muted, default: false))
                        .accessibilityIdentifier("mixer-mute-\(bus)")
                    Toggle("Solo", isOn: busValue(bus, \.solo, default: false))
                        .accessibilityIdentifier("mixer-solo-\(bus)")
                }
            }
            Section("Ducking") {
                Toggle("Duck Music Under Voice", isOn: duckValue(\.enabled, default: true))
                    .accessibilityIdentifier("mixer-ducking-enabled")
                gain(duckValue(\.gain, default: 0.35), title: "Ducked Gain")
                    .accessibilityIdentifier("mixer-ducking-gain")
                TextField("Attack (ms)", value: duckValue(\.attackMs, default: 120), format: .number)
                    .keyboardType(.numberPad)
                    .accessibilityIdentifier("mixer-ducking-attack")
                TextField("Release (ms)", value: duckValue(\.releaseMs, default: 300), format: .number)
                    .keyboardType(.numberPad)
                    .accessibilityIdentifier("mixer-ducking-release")
            }
        }
        .disabled(busy)
        .interactiveDismissDisabled(busy)
        .navigationTitle("Mixer")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() }.disabled(busy) }
            ToolbarItem(placement: .confirmationAction) {
                Button("Save Mixer") {
                    busy = true
                    Task {
                        defer { busy = false }
                        do {
                            try await session.saveAudioMixer(draft, revision: revision)
                            dismiss()
                        }
                        catch { self.error = StudioAlert(error) }
                    }
                }
                .disabled(busy || draft == library.mixer)
                .accessibilityIdentifier("mixer-save")
            }
        }
        .alert(item: $error) { Alert(title: Text("Mixer"), message: Text($0.message)) }
    }

    private func gain(_ value: Binding<Double>, title: LocalizedStringKey) -> some View {
        Slider(value: value, in: 0...1, step: 0.01) { Text(title) }
            .accessibilityValue(value.wrappedValue.formatted(.percent.precision(.fractionLength(0))))
    }

    private func busValue<Value>(_ bus: String, _ key: WritableKeyPath<ProjectAudioMixer.Bus, Value?>, default fallback: Value) -> Binding<Value> {
        Binding(get: { draft.buses?[bus]?[keyPath: key] ?? fallback }, set: { value in
            var settings = draft.buses ?? [:]
            settings[bus, default: .init()][keyPath: key] = value
            draft.buses = settings
        })
    }

    private func duckValue<Value>(_ key: WritableKeyPath<ProjectAudioMixer.Ducking, Value?>, default fallback: Value) -> Binding<Value> {
        Binding(get: { draft.ducking?[keyPath: key] ?? fallback }, set: { value in
            var ducking = draft.ducking ?? .init()
            ducking[keyPath: key] = value
            draft.ducking = ducking
        })
    }
}
