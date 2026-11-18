import Darwin
import Foundation
import OSLog
import UniformTypeIdentifiers
import WebKit

@MainActor
final class PlayerSchemeHandler: NSObject, WKURLSchemeHandler {
    nonisolated static let scheme = "advjs-player"
    nonisolated static let host = "project"
    nonisolated static let playerPrefix = "__player"
    nonisolated static let baseURL = URL(string: "advjs-player://project/")!
    nonisolated static let entryURL = URL(string: "advjs-player://project/__player/index.html")!

    private let playerRoot: URL
    private let projectRoot: URL
    private let projectPaths: Set<String>
    private let scopedURL: URL?
    private var running: [ObjectIdentifier: Task<Void, Never>] = [:]
    private let report: (String, String) -> Void

    init(playerRoot: URL, projectRoot: URL, projectPaths: [String], report: @escaping (String, String) -> Void) {
        self.playerRoot = playerRoot
        scopedURL = projectRoot.startAccessingSecurityScopedResource() ? projectRoot : nil
        self.projectRoot = projectRoot.resolvingSymlinksInPath()
        self.projectPaths = Set(projectPaths)
        self.report = report
    }

    deinit {
        scopedURL?.stopAccessingSecurityScopedResource()
    }

    func webView(_ webView: WKWebView, start task: any WKURLSchemeTask) {
        guard let url = task.request.url, task.request.httpMethod == "GET" || task.request.httpMethod == "HEAD",
              let segments = Self.segments(of: url) else {
            task.didFailWithError(URLError(.badURL))
            return
        }
        let bundled = segments.first == Self.playerPrefix
        if url == Self.entryURL {
            Logger(subsystem: "org.advjs.studio", category: "OfflinePlayer").info("Serving bundled player document")
        }
        let path = bundled ? Array(segments.dropFirst()) : segments
        let name = path.joined(separator: "/")
        let ext = (name as NSString).pathExtension.lowercased()
        guard bundled || (projectPaths.contains(name) && Self.mediaMIME[ext] != nil) else {
            if Self.mediaMIME[ext] != nil { report("PLAYER_RESOURCE", name) }
            respond(to: task, url: url, response: .init(status: 404))
            return
        }
        let root = bundled ? playerRoot : projectRoot
        let range = task.request.value(forHTTPHeaderField: "Range")
        let head = task.request.httpMethod == "HEAD"
        let id = ObjectIdentifier(task)
        let read = Task.detached(priority: .userInitiated) {
            Self.read(root: root, path: path, range: range, head: head)
        }
        running[id] = Task { [weak self] in
            let response = await read.value
            guard let self, !Task.isCancelled, running.removeValue(forKey: id) != nil else { return }
            if response.status >= 400 && response.status != 416 {
                report("PLAYER_RESOURCE", name)
            }
            respond(to: task, url: url, response: response)
        }
    }

    func webView(_ webView: WKWebView, stop task: any WKURLSchemeTask) {
        running.removeValue(forKey: ObjectIdentifier(task))?.cancel()
    }

    func close() {
        running.values.forEach { $0.cancel() }
        running.removeAll()
    }

    private func respond(to task: any WKURLSchemeTask, url: URL, response: Response) {
        guard let headers = HTTPURLResponse(url: url, statusCode: response.status, httpVersion: "HTTP/1.1", headerFields: response.headers) else {
            task.didFailWithError(URLError(.badServerResponse))
            return
        }
        task.didReceive(headers)
        if !response.data.isEmpty { task.didReceive(response.data) }
        task.didFinish()
    }

    nonisolated static func segments(of url: URL) -> [String]? {
        guard let parts = URLComponents(url: url, resolvingAgainstBaseURL: false),
              parts.scheme == scheme, parts.host == host, parts.user == nil, parts.password == nil, parts.port == nil,
              parts.percentEncodedPath.hasPrefix("/") else { return nil }
        let raw = parts.percentEncodedPath.dropFirst().split(separator: "/", omittingEmptySubsequences: false)
        let decoded = raw.compactMap { $0.removingPercentEncoding }
        guard !decoded.isEmpty, decoded.count == raw.count,
              decoded.allSatisfy({ !$0.isEmpty && !$0.hasPrefix(".") && !$0.contains("/") && !$0.contains("\\") && !$0.contains("\0") }) else { return nil }
        return decoded
    }

    private nonisolated static let bundleMIME = ["js": "text/javascript", "html": "text/html", "css": "text/css"]

    private nonisolated static let mediaMIME: [String: String] = [
        "png": "image/png", "jpg": "image/jpeg", "jpeg": "image/jpeg", "gif": "image/gif",
        "webp": "image/webp", "svg": "image/svg+xml", "avif": "image/avif", "heic": "image/heic",
        "mp3": "audio/mpeg", "m4a": "audio/mp4", "aac": "audio/aac", "wav": "audio/wav",
        "ogg": "audio/ogg", "opus": "audio/ogg", "flac": "audio/flac",
        "mp4": "video/mp4", "webm": "video/webm", "mov": "video/quicktime",
    ]

    nonisolated struct Response: Sendable {
        let status: Int
        var data = Data()
        var headers: [String: String] = [:]
    }

    /// Open each path segment relative to its parent descriptor. No symlinks are followed.
    nonisolated static func read(root: URL, path: [String], range header: String?, head: Bool) -> Response {
        guard let name = path.last else { return Response(status: 404) }
        var fd = open(root.path(percentEncoded: false), O_RDONLY | O_DIRECTORY | O_NOFOLLOW | O_CLOEXEC)
        guard fd >= 0 else { return Response(status: 404) }
        for (index, segment) in path.enumerated() {
            let flags = O_RDONLY | O_NOFOLLOW | O_CLOEXEC | O_NONBLOCK
            let child = openat(fd, segment, index == path.count - 1 ? flags : flags | O_DIRECTORY)
            Darwin.close(fd)
            guard child >= 0 else { return Response(status: 404) }
            fd = child
        }
        var info = stat()
        let handle = FileHandle(fileDescriptor: fd, closeOnDealloc: true)
        defer { try? handle.close() }
        guard fstat(fd, &info) == 0, info.st_mode & S_IFMT == S_IFREG, let size = Int(exactly: info.st_size), size >= 0 else {
            return Response(status: 404)
        }
        let ext = (name as NSString).pathExtension.lowercased()
        let mime = mediaMIME[ext] ?? bundleMIME[ext] ?? UTType(filenameExtension: ext)?.preferredMIMEType ?? "application/octet-stream"
        var headers = [
            "Content-Type": mime, "Accept-Ranges": "bytes", "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff", "Access-Control-Allow-Origin": "*",
        ]
        var range = 0..<size
        if let header {
            guard let requested = parseRange(header, size: size) else {
                headers["Content-Range"] = "bytes */\(size)"
                return Response(status: 416, headers: headers)
            }
            range = requested
            headers["Content-Range"] = "bytes \(range.lowerBound)-\(range.upperBound - 1)/\(size)"
        }
        headers["Content-Length"] = "\(range.count)"
        guard head || range.count <= 64 * 1_048_576 else { return Response(status: 413) }
        do {
            try handle.seek(toOffset: UInt64(range.lowerBound))
            let payload = head || range.isEmpty ? Data() : try handle.read(upToCount: range.count) ?? Data()
            guard head || payload.count == range.count else { return Response(status: 500) }
            return Response(status: header == nil ? 200 : 206, data: payload, headers: headers)
        }
        catch { return Response(status: 500) }
    }

    nonisolated static func parseRange(_ header: String, size: Int) -> Range<Int>? {
        guard header.hasPrefix("bytes="), size > 0 else { return nil }
        let parts = header.dropFirst(6).split(separator: "-", omittingEmptySubsequences: false)
        guard parts.count == 2 else { return nil }
        if parts[0].isEmpty, let suffix = Int(parts[1]), suffix > 0 {
            return max(0, size - suffix)..<size
        }
        guard let start = Int(parts[0]), start >= 0, start < size else { return nil }
        if parts[1].isEmpty { return start..<size }
        guard let end = Int(parts[1]), end >= start else { return nil }
        return start..<(min(end, size - 1) + 1)
    }
}
