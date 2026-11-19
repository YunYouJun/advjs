import Foundation
import StudioKit
import Testing
@testable import StudioApp

@Suite("App models")
struct StudioAppTests {
    @Test("Keeps system app-language selection available on single-language devices")
    func languageSettings() {
        #expect(Bundle.main.object(forInfoDictionaryKey: "UIPrefersShowingLanguageSettings") as? Bool == true)
        #expect(Bundle.main.developmentLocalization == "en")
        #expect(Bundle.main.localizations.contains("zh-Hans"))
    }

    @Test("Lists one folder at a time from project paths")
    func folderListing() {
        let paths = ["README.md", "adv/chapters/one.adv.md", "adv/chapters/Two.adv.md", "adv/assets/a.png", "adv.config.json", "adv/world.md"]
        let root = FolderListing(paths: paths, folder: "")
        #expect(root.folders == ["adv"])
        #expect(root.files == ["adv.config.json", "README.md"])
        let adv = FolderListing(paths: paths, folder: "adv")
        #expect(adv.folders == ["assets", "chapters"])
        #expect(adv.files == ["world.md"])
        #expect(FolderListing(paths: paths, folder: "adv/chapters").files == ["one.adv.md", "Two.adv.md"])
    }

    @Test("Shows every template the engine offers, in engine order")
    func templates() {
        let list = StarterTemplate.all(templates: nil)
        #expect(list.map(\.id) == ["visual-novel-starter", "school-romance", "mystery-detective", "fantasy-adventure", "modern-urban", "quick-start"])
    }

    @Test("Classifies files for preview")
    func fileKinds() {
        #expect(FileKind(path: "adv/chapters/one.adv.md") == .text)
        #expect(FileKind(path: "adv/assets/a.webp") == .image)
        #expect(FileKind(path: "adv/assets/bgm.m4a") == .audio)
        #expect(FileKind(path: "adv/assets/model.vrm") == .other)
    }
    @Test("Player resources stream byte ranges and restrict filesystem traversal")
    func offlineResources() throws {
        let root = FileManager.default.temporaryDirectory.appending(path: UUID().uuidString)
        let project = root.appending(path: "project")
        try FileManager.default.createDirectory(at: project, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: root) }
        let outside = root.appending(path: "outside.m4a")
        try Data("outside".utf8).write(to: outside)
        let inside = project.appending(path: "theme.m4a")
        try Data("0123456789".utf8).write(to: inside)
        try FileManager.default.createSymbolicLink(at: project.appending(path: "link.m4a"), withDestinationURL: outside)

        let response = PlayerSchemeHandler.read(root: project, path: ["theme.m4a"], range: "bytes=3-5", head: false)
        #expect(response.status == 206)
        #expect(response.headers["Content-Type"] == "audio/mp4")
        #expect(response.headers["Content-Range"] == "bytes 3-5/10")
        #expect(response.data == Data("345".utf8))
        #expect(PlayerSchemeHandler.read(root: project, path: ["link.m4a"], range: nil, head: false).status == 404)
        #expect(PlayerSchemeHandler.read(root: project, path: ["theme.m4a"], range: "bytes=12-", head: false).status == 416)

        for value in ["advjs-player://project/%2E%2E/outside.m4a", "advjs-player://project/adv%2Ftheme.m4a", "advjs-player://other/theme.m4a", "file:///theme.m4a"] {
            #expect(PlayerSchemeHandler.segments(of: try #require(URL(string: value))) == nil)
        }
    }
}
