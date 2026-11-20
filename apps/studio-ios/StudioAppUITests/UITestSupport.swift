import XCTest

@MainActor
extension XCTestCase {
    func attachScreenshot(_ app: XCUIApplication, _ name: String) {
        // The app snapshot can be cropped when the iPad is in landscape.
        let screenshot = UIDevice.current.userInterfaceIdiom == .pad ? XCUIScreen.main.screenshot() : app.screenshot()
        let attachment = XCTAttachment(screenshot: screenshot)
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }

    @discardableResult
    func waitForPlayerDialogue(_ expected: String, in app: XCUIApplication) -> XCUIElement {
        let texts = app.webViews.firstMatch.staticTexts
        let line = texts.containing(NSPredicate(format: "label CONTAINS %@", expected)).firstMatch
        let firstGlyph = texts.matching(NSPredicate(format: "label == %@", String(expected.prefix(1)))).firstMatch
        let content = expected.filter { !$0.isWhitespace }
        let ready = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
            if line.exists { return true }
            guard firstGlyph.exists else { return false }
            // Some WebKit versions expose each animated glyph as a separate static text.
            let rendered = texts.allElementsBoundByIndex.map(\.label).joined()
            return rendered.filter { !$0.isWhitespace }.contains(content)
        }, object: nil)
        XCTAssertEqual(XCTWaiter.wait(for: [ready], timeout: 40), .completed, app.debugDescription)
        return line.exists ? line : firstGlyph
    }

    /// A fresh simulator can show the system's slide-to-type introduction over
    /// the first keyboard. It accepts typing but intercepts subsequent taps.
    func dismissKeyboardIntroduction(in app: XCUIApplication) {
        let introduction = app.otherElements["UIContinuousPathIntroductionView"].firstMatch
        guard introduction.waitForExistence(timeout: 3) else { return }
        attachScreenshot(app, "keyboard-introduction")
        let continueButton = introduction.buttons.firstMatch
        XCTAssertTrue(continueButton.waitForExistence(timeout: 5))
        continueButton.tap()
        XCTAssertTrue(introduction.waitForNonExistence(timeout: 5), app.debugDescription)
    }

    /// Documents of the App's UI-testing data directory on this simulator,
    /// found through the container metadata next to the test runner's own.
    func studioUITestingDocuments() throws -> URL {
        #if DEBUG
        let bundleIdentifier = "org.advjs.studio.dev"
        #else
        let bundleIdentifier = "org.advjs.studio"
        #endif
        let applications = URL(fileURLWithPath: NSHomeDirectory()).deletingLastPathComponent()
        for container in try FileManager.default.contentsOfDirectory(at: applications, includingPropertiesForKeys: nil) {
            let metadata = container.appending(path: ".com.apple.mobile_container_manager.metadata.plist")
            guard let plist = NSDictionary(contentsOf: metadata),
                  plist["MCMMetadataIdentifier"] as? String == bundleIdentifier else { continue }
            return container.appending(path: "tmp/ui-tests/Documents")
        }
        throw XCTSkip("App container not reachable from the test runner")
    }

    /// Writes as another app would: through file coordination, replacing atomically.
    func coordinatedWrite(_ data: Data, to url: URL) throws {
        var coordinationError: NSError?
        var writeError: Error?
        NSFileCoordinator(filePresenter: nil).coordinate(writingItemAt: url, options: .forReplacing, error: &coordinationError) { target in
            do { try data.write(to: target, options: .atomic) }
            catch { writeError = error }
        }
        if let error = coordinationError ?? writeError {
            throw error
        }
    }
}
