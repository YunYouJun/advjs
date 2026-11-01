import Foundation

/// Observes a project folder for changes made by other processes (the Files
/// App, iCloud, other editors) through file coordination.
///
/// Pass this presenter to the App's own coordinated writes so they are not
/// reported back as external changes.
public final class ProjectWatcher: NSObject, NSFilePresenter, @unchecked Sendable {
    public enum Event: Sendable {
        /// Files changed, appeared, moved or disappeared inside the project.
        case changed([URL])
        /// The project folder itself moved, for example renamed in Files.
        case moved(URL)
        /// The project folder was deleted.
        case deleted
    }

    public let presentedItemURL: URL?
    public let presentedItemOperationQueue: OperationQueue
    private let handler: @Sendable (Event) -> Void

    public init(url: URL, handler: @escaping @Sendable (Event) -> Void) {
        presentedItemURL = url
        let queue = OperationQueue()
        queue.name = "org.advjs.studio.project-watcher"
        queue.maxConcurrentOperationCount = 1
        presentedItemOperationQueue = queue
        self.handler = handler
        super.init()
    }

    public func start() {
        NSFileCoordinator.addFilePresenter(self)
    }

    public func stop() {
        NSFileCoordinator.removeFilePresenter(self)
    }

    public func presentedItemDidChange() {
        handler(.changed([]))
    }

    public func presentedSubitemDidChange(at url: URL) {
        handler(.changed([url]))
    }

    public func presentedSubitemDidAppear(at url: URL) {
        handler(.changed([url]))
    }

    public func presentedSubitem(at oldURL: URL, didMoveTo newURL: URL) {
        handler(.changed([oldURL, newURL]))
    }

    public func accommodatePresentedSubitemDeletion(at url: URL, completionHandler: @escaping @Sendable (Error?) -> Void) {
        handler(.changed([url]))
        completionHandler(nil)
    }

    public func presentedItemDidMove(to newURL: URL) {
        handler(.moved(newURL))
    }

    public func accommodatePresentedItemDeletion(completionHandler: @escaping @Sendable (Error?) -> Void) {
        handler(.deleted)
        completionHandler(nil)
    }
}
