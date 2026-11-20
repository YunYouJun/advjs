import XCTest

@MainActor
final class AudioAuthoringUITests: XCTestCase {
    private var originalOrientation: UIDeviceOrientation?
    private var seededLocalFile: URL?

    override func setUp() async throws {
        continueAfterFailure = false
        if UIDevice.current.userInterfaceIdiom == .pad {
            originalOrientation = XCUIDevice.shared.orientation
            XCUIDevice.shared.orientation = .landscapeLeft
        }
    }

    override func tearDown() async throws {
        if let seededLocalFile { try? FileManager.default.removeItem(at: seededLocalFile) }
        if let originalOrientation, originalOrientation.isPortrait || originalOrientation.isLandscape {
            XCUIDevice.shared.orientation = originalOrientation
        }
    }

    func testFilesMusicReviewBindingAndReopenedPlaytest() throws {
        let (app, documents, project, original) = try createProject()
        openChapter(in: app)
        tap(app.buttons["chapter-music"].firstMatch, in: app)
        tap(app.buttons["audio-initialize"], in: app)
        tap(app.buttons["audio-actions"], in: app)
        tap(app.buttons["audio-brief"], in: app)
        let summary = app.textViews["music-brief-summary"].firstMatch
        let briefText = "Rain and piano at night"
        let summaryField = summary.exists ? summary : app.textFields["music-brief-summary"].firstMatch
        tap(summaryField, in: app)
        summaryField.typeText(briefText)
        let briefLicense = app.textFields["music-brief-license"]
        bringIntoView(briefLicense, in: app)
        tap(briefLicense, in: app)
        briefLicense.typeText("CC0-1.0")
        XCTAssertEqual(briefLicense.value as? String, "CC0-1.0")
        bringIntoView(app.buttons["music-brief-use"], in: app)
        tap(app.buttons["music-brief-copy"], in: app)
        XCTAssertTrue(app.buttons["music-brief-copy"].label.contains("Copied"))
        tap(app.buttons["music-brief-use"], in: app)

        tap(app.buttons["audio-choose-file"], in: app)
        let publicFixture = try seedLocalFile(original, in: app)
        seededLocalFile = publicFixture
        chooseLocalFile(publicFixture.lastPathComponent, in: app)
        let save = app.buttons["audio-save-metadata"]
        waitUntil("The file is decoded and can be imported", timeout: 30) { save.exists && save.isEnabled }
        attachScreenshot(app, "audio-files-import")
        XCTAssertEqual(app.textFields["audio-license"].value as? String, "CC0-1.0")
        let importSummary = app.descendants(matching: .any)["music-brief-summary"].firstMatch
        bringIntoView(importSummary, in: app)
        XCTAssertEqual(importSummary.value as? String, briefText)
        tap(save, in: app)

        let row = app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH %@", "audio-asset-")).firstMatch
        tap(row, in: app, timeout: 25)
        let catalog = project.appending(path: "adv/assets/audio.json")
        let written = try JSONSerialization.jsonObject(with: Data(contentsOf: catalog)) as? [String: Any]
        let asset = try XCTUnwrap((written?["assets"] as? [[String: Any]])?.first)
        let id = try XCTUnwrap(asset["id"] as? String)
        let media = try XCTUnwrap(asset["path"] as? String)
        XCTAssertEqual(media, "audio/\(id).m4a")
        XCTAssertEqual(try Data(contentsOf: project.appending(path: "adv/assets/\(media)")), original)

        try reviewBindAndPlay(app, documents: documents, project: project, id: id)
    }

    func testAuditionAndReopenWithSavedAudioCatalog() throws {
        let (app, documents, project, original) = try createProject()
        let fixture = try installAudioFixture(in: app, project: project, bytes: original)
        try reopenProject(app)
        tap(app.buttons["chapter-music"].firstMatch, in: app)
        tap(app.buttons["audio-asset-\(fixture.id)"].firstMatch, in: app, timeout: 25)
        try reviewBindAndPlay(app, documents: documents, project: project, id: fixture.id)
    }

    func testEditsFiltersAndRemovesCatalogEntry() throws {
        let (app, _, project, original) = try createProject()
        let fixture = try installAudioFixture(in: app, project: project, bytes: original)
        try reopenProject(app)
        tap(app.buttons["chapter-music"], in: app)
        let asset = app.buttons["audio-asset-\(fixture.id)"]
        tap(asset, in: app)
        let edit = app.buttons["audio-edit"]
        bringIntoView(edit, in: app)
        tap(edit, in: app)
        let title = app.textFields["audio-title"]
        tap(title, in: app)
        title.typeText("Piano by the window")
        let labels = app.textFields["audio-labels"]
        tap(labels, in: app)
        labels.typeText("dusk, rain")
        tap(app.buttons["audio-save-metadata"], in: app)
        let assetHeader = app.navigationBars["Piano by the window"]
        XCTAssertTrue(assetHeader.waitForExistence(timeout: 15), app.debugDescription)
        let play = app.buttons["audio-play-pause"]
        tap(play, in: app)
        waitUntil("The edited asset can be auditioned") { play.label.contains("Pause") }
        tap(assetHeader.buttons.firstMatch, in: app)
        tap(asset, in: app)
        XCTAssertTrue(play.label.contains("Play"))
        tap(assetHeader.buttons.firstMatch, in: app)

        let search = app.searchFields.matching(NSPredicate(format: "placeholderValue == %@ OR label == %@", "Search Audio", "Search Audio")).firstMatch
        bringIntoView(search, in: app, towardTop: true)
        tap(search, in: app)
        search.typeText("rain")
        XCTAssertTrue(asset.exists)
        attachScreenshot(app, "audio-library-tag-search")
        let kind = app.buttons["audio-filter"]
        tap(kind, in: app)
        tap(app.buttons["Ambience"], in: app)
        XCTAssertTrue(asset.waitForNonExistence(timeout: 10), app.debugDescription)
        tap(kind, in: app)
        tap(app.buttons["Background Music"], in: app)
        tap(asset, in: app)

        let remove = app.buttons["audio-delete"]
        bringIntoView(remove, in: app)
        tap(remove, in: app)
        tap(app.buttons["audio-confirm-delete"].firstMatch, in: app)
        XCTAssertTrue(asset.waitForNonExistence(timeout: 15))
        try reopenProject(app)
        tap(app.buttons["chapter-music"], in: app)
        XCTAssertTrue(app.buttons["audio-empty-import"].waitForExistence(timeout: 15))
        XCTAssertEqual(try Data(contentsOf: fixture.media), original)
    }

    func testExportsBriefJSONAndReopensMixer() throws {
        let (app, _, project, _) = try createProject()
        openChapter(in: app)
        tap(app.buttons["chapter-music"], in: app)
        tap(app.buttons["audio-initialize"], in: app)
        tap(app.buttons["audio-actions"], in: app)
        tap(app.buttons["audio-brief"], in: app)
        let summary = app.textFields["music-brief-summary"]
        tap(summary, in: app)
        summary.typeText("A quiet piano at dusk")

        let directory = try localFilesStorage().appending(path: "Studio Brief \(UUID().uuidString.prefix(6))")
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        seededLocalFile = directory
        let export = app.buttons["music-brief-export"]
        bringIntoView(export, in: app)
        tap(export, in: app)
        chooseLocalFile(directory.lastPathComponent, in: app, screenshot: "audio-brief-export-picker")
        let save = app.buttons.matching(NSPredicate(format: "label == %@ AND enabled == 1", "Save")).firstMatch
        tap(save, in: app)
        let exported = directory.appending(path: "music-brief.json")
        waitUntil("The music brief is saved by Files") { FileManager.default.fileExists(atPath: exported.path) }
        let bytes = try Data(contentsOf: exported)
        let brief = try XCTUnwrap(JSONSerialization.jsonObject(with: bytes) as? [String: Any])
        XCTAssertEqual((brief["brief"] as? [String: Any])?["summary"] as? String, "A quiet piano at dusk")
        let receipt = XCTAttachment(string: String(decoding: bytes, as: UTF8.self))
        receipt.name = "audio-music-brief-json"
        receipt.lifetime = .keepAlways
        add(receipt)

        let briefBar = app.navigationBars["Music Brief"]
        let done = briefBar.buttons["Done"].firstMatch
        waitUntil("The music brief is active after Files closes") { done.exists && done.isHittable }
        done.tap()
        XCTAssertTrue(briefBar.waitForNonExistence(timeout: 15))
        tap(app.buttons["audio-actions"], in: app)
        tap(app.buttons["audio-mixer"], in: app)
        let musicGain = app.sliders["mixer-gain-music"]
        bringIntoView(musicGain, in: app)
        XCTAssertTrue(musicGain.exists)
        let originalMusicGain = try sliderGain(musicGain)
        musicGain.adjust(toNormalizedSliderPosition: 0.65)
        let selectedMusicGain = try sliderGain(musicGain)
        XCTAssertNotEqual(selectedMusicGain, originalMusicGain)
        let solo = app.switches["mixer-solo-music"]
        bringIntoView(solo, in: app)
        solo.coordinate(withNormalizedOffset: CGVector(dx: 0.94, dy: 0.5)).tap()
        let mute = app.switches["mixer-mute-ambience"]
        bringIntoView(mute, in: app)
        mute.coordinate(withNormalizedOffset: CGVector(dx: 0.94, dy: 0.5)).tap()
        // Scroll past the slider so its entire track is visible below the toolbar.
        let duckingRelease = app.textFields["mixer-ducking-release"]
        bringIntoView(duckingRelease, in: app)
        XCTAssertTrue(duckingRelease.isHittable)
        let ducking = app.sliders["mixer-ducking-gain"]
        XCTAssertTrue(ducking.isHittable)
        let defaultDuckingGain = try XCTUnwrap(ducking.value as? String)
        ducking.adjust(toNormalizedSliderPosition: 0.75)
        waitUntil("The Ducked Gain slider changes") {
            guard ducking.exists, let value = ducking.value as? String else { return false }
            return value != defaultDuckingGain
        }
        let selectedDuckingGain = try sliderGain(ducking)
        tap(app.buttons["mixer-save"], in: app)
        let mixerFile = project.appending(path: "adv/audio/mixer.json")
        waitUntil("The native Mixer writes project settings") { FileManager.default.fileExists(atPath: mixerFile.path) }
        let mixer = try XCTUnwrap(JSONSerialization.jsonObject(with: Data(contentsOf: mixerFile)) as? [String: Any])
        let buses = try XCTUnwrap(mixer["buses"] as? [String: [String: Any]])
        XCTAssertEqual(try XCTUnwrap(buses["music"]?["gain"] as? Double), selectedMusicGain, accuracy: 0.005)
        XCTAssertEqual(buses["music"]?["solo"] as? Bool, true)
        XCTAssertEqual(buses["ambience"]?["muted"] as? Bool, true)
        XCTAssertEqual(try XCTUnwrap((mixer["ducking"] as? [String: Any])?["gain"] as? Double), selectedDuckingGain, accuracy: 0.005)

        try reopenProject(app)
        tap(app.buttons["chapter-music"], in: app)
        tap(app.buttons["audio-actions"], in: app)
        tap(app.buttons["audio-mixer"], in: app)
        bringIntoView(app.switches["mixer-solo-music"], in: app)
        XCTAssertEqual(app.switches["mixer-solo-music"].value as? String, "1")
        attachScreenshot(app, "audio-mixer-persisted")
    }

    private func installAudioFixture(in app: XCUIApplication, project: URL, bytes: Data) throws -> (id: String, media: URL) {
        tap(app.buttons["project-section-chapters"].firstMatch, in: app, timeout: 25)
        let fixture = try XCTUnwrap(Bundle(for: Self.self).resourceURL?.appending(path: "OfflineFixture.bundle/adv/assets.json"))
        var catalog = try XCTUnwrap(JSONSerialization.jsonObject(with: Data(contentsOf: fixture)) as? [String: Any])
        var assets = try XCTUnwrap(catalog["assets"] as? [[String: Any]])
        assets[0]["music"] = [
            "schemaVersion": 1, "usage": "background", "source": ["type": "manual"],
            "rights": ["license": "CC0-1.0"], "review": ["status": "pending"],
        ]
        catalog["assets"] = assets
        let path = try XCTUnwrap(assets[0]["path"] as? String)
        let media = project.appending(path: "adv/assets/" + path)
        try FileManager.default.createDirectory(at: media.deletingLastPathComponent(), withIntermediateDirectories: true)
        try coordinatedWrite(bytes, to: media)
        try coordinatedWrite(JSONSerialization.data(withJSONObject: catalog), to: project.appending(path: "adv/assets.json"))

        return (try XCTUnwrap(assets[0]["id"] as? String), media)
    }

    private func createProject() throws -> (XCUIApplication, URL, URL, Data) {
        let app = XCUIApplication()
        app.launchArguments = ["-studioUITesting", "-studioResetData", "-studioMeasureAudio",
                               "-AppleLanguages", "(en)", "-AppleLocale", "en_US"]
        app.launch()
        let projectName = "Audio Story"
        let openNew = app.buttons["new-project"].firstMatch
        if !openNew.exists, app.buttons["Show Sidebar"].exists { app.buttons["Show Sidebar"].tap() }
        tap(openNew, in: app, timeout: 30)
        let name = app.textFields["project-name"]
        XCTAssertTrue(name.waitForExistence(timeout: 15))
        name.typeText(projectName)
        dismissKeyboardIntroduction(in: app)
        tap(app.buttons["template-visual-novel-starter"], in: app)
        tap(app.buttons["create-project"], in: app)

        let documents = try studioUITestingDocuments()
        let project = documents.appending(path: projectName)
        let fixture = try XCTUnwrap(Bundle(for: Self.self).resourceURL?.appending(path: "OfflineFixture.bundle/adv/assets/bgm/theme.m4a"))
        let original = try Data(contentsOf: fixture)
        return (app, documents, project, original)
    }

    private func reviewBindAndPlay(_ app: XCUIApplication, documents: URL, project: URL, id: String) throws {
        let reviewToggle = app.switches["music-listened"]
        bringIntoView(reviewToggle, in: app)
        XCTAssertFalse(reviewToggle.isEnabled)
        let playback = app.buttons["audio-play-pause"]
        bringIntoView(playback, in: app, towardTop: true)
        tap(playback, in: app)
        waitUntil("Audition starts") { playback.label.contains("Pause") }
        bringIntoView(reviewToggle, in: app)
        waitUntil("Review unlocks after audio advances") { reviewToggle.isEnabled }
        XCUIDevice.shared.press(.home)
        app.activate()
        waitUntil("Backgrounding clears audition evidence") { reviewToggle.exists && !reviewToggle.isEnabled }
        bringIntoView(playback, in: app, towardTop: true)
        tap(playback, in: app)
        waitUntil("Audition resumes only when requested") { playback.label.contains("Pause") }
        let progress = app.sliders["audio-progress"]
        XCTAssertTrue(progress.waitForExistence(timeout: 10))
        progress.adjust(toNormalizedSliderPosition: 0.5)
        tap(playback, in: app)
        waitUntil("Pause is exposed") { playback.label.contains("Play") }
        tap(playback, in: app)
        bringIntoView(reviewToggle, in: app)
        waitUntil("Review is enabled after playing the target") { reviewToggle.isEnabled }
        // SwiftUI's accessibility element includes the full row. Hit the
        // native switch at its trailing edge as a sighted author would.
        reviewToggle.coordinate(withNormalizedOffset: CGVector(dx: 0.94, dy: 0.5)).tap()
        let approve = app.buttons["music-approve"]
        bringIntoView(approve, in: app)
        XCTAssertTrue(approve.isEnabled, app.debugDescription)
        tap(approve, in: app)
        let bind = app.buttons["music-bind"]
        bringIntoView(bind, in: app)
        waitUntil("Review completes or reports an audio error") { bind.isEnabled || app.alerts.firstMatch.exists }
        XCTAssertFalse(app.alerts.firstMatch.exists, app.debugDescription)
        attachScreenshot(app, "audio-music-approved")
        bind.tap()
        let apply = app.buttons["music-apply-binding"]
        XCTAssertTrue(apply.waitForExistence(timeout: 15), app.debugDescription)
        attachScreenshot(app, "audio-markdown-binding-preview")
        apply.tap()

        let chapter = project.appending(path: "adv/chapters/01.adv.md")
        waitUntil("The approved music cue is saved in Markdown") {
            (try? String(contentsOf: chapter, encoding: .utf8))?.contains(id) == true
        }
        try reopenProject(app)
        tap(app.buttons["play-chapter"].firstMatch, in: app)
        tap(app.buttons["play-chapter-start"].firstMatch, in: app)
        let closePlayer = app.buttons["close-player"]
        XCTAssertTrue(closePlayer.waitForExistence(timeout: 30), app.debugDescription)
        let back = app.buttons["player-back"].firstMatch
        waitUntil("The reopened player renders the first scene", timeout: 90) {
            back.exists && back.isEnabled
        }
        XCTAssertFalse(app.otherElements["player-diagnostic"].exists)
        #if DEBUG
        let measurement = documents.deletingLastPathComponent().appending(path: "player-audio-rms.txt")
        waitUntil("The reopened chapter produces nonzero Web Audio output", timeout: 45) {
            (try? String(contentsOf: measurement, encoding: .utf8)).flatMap(Double.init).map { $0 > 0.0001 } ?? false
        }
        let log = XCTAttachment(string: try String(contentsOf: measurement, encoding: .utf8))
        log.name = "reopened-chapter-player-audio-rms"
        log.lifetime = .keepAlways
        add(log)
        #endif
        attachScreenshot(app, "audio-reopened-chapter-playtest")
        closePlayer.tap()
    }

    private func reopenProject(_ app: XCUIApplication) throws {
        app.terminate()
        app.launchArguments.removeAll { $0 == "-studioResetData" }
        app.launch()
        let projectRow = app.descendants(matching: .any)["project-Audio Story"].firstMatch
        let chapters = app.buttons["project-section-chapters"].firstMatch
        waitUntil("The project is restored or available in the library", timeout: 30) { chapters.exists || projectRow.exists }
        if !chapters.exists, projectRow.exists { projectRow.tap() }
        openChapter(in: app)
    }

    private func openChapter(in app: XCUIApplication) {
        tap(app.buttons["project-section-chapters"].firstMatch, in: app, timeout: 25)
        tap(app.buttons["chapter-adv/chapters/01.adv.md"].firstMatch, in: app)
    }

    private func seedLocalFile(_ bytes: Data, in app: XCUIApplication) throws -> URL {
        let fullNavigation = app.navigationBars["FullDocumentManagerViewControllerNavigationBar"]
        waitUntil("Files picker is presented", timeout: 25) {
            fullNavigation.exists || app.buttons["Browse"].firstMatch.exists ||
                app.otherElements["Browse View (Picker)"].exists
        }
        let storage = try localFilesStorage()
        let file = storage.appending(path: "Studio Audit BGM \(UUID().uuidString.prefix(6)).m4a")
        try bytes.write(to: file, options: .withoutOverwriting)
        return file
    }

    private func localFilesStorage() throws -> URL {
        // The simulator's "On My iPhone/iPad" provider. Seed only our unique
        // fixture, then choose it through the real system document picker.
        let shared = URL(fileURLWithPath: NSHomeDirectory())
            .deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent()
            .appending(path: "Shared/AppGroup")
        let group = try XCTUnwrap(FileManager.default.contentsOfDirectory(at: shared, includingPropertiesForKeys: nil).first { url in
            let info = NSDictionary(contentsOf: url.appending(path: ".com.apple.mobile_container_manager.metadata.plist"))
            return info?["MCMMetadataIdentifier"] as? String == "group.com.apple.FileProvider.LocalStorage"
        })
        let storage = group.appending(path: "File Provider Storage")
        try FileManager.default.createDirectory(at: storage, withIntermediateDirectories: true)
        return storage
    }

    private func chooseLocalFile(_ name: String, in app: XCUIApplication, screenshot: String = "audio-files-picker") {
        let stem = (name as NSString).deletingPathExtension
        let file = app.cells.matching(NSPredicate(format: "identifier BEGINSWITH %@", stem)).firstMatch
        let deviceName = UIDevice.current.userInterfaceIdiom == .pad ? "On My iPad" : "On My iPhone"
        let title = app.navigationBars["FullDocumentManagerViewControllerNavigationBar"].staticTexts[deviceName]
        let device = app.staticTexts.matching(NSPredicate(format: "label == %@", deviceName)).firstMatch
        var waitedForProvider = false
        for _ in 0..<10 {
            if file.exists, file.isHittable {
                attachScreenshot(app, screenshot)
                file.tap()
                return
            }
            if title.exists {
                RunLoop.current.run(until: Date().addingTimeInterval(0.5))
                continue
            }
            if device.exists, device.isHittable { device.tap(); continue }
            let browse = app.buttons["Browse"].firstMatch
            if browse.exists, browse.isHittable, !browse.isSelected { browse.tap(); continue }
            if !waitedForProvider {
                waitedForProvider = true
                if device.waitForExistence(timeout: 45), device.isHittable { device.tap(); continue }
            }
            let sidebar = app.buttons["Show Sidebar"].firstMatch
            if sidebar.exists, sidebar.isHittable { sidebar.tap(); continue }
            let back = app.buttons["DOC.navBarButton.backInHistory"].firstMatch
            if back.exists, back.isHittable { back.tap(); continue }
            RunLoop.current.run(until: Date().addingTimeInterval(0.5))
        }
        attachScreenshot(app, "audio-file-picker")
        XCTFail(app.debugDescription)
    }

    private func bringIntoView(_ element: XCUIElement, in app: XCUIApplication, towardTop: Bool = false) {
        for _ in 0..<6 {
            if element.exists, element.isHittable { return }
            if towardTop { app.swipeDown() }
            else { app.swipeUp() }
        }
    }

    private func sliderGain(_ slider: XCUIElement) throws -> Double {
        let percentage = try XCTUnwrap(slider.value as? String)
        return try Double(percentage, format: .percent.locale(Locale(identifier: "en_US")))
    }

    private func tap(_ element: XCUIElement, in app: XCUIApplication, timeout: TimeInterval = 12) {
        XCTAssertTrue(element.exists || element.waitForExistence(timeout: timeout), app.debugDescription)
        element.tap()
    }

    private func waitUntil(_ description: String, timeout: TimeInterval = 15, _ condition: @escaping () -> Bool) {
        let check = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in condition() }, object: nil)
        XCTAssertEqual(XCTWaiter.wait(for: [check], timeout: timeout), .completed, description)
    }
}
