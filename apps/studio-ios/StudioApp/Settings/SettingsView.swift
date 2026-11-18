import SafariServices
import StudioKit
import SwiftUI

/// The Me tab: device preferences, local data and information about the App.
struct SettingsView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.openURL) private var openURL
    @Environment(\.locale) private var locale
    @State private var confirmingClear = false
    @State private var cleared = false
    @State private var showsPrivacy = false
    @State private var versionTaps = 0
    @AppStorage("developerOptions") private var developerOptions = false

    var body: some View {
        @Bindable var model = model
        Form {
            Section("Appearance") {
                Picker("Appearance", selection: $model.appearance) {
                    ForEach(Appearance.allCases) { appearance in
                        Text(appearance.title).tag(appearance)
                    }
                }
                .pickerStyle(.inline)
                .labelsHidden()
            }

            Section {
                Button {
                    // iOS shows the App's language choice on its Settings page.
                    if let url = URL(string: UIApplication.openSettingsURLString) {
                        openURL(url)
                    }
                } label: {
                    LabeledContent("Language", value: languageName)
                }
                .foregroundStyle(.primary)
                .accessibilityIdentifier("language-settings")
            } footer: {
                Text("ADV.JS Studio follows the language you choose for it in Settings. Dates and numbers follow your region.")
            }

            Section("Local Data") {
                NavigationLink {
                    RecentlyDeletedView()
                } label: {
                    LabeledContent("Recently Deleted", value: model.library.recentlyDeleted.count, format: .number)
                }
                Button("Clear Local Data", role: .destructive) {
                    confirmingClear = true
                }
            }

            Section("About") {
                LabeledContent("Version", value: Bundle.main.versionDescription)
                    .contentShape(.rect)
                    .onTapGesture {
                        versionTaps += 1
                        if versionTaps >= 5 { developerOptions = true }
                    }
                    .accessibilityIdentifier("app-version")
                Link(destination: URL(string: "https://advjs.org")!) {
                    Label("ADV.JS Docs", systemImage: "book")
                }
                Link(destination: URL(string: "https://github.com/YunYouJun/advjs")!) {
                    Label("GitHub", systemImage: "chevron.left.forwardslash.chevron.right")
                }
                Button {
                    showsPrivacy = true
                } label: {
                    Label("Privacy Policy", systemImage: "hand.raised")
                }
                Link(destination: URL(string: "https://github.com/YunYouJun/advjs/issues/new")!) {
                    Label("Send Feedback", systemImage: "envelope")
                }
            }

            if developerOptions {
                Section("Developer Options") {
                    NavigationLink("Debug Info") {
                        DebugInfoView()
                    }
                }
            }
        }
        .navigationTitle("Me")
        .confirmationDialog("Clear local data?", isPresented: $confirmingClear, titleVisibility: .visible) {
            Button("Clear Local Data", role: .destructive) { clearLocalData() }
        } message: {
            Text("Preferences, unsaved drafts and caches on this device are removed. Your project files are kept.")
        }
        .alert("Local data cleared", isPresented: $cleared) {
            Button("OK", role: .cancel) {}
        }
        .sheet(isPresented: $showsPrivacy) {
            SafariView(url: URL(string: "https://studio.advjs.org/privacy")!)
                .ignoresSafeArea()
        }
    }

    private var languageName: String {
        let code = Bundle.main.preferredLocalizations.first ?? "en"
        return locale.localizedString(forIdentifier: code) ?? code
    }

    private func clearLocalData() {
        let directories = model.library.directories
        for url in [directories.drafts, directories.staging] {
            try? FileManager.default.removeItem(at: url)
        }
        if let domain = Bundle.main.bundleIdentifier {
            UserDefaults.standard.removePersistentDomain(forName: domain)
        }
        model.appearance = .system
        developerOptions = false
        try? directories.prepare()
        cleared = true
    }
}

/// Redacted diagnostics for bug reports (S11).
struct DebugInfoView: View {
    @Environment(AppModel.self) private var model
    @State private var engineInfo: EngineInfo?
    @State private var copied = false

    var body: some View {
        Form {
            Section {
                ForEach(lines, id: \.0) { line in
                    LabeledContent(line.0, value: line.1)
                }
            } footer: {
                Text("Contains no project names, file contents or account data.")
            }
            Button("Copy Debug Info") {
                UIPasteboard.general.string = lines.map { "\($0.0): \($0.1)" }.joined(separator: "\n")
                copied = true
            }
        }
        .navigationTitle("Debug Info")
        .task {
            _ = try? await model.library.engine.start()
            engineInfo = await model.library.engine.info
        }
        .alert("Copied to clipboard", isPresented: $copied) {
            Button("OK", role: .cancel) {}
        }
    }

    private var lines: [(String, String)] {
        [
            ("App", Bundle.main.versionDescription),
            ("System", "\(UIDevice.current.systemName) \(UIDevice.current.systemVersion)"),
            ("Device", UIDevice.current.model),
            ("Locale", Locale.current.identifier),
            ("Engine API", engineInfo.map { "v\($0.apiVersion), \($0.operations.count) operations" } ?? "—"),
            ("Plugins", engineInfo.map { $0.plugins.sorted { $0.key < $1.key }.map { "\($0.key)@\($0.value)" }.joined(separator: ", ") } ?? "—"),
            ("Projects", "\(model.library.projects.count)"),
        ]
    }
}

struct SafariView: UIViewControllerRepresentable {
    let url: URL

    func makeUIViewController(context: Context) -> SFSafariViewController {
        SFSafariViewController(url: url)
    }

    func updateUIViewController(_ controller: SFSafariViewController, context: Context) {}
}

extension Bundle {
    /// "1.0 (12)".
    var versionDescription: String {
        let version = object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "—"
        let build = object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? "—"
        return "\(version) (\(build))"
    }
}
