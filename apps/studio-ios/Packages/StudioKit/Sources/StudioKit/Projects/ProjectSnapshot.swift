import Foundation

/// A project's files as the engine reads them: UTF-8 text by project-relative
/// path, plus every path (text and binary). Built from coordinated reads so
/// files being written by the Files App or iCloud are read whole.
public struct ProjectSnapshot: Sendable, Equatable {
    public let files: [String: String]
    public let paths: [String]
    public let modificationDates: [String: Date]
    /// Text files skipped because they were not valid UTF-8 or too large.
    public let unreadable: [String]

    /// Same list as Web Studio's text extensions.
    public static let textExtensions: Set<String> = [
        "md", "txt", "json", "yaml", "yml", "ts", "js", "vue", "css", "html", "xml", "toml", "ini", "cfg", "conf",
    ]
    /// Folders that are never project content.
    public static let skippedDirectories: Set<String> = ["node_modules", "dist", ".git"]
    public static let maximumTextBytes = 8 * 1_048_576

    public init(files: [String: String], paths: [String], modificationDates: [String: Date] = [:], unreadable: [String] = []) {
        self.files = files
        self.paths = paths
        self.modificationDates = modificationDates
        self.unreadable = unreadable
    }

    public var engineInput: EngineProjectInput {
        EngineProjectInput(files: files, paths: paths)
    }

    public static func isTextPath(_ path: String) -> Bool {
        textExtensions.contains((path as NSString).pathExtension.lowercased())
    }

    /// Read `root`. Hidden files are skipped, except iCloud placeholders
    /// (`.name.icloud`), which are downloaded and read.
    public static func read(at root: URL, filePresenter: NSFilePresenter? = nil, fileManager: FileManager = .default) throws -> ProjectSnapshot {
        var files: [String: String] = [:]
        var paths: [String] = []
        var dates: [String: Date] = [:]
        var unreadable: [String] = []

        for (path, url) in try enumerate(root: root, fileManager: fileManager) {
            paths.append(path)
            let values = try? url.resourceValues(forKeys: [.contentModificationDateKey, .fileSizeKey])
            if let date = values?.contentModificationDate {
                dates[path] = date
            }
            guard isTextPath(path) else { continue }
            if let size = values?.fileSize, size > maximumTextBytes {
                unreadable.append(path)
                continue
            }
            do {
                let data = try CoordinatedFiles.read(url, filePresenter: filePresenter)
                if let text = String(data: data, encoding: .utf8) {
                    files[path] = text
                }
                else {
                    unreadable.append(path)
                }
            }
            catch {
                unreadable.append(path)
            }
        }
        return ProjectSnapshot(files: files, paths: paths.sorted(), modificationDates: dates, unreadable: unreadable.sorted())
    }

    /// Project-relative paths of regular files under `root`, in no particular order.
    static func enumerate(root: URL, fileManager: FileManager) throws -> [(String, URL)] {
        let base = root.standardizedFileURL.resolvingSymlinksInPath()
        let basePath = base.path(percentEncoded: false).hasSuffix("/") ? base.path(percentEncoded: false) : base.path(percentEncoded: false) + "/"
        guard let enumerator = fileManager.enumerator(
            at: base,
            includingPropertiesForKeys: [.isRegularFileKey, .isDirectoryKey, .isSymbolicLinkKey],
            options: [],
            errorHandler: { _, _ in true }
        ) else {
            throw ProjectLibraryError.unavailable
        }
        var result: [(String, URL)] = []
        for case let url as URL in enumerator {
            let name = url.lastPathComponent
            let values = try? url.resourceValues(forKeys: [.isRegularFileKey, .isDirectoryKey, .isSymbolicLinkKey])
            if values?.isDirectory == true {
                if skippedDirectories.contains(name) || name.hasPrefix(".") {
                    enumerator.skipDescendants()
                }
                continue
            }
            // Symbolic links could point outside the project; never follow them.
            if values?.isSymbolicLink == true {
                continue
            }
            var fileURL = url
            var fileName = name
            if name.hasPrefix(".") {
                guard name.hasSuffix(".icloud"), name.count > ".icloud".count + 1 else { continue }
                fileName = String(name.dropFirst().dropLast(".icloud".count))
                fileURL = url.deletingLastPathComponent().appending(path: fileName)
                try? fileManager.startDownloadingUbiquitousItem(at: fileURL)
            }
            else if values?.isRegularFile != true {
                continue
            }
            let fullPath = fileURL.standardizedFileURL.path(percentEncoded: false)
            guard fullPath.hasPrefix(basePath) else { continue }
            result.append((String(fullPath.dropFirst(basePath.count)), fileURL))
        }
        return result
    }

    /// Whether files under `root` were added, removed or modified since this
    /// snapshot, judged by paths and modification dates without reading files.
    public func isOutdated(at root: URL, fileManager: FileManager = .default) -> Bool {
        guard let current = try? Self.enumerate(root: root, fileManager: fileManager) else { return true }
        guard current.count == paths.count else { return true }
        for (path, url) in current {
            let date = try? url.resourceValues(forKeys: [.contentModificationDateKey]).contentModificationDate
            if modificationDates[path] != date {
                return true
            }
        }
        return false
    }

    /// Whether `root` looks like an ADV.JS project.
    public static func isProject(at root: URL, fileManager: FileManager = .default) -> Bool {
        var isDirectory: ObjCBool = false
        if fileManager.fileExists(atPath: root.appending(path: "adv").path(percentEncoded: false), isDirectory: &isDirectory), isDirectory.boolValue {
            return true
        }
        return fileManager.fileExists(atPath: root.appending(path: "adv.config.json").path(percentEncoded: false))
    }
}
