import CoreGraphics
import Foundation
import ImageIO
import Testing
import UniformTypeIdentifiers
@testable import StudioKit

@MainActor
struct ProjectImagesTests {
    private func fixture(_ type: UTType, width: Int = 512, height: Int = 64) throws -> Data {
        let context = try #require(CGContext(data: nil, width: width, height: height, bitsPerComponent: 8, bytesPerRow: 0,
                                             space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue))
        context.setFillColor(CGColor(red: 0.8, green: 0.45, blue: 0.3, alpha: 1))
        context.fill(CGRect(x: 0, y: 0, width: width, height: height))
        let image = try #require(context.makeImage())
        let bytes = NSMutableData()
        let destination = try #require(CGImageDestinationCreateWithData(bytes, type.identifier as CFString, 1, nil))
        CGImageDestinationAddImage(destination, image, nil)
        try #require(CGImageDestinationFinalize(destination))
        return bytes as Data
    }

    @Test("Keeps supported source bytes and resizes oversized images")
    func normalization() throws {
        let original = try fixture(.png)
        let kept = try NormalizedProjectImage.read(original)
        #expect(kept.fileExtension == "png")
        #expect(kept.data == original)
        let wide = try fixture(.jpeg, width: 4200)
        let converted = try NormalizedProjectImage.read(wide)
        #expect(converted.data != wide)
        let source = try #require(CGImageSourceCreateWithData(converted.data as CFData, nil))
        let properties = try #require(CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [CFString: Any])
        #expect(properties[kCGImagePropertyPixelWidth] as? Int == 4096)
        if (CGImageDestinationCopyTypeIdentifiers() as? [String])?.contains(UTType.heic.identifier) == true {
            let heic = try fixture(.heic)
            let compatible = try NormalizedProjectImage.read(heic)
            #expect(compatible.fileExtension == "jpg")
            #expect(compatible.data != heic)
        }
        #expect(throws: ProjectImageError.invalidImage) { try NormalizedProjectImage.read(Data("Not an image".utf8)) }
    }

    @Test("Creates distinct asset references and reopens the saved cover")
    func cover() async throws {
        let studio = try TemporaryStudio()
        defer { studio.remove() }
        let store = ProjectStore(directories: studio.directories, engine: EngineBridge())
        let record = try await store.create(name: "Pictures", templateID: "school-romance")
        let session = ProjectSession(id: record.id, name: record.name, store: store, directories: studio.directories)
        await session.open()
        try await session.setGameDescription("A project with a cover")
        let png = try fixture(.png)
        let jpg = try fixture(.jpeg)
        let first = try await session.importImage(png, kind: .cover, id: "", name: "../same.png")
        #expect(first.hasPrefix("adv/assets/cover/samepng."))
        #expect(try await session.importImage(png, kind: .cover, id: "", name: "../same.png") == first)
        let second = try await session.importImage(jpg, kind: .cover, id: "", name: "../same.png")
        #expect(first != second)
        #expect(try Data(contentsOf: session.fileURL(first)) == png)
        let characterPath = "adv/characters/ye-qing.character.md"
        let portrait = try await session.importImage(png, kind: .character, id: "ye-qing", name: "neutral")
        let character = try await session.contentDocument(.character, path: characterPath)
        _ = try await session.stageContent(.character, path: characterPath, document: character, changes: [
            "avatar": .string(portrait), "tachies": .object(["neutral": .object(["src": .string(portrait)])]),
        ])
        try await session.saveContent(characterPath)
        let scenePath = try await session.createContent(.scene, data: ["name": .string("Classroom")])
        let background = try await session.importImage(jpg, kind: .scene, id: "classroom", name: "background")
        let scene = try await session.contentDocument(.scene, path: scenePath)
        _ = try await session.stageContent(.scene, path: scenePath, document: scene, changes: ["src": .string(background)])
        try await session.saveContent(scenePath)
        try await session.setCover(first)
        try await session.setCover(second)
        await session.close()
        await session.open()
        #expect(try await session.coverPath() == second)
        #expect(session.snapshot?.files[ProjectSession.gameSettingsPath]?.contains("A project with a cover") == true)
        let package = try await store.exportPackage(record.id)
        let imported = try await store.importPackage(at: package, name: "Reopened Pictures")
        let reopened = ProjectSession(id: imported.id, name: imported.name, store: store, directories: studio.directories)
        await reopened.open()
        #expect(try await reopened.coverPath() == second)
        #expect(try Data(contentsOf: reopened.fileURL(second)) == jpg)
        let openedCharacter = try await reopened.contentDocument(.character, path: characterPath)
        #expect(openedCharacter.data["tachies"]?.object?["neutral"]?.object?["src"] == .string(portrait))
        #expect(try Data(contentsOf: reopened.fileURL(portrait)) == png)
        #expect(try await reopened.contentDocument(.scene, path: scenePath).data["src"] == .string(background))
        #expect(try Data(contentsOf: reopened.fileURL(background)) == jpg)
        await reopened.close()

        let invalid = "adv/assets/cover/missing.png"
        await #expect(throws: ProjectImageError.missingImage) { try await session.setCover(invalid) }
        #expect(try await session.coverPath() == second)
        try await session.setCover(nil)
        #expect(try await session.coverPath() == nil)
        #expect(session.localImageURL(first) != nil)
        await session.close()
    }
}
