import XCTest

/// Another process (this test runner) edits a file through file coordination
/// while the author has unsaved changes, as the Files app or iCloud would.
@MainActor
final class ExternalChangeUITests: XCTestCase {
    override func setUp() async throws {
        continueAfterFailure = false
        try XCTSkipIf(UIDevice.current.userInterfaceIdiom == .pad, "Uses the iPhone layout")
    }

    func testFileChangedElsewhereWhileEditingKeepsBothVersions() throws {
        let app = XCUIApplication()
        app.launchArguments = ["-studioUITesting", "-studioResetData", "-AppleLanguages", "(en)", "-AppleLocale", "en_US"]
        app.launch()
        let workspace = app.tabBars.buttons.firstMatch
        if workspace.waitForExistence(timeout: 30) {
            workspace.tap()
        }

        app.buttons["new-project"].firstMatch.tap()
        let field = app.textFields["project-name"]
        XCTAssertTrue(field.waitForExistence(timeout: 15))
        field.typeText("Shared")
        dismissKeyboardIntroduction(in: app)
        app.buttons["template-visual-novel-starter"].tap()
        app.buttons["create-project"].tap()
        XCTAssertTrue(app.navigationBars["Shared"].waitForExistence(timeout: 30))
        app.buttons["Files"].tap()
        XCTAssertTrue(app.buttons["folder-adv"].waitForExistence(timeout: 15))
        app.buttons["folder-adv"].tap()
        XCTAssertTrue(app.buttons["file-adv/world.md"].waitForExistence(timeout: 15))
        app.buttons["file-adv/world.md"].tap()

        let editor = app.textViews["file-editor"]
        XCTAssertTrue(editor.waitForExistence(timeout: 15))
        editor.tap()
        editor.typeText("\nDraft line from iPhone.")
        sleep(2)

        let file = try studioUITestingDocuments().appending(path: "Shared/adv/world.md")
        XCTAssertTrue(FileManager.default.fileExists(atPath: file.path))
        try coordinatedWrite(Data("# Edited elsewhere\n".utf8), to: file)

        let keepBoth = app.buttons["conflict-keep-both"]
        XCTAssertTrue(keepBoth.waitForExistence(timeout: 20))
        attachScreenshot(app, "conflict-banner")
        keepBoth.tap()
        XCTAssertTrue(keepBoth.waitForNonExistence(timeout: 10))

        XCTAssertEqual(try String(contentsOf: file, encoding: .utf8), "# Edited elsewhere\n")
        let mine = try String(contentsOf: file.deletingLastPathComponent().appending(path: "world (mine).md"), encoding: .utf8)
        XCTAssertTrue(mine.contains("Draft line from iPhone."))
        app.navigationBars.buttons.element(boundBy: 0).tap()
        XCTAssertTrue(app.buttons["file-adv/world (mine).md"].waitForExistence(timeout: 10))
        attachScreenshot(app, "both-versions-kept")
    }
}
