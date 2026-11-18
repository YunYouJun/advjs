import StudioKit
import StudioUI
import SwiftUI

@main
struct StudioApp: App {
    @State private var model = AppModel.live()

    var body: some Scene {
        WindowGroup(id: "main") {
            RootView()
                .environment(model)
                .tint(StudioTheme.purple)
                .preferredColorScheme(model.appearance.colorScheme)
        }
        .commands {
            StudioCommands(model: model)
        }

        // iPad: one more window per project, opened from a project's context menu.
        WindowGroup("Project", id: "project", for: UUID.self) { $projectID in
            if let projectID {
                ProjectWindowView(projectID: projectID)
                    .environment(model)
                    .tint(StudioTheme.purple)
                    .preferredColorScheme(model.appearance.colorScheme)
            }
        }
    }
}
