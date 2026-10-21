import XCTest

/// Numbers and dates follow the App's locale. English and Simplified Chinese
/// share decimal and grouping symbols, so a German region shows the difference.
@MainActor
final class RegionalFormatUITests: XCTestCase {
    override func setUp() async throws {
        continueAfterFailure = false
        try XCTSkipIf(UIDevice.current.userInterfaceIdiom == .pad, "Uses the iPhone layout")
    }

    private func launch(_ arguments: [String]) -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments = ["-studioUITesting"] + arguments
        app.launch()
        let workspace = app.tabBars.buttons.firstMatch
        if workspace.waitForExistence(timeout: 30) {
            workspace.tap()
        }
        return app
    }

    func testFileSizeAndDateFollowTheLocale() throws {
        var app = launch(["-studioResetData", "-AppleLanguages", "(en)", "-AppleLocale", "en_US"])
        app.buttons["new-project"].firstMatch.tap()
        let field = app.textFields["project-name"]
        XCTAssertTrue(field.waitForExistence(timeout: 15))
        field.typeText("Formats")
        app.buttons["template-quick-start"].tap()
        app.buttons["create-project"].tap()
        XCTAssertTrue(app.navigationBars["Formats"].waitForExistence(timeout: 30))
        app.terminate()

        // A 1.5 MB file shows a fractional size, so the decimal separator is visible.
        let file = try studioUITestingDocuments().appending(path: "Formats/adv/archive.bin")
        try coordinatedWrite(Data(count: 1_500_000), to: file)

        for (language, locale, size, date) in [
            ("en", "en_US", "1.5 MB", "PM|AM"),
            ("zh-Hans", "zh_CN", "1.5 MB", "\\d{4}/\\d{1,2}/\\d{1,2}"),
            ("en", "de_DE", "1,5 MB", "\\d{1,2}\\.\\d{1,2}\\.\\d{4}|\\d{1,2}/\\d{1,2}/\\d{4}"),
        ] {
            app = launch(["-AppleLanguages", "(\(language))", "-AppleLocale", locale])
            let row = app.buttons["project-Formats"]
            // Scene restoration may reopen the project the previous launch left open.
            if !row.waitForExistence(timeout: 5), app.navigationBars["Formats"].exists {
                app.navigationBars.buttons.element(boundBy: 0).tap()
            }
            XCTAssertTrue(row.waitForExistence(timeout: 15))
            row.tap()
            let files = app.buttons.matching(NSPredicate(format: "label IN {'Files', '文件'}")).firstMatch
            XCTAssertTrue(files.waitForExistence(timeout: 15))
            files.tap()
            XCTAssertTrue(app.buttons["folder-adv"].waitForExistence(timeout: 15))
            app.buttons["folder-adv"].tap()
            XCTAssertTrue(app.buttons["file-adv/archive.bin"].waitForExistence(timeout: 15))
            app.buttons["file-adv/archive.bin"].tap()

            let sizeText = app.staticTexts.matching(NSPredicate(format: "label CONTAINS 'MB'")).firstMatch
            XCTAssertTrue(sizeText.waitForExistence(timeout: 10))
            // Label and value are one element: "Size, 1.5 MB", "大小、1.5 MB".
            XCTAssertTrue(sizeText.label.hasSuffix(size), "\(locale): \(sizeText.label)")
            let dateText = app.staticTexts.matching(NSPredicate(format: "label MATCHES %@", ".*(\(date)).*")).firstMatch
            XCTAssertTrue(dateText.exists, "\(locale): \(app.staticTexts.allElementsBoundByIndex.map(\.label))")
            attachScreenshot(app, "file-info-\(locale)")
            app.terminate()
        }
    }
}
