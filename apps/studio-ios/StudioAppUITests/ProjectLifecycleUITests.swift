import XCTest

/// Project management in the iPhone layout, against a throwaway data directory.
@MainActor
final class ProjectLifecycleUITests: XCTestCase {
    override func setUp() async throws {
        continueAfterFailure = false
        try XCTSkipIf(UIDevice.current.userInterfaceIdiom == .pad, "iPhone layout; iPad is covered by IPadLayoutUITests")
    }

    private func launch(language: String = "en", locale: String = "en_US") -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments = ["-studioUITesting", "-studioResetData", "-AppleLanguages", "(\(language))", "-AppleLocale", locale]
        app.launch()
        // Scene restoration may reopen the tab an earlier test left selected.
        let workspace = app.tabBars.buttons.firstMatch
        if workspace.waitForExistence(timeout: 30) {
            workspace.tap()
        }
        return app
    }

    private func waitUntil(timeout: TimeInterval = 5, _ condition: () -> Bool) -> Bool {
        let deadline = Date().addingTimeInterval(timeout)
        while !condition(), Date() < deadline {
            RunLoop.current.run(until: Date().addingTimeInterval(0.2))
        }
        return condition()
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
        XCTAssertTrue(field.waitForExistence(timeout: 10))
        field.typeText(name)
        app.buttons["template-\(template)"].tap()
        app.buttons["create-project"].tap()
    }

    func testCreateOpenRenameDeleteAndUndo() {
        let app = launch()
        XCTAssertTrue(app.staticTexts["No Projects Yet"].waitForExistence(timeout: 15))
        screenshot(app, "empty-library")

        createProject(app, name: "Lighthouse", template: "school-romance")
        // Creating opens the project.
        XCTAssertTrue(app.navigationBars["Lighthouse"].waitForExistence(timeout: 20))
        app.buttons["Overview"].tap()
        XCTAssertTrue(app.staticTexts["Chapters"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.buttons["health-summary"].exists)
        screenshot(app, "project-overview")
        app.navigationBars.buttons.element(boundBy: 0).tap()
        app.navigationBars.buttons.element(boundBy: 0).tap()

        let row = app.buttons["project-Lighthouse"]
        XCTAssertTrue(row.waitForExistence(timeout: 10))
        XCTAssertTrue(row.label.contains("Edited"), row.label)
        screenshot(app, "library-with-project")

        row.swipeLeft()
        app.buttons["Rename"].tap()
        // Alert text fields do not keep custom identifiers.
        let rename = app.alerts.textFields.firstMatch
        XCTAssertTrue(rename.waitForExistence(timeout: 5))
        rename.clearAndType("Lighthouse Keeper")
        // The first tap can land while the keyboard is still settling.
        let confirm = app.alerts.buttons["Rename"]
        for _ in 0..<3 where confirm.exists {
            confirm.tap()
            _ = waitUntil(timeout: 2) { !confirm.exists }
        }
        let renamed = app.buttons["project-Lighthouse Keeper"]
        XCTAssertTrue(renamed.waitForExistence(timeout: 10))

        renamed.swipeLeft()
        app.buttons["Delete"].tap()
        XCTAssertTrue(app.buttons["undo-delete"].waitForExistence(timeout: 5))
        screenshot(app, "deleted-with-undo")
        app.buttons["undo-delete"].tap()
        XCTAssertTrue(app.buttons["project-Lighthouse Keeper"].waitForExistence(timeout: 10))

        app.buttons["project-Lighthouse Keeper"].swipeLeft()
        app.buttons["Delete"].tap()
        XCTAssertTrue(app.buttons["Recently Deleted"].waitForExistence(timeout: 10))
        app.buttons["Recently Deleted"].tap()
        XCTAssertTrue(app.staticTexts["Lighthouse Keeper"].waitForExistence(timeout: 5))
        screenshot(app, "recently-deleted")
    }

    func testEditAndSaveAFile() {
        let app = launch()
        createProject(app, name: "Notebook", template: "visual-novel-starter")
        XCTAssertTrue(app.navigationBars["Notebook"].waitForExistence(timeout: 20))
        app.buttons["Files"].tap()
        let adv = app.buttons["folder-adv"]
        XCTAssertTrue(adv.waitForExistence(timeout: 10))
        adv.tap()
        let world = app.buttons["file-adv/world.md"]
        XCTAssertTrue(world.waitForExistence(timeout: 10))
        screenshot(app, "files-adv-folder")
        world.tap()

        let editor = app.textViews["file-editor"]
        XCTAssertTrue(editor.waitForExistence(timeout: 10))
        editor.tap()
        editor.typeText("\nA line written on iPhone.")
        let save = app.buttons["save-file"]
        XCTAssertTrue(waitUntil { save.isEnabled })
        screenshot(app, "editing-with-draft")
        save.tap()
        XCTAssertTrue(waitUntil { !save.isEnabled })
        XCTAssertTrue((editor.value as? String ?? "").contains("A line written on iPhone."))
    }

    func testChineseInterfaceAndRegionalFormats() {
        let app = launch(language: "zh-Hans", locale: "zh_CN")
        XCTAssertTrue(app.staticTexts["暂无项目"].waitForExistence(timeout: 15))
        XCTAssertTrue(app.buttons["工作区"].exists)
        XCTAssertTrue(app.buttons["我的"].exists)
        createProject(app, name: "灯塔", template: "quick-start")
        XCTAssertTrue(app.navigationBars["灯塔"].waitForExistence(timeout: 20))
        app.buttons["概览"].tap()
        XCTAssertTrue(app.staticTexts["章节"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.staticTexts.containing(NSPredicate(format: "label BEGINSWITH '更新于'")).firstMatch.exists)
        screenshot(app, "zh-overview")
        app.navigationBars.buttons.element(boundBy: 0).tap()
        app.navigationBars.buttons.element(boundBy: 0).tap()
        let row = app.buttons["project-灯塔"]
        XCTAssertTrue(row.waitForExistence(timeout: 10))
        XCTAssertTrue(row.label.contains("编辑于"), row.label)
        screenshot(app, "zh-library")
        app.buttons["我的"].tap()
        XCTAssertTrue(app.staticTexts["外观"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.buttons["language-settings"].exists)
        screenshot(app, "zh-settings")
    }

    func testLanguageEntryOpensSystemSettings() {
        let app = launch()
        app.buttons["Me"].tap()
        let language = app.buttons["language-settings"]
        XCTAssertTrue(language.waitForExistence(timeout: 10))
        screenshot(app, "settings")
        language.tap()
        let settings = openAppPageInSettings()
        screenshot(settings, "system-settings-for-app")
    }

    /// Change the per-app language in Settings, as an author would, and check
    /// that the interface and date formatting follow without relaunch arguments.
    func testSwitchingLanguageInSystemSettings() {
        var app = launch()
        app.terminate()
        for (choice, workspace, me, edited) in [("English", "Workspace", "Me", "Edited"), ("简体中文", "工作区", "我的", "编辑于")] {
            XCUIApplication(bundleIdentifier: "com.apple.Preferences").terminate()
            app = XCUIApplication()
            app.launchArguments = ["-studioUITesting"]
            app.launch()
            let meTab = app.buttons.matching(NSPredicate(format: "label IN {'Me', '我的'}")).firstMatch
            XCTAssertTrue(meTab.waitForExistence(timeout: 30))
            meTab.tap()
            let entry = app.buttons["language-settings"]
            XCTAssertTrue(entry.waitForExistence(timeout: 10))
            entry.tap()
            let settings = openAppPageInSettings()
            let language = settings.buttons.matching(NSPredicate(format: "label BEGINSWITH '语言' OR label BEGINSWITH 'Language'")).firstMatch
            XCTAssertTrue(language.waitForExistence(timeout: 15), settings.debugDescription)
            language.tap()
            let option = settings.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", choice)).firstMatch
            if !option.waitForExistence(timeout: 10) {
                settings.staticTexts.matching(NSPredicate(format: "label BEGINSWITH %@", choice)).firstMatch.tap()
            }
            else {
                option.tap()
            }
            screenshot(settings, "system-language-\(choice)")

            // Settings relaunches the App in the chosen language; open it with no language arguments.
            app = XCUIApplication()
            app.launchArguments = ["-studioUITesting"]
            app.launch()
            XCTAssertTrue(app.buttons[workspace].waitForExistence(timeout: 30), "expected \(workspace)")
            XCTAssertTrue(app.buttons[me].exists)
            app.buttons[workspace].tap()
            let rows = app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH 'project-'"))
            if !rows.firstMatch.waitForExistence(timeout: 5) {
                createProject(app, name: "Starlight", template: "quick-start")
                XCTAssertTrue(app.navigationBars["Starlight"].waitForExistence(timeout: 30))
                app.navigationBars.buttons.element(boundBy: 0).tap()
            }
            XCTAssertTrue(rows.firstMatch.waitForExistence(timeout: 10))
            XCTAssertTrue(rows.firstMatch.label.contains(edited), rows.firstMatch.label)
            screenshot(app, "app-after-system-language-\(choice)")
            app.terminate()
        }
    }

    /// Settings opened from the App: wait for this App's page. Some simulator
    /// builds stop at the Settings root, so go to Apps → ADV.JS Studio if needed.
    private func openAppPageInSettings() -> XCUIApplication {
        let settings = XCUIApplication(bundleIdentifier: "com.apple.Preferences")
        XCTAssertTrue(settings.wait(for: .runningForeground, timeout: 15))
        let appTitle = settings.staticTexts["ADV.JS Studio"].firstMatch
        if !appTitle.waitForExistence(timeout: 10) {
            let apps = settings.buttons.matching(NSPredicate(format: "identifier CONTAINS[c] 'APPS' OR label == 'App' OR label == 'Apps'")).firstMatch
            for _ in 0..<6 where !apps.isHittable {
                settings.swipeUp()
            }
            apps.tap()
            let row = settings.buttons["ADV.JS Studio"].firstMatch
            for _ in 0..<8 where !row.waitForExistence(timeout: 2) {
                settings.swipeUp()
            }
            row.tap()
        }
        XCTAssertTrue(appTitle.waitForExistence(timeout: 15), settings.debugDescription)
        sleep(2)
        return settings
    }
}

extension XCUIElement {
    func clearAndType(_ text: String) {
        tap()
        if let current = value as? String, !current.isEmpty {
            typeText(String(repeating: XCUIKeyboardKey.delete.rawValue, count: current.count))
        }
        typeText(text)
    }
}
