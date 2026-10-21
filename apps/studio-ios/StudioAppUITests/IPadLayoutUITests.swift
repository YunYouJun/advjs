import XCTest

/// Three-column layout and project windows on iPad.
@MainActor
final class IPadLayoutUITests: XCTestCase {
    override func setUp() async throws {
        continueAfterFailure = false
        try XCTSkipUnless(UIDevice.current.userInterfaceIdiom == .pad, "iPad only")
    }

    private func screenshot(_ app: XCUIApplication, _ name: String) {
        let attachment = XCTAttachment(screenshot: app.screenshot())
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }

    private func createProject(_ app: XCUIApplication, name: String, template: String) {
        app.buttons["new-project"].firstMatch.tap()
        let field = app.textFields["project-name"]
        XCTAssertTrue(field.waitForExistence(timeout: 15))
        field.typeText(name)
        app.buttons["template-\(template)"].tap()
        app.buttons["create-project"].tap()
    }

    func testThreeColumnsAndProjectWindows() {
        XCUIDevice.shared.orientation = .landscapeLeft
        let app = XCUIApplication()
        app.launchArguments = ["-studioUITesting", "-studioResetData", "-AppleLanguages", "(en)", "-AppleLocale", "en_US"]
        app.launch()

        XCTAssertTrue(app.buttons["new-project"].firstMatch.waitForExistence(timeout: 30))
        createProject(app, name: "Harbor", template: "school-romance")
        XCTAssertTrue(app.staticTexts["Project Health"].firstMatch.waitForExistence(timeout: 30))
        createProject(app, name: "Moonlit", template: "quick-start")

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
        XCTAssertTrue(app.navigationBars["Moonlit"].firstMatch.waitForExistence(timeout: 30))
        screenshot(app, "ipad-project-window")
        XCUIDevice.shared.orientation = .portrait
    }
}
