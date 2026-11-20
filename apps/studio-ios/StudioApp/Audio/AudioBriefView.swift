import StudioKit
import SwiftUI
import UniformTypeIdentifiers

struct AudioBriefView: View {
    let session: ProjectSession
    let usages: [String]
    let useForImport: (ContentData) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var fields = MusicFields()
    @State private var license = ""
    @State private var document: MusicBriefDocument?
    @State private var exporting = false
    @State private var busy = false
    @State private var copied = false
    @State private var error: StudioAlert?

    var body: some View {
        Form {
            MusicFieldsView(music: $fields, usages: usages)
            TextField("License", text: $license)
                .accessibilityIdentifier("music-brief-license")
            Section {
                Button(copied ? "Brief Copied" : "Copy Brief Text", systemImage: "doc.on.doc") {
                    prepare { brief in
                        UIPasteboard.general.string = brief.text
                        copied = true
                    }
                }
                .accessibilityIdentifier("music-brief-copy")
                Button("Export Brief JSON", systemImage: "square.and.arrow.up") {
                    prepare { brief in
                        document = MusicBriefDocument(text: brief.json)
                        exporting = true
                    }
                }
                .accessibilityIdentifier("music-brief-export")
                Button("Use Brief for Import", systemImage: "square.and.arrow.down") {
                    prepare { brief in useForImport(brief.music) }
                }
                .accessibilityIdentifier("music-brief-use")
                Link("Open Suno", destination: URL(string: "https://suno.com/create")!)
            }
        }
        .disabled(busy)
        .navigationTitle("Music Brief")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) { Button("Done") { dismiss() }.disabled(busy) }
        }
        .fileExporter(isPresented: $exporting, document: document, contentType: .json, defaultFilename: "music-brief.json") { result in
            document = nil
            if case .failure(let error) = result { self.error = StudioAlert(error) }
        }
        .alert(item: $error) { Alert(title: Text("Music Brief"), message: Text($0.message)) }
    }

    private func prepare(_ action: @escaping (ProjectMusicBrief) -> Void) {
        busy = true
        Task {
            defer { busy = false }
            do { action(try await session.musicBrief(fields.data(license: license))) }
            catch { self.error = StudioAlert(error) }
        }
    }
}

private struct MusicBriefDocument: FileDocument {
    static let readableContentTypes: [UTType] = [.json]
    let text: String

    init(text: String) { self.text = text }

    init(configuration: ReadConfiguration) throws {
        guard let bytes = configuration.file.regularFileContents, let text = String(data: bytes, encoding: .utf8) else {
            throw CocoaError(.fileReadCorruptFile)
        }
        self.text = text
    }

    func fileWrapper(configuration: WriteConfiguration) throws -> FileWrapper {
        FileWrapper(regularFileWithContents: Data(text.utf8))
    }
}
