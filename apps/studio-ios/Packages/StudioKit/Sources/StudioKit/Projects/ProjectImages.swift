import CryptoKit
import Foundation
import ImageIO
import UniformTypeIdentifiers

public enum ProjectImageKind: String, Encodable, Sendable {
    case character, scene, cover
}

public enum ProjectImageError: Error {
    case invalidImage
    case missingImage
}

public struct NormalizedProjectImage: Sendable {
    public let data: Data
    public let fileExtension: String

    public static func read(_ data: Data) throws -> Self {
        let maxEdge = 4096
        let maxBytes = 32 * 1_048_576
        guard data.count <= maxBytes,
              let source = CGImageSourceCreateWithData(data as CFData, [kCGImageSourceShouldCache: false] as CFDictionary),
              let identifier = CGImageSourceGetType(source) as String?,
              let properties = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [CFString: Any],
              let width = properties[kCGImagePropertyPixelWidth] as? Int,
              let height = properties[kCGImagePropertyPixelHeight] as? Int,
              width > 0, height > 0 else {
            throw ProjectImageError.invalidImage
        }

        let supported = [UTType.png.identifier: "png", UTType.jpeg.identifier: "jpg",
                         UTType.gif.identifier: "gif", UTType.webP.identifier: "webp"]
        if let ext = supported[identifier], max(width, height) <= maxEdge {
            // Validate that the payload decodes before exposing it to the project.
            guard CGImageSourceGetStatus(source) == .statusComplete,
                  CGImageSourceCreateImageAtIndex(source, 0, nil) != nil else { throw ProjectImageError.invalidImage }
            return Self(data: data, fileExtension: ext)
        }

        guard CGImageSourceGetCount(source) == 1,
              UTType(identifier)?.conforms(to: .image) == true,
              let image = CGImageSourceCreateThumbnailAtIndex(source, 0, [
                kCGImageSourceCreateThumbnailFromImageAlways: true,
                kCGImageSourceCreateThumbnailWithTransform: true,
                kCGImageSourceThumbnailMaxPixelSize: maxEdge,
              ] as CFDictionary) else { throw ProjectImageError.invalidImage }

        let decodedAlpha = [.first, .last, .premultipliedFirst, .premultipliedLast, .alphaOnly].contains(image.alphaInfo)
        // ImageIO can decode opaque HEIC into an RGBA buffer. Use source
        // metadata for HEIF so an unused alpha channel does not force PNG.
        let isHEIF = identifier == UTType.heic.identifier || identifier == UTType.heif.identifier
        let hasAlpha = properties[kCGImagePropertyHasAlpha] as? Bool ?? (isHEIF ? false : decodedAlpha)
        let type = hasAlpha ? UTType.png : UTType.jpeg
        let output = NSMutableData()
        guard let destination = CGImageDestinationCreateWithData(output, type.identifier as CFString, 1, nil) else {
            throw ProjectImageError.invalidImage
        }
        CGImageDestinationAddImage(destination, image, [kCGImageDestinationLossyCompressionQuality: 0.88] as CFDictionary)
        guard CGImageDestinationFinalize(destination) else { throw ProjectImageError.invalidImage }
        return Self(data: output as Data, fileExtension: hasAlpha ? "png" : "jpg")
    }
}

private struct ImagePathInput: Encodable, Sendable {
    let kind: ProjectImageKind
    let id: String
    let name: String
    let digest: String
    let `extension`: String
}

private struct CoverInput: Encodable, Sendable {
    let source: String?
    var path: String?
}

private struct CoverRead: Decodable, Sendable {
    let path: String?
}

extension ProjectSession {
    public static let gameSettingsPath = "adv/settings/game.json"

    public func importImage(_ data: Data, kind: ProjectImageKind, id: String, name: String) async throws -> String {
        let image = try await Task.detached(priority: .userInitiated) { try NormalizedProjectImage.read(data) }.value
        let digest = SHA256.hash(data: image.data).map { String(format: "%02x", $0) }.joined()
        let path = try await engine.call(
            "project.imagePath",
            input: ImagePathInput(kind: kind, id: id, name: name, digest: digest, extension: image.fileExtension),
            as: String.self
        )
        let url = try contentURL(path)
        if let existing = try? CoordinatedFiles.read(url, filePresenter: watcher) {
            guard existing == image.data else { throw ContentAuthoringError.sourceChanged }
        }
        else {
            try CoordinatedFiles.changeBytes(at: url, from: nil, to: image.data, filePresenter: watcher)
        }
        await reload()
        return path
    }

    public func coverPath() async throws -> String? {
        let source = snapshot?.files[Self.gameSettingsPath]
        return try await engine.call("project.readCover", input: CoverInput(source: source), as: CoverRead.self).path
    }

    public func setCover(_ path: String?) async throws {
        if let path {
            let url = try contentURL(path)
            guard FileManager.default.isReadableFile(atPath: url.path(percentEncoded: false)) else {
                throw ProjectImageError.missingImage
            }
        }
        let settings = Self.gameSettingsPath
        guard !hasDraft(settings), let snapshot, !snapshot.unreadable.contains(settings) else {
            throw ContentAuthoringError.sourceChanged
        }
        let source = snapshot.files[settings]
        let write = try await engine.call("project.setCover", input: CoverInput(source: source, path: path), as: ContentWrite.self)
        guard !hasDraft(settings) else { throw ContentAuthoringError.sourceChanged }
        try CoordinatedFiles.changeContent(at: try contentURL(write.path), from: source, to: write.text, filePresenter: watcher)
        await reload()
    }

    /// Accept both root-relative refs and the older Web Studio refs under adv/.
    public func localImageURL(_ path: String) -> URL? {
        for candidate in [path, "adv/\(path)"] {
            if let url = try? contentURL(candidate), FileManager.default.isReadableFile(atPath: url.path(percentEncoded: false)) {
                return url
            }
        }
        return nil
    }
}
