import Foundation
import Observation

/// The project list as the interface sees it. File work happens in
/// ``ProjectStore`` off the main thread; this model republishes its results.
@MainActor
@Observable
public final class ProjectLibrary {
    public private(set) var projects: [ProjectSummary] = []
    public private(set) var recentlyDeleted: [DeletedProject] = []
    public private(set) var templates: EngineTemplateList?
    public private(set) var isLoading = false
    public private(set) var hasLoaded = false

    public let store: ProjectStore
    public let engine: EngineBridge
    public let directories: StudioDirectories

    public init(directories: StudioDirectories, engine: EngineBridge = EngineBridge(label: "org.advjs.studio.engine.library")) {
        self.directories = directories
        self.engine = engine
        store = ProjectStore(directories: directories, engine: engine)
    }

    public func refresh() async throws {
        isLoading = true
        defer { isLoading = false }
        projects = try await store.refresh()
        recentlyDeleted = try await store.recentlyDeleted()
        hasLoaded = true
    }

    public func loadTemplates() async throws {
        guard templates == nil else { return }
        try await engine.start()
        templates = try await engine.call("project.templates", input: EmptyEngineInput(), as: EngineTemplateList.self)
    }

    @discardableResult
    public func create(name: String, templateID: String) async throws -> ProjectRecord {
        let record = try await store.create(name: name, templateID: templateID)
        try await refresh()
        return record
    }

    @discardableResult
    public func rename(_ id: UUID, to name: String) async throws -> ProjectRecord {
        let record = try await store.rename(id, to: name)
        try await refresh()
        return record
    }

    @discardableResult
    public func delete(_ id: UUID) async throws -> DeletedProject {
        let deleted = try await store.delete(id)
        try await refresh()
        return deleted
    }

    @discardableResult
    public func restore(_ id: UUID) async throws -> ProjectRecord {
        let record = try await store.restore(id)
        try await refresh()
        return record
    }

    public func deletePermanently(_ id: UUID) async throws {
        try await store.deletePermanently(id)
        try await refresh()
    }

    @discardableResult
    public func importPackage(at url: URL, name: String? = nil) async throws -> ProjectRecord {
        let record = try await store.importPackage(at: url, name: name)
        try await refresh()
        return record
    }

    @discardableResult
    public func importFolder(at url: URL) async throws -> ProjectRecord {
        let record = try await store.importFolder(at: url)
        try await refresh()
        return record
    }

    @discardableResult
    public func openInPlace(at url: URL) async throws -> ProjectRecord {
        let record = try await store.openInPlace(at: url)
        try await refresh()
        return record
    }

    public func exportPackage(_ id: UUID) async throws -> URL {
        try await store.exportPackage(id)
    }

    public func summary(_ id: UUID) -> ProjectSummary? {
        projects.first { $0.id == id }
    }
}
