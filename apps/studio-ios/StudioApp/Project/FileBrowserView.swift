import AVKit
import StudioKit
import SwiftUI

/// One folder of the project, like the Files App: subfolders push further
/// in, files open in the editor or a preview. Rename, duplicate and delete
/// from each file's menu.
struct FileBrowserView: View {
    let session: ProjectSession
    /// Project-relative folder; empty for the project root.
    var folder = ""
    @Environment(AppModel.self) private var model
    @State private var renaming: String?
    @State private var newName = ""
    @State private var isCreating = false
    @State private var newFileName = "notes.md"
    @State private var deleting: String?

    private var listing: FolderListing {
        FolderListing(paths: session.snapshot?.paths ?? [], folder: folder)
    }

    var body: some View {
        List {
            ForEach(listing.folders, id: \.self) { name in
                NavigationLink(value: ProjectRoute.folder(path(name))) {
                    Label(name, systemImage: "folder")
                }
                .accessibilityIdentifier("folder-\(path(name))")
            }
            ForEach(listing.files, id: \.self) { name in
                let filePath = path(name)
                NavigationLink(value: ProjectRoute.file(filePath)) {
                    FileRow(session: session, path: filePath)
                }
                .accessibilityIdentifier("file-\(filePath)")
                .contextMenu {
                    Button {
                        newName = name
                        renaming = filePath
                    } label: {
                        Label("Rename", systemImage: "pencil")
                    }
                    Button {
                        run { _ = try await session.duplicateFile(filePath) }
                    } label: {
                        Label("Duplicate", systemImage: "plus.square.on.square")
                    }
                    Divider()
                    Button(role: .destructive) {
                        deleting = filePath
                    } label: {
                        Label("Delete", systemImage: "trash")
                    }
                }
                .swipeActions {
                    Button(role: .destructive) {
                        deleting = filePath
                    } label: {
                        Label("Delete", systemImage: "trash")
                    }
                }
            }
        }
        .overlay {
            if listing.folders.isEmpty, listing.files.isEmpty {
                ContentUnavailableView("No Files", systemImage: "folder")
            }
        }
        .navigationTitle(folder.isEmpty ? String(localized: "Files") : (folder as NSString).lastPathComponent)
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button {
                    isCreating = true
                } label: {
                    Label("New File", systemImage: "doc.badge.plus")
                }
            }
        }
        .alert("Rename File", isPresented: Binding(get: { renaming != nil }, set: { if !$0 { renaming = nil } })) {
            TextField("Name", text: $newName)
            Button("Cancel", role: .cancel) {}
            Button("Rename") {
                guard let source = renaming else { return }
                let target = path(newName)
                run { try await session.renameFile(source, to: target) }
            }
        }
        .alert("New File", isPresented: $isCreating) {
            TextField("notes.md", text: $newFileName)
            Button("Cancel", role: .cancel) {}
            Button("Create") {
                let name = newFileName.trimmingCharacters(in: .whitespaces)
                run { try await session.createFile(path(name)) }
            }
        } message: {
            Text("The file is created in this folder.")
        }
        .confirmationDialog(
            "Delete “\(deleting.map { ($0 as NSString).lastPathComponent } ?? "")”?",
            isPresented: Binding(get: { deleting != nil }, set: { if !$0 { deleting = nil } }),
            titleVisibility: .visible
        ) {
            Button("Delete", role: .destructive) {
                if let target = deleting {
                    run { try await session.deleteFile(target) }
                }
            }
        } message: {
            Text("The file is removed from the project folder.")
        }
    }

    private func path(_ name: String) -> String {
        folder.isEmpty ? name : "\(folder)/\(name)"
    }

    private func run(_ operation: @escaping () async throws -> Void) {
        Task {
            do { try await operation() }
            catch { model.report(error) }
        }
    }
}

/// Direct children of one folder, derived from project paths.
struct FolderListing: Equatable {
    let folders: [String]
    let files: [String]

    init(paths: [String], folder: String) {
        let prefix = folder.isEmpty ? "" : "\(folder)/"
        var folders = Set<String>()
        var files: [String] = []
        for path in paths where path.hasPrefix(prefix) {
            let rest = path.dropFirst(prefix.count)
            if let slash = rest.firstIndex(of: "/") {
                folders.insert(String(rest[..<slash]))
            }
            else if !rest.isEmpty {
                files.append(String(rest))
            }
        }
        self.folders = folders.sorted { $0.localizedStandardCompare($1) == .orderedAscending }
        self.files = files.sorted { $0.localizedStandardCompare($1) == .orderedAscending }
    }
}

struct FileRow: View {
    let session: ProjectSession
    let path: String

    var body: some View {
        HStack {
            Label((path as NSString).lastPathComponent, systemImage: FileKind(path: path).systemImage)
            Spacer()
            if session.conflicts.contains(where: { $0.path == path }) {
                Image(systemName: "exclamationmark.arrow.triangle.2.circlepath")
                    .foregroundStyle(.orange)
                    .accessibilityLabel(Text("Changed in another app"))
            }
            else if session.hasDraft(path) {
                Image(systemName: "circle.fill")
                    .font(.caption2)
                    .foregroundStyle(.tint)
                    .accessibilityLabel(Text("Unsaved changes"))
            }
        }
    }
}

enum FileKind {
    case text
    case image
    case audio
    case other

    init(path: String) {
        let ext = (path as NSString).pathExtension.lowercased()
        if ProjectSnapshot.isTextPath(path) {
            self = .text
        }
        else if ["png", "jpg", "jpeg", "gif", "webp", "heic", "avif", "bmp"].contains(ext) {
            self = .image
        }
        else if ["mp3", "m4a", "aac", "wav", "caf", "aiff", "flac"].contains(ext) {
            self = .audio
        }
        else {
            self = .other
        }
    }

    var systemImage: String {
        switch self {
        case .text: "doc.text"
        case .image: "photo"
        case .audio: "waveform"
        case .other: "doc"
        }
    }
}

/// Text files open in the editor; images and audio preview natively.
struct FileDetailView: View {
    let session: ProjectSession
    let path: String

    var body: some View {
        switch FileKind(path: path) {
        case .text:
            FileEditorView(session: session, path: path)
        case .image:
            ImagePreview(url: try? session.fileURL(path))
                .navigationTitle((path as NSString).lastPathComponent)
        case .audio:
            AudioPreview(url: try? session.fileURL(path))
                .navigationTitle((path as NSString).lastPathComponent)
        case .other:
            FileInfoView(url: try? session.fileURL(path))
                .navigationTitle((path as NSString).lastPathComponent)
        }
    }
}

struct ImagePreview: View {
    let url: URL?

    var body: some View {
        if let url, let data = try? CoordinatedFiles.read(url), let image = UIImage(data: data) {
            ScrollView([.horizontal, .vertical]) {
                Image(uiImage: image)
                    .resizable()
                    .scaledToFit()
                    .frame(maxWidth: 1024)
                    .accessibilityLabel(Text(url.lastPathComponent))
            }
        }
        else {
            ContentUnavailableView("No Preview", systemImage: "photo", description: Text("This image format can’t be previewed."))
        }
    }
}

struct AudioPreview: View {
    let url: URL?
    @State private var player: AVPlayer?

    var body: some View {
        VStack {
            if let player {
                VideoPlayer(player: player)
                    .frame(height: 120)
            }
            else {
                ContentUnavailableView("No Preview", systemImage: "waveform")
            }
        }
        .padding()
        .onAppear {
            if let url { player = AVPlayer(url: url) }
        }
        .onDisappear {
            player?.pause()
            player = nil
        }
    }
}

struct FileInfoView: View {
    let url: URL?

    var body: some View {
        let values = try? url?.resourceValues(forKeys: [.fileSizeKey, .contentModificationDateKey])
        Form {
            if let size = values?.fileSize {
                LabeledContent("Size", value: Int64(size), format: .byteCount(style: .file))
            }
            if let date = values?.contentModificationDate {
                LabeledContent("Modified", value: date, format: .dateTime)
            }
        }
    }
}
