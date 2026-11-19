import SwiftUI

extension FocusedValues {
    /// Project shown by the focused window.
    @Entry var selectedProject: UUID?
    /// Project-list actions of the focused window.
    @Entry var libraryActions: LibraryActions?
    /// Saves the focused editor's draft.
    @Entry var saveFile: SaveAction?
    @Entry var runPlaytest: RunPlaytestAction?
    /// Focuses the focused window's project search.
    @Entry var findProjects: FindAction?
}

/// Starts searching the project list, compared by identity of its window.
struct FindAction: Equatable {
    let id: UUID
    let perform: () -> Void

    static func == (left: FindAction, right: FindAction) -> Bool {
        left.id == right.id
    }
}

/// The focused editor's save, compared by file so focus updates stay cheap.
struct SaveAction: Equatable {
    let path: String
    let perform: () -> Void

    static func == (left: SaveAction, right: SaveAction) -> Bool {
        left.path == right.path
    }
}

struct RunPlaytestAction {
    let perform: () -> Void
}

/// Commands for the main window, which owns the project library.
struct StudioLibraryCommands: Commands {
    @FocusedValue(\.libraryActions) private var libraryActions
    @FocusedValue(\.selectedProject) private var selectedProject
    @FocusedValue(\.findProjects) private var findProjects
    @Environment(\.openWindow) private var openWindow

    var body: some Commands {
        CommandGroup(replacing: .newItem) {
            Button("New Project") { libraryActions?.isCreating = true }
                .keyboardShortcut("n", modifiers: .command)
                .disabled(libraryActions == nil)
            Button("Open Project in New Window") {
                if let selectedProject { openWindow(id: "project", value: selectedProject) }
            }
            .keyboardShortcut("n", modifiers: [.command, .option])
            .disabled(selectedProject == nil)
        }
        CommandGroup(after: .newItem) {
            Button("Import Package…") { libraryActions?.importing = .package }
                .keyboardShortcut("i", modifiers: [.command, .shift])
                .disabled(libraryActions == nil)
            Button("Open Folder in Place…") { libraryActions?.importing = .folderInPlace }
                .keyboardShortcut("o", modifiers: .command)
                .disabled(libraryActions == nil)
        }
        CommandGroup(after: .textEditing) {
            Button("Find Projects") { findProjects?.perform() }
                .keyboardShortcut("f", modifiers: .command)
                .disabled(findProjects == nil)
        }
    }
}

/// Commands available in either window, routed to the focused editor.
struct StudioEditorCommands: Commands {
    @FocusedValue(\.saveFile) private var saveFile
    @FocusedValue(\.runPlaytest) private var runPlaytest

    var body: some Commands {
        SidebarCommands()
        CommandGroup(replacing: .saveItem) {
            Button("Save") { saveFile?.perform() }
                .keyboardShortcut("s", modifiers: .command)
                .disabled(saveFile == nil)
            Button("Run Playtest") { runPlaytest?.perform() }
                .keyboardShortcut("r", modifiers: .command)
                .disabled(runPlaytest == nil)
        }
    }
}
