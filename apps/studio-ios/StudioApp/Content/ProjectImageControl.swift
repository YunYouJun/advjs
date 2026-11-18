import PhotosUI
import StudioKit
import SwiftUI
import UIKit
import UniformTypeIdentifiers

struct ProjectImageControl: View {
    let session: ProjectSession
    let title: LocalizedStringKey
    let kind: ProjectImageKind
    let ownerID: String
    let fileLabel: String
    let path: String?
    let update: (String?) async throws -> Void

    @Environment(AppModel.self) private var model
    @State private var photo: PhotosPickerItem?
    @State private var files = false
    @State private var camera = false
    @State private var importing = false
    @State private var thumbnail: UIImage?

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title).font(.headline)
            if let thumbnail {
                Image(uiImage: thumbnail)
                    .resizable()
                    .scaledToFit()
                    .frame(maxHeight: 180)
                    .accessibilityLabel(Text(title))
            }
            else if path?.isEmpty == false {
                Label("Image Unavailable", systemImage: "exclamationmark.circle")
                    .foregroundStyle(.secondary)
            }
            if importing {
                ProgressView()
                    .accessibilityLabel("Importing Image")
            }
            else {
                Menu {
                    PhotosPicker(selection: $photo, matching: .images, preferredItemEncoding: .current) {
                        Label("Photo Library…", systemImage: "photo.on.rectangle")
                    }
                    Button { files = true } label: { Label("Choose File…", systemImage: "folder") }
                    if UIImagePickerController.isSourceTypeAvailable(.camera) {
                        Button { camera = true } label: { Label("Take Photo…", systemImage: "camera") }
                    }
                    if path?.isEmpty == false {
                        Button("Remove Image", role: .destructive) { run { try await update(nil) } }
                    }
                } label: {
                    Label(path?.isEmpty == false ? "Replace Image…" : "Add Image…", systemImage: "photo.badge.plus")
                }
                .accessibilityIdentifier("image-\(kind.rawValue)-\(fileLabel)")
            }
        }
        .fullScreenCover(isPresented: $camera) {
            ProjectCamera { data in
                camera = false
                if let data { run { try await importImage(data) } }
            }
            .ignoresSafeArea()
        }
        .fileImporter(isPresented: $files, allowedContentTypes: [.image]) { result in
            run {
                let file = try result.get()
                let access = file.startAccessingSecurityScopedResource()
                defer { if access { file.stopAccessingSecurityScopedResource() } }
                let limit = 32 * 1_048_576
                if let size = try file.resourceValues(forKeys: [.fileSizeKey]).fileSize, size > limit {
                    throw ProjectImageError.invalidImage
                }
                try await importImage(CoordinatedFiles.read(file))
            }
        }
        .onChange(of: photo) { _, item in
            guard let item else { return }
            run {
                defer { photo = nil }
                guard let data = try await item.loadTransferable(type: Data.self) else { throw ProjectImageError.invalidImage }
                try await importImage(data)
            }
        }
        .onDrop(of: [.image], isTargeted: nil) { providers in
            guard !importing, let provider = providers.first,
                  let type = provider.registeredTypeIdentifiers.first(where: { UTType($0)?.conforms(to: .image) == true }) else { return false }
            importing = true
            _ = provider.loadDataRepresentation(forTypeIdentifier: type) { data, _ in
                Task { @MainActor in
                    defer { importing = false }
                    do {
                        guard let data else { throw ProjectImageError.invalidImage }
                        try await importImage(data)
                    }
                    catch { model.report(error) }
                }
            }
            return true
        }
        .task(id: PreviewKey(path: path, snapshot: session.snapshot)) {
            thumbnail = path.flatMap { session.localImageURL($0) }.flatMap(Self.preview)
        }
    }

    private func run(_ operation: @escaping () async throws -> Void) {
        guard !importing else { return }
        importing = true
        Task {
            defer { importing = false }
            do { try await operation() }
            catch { model.report(error) }
        }
    }

    private func importImage(_ data: Data) async throws {
        let path = try await session.importImage(data, kind: kind, id: ownerID, name: fileLabel)
        try await update(path)
    }

    private struct PreviewKey: Equatable {
        let path: String?
        let modified: Date?

        init(path: String?, snapshot: ProjectSnapshot?) {
            self.path = path
            modified = path.flatMap { snapshot?.modificationDates[$0] ?? snapshot?.modificationDates["adv/\($0)"] }
        }
    }

    private static func preview(_ url: URL) -> UIImage? {
        guard let source = CGImageSourceCreateWithURL(url as CFURL, nil),
              let image = CGImageSourceCreateThumbnailAtIndex(source, 0, [
                kCGImageSourceCreateThumbnailFromImageAlways: true,
                kCGImageSourceCreateThumbnailWithTransform: true,
                kCGImageSourceThumbnailMaxPixelSize: 512,
              ] as CFDictionary) else { return nil }
        return UIImage(cgImage: image)
    }
}

struct ProjectCoverSection: View {
    let session: ProjectSession
    @Environment(AppModel.self) private var model
    @State private var cover: String?

    var body: some View {
        ProjectImageControl(session: session, title: "Project Cover", kind: .cover, ownerID: "", fileLabel: "cover", path: cover) {
            try await session.setCover($0)
            cover = $0
        }
        .task(id: session.snapshot?.files[ProjectSession.gameSettingsPath]) {
            do { cover = try await session.coverPath() }
            catch { cover = nil }
        }
    }
}

struct CharacterImagesSection: View {
    let session: ProjectSession
    let fields: ContentFields
    @State private var newPose = ""
    @State private var pendingPose: String?
    @State private var showingNewPose = false

    private var poses: ContentData { fields.value("tachies")?.object ?? [:] }
    private var id: String { fields.value("id")?.string ?? "" }

    var body: some View {
        Section("Character Images") {
            ProjectImageControl(session: session, title: "Avatar", kind: .character, ownerID: id, fileLabel: "avatar",
                                path: fields.value("avatar")?.string) { reference in
                fields.assign(reference.map(ContentValue.string), at: "avatar")
            }

            ForEach(poses.keys.sorted(), id: \.self) { name in
                poseControl(name, title: "\(name)")
            }
            if let pendingPose, poses[pendingPose] == nil {
                poseControl(pendingPose, title: "\(pendingPose)")
            }
            Button("Add Standing Portrait") { newPose = ""; showingNewPose = true }
                .disabled(pendingPose != nil)
                .alert("Add Standing Portrait", isPresented: $showingNewPose) {
                    TextField("Pose Name", text: $newPose)
                    Button("Cancel", role: .cancel) {}
                    Button("Add") {
                        let name = newPose.trimmingCharacters(in: .whitespacesAndNewlines)
                        if !name.isEmpty, poses[name] == nil { pendingPose = name }
                    }
                }
            if pendingPose != nil {
                Button("Cancel", role: .cancel) { pendingPose = nil }
            }
        }
    }

    private func poseControl(_ name: String, title: LocalizedStringKey) -> some View {
        ProjectImageControl(
            session: session, title: title, kind: .character, ownerID: id, fileLabel: name,
            path: poses[name]?.object?["src"]?.string
        ) { reference in
            var updated = poses
            if let reference {
                var portrait = updated[name]?.object ?? [:]
                portrait["src"] = .string(reference)
                updated[name] = .object(portrait)
            }
            else { updated[name] = nil }
            fields.assign(updated.isEmpty ? nil : .object(updated), at: "tachies")
            pendingPose = nil
        }
    }
}
