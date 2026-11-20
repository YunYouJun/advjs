import Foundation
import Observation
import StudioKit
import SwiftUI

/// App-wide state shared by every window: the project list, open project
/// sessions and device preferences. Windows showing the same project share
/// its session. Sessions stay open while recently used, so pushing a view or
/// switching windows keeps the engine warm; the least recently used beyond
/// `maximumOpenSessions` are closed to release their JavaScript heaps.
@Observable
final class AppModel {
    static let maximumOpenSessions = 4

    let library: ProjectLibrary
    private(set) var sessions: [UUID: ProjectSession] = [:]
    @ObservationIgnored private var lastUsed: [UUID: Date] = [:]
    var lastError: StudioAlert?
    /// Windows showing the project list, so a project window can tell whether closing leaves one.
    @ObservationIgnored var libraryWindows = 0

    /// Light, dark or the system setting; a device preference, not project data.
    var appearance: Appearance = Appearance(rawValue: UserDefaults.standard.string(forKey: "appearance") ?? "") ?? .system {
        didSet { UserDefaults.standard.set(appearance.rawValue, forKey: "appearance") }
    }

    init(directories: StudioDirectories) {
        library = ProjectLibrary(directories: directories)
    }

    /// The model for the App's real containers, or a temporary one under UI tests.
    static func live() -> AppModel {
        let arguments = ProcessInfo.processInfo.arguments
        if arguments.contains("-studioUITesting") {
            let root = FileManager.default.temporaryDirectory.appending(path: "ui-tests", directoryHint: .isDirectory)
            if arguments.contains("-studioResetData") {
                try? FileManager.default.removeItem(at: root)
            }
            return AppModel(directories: StudioDirectories(root: root))
        }
        do {
            return AppModel(directories: try StudioDirectories.standard())
        }
        catch {
            let root = FileManager.default.temporaryDirectory.appending(path: "fallback", directoryHint: .isDirectory)
            return AppModel(directories: StudioDirectories(root: root))
        }
    }

    /// Open (or reuse) the session for a project.
    func session(for id: UUID) -> ProjectSession {
        lastUsed[id] = .now
        if let session = sessions[id] {
            return session
        }
        let name = library.summary(id)?.name ?? ""
        let session = ProjectSession(id: id, name: name, store: library.store, directories: library.directories)
        sessions[id] = session
        Task { await session.open() }
        trimSessions(keeping: id)
        return session
    }

    /// Close the session of a project that was deleted or moved.
    func closeSession(_ id: UUID) {
        guard let session = sessions.removeValue(forKey: id) else { return }
        lastUsed[id] = nil
        Task { await session.close() }
    }

    private func trimSessions(keeping id: UUID) {
        let stale = sessions.keys
            .filter { $0 != id }
            .sorted { (lastUsed[$0] ?? .distantPast) < (lastUsed[$1] ?? .distantPast) }
            .dropLast(Self.maximumOpenSessions - 1)
        for staleID in stale {
            closeSession(staleID)
        }
    }

    func report(_ error: Error) {
        lastError = StudioAlert(error)
    }

    func refresh() async {
        do {
            try await library.refresh()
        }
        catch {
            report(error)
        }
    }
}

enum Appearance: String, CaseIterable, Identifiable {
    case system
    case light
    case dark

    var id: String { rawValue }

    var colorScheme: ColorScheme? {
        switch self {
        case .system: nil
        case .light: .light
        case .dark: .dark
        }
    }

    var title: LocalizedStringKey {
        switch self {
        case .system: "Match System"
        case .light: "Light"
        case .dark: "Dark"
        }
    }
}

/// An error worth telling the author about, with a localized message.
struct StudioAlert: Identifiable {
    let id = UUID()
    let message: String

    init(_ error: Error) {
        message = StudioAlert.describe(error)
    }

    static func describe(_ error: Error) -> String {
        if error is CoordinatedFiles.WriteError {
            return String(localized: "This file changed on disk. Review the conflict before saving.")
        }
        if let error = error as? ProjectLibraryError {
            switch error {
            case .notFound: return String(localized: "The project no longer exists.")
            case .notAProject: return String(localized: "This folder is not an ADV.JS project. It needs an adv folder or adv.config.json.")
            case .unavailable: return String(localized: "The project folder cannot be reached. It may have been moved or its storage is unavailable.")
            case .nameTaken(let name): return String(localized: "“\(name)” already exists. Choose another name.")
            case .invalidName: return String(localized: "Enter a valid name.")
            case .unsafePackage(let paths): return String(localized: "The package was not imported because it contains unsafe paths: \(paths.joined(separator: ", "))")
            case .invalidPackage: return String(localized: "This file is not an ADV.JS project package (.advpkg.zip).")
            case .missingMedia(let path): return String(localized: "The project lists a file that is missing: \(path)")
            case .mediaMismatch(let path): return String(localized: "A media file does not match its recorded checksum: \(path)")
            case .renameUnsupportedForExternal: return String(localized: "Projects opened from another location keep their folder name. Rename them in the Files app.")
            }
        }
        if let error = error as? ContentAuthoringError {
            switch error {
            case .sourceChanged: return String(localized: "The entry changed on disk. Reopen it or resolve the draft conflict.")
            case .unreadable: return String(localized: "The entry could not be read. Check its source file.")
            }
        }
        if case EngineError.engine(let failure) = error, failure.code == "ENGINE_AUTHORING_INVALID" {
            return String(localized: "The content could not be processed. Check the entry fields or import file.")
        }
        if let error = error as? ProjectAudioError {
            switch error {
            case .missingFile: return String(localized: "The audio file is missing from the project.")
            case .unreadableFile: return String(localized: "The audio file could not be read. Check that it is downloaded in Files.")
            case .invalidAudio: return String(localized: "This audio cannot be decoded. Choose a playable audio file.")
            case .audioTooLarge: return String(localized: "Choose an audio file up to 64 MiB.")
            case .noLocalMedia: return String(localized: "This resource has no local audio file.")
            case .changedMedia: return String(localized: "The audio file differs from the catalog’s recorded master.")
            case .auditionRequired: return String(localized: "Play this audio before confirming the review.")
            case .staleProject: return String(localized: "The project changed. Reload the audio library and try again.")
            case .unsavedChapter: return String(localized: "Save the chapter before binding music.")
            case .incompleteRollback: return String(localized: "The audio edit could not be fully restored after a write error. Reload the project and check its files.")
            }
        }
        if case EngineError.engine(let failure) = error {
            switch failure.code {
            case "ENGINE_AUDIO_CONFLICT": return String(localized: "The project changed. Reload the audio library and try again.")
            case "ENGINE_AUDIO_REFERENCED": return String(localized: "This audio is in use. Remove its references before changing its kind or removing it.")
            case "ENGINE_AUDIO_REVIEW_REQUIRED": return String(localized: "Review this music and its license before binding it.")
            case "ENGINE_AUDIO_CHAPTER_INVALID": return String(localized: "Choose a Markdown chapter with saved story content.")
            case "ENGINE_AUDIO_ROOT_UNSUPPORTED": return String(localized: "Audio authoring requires the adv project folder.")
            case "ENGINE_AUDIO_FILE_INVALID": return String(localized: "Choose a nonempty audio file in a supported format.")
            case "ENGINE_AUDIO_INVALID": return String(localized: "The audio edit could not be validated. Check the resource fields and project diagnostics.")
            default: break
            }
        }
        if let error = error as? ProjectImageError {
            switch error {
            case .invalidImage: return String(localized: "This image could not be imported. Check the format and file size.")
            case .missingImage: return String(localized: "The image file is missing from the project.")
            }
        }
        return error.localizedDescription
    }
}
