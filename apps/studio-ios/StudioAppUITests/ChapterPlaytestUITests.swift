import XCTest

@MainActor
final class ChapterPlaytestUITests: XCTestCase {
    private var originalOrientation: UIDeviceOrientation?

    override func setUp() async throws {
        continueAfterFailure = false
        if UIDevice.current.userInterfaceIdiom == .pad {
            originalOrientation = XCUIDevice.shared.orientation
            XCUIDevice.shared.orientation = .landscapeLeft
        }
    }

    override func tearDown() async throws {
        if let originalOrientation, originalOrientation.isPortrait || originalOrientation.isLandscape {
            XCUIDevice.shared.orientation = originalOrientation
        }
    }

    private func openNewProject(_ app: XCUIApplication, name: String) {
        app.launchArguments = ["-studioUITesting", "-studioResetData", "-AppleLanguages", "(en)", "-AppleLocale", "en_US"]
        app.launch()
        let library = app.buttons["new-project"].firstMatch
        if UIDevice.current.userInterfaceIdiom == .pad, !library.exists {
            let showSidebar = app.buttons["Show Sidebar"].firstMatch
            if showSidebar.waitForExistence(timeout: 8) { showSidebar.tap() }
        }
        XCTAssertTrue(library.waitForExistence(timeout: 30), app.debugDescription)
        library.tap()

        let field = app.textFields["project-name"]
        XCTAssertTrue(field.waitForExistence(timeout: 15))
        field.typeText(name)
        dismissKeyboardIntroduction(in: app)
        app.buttons["template-visual-novel-starter"].tap()
        app.buttons["create-project"].tap()
    }

    private func openChapters(_ app: XCUIApplication) {
        if UIDevice.current.userInterfaceIdiom == .pad {
            let section = app.buttons["project-section-chapters"].firstMatch
            XCTAssertTrue(section.waitForExistence(timeout: 30), app.debugDescription)
            section.tap()
            return
        }
        let overview = app.buttons["Overview"]
        XCTAssertTrue(overview.waitForExistence(timeout: 30))
        overview.tap()
        let tile = app.buttons["overview-chapters"].firstMatch
        XCTAssertTrue(tile.waitForExistence(timeout: 20), app.debugDescription)
        tile.tap()
    }

    private func writeChapterDraft(_ app: XCUIApplication, project name: String,
                                   body: String = "\n> Draft lighthouse at night.\n") {
        openNewProject(app, name: name)
        openChapters(app)
        let newChapter = app.buttons["new-chapter"]
        XCTAssertTrue(newChapter.waitForExistence(timeout: 15), app.debugDescription)
        newChapter.tap()
        let filename = app.alerts.textFields.firstMatch
        XCTAssertTrue(filename.waitForExistence(timeout: 5))
        filename.typeText("02")
        let create = app.alerts.buttons["Create"]
        create.tap()
        if !create.waitForNonExistence(timeout: 2), UIDevice.current.userInterfaceIdiom == .pad {
            filename.typeKey(.return, modifierFlags: [])
        }
        XCTAssertTrue(create.waitForNonExistence(timeout: 5), "The chapter prompt did not submit the filename")

        let chapter = app.buttons["chapter-adv/chapters/02.adv.md"]
        XCTAssertTrue(chapter.waitForExistence(timeout: 10))
        chapter.tap()
        let title = app.textFields["chapter-title"]
        XCTAssertTrue(title.waitForExistence(timeout: 10))
        title.tap()
        title.typeText(" Night")
        attachScreenshot(app, "chapter-form")

        let source = app.buttons["Source File"].firstMatch
        XCTAssertTrue(source.exists)
        source.tap()
        let editor = app.textViews["chapter-source"]
        XCTAssertTrue(editor.waitForExistence(timeout: 10))
        XCTAssertTrue((editor.value as? String)?.contains("Night") == true)
        editor.tap()
        // The end of the existing metadata is the document end.
        editor.typeKey(.end, modifierFlags: .command)
        editor.typeText(body)
        attachScreenshot(app, "chapter-source-draft")
    }

    func testChapterSavePreservesFormAndSource() throws {
        let app = XCUIApplication()
        writeChapterDraft(app, project: "Chapter Author")
        let save = app.buttons["save-chapter"]
        XCTAssertTrue(save.isEnabled)
        save.tap()

        let path = try studioUITestingDocuments().appending(path: "Chapter Author/adv/chapters/02.adv.md")
        let written = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
            (try? String(contentsOf: path, encoding: .utf8))?.contains("Draft lighthouse") == true
        }, object: nil)
        XCTAssertEqual(XCTWaiter.wait(for: [written], timeout: 10), .completed)
        let source = try String(contentsOf: path, encoding: .utf8)
        XCTAssertTrue(source.contains("Night"), source)
        XCTAssertTrue(source.contains("> Draft lighthouse"), source)
        attachScreenshot(app, "saved-chapter-source")
    }

    func testDraftAndSavedChapterPlaytest() throws {
        let app = XCUIApplication()
        let isPad = UIDevice.current.userInterfaceIdiom == .pad
        if isPad {
            writeChapterDraft(app, project: "Local Story")
        }
        else {
            writeChapterDraft(app, project: "Local Story", body: """

            > Draft lighthouse at night.

            - [Follow the beacon](#beacon)
            - [Wait in the harbor](#harbor)

            ## Beacon {#beacon}

            > The beacon is bright.

            ## Harbor {#harbor}

            > The harbor is quiet.

            """)
        }
        let editor = app.textViews["chapter-source"]
        let url = try studioUITestingDocuments().appending(path: "Local Story/adv/chapters/02.adv.md")
        let saved = try Data(contentsOf: url)
        let position = app.staticTexts["chapter-source-position"]
        if isPad {
            editor.typeKey(.upArrow, modifierFlags: [])
            editor.typeKey(.leftArrow, modifierFlags: .command)
        }
        let originalPosition = position.label
        let play = app.buttons["play-chapter"].firstMatch
        XCTAssertTrue(play.exists)
        if isPad {
            app.typeKey("r", modifierFlags: .command)
        }
        else {
            play.tap()
            app.buttons["play-chapter-start"].tap()
        }
        let draft = app.buttons["Playtest Draft"].firstMatch
        XCTAssertTrue(draft.waitForExistence(timeout: 10))
        let close = app.buttons["close-player"]
        if !isPad {
            app.buttons["Cancel"].firstMatch.tap()
            XCTAssertTrue(draft.waitForNonExistence(timeout: 5))
            XCTAssertFalse(close.exists)
            XCTAssertEqual(try Data(contentsOf: url), saved)
            play.tap()
            app.buttons["play-chapter-start"].tap()
            XCTAssertTrue(draft.waitForExistence(timeout: 10))
        }
        draft.tap()
        XCTAssertTrue(close.waitForExistence(timeout: 20), app.debugDescription)
        let opening = waitForPlayerDialogue("Draft lighthouse", in: app)
        attachScreenshot(app, "draft-playtest")
        if !isPad {
            let choice = app.webViews.buttons.containing(NSPredicate(format: "label CONTAINS %@", "Follow the beacon")).firstMatch
            for _ in 0..<3 where !choice.exists { opening.tap() }
            XCTAssertTrue(choice.waitForExistence(timeout: 10), app.debugDescription)
            choice.tap()
            waitForPlayerDialogue("The beacon is bright.", in: app)
            attachScreenshot(app, "draft-playtest-choice")
        }
        XCTAssertEqual(try Data(contentsOf: url), saved)

        close.tap()
        XCTAssertTrue(editor.waitForExistence(timeout: 10))
        XCTAssertEqual(position.label, originalPosition)
        play.tap()
        app.buttons["play-chapter-start"].tap()
        app.buttons["Save and Playtest"].firstMatch.tap()
        waitForPlayerDialogue("Draft lighthouse", in: app)
        XCTAssertTrue(try String(contentsOf: url, encoding: .utf8).contains("Draft lighthouse"))
        close.tap()
        XCTAssertTrue(editor.waitForExistence(timeout: 10))
        XCTAssertEqual(position.label, originalPosition)
    }
    func testPlaytestRejectsConflictAndInvalidDraft() throws {
        let app = XCUIApplication()
        writeChapterDraft(app, project: "Playtest Conflict", body: "\n> Draft lighthouse at night.\n\n- [Broken](#missing)\n")
        let editor = app.textViews["chapter-source"]
        let position = app.staticTexts["chapter-source-position"].label
        let draft = try XCTUnwrap(editor.value as? String)
        let brokenLine = try XCTUnwrap(draft.components(separatedBy: "\n").firstIndex { $0.contains("[Broken]") }) + 1
        let file = try studioUITestingDocuments().appending(path: "Playtest Conflict/adv/chapters/02.adv.md")
        let outside = Data("> Edited elsewhere.\n".utf8)
        try coordinatedWrite(outside, to: file)

        func requestPlaytest() {
            app.buttons["play-chapter"].firstMatch.tap()
            app.buttons["play-chapter-start"].firstMatch.tap()
        }

        requestPlaytest()
        app.buttons["Save and Playtest"].firstMatch.tap()
        let diagnostics = app.navigationBars["Can’t Start Playtest"].firstMatch
        XCTAssertTrue(diagnostics.waitForExistence(timeout: 15), app.debugDescription)
        XCTAssertFalse(app.webViews.firstMatch.exists)
        XCTAssertEqual(try Data(contentsOf: file), outside)
        attachScreenshot(app, "playtest-save-conflict")
        app.buttons["Done"].firstMatch.tap()
        XCTAssertTrue(editor.waitForExistence(timeout: 10))
        XCTAssertEqual(app.staticTexts["chapter-source-position"].label, position)

        requestPlaytest()
        app.buttons["Playtest Draft"].firstMatch.tap()
        XCTAssertTrue(diagnostics.waitForExistence(timeout: 15), app.debugDescription)
        XCTAssertFalse(app.webViews.firstMatch.exists)
        XCTAssertEqual(try Data(contentsOf: file), outside)
        let source = app.buttons["player-issue-ADV_RUNTIME_UNKNOWN_TARGET"].firstMatch
        XCTAssertTrue(source.waitForExistence(timeout: 10), app.debugDescription)
        source.tap()
        let diagnosticEditor = app.textViews["chapter-source"].firstMatch
        XCTAssertTrue(diagnosticEditor.waitForExistence(timeout: 10), app.debugDescription)
        XCTAssertTrue((diagnosticEditor.value as? String)?.contains("[Broken](#missing)") == true)
        let destination = app.staticTexts.matching(identifier: "chapter-source-position")
            .matching(NSPredicate(format: "label == %@", "Line \(brokenLine), Column 1")).firstMatch
        XCTAssertTrue(destination.waitForExistence(timeout: 10), app.debugDescription)
        attachScreenshot(app, "playtest-invalid-draft-source")
    }

    func testHealthDiagnosticOpensSourceAtReportedLine() throws {
        let app = XCUIApplication()
        openNewProject(app, name: "Diagnostic Story")
        let file = try studioUITestingDocuments().appending(path: "Diagnostic Story/adv/chapters/01.adv.md")
        let ready = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in FileManager.default.fileExists(atPath: file.path) }, object: nil)
        XCTAssertEqual(XCTWaiter.wait(for: [ready], timeout: 20), .completed)
        try coordinatedWrite(Data("> 开场 😀\n\n- [Branch](#missing)\n".utf8), to: file)

        if UIDevice.current.userInterfaceIdiom == .pad {
            let health = app.buttons["project-section-health"].firstMatch
            XCTAssertTrue(health.waitForExistence(timeout: 20), app.debugDescription)
            health.tap()
        }
        else {
            let overview = app.buttons["Overview"]
            XCTAssertTrue(overview.waitForExistence(timeout: 20))
            overview.tap()
            let health = app.buttons["health-summary"].firstMatch
            XCTAssertTrue(health.waitForExistence(timeout: 20))
            health.tap()
        }
        let diagnostic = app.buttons["project-issue-ADV_RUNTIME_UNKNOWN_TARGET"].firstMatch
        XCTAssertTrue(diagnostic.waitForExistence(timeout: 10), app.debugDescription)
        diagnostic.tap()
        let position = app.staticTexts["chapter-source-position"]
        XCTAssertTrue(position.waitForExistence(timeout: 10), app.debugDescription)
        XCTAssertEqual(position.label, "Line 3, Column 1")
        attachScreenshot(app, "chapter-diagnostic-source-location")
    }

    func testSavedFixtureShowsBothOfficialActivities() throws {
        let app = XCUIApplication()
        openNewProject(app, name: "Offline Fixture")
        let documents = try studioUITestingDocuments()
        let root = documents.appending(path: "Offline Fixture")
        let config = root.appending(path: "adv.config.json")
        let valid = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in FileManager.default.fileExists(atPath: config.path) }, object: nil)
        XCTAssertEqual(XCTWaiter.wait(for: [valid], timeout: 20), .completed)
        app.terminate()

        let fixture = try XCTUnwrap(Bundle(for: Self.self).resourceURL?.appending(path: "OfflineFixture.bundle"))
        let destination = root.appending(path: "adv")
        try FileManager.default.removeItem(at: destination)
        try FileManager.default.copyItem(at: fixture.appending(path: "adv"), to: destination)
        try Data(contentsOf: fixture.appending(path: "adv.config.json")).write(to: config, options: .atomic)

        app.launchArguments.removeAll { $0 == "-studioResetData" }
        app.launch()
        let play = app.buttons["overview-play"].firstMatch
        let isPad = UIDevice.current.userInterfaceIdiom == .pad
        let overview = app.buttons[isPad ? "project-section-overview" : "Overview"].firstMatch
        if !play.waitForExistence(timeout: 4) {
            if !overview.exists {
                let project = app.descendants(matching: .any)["project-Offline Fixture"].firstMatch
                let sidebar = app.buttons["Show Sidebar"].firstMatch
                if !project.exists, sidebar.exists { sidebar.tap() }
                XCTAssertTrue(project.waitForExistence(timeout: 15), app.debugDescription)
                project.tap()
            }
            if !play.exists {
                XCTAssertTrue(overview.waitForExistence(timeout: 15), app.debugDescription)
                overview.tap()
            }
        }
        XCTAssertTrue(play.waitForExistence(timeout: 15), app.debugDescription)
        play.tap()

        let web = app.webViews.firstMatch
        let opening = waitForPlayerDialogue("断网也能试玩吗", in: app)
        attachScreenshot(app, "saved-offline-fixture-dialogue")
        XCUIDevice.shared.press(.home)
        app.activate()
        waitForPlayerDialogue("断网也能试玩吗", in: app)
        let close = app.buttons["close-player"].firstMatch
        XCTAssertTrue(close.waitForExistence(timeout: 10), app.debugDescription)
        let appFrame = app.frame
        let closeFrame = close.frame
        XCTAssertFalse(closeFrame.isEmpty)
        XCTAssertTrue(appFrame.contains(closeFrame))
        // Resolve the native hit target before the WebKit activity opens its modal.
        // Resolving the button again inside that modal can stall the iPad AX query.
        let closeLocation = app.coordinate(withNormalizedOffset: CGVector(
            dx: (closeFrame.midX - appFrame.minX) / appFrame.width,
            dy: (closeFrame.midY - appFrame.minY) / appFrame.height
        ))
        let options = app.descendants(matching: .any)["player-options"].firstMatch
        func playbackAction(id: String, label: String) {
            options.tap()
            // UIKit's menu elements can expose a label without the SwiftUI identifier.
            let action = app.descendants(matching: .any)
                .matching(NSPredicate(format: "identifier == %@ OR label == %@", id, label)).firstMatch
            XCTAssertTrue(action.waitForExistence(timeout: 10), app.debugDescription)
            action.tap()
        }

        playbackAction(id: "player-chapter-lighthouse", label: "lighthouse")
        waitForPlayerDialogue("Lanterns are lit across the harbor.", in: app)
        app.buttons["player-back"].firstMatch.tap()
        waitForPlayerDialogue("断网也能试玩吗", in: app)
        attachScreenshot(app, "saved-offline-fixture-chapter-back")
        playbackAction(id: "player-restart", label: "Restart")
        waitForPlayerDialogue("断网也能试玩吗", in: app)

        let civilization = web.buttons.containing(NSPredicate(format: "label CONTAINS %@", "初始化文明")).firstMatch
        for _ in 0..<3 where !civilization.exists { opening.tap() }
        XCTAssertTrue(civilization.waitForExistence(timeout: 10), app.debugDescription)
        civilization.tap()
        let initialize = web.buttons["执行初始化"].firstMatch
        XCTAssertTrue(initialize.waitForExistence(timeout: 10), app.debugDescription)
        attachScreenshot(app, "saved-offline-fixture-civilization")
        initialize.tap()
        waitForPlayerDialogue("探针结束", in: app)

        playbackAction(id: "player-restart", label: "Restart")
        let restarted = waitForPlayerDialogue("断网也能试玩吗", in: app)
        let choice = web.buttons.containing(NSPredicate(format: "label CONTAINS %@", "先看星图")).firstMatch
        for _ in 0..<3 where !choice.exists { restarted.tap() }
        XCTAssertTrue(choice.waitForExistence(timeout: 10), app.debugDescription)
        choice.tap()
        XCTAssertTrue(web.buttons["重置星图"].waitForExistence(timeout: 10), app.debugDescription)
        attachScreenshot(app, "saved-offline-fixture-star-map")
        closeLocation.tap()
        XCTAssertTrue(play.waitForExistence(timeout: 15), app.debugDescription)
        XCTAssertTrue(web.waitForNonExistence(timeout: 10), app.debugDescription)
    }
}
