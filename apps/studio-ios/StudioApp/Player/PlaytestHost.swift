import Observation
import OSLog
import StudioKit
import SwiftUI

enum PlaytestStart {
    case project
    case chapter(String)
    case source(SourceLocation)
    case node(RuntimeAddress, SourceLocation)

    var path: String? {
        switch self {
        case .project: nil
        case .chapter(let path): path
        case .source(let location), .node(_, let location): location.path
        }
    }

    var location: SourceLocation? {
        switch self {
        case .source(let location), .node(_, let location): location
        case .project, .chapter: nil
        }
    }
}

@Observable
final class PlaytestCoordinator {
    struct Request {
        let session: ProjectSession
        let start: PlaytestStart
    }

    var pending: Request?
    var launch: PlayerLaunch?
    var issues: [PlayerIssue] = []
    var showIssues = false
    var issueSession: ProjectSession?
    private(set) var isPreparing = false
    private let logger = Logger(subsystem: "org.advjs.studio", category: "OfflinePlayer")

    func offer(_ session: ProjectSession, start: PlaytestStart) {
        guard !isPreparing, launch == nil else { return }
        let request = Request(session: session, start: start)
        if session.drafts.isEmpty {
            begin(request, version: .saved, save: false)
        }
        else {
            pending = request
        }
    }

    func begin(_ request: Request, version: ProjectSourceVersion, save: Bool) {
        guard !isPreparing, launch == nil else { return }
        isPreparing = true
        logger.info("Preparing playtest snapshot")
        issueSession = request.session
        pending = nil
        Task {
            defer { isPreparing = false }
            do {
                let session = request.session
                if version == .saved {
                    try await session.reloadSavedVersion()
                }
                if save {
                    guard session.conflicts.isEmpty else { throw CoordinatedFiles.WriteError.sourceChanged }
                    let drafts = session.drafts
                    for draft in drafts {
                        guard session.drafts.first(where: { $0.path == draft.path }) == draft else {
                            throw CoordinatedFiles.WriteError.sourceChanged
                        }
                        try await session.saveDraft(draft.path)
                    }
                    guard session.drafts.isEmpty else { throw CoordinatedFiles.WriteError.sourceChanged }
                }
                guard let root = session.root else { throw ProjectLibraryError.unavailable }
                let source = try session.sourceInput(version)
                logger.info("Compiling playtest snapshot")
                let result = try await session.buildPlayer(source, baseURL: PlayerSchemeHandler.baseURL)
                logger.info("Compiled playtest snapshot")
                let errors = result.diagnostics.filter { $0.severity == .error }
                guard errors.isEmpty, result.program != nil, result.gameConfigJSON != nil else {
                    reject(errors.map(PlayerIssue.init))
                    return
                }
                let address: RuntimeAddress?
                if case .node(let node, let location) = request.start {
                    let current = result.sourceMap.nodes?["\(node.chapterId)#\(node.nodeId)"]
                    address = current == location && result.program?.chapters[node.chapterId]?.order.contains(node.nodeId) == true ? node : nil
                }
                else {
                    address = result.startAddress(chapterPath: request.start.path, location: request.start.location)
                }
                guard let start = address else {
                    reject([PlayerIssue(code: "PLAYER_START", message: String(localized: "There’s no executable node at or after this position."),
                                        location: request.start.location)])
                    return
                }
                launch = PlayerLaunch(projectRoot: root, paths: source.paths, build: result, start: start)
            }
            catch {
                reject([PlayerIssue(code: "PROJECT_PLAYTEST", message: StudioAlert.describe(error))])
            }
        }
    }

    private func reject(_ diagnostics: [PlayerIssue]) {
        issues = diagnostics.isEmpty
            ? [PlayerIssue(code: "PLAYER_BUILD", message: String(localized: "The project couldn’t be prepared for playback."))]
            : diagnostics
        showIssues = true
    }
}

struct PlaytestHost: ViewModifier {
    @State private var coordinator = PlaytestCoordinator()

    func body(content: Content) -> some View {
        @Bindable var coordinator = coordinator
        content
            .disabled(coordinator.isPreparing)
            .alert("Playtest with Unsaved Changes", isPresented: Binding(
                get: { coordinator.pending != nil },
                set: { if !$0 { coordinator.pending = nil } }
            ), presenting: coordinator.pending) { request in
                Button("Save and Playtest") { coordinator.begin(request, version: .saved, save: true) }
                Button("Playtest Draft") { coordinator.begin(request, version: .draft, save: false) }
                Button("Cancel", role: .cancel) {}
            }
            .fullScreenCover(item: $coordinator.launch) { launch in
                PlayerView(launch: launch)
            }
            .sheet(isPresented: $coordinator.showIssues) {
                NavigationStack {
                    List(coordinator.issues) { issue in
                        if let location = issue.location, let session = coordinator.issueSession,
                           session.text(at: location.path) != nil {
                            NavigationLink {
                                FileDetailView(session: session, path: location.path, location: location)
                            } label: { issueRow(issue) }
                            .accessibilityIdentifier("player-issue-\(issue.code)")
                        }
                        else {
                            issueRow(issue)
                        }
                    }
                    .navigationTitle("Can’t Start Playtest")
                    .navigationBarTitleDisplayMode(.inline)
                    .toolbar {
                        ToolbarItem(placement: .confirmationAction) {
                            Button("Done") { coordinator.showIssues = false }
                        }
                    }
                }
            }
            .environment(coordinator)
    }
    private func issueRow(_ issue: PlayerIssue) -> some View {
        IssueRow(isError: true, message: issue.message, location: issue.location?.display ?? issue.code)
    }
}
