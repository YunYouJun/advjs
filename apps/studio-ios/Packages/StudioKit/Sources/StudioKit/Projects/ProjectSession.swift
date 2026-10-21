import Foundation
import Observation

/// One open project: its files, the engine's view of them, and edits in
/// progress. Each session owns its own engine (and JavaScript heap), which is
/// released when the session closes.
///
/// Changes made by other processes are picked up through file coordination
/// and applied after a short pause; drafts whose file changed underneath
/// become ``conflicts`` for the author to resolve.
@MainActor
@Observable
public final class ProjectSession: Identifiable {
    public enum State: Equatable, Sendable {
        case closed
        case loading
        case ready
        case failed(String)
        /// The folder was deleted or can no longer be reached.
        case gone
    }

    public let id: UUID
    public private(set) var name: String
    public private(set) var root: URL?
    public private(set) var state: State = .closed
    public private(set) var snapshot: ProjectSnapshot?
    public private(set) var index: EngineProjectIndex?
    public private(set) var validation: EngineValidation?
    public private(set) var conflicts: [FileConflict] = []
    public private(set) var drafts: [FileDraft] = []
    /// Reloads caused by changes from other processes, for diagnostics and tests.
    public private(set) var externalReloads = 0
    public private(set) var lastReloadedAt: Date?

    public static let debounce: Duration = .milliseconds(400)

    private let store: ProjectStore
    private let engine: EngineBridge
    private let draftStore: DraftStore
    private var access: ProjectFolderAccess?
    private var watcher: ProjectWatcher?
    private var pendingReload: Task<Void, Never>?

    public init(id: UUID, name: String, store: ProjectStore, directories: StudioDirectories) {
        self.id = id
        self.name = name
        self.store = store
        engine = EngineBridge(label: "org.advjs.studio.engine.project")
        draftStore = DraftStore(directory: directories.drafts.appending(path: id.uuidString, directoryHint: .isDirectory))
    }

    // MARK: - Lifecycle

    public func open() async {
        guard state == .closed || state == .gone || isFailed else { return }
        state = .loading
        do {
            let access = try await store.resolve(id)
            self.access = access
            root = access.url
            name = access.url.lastPathComponent
            try await store.markOpened(id)
            let watcher = ProjectWatcher(url: access.url) { [weak self] event in
                Task { @MainActor in self?.handle(event) }
            }
            watcher.start()
            self.watcher = watcher
            try await engine.start()
            try await load()
            state = .ready
        }
        catch ProjectLibraryError.notFound {
            state = .gone
        }
        catch {
            state = .failed(error.localizedDescription)
        }
    }

    public func close() async {
        pendingReload?.cancel()
        watcher?.stop()
        watcher = nil
        access?.stopAccessing()
        access = nil
        await engine.shutdown()
        snapshot = nil
        index = nil
        validation = nil
        state = .closed
    }

    public func reload() async {
        do {
            try await load()
            if state != .ready { state = .ready }
        }
        catch {
            state = .failed(error.localizedDescription)
        }
    }

    /// Reload when the folder changed without file coordination (for example
    /// tools that write directly). Called when the App becomes active.
    public func refreshIfChangedOnDisk() async {
        guard state == .ready, let root, let snapshot else { return }
        let outdated = await Task.detached(priority: .utility) {
            snapshot.isOutdated(at: root)
        }.value
        if outdated {
            externalReloads += 1
            await reload()
        }
    }

    // MARK: - Files

    /// Text of `path` as the author should see it: the draft if there is one.
    public func text(at path: String) -> String? {
        draftStore.draft(for: path)?.text ?? snapshot?.files[path]
    }

    public func hasDraft(_ path: String) -> Bool {
        drafts.contains { $0.path == path }
    }

    /// Keep an unsaved edit on this device.
    public func updateDraft(_ text: String, for path: String) {
        if text == snapshot?.files[path], draftStore.draft(for: path)?.baseSHA256 == snapshot?.files[path].map(DraftStore.sha256) {
            draftStore.discard(path)
        }
        else {
            try? draftStore.save(text, for: path, base: snapshot?.files[path])
        }
        refreshDrafts()
    }

    public func discardDraft(_ path: String) {
        draftStore.discard(path)
        refreshDrafts()
    }

    /// Write `text` to `path` atomically and drop its draft.
    public func save(_ text: String, to path: String) async throws {
        let url = try fileURL(path)
        try CoordinatedFiles.write(Data(text.utf8), to: url, filePresenter: watcher)
        draftStore.discard(path)
        try await load()
    }

    public func saveDraft(_ path: String) async throws {
        guard let draft = draftStore.draft(for: path) else { return }
        try await save(draft.text, to: path)
    }

    public func createFile(_ path: String, contents: String = "") async throws {
        let url = try fileURL(path)
        guard !ProjectFolderName.isTaken(url.lastPathComponent, in: url.deletingLastPathComponent()) else {
            throw ProjectLibraryError.nameTaken(url.lastPathComponent)
        }
        try CoordinatedFiles.write(Data(contents.utf8), to: url, filePresenter: watcher)
        try await load()
    }

    public func renameFile(_ path: String, to newPath: String) async throws {
        guard path != newPath else { return }
        let source = try fileURL(path)
        let destination = try fileURL(newPath)
        let sameFolder = source.deletingLastPathComponent() == destination.deletingLastPathComponent()
        guard !ProjectFolderName.isTaken(destination.lastPathComponent, in: destination.deletingLastPathComponent(), except: sameFolder ? source.lastPathComponent : nil) else {
            throw ProjectLibraryError.nameTaken(destination.lastPathComponent)
        }
        try CoordinatedFiles.rename(source, to: destination, filePresenter: watcher)
        if let draft = draftStore.draft(for: path) {
            try? draftStore.save(draft.text, for: newPath, base: snapshot?.files[path])
            draftStore.discard(path)
        }
        try await load()
    }

    /// Copy a file next to itself as "name copy.ext" (numbered if needed) and return the new path.
    @discardableResult
    public func duplicateFile(_ path: String) async throws -> String {
        let source = try fileURL(path)
        let directory = source.deletingLastPathComponent()
        let stem = source.deletingPathExtension().lastPathComponent
        let ext = source.pathExtension
        let candidate = ProjectFolderName.unique(ext.isEmpty ? "\(stem) copy" : "\(stem) copy.\(ext)", in: directory)
        let destination = directory.appending(path: candidate)
        try CoordinatedFiles.copy(source, to: destination, filePresenter: watcher)
        try await load()
        return relativePath(destination) ?? candidate
    }

    public func deleteFile(_ path: String) async throws {
        try CoordinatedFiles.delete(try fileURL(path), filePresenter: watcher)
        draftStore.discard(path)
        try await load()
    }

    public func resolve(_ conflict: FileConflict, with resolution: ConflictResolution) async throws {
        switch resolution {
        case .keepMine:
            try await save(conflict.mine, to: conflict.path)
        case .keepTheirs:
            discardDraft(conflict.path)
            try await load()
        case .keepBoth:
            let url = try fileURL(conflict.path)
            let directory = url.deletingLastPathComponent()
            let stem = url.deletingPathExtension().lastPathComponent
            let ext = url.pathExtension
            let name = ProjectFolderName.unique(ext.isEmpty ? "\(stem) (mine)" : "\(stem) (mine).\(ext)", in: directory)
            try CoordinatedFiles.write(Data(conflict.mine.utf8), to: directory.appending(path: name), filePresenter: watcher)
            draftStore.discard(conflict.path)
            try await load()
        }
    }

    /// Remove broken references named by fixable warnings (shared `project.fixReferences`).
    /// Returns how many issues were fixed.
    @discardableResult
    public func fixReferences(_ issues: [EngineValidation.Issue]) async throws -> Int {
        guard let files = snapshot?.files else { return 0 }
        let result = try await engine.call(
            "project.fixReferences",
            input: EngineFixInput(files: files, issues: issues),
            as: EngineFixResult.self
        )
        for (path, text) in result.writes.sorted(by: { $0.key < $1.key }) {
            try CoordinatedFiles.write(Data(text.utf8), to: try fileURL(path), filePresenter: watcher)
        }
        try await load()
        return result.fixed.count
    }

    /// Set `description` in `adv/settings/game.json` through the shared patch rules.
    public func setGameDescription(_ description: String) async throws {
        let path = "adv/settings/game.json"
        var files = snapshot?.files ?? [:]
        if files[path] == nil {
            files[path] = "{}\n"
        }
        let result = try await engine.call(
            "project.applyPatches",
            input: EnginePatchInput(files: [path: files[path]!], patches: [.jsonSet(path: path, key: "description", value: description)]),
            as: EnginePatchResult.self
        )
        if let text = result.files[path] {
            try CoordinatedFiles.write(Data(text.utf8), to: try fileURL(path), filePresenter: watcher)
        }
        try await load()
    }

    /// The URL of a project-relative path, refusing paths that leave the project.
    public func fileURL(_ path: String) throws -> URL {
        guard let root else { throw ProjectLibraryError.unavailable }
        let components = path.split(separator: "/", omittingEmptySubsequences: false)
        guard !path.isEmpty, !path.hasPrefix("/"), !components.contains(where: { $0.isEmpty || $0 == "." || $0 == ".." }) else {
            throw ProjectLibraryError.invalidName
        }
        return root.appending(path: path)
    }

    // MARK: - Private

    private var isFailed: Bool {
        if case .failed = state { return true }
        return false
    }

    private func relativePath(_ url: URL) -> String? {
        guard let root else { return nil }
        let base = root.standardizedFileURL.path(percentEncoded: false)
        let full = url.standardizedFileURL.path(percentEncoded: false)
        let prefix = base.hasSuffix("/") ? base : base + "/"
        return full.hasPrefix(prefix) ? String(full.dropFirst(prefix.count)) : nil
    }

    private func load() async throws {
        guard let root else { throw ProjectLibraryError.unavailable }
        let presenter = watcher
        let snapshot = try await Task.detached(priority: .userInitiated) {
            try ProjectSnapshot.read(at: root, filePresenter: presenter)
        }.value
        let index = try await engine.call("project.index", input: snapshot.engineInput, as: EngineProjectIndex.self)
        // Validation needs readable settings; a broken game.json shows up as a failed check, not a failed project.
        let validation = try? await engine.call("project.validate", input: snapshot.engineInput, as: EngineValidation.self)
        self.snapshot = snapshot
        self.index = index
        self.validation = validation
        lastReloadedAt = .now
        refreshDrafts()
    }

    private func refreshDrafts() {
        drafts = draftStore.all()
        conflicts = draftStore.conflicts(with: snapshot?.files ?? [:])
    }

    private func handle(_ event: ProjectWatcher.Event) {
        switch event {
        case .changed:
            pendingReload?.cancel()
            pendingReload = Task { [weak self] in
                try? await Task.sleep(for: Self.debounce)
                guard !Task.isCancelled, let self, self.state == .ready else { return }
                self.externalReloads += 1
                await self.reload()
            }
        case .moved(let url):
            root = url
            name = url.lastPathComponent
        case .deleted:
            state = .gone
        }
    }
}
