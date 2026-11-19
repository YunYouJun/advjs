import XCTest

@MainActor
final class ContentAuthoringUITests: XCTestCase {
    func testRenameCharacterKeepsFileAndOpensAfterRelaunch() throws {
        continueAfterFailure = false
        let originalOrientation = XCUIDevice.shared.orientation
        if UIDevice.current.userInterfaceIdiom == .pad {
            XCUIDevice.shared.orientation = .landscapeLeft
        }
        defer { XCUIDevice.shared.orientation = originalOrientation }
        let app = XCUIApplication()
        app.launchArguments = ["-studioUITesting", "-studioResetData", "-appearance", "light", "-AppleLanguages", "(en)", "-AppleLocale", "en_US"]
        app.launch()
        if app.tabBars.buttons.firstMatch.exists { app.tabBars.buttons.firstMatch.tap() }
        let newProject = app.buttons["new-project"].firstMatch
        XCTAssertTrue(newProject.waitForExistence(timeout: 30), app.debugDescription)
        newProject.tap()
        let projectName = app.textFields["project-name"]
        XCTAssertTrue(projectName.waitForExistence(timeout: 10))
        projectName.tap()
        projectName.typeText("Content Fixture")
        dismissKeyboardIntroduction(in: app)
        app.buttons["template-school-romance"].tap()
        app.buttons["create-project"].tap()

        let content = app.descendants(matching: .any)["story-content-section"].firstMatch
        XCTAssertTrue(content.waitForExistence(timeout: 20))
        content.tap()
        let characters = app.buttons["content-list-character"]
        XCTAssertTrue(characters.waitForExistence(timeout: 10))
        characters.tap()
        let row = app.buttons["content-entry-adv/characters/ye-qing.character.md"]
        XCTAssertTrue(row.waitForExistence(timeout: 10))
        let documents = try studioUITestingDocuments()
        let url = documents.appending(path: "Content Fixture/adv/characters/ye-qing.character.md")
        let original = try String(contentsOf: url, encoding: .utf8)
        let fixture = original.replacingOccurrences(of: "\n---", with: "\ncustomMetadata: { current: 1 }\n---")
            + "\n## 额外说明\n\n未知正文\n"
        try coordinatedWrite(Data(fixture.utf8), to: url)

        // Allow the session watcher to publish the source baseline before opening the form.
        RunLoop.current.run(until: Date().addingTimeInterval(1))
        row.tap()
        let name = app.textFields["content-name"]
        XCTAssertTrue(name.waitForExistence(timeout: 10))
        name.tap()
        name.clearAndType("April")
        let save = app.buttons["save-content"]
        let enabled = XCTNSPredicateExpectation(predicate: NSPredicate(format: "enabled == true"), object: save)
        XCTAssertEqual(XCTWaiter.wait(for: [enabled], timeout: 5), .completed)
        save.tap()
        let disabled = XCTNSPredicateExpectation(predicate: NSPredicate(format: "enabled == false"), object: save)
        XCTAssertEqual(XCTWaiter.wait(for: [disabled], timeout: 10), .completed)
        XCTAssertTrue(app.navigationBars["April"].waitForExistence(timeout: 10))
        attachScreenshot(app, "native-content-character-renamed")
        let saved = try String(contentsOf: url, encoding: .utf8)
        XCTAssertTrue(saved.contains("id: ye-qing"))
        XCTAssertTrue(saved.contains("name: April"))
        XCTAssertTrue(saved.contains("customMetadata:"))
        XCTAssertTrue(saved.hasSuffix("\n## 额外说明\n\n未知正文\n"))

        app.terminate()
        app.launchArguments = ["-studioUITesting", "-appearance", "dark", "-AppleLanguages", "(zh-Hans)", "-AppleLocale", "zh_CN"]
        app.launch()
        let project = app.descendants(matching: .any)["project-Content Fixture"].firstMatch
        if !content.exists {
            XCTAssertTrue(project.waitForExistence(timeout: 15))
            project.tap()
        }
        XCTAssertTrue(content.waitForExistence(timeout: 15))
        content.tap()
        XCTAssertTrue(characters.waitForExistence(timeout: 10))
        characters.tap()
        XCTAssertTrue(row.waitForExistence(timeout: 10))
        XCTAssertTrue(row.label.contains("April"), row.label)
        row.tap()
        XCTAssertTrue(app.navigationBars["April"].waitForExistence(timeout: 10))
        attachScreenshot(app, "native-content-character-reopened-zh-dark")
    }
}
