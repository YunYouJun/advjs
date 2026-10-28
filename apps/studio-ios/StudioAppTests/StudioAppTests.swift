import Foundation
import StudioKit
import Testing
@testable import StudioApp

@Suite("App models")
struct StudioAppTests {
    @Test("Keeps system app-language selection available on single-language devices")
    func languageSettings() {
        #expect(Bundle.main.object(forInfoDictionaryKey: "UIPrefersShowingLanguageSettings") as? Bool == true)
        #expect(Bundle.main.localizations.contains("en"))
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
}
