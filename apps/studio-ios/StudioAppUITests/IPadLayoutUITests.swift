import XCTest

/// Three-column layout and project windows on iPad.
@MainActor
final class IPadLayoutUITests: XCTestCase {
    override func setUp() async throws {
        continueAfterFailure = false
        try XCTSkipUnless(UIDevice.current.userInterfaceIdiom == .pad, "iPad only")
    }

    /// The whole screen: an app screenshot in landscape comes back rotated and clipped.
    private func screenshot(_ app: XCUIApplication, _ name: String) {
        let attachment = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }

    private func createProject(_ app: XCUIApplication, name: String, template: String) {
        app.buttons["new-project"].firstMatch.tap()
        let field = app.textFields["project-name"]
        XCTAssertTrue(field.waitForExistence(timeout: 15))
        field.typeText(name)
        dismissKeyboardIntroduction(in: app)
        app.buttons["template-\(template)"].tap()
        app.buttons["create-project"].tap()
    }

    func testThreeColumnsAndProjectWindows() throws {
        let originalOrientation = XCUIDevice.shared.orientation
        XCUIDevice.shared.orientation = .landscapeLeft
        defer {
            if originalOrientation.isPortrait || originalOrientation.isLandscape {
                XCUIDevice.shared.orientation = originalOrientation
            }
        }
        let app = XCUIApplication()
        app.launchArguments = ["-studioUITesting", "-studioResetData", "-AppleLanguages", "(en)", "-AppleLocale", "en_US"]
        app.launch()

        XCTAssertTrue(app.buttons["new-project"].firstMatch.waitForExistence(timeout: 30))
        // ⌘N from a hardware keyboard opens New Project, like the File menu command.
        app.typeKey("n", modifierFlags: .command)
        let field = app.textFields["project-name"]
        XCTAssertTrue(field.waitForExistence(timeout: 15))
        field.typeText("Harbor")
        dismissKeyboardIntroduction(in: app)
        app.buttons["template-school-romance"].tap()
        app.buttons["create-project"].tap()
        XCTAssertTrue(app.staticTexts["Project Health"].firstMatch.waitForExistence(timeout: 30))
        createProject(app, name: "Moonlit", template: "quick-start")
        let documents = try studioUITestingDocuments()
        for (name, line) in [("Harbor", "First window harbor"), ("Moonlit", "Second window moonlit")] {
            let file = documents.appending(path: "\(name)/adv/chapters/01.adv.md")
            let ready = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
                FileManager.default.fileExists(atPath: file.path)
            }, object: nil)
            XCTAssertEqual(XCTWaiter.wait(for: [ready], timeout: 15), .completed)
            try coordinatedWrite(Data("> \(line)\n".utf8), to: file)
        }

        let harbor = app.descendants(matching: .any)["project-Harbor"].firstMatch
        XCTAssertTrue(harbor.waitForExistence(timeout: 20))
        harbor.tap()
        XCTAssertTrue(app.staticTexts["Chapters"].firstMatch.waitForExistence(timeout: 20))
        screenshot(app, "ipad-three-columns")

        let moonlit = app.descendants(matching: .any)["project-Moonlit"].firstMatch
        moonlit.press(forDuration: 1.2)
        let newWindow = app.buttons["Open in New Window"]
        XCTAssertTrue(newWindow.waitForExistence(timeout: 10))
        screenshot(app, "ipad-context-menu")
        newWindow.tap()
        // The project window shows the second project's sections.
        let window = app.windows.containing(.navigationBar, identifier: "Moonlit").firstMatch
        XCTAssertTrue(window.waitForExistence(timeout: 30))
        screenshot(app, "ipad-project-window")
        let overview = window.buttons["project-section-overview"].firstMatch
        XCTAssertTrue(overview.waitForExistence(timeout: 15), app.debugDescription)
        overview.tap()
        XCTAssertTrue(window.buttons["overview-play"].firstMatch.waitForExistence(timeout: 15), app.debugDescription)
        window.typeKey("r", modifierFlags: .command)
        let web = app.webViews.firstMatch
        waitForPlayerDialogue("Second window moonlit", in: app)
        screenshot(app, "ipad-focused-project-playtest")
        app.buttons["close-player"].firstMatch.tap()
        XCTAssertTrue(web.waitForNonExistence(timeout: 10), app.debugDescription)
        XCTAssertTrue(app.navigationBars["Moonlit"].firstMatch.exists, app.debugDescription)
    }
}
