// SPIKE (P0 feasibility): serves the offline player and one project read-only.
//
//   advjs-player://project/__player/…  → app bundle (out/player)
//   advjs-player://project/…           → current project directory
//
// No local HTTP server. Paths are confined to their roots after symlink
// resolution, hidden segments are refused, and byte ranges are honoured so
// WebKit's media stack can stream BGM from a custom scheme.

import Foundation
import UniformTypeIdentifiers
import WebKit

@MainActor
final class PlayerSchemeHandler: NSObject, WKURLSchemeHandler {
    nonisolated static let scheme = "advjs-player"
    nonisolated static let host = "project"
    nonisolated static let playerPrefix = "__player"
    nonisolated static var baseURL: URL { URL(string: "\(scheme)://\(host)/")! }
    nonisolated static var entryURL: URL { URL(string: "\(scheme)://\(host)/\(playerPrefix)/index.html")! }

    private let playerRoot: URL
    private let projectRoot: URL
    private var active: [ObjectIdentifier: any WKURLSchemeTask] = [:]
    private(set) var servedLog: [String] = []
    private(set) var refusedLog: [String] = []

    init(playerRoot: URL, projectRoot: URL) {
        self.playerRoot = playerRoot.resolvingSymlinksInPath().standardizedFileURL
        self.projectRoot = projectRoot.resolvingSymlinksInPath().standardizedFileURL
    }

    func webView(_ webView: WKWebView, start urlSchemeTask: any WKURLSchemeTask) {
        let request = urlSchemeTask.request
        guard let url = request.url, url.host() == Self.host else {
            respond(urlSchemeTask, payload: .failure(status: 400), url: request.url)
            return
        }
        let segments = url.path(percentEncoded: false).split(separator: "/").map(String.init)
        let (root, relative): (URL, [String]) = segments.first == Self.playerPrefix
            ? (playerRoot, Array(segments.dropFirst()))
            : (projectRoot, segments)
        guard let file = Self.confinedFile(root: root, segments: relative) else {
            refusedLog.append(url.path(percentEncoded: true))
            respond(urlSchemeTask, payload: .failure(status: 404), url: url)
            return
        }
        let id = ObjectIdentifier(urlSchemeTask)
        active[id] = urlSchemeTask
        let rangeHeader = request.value(forHTTPHeaderField: "Range")
        Task.detached(priority: .userInitiated) {
            let payload = Self.read(file: file, rangeHeader: rangeHeader)
            await self.finish(id: id, url: url, payload: payload)
        }
    }

    func webView(_ webView: WKWebView, stop urlSchemeTask: any WKURLSchemeTask) {
        active[ObjectIdentifier(urlSchemeTask)] = nil
    }

    private func finish(id: ObjectIdentifier, url: URL, payload: Payload) {
        guard let task = active.removeValue(forKey: id) else { return }
        if case .file(let status, _, let range, _, _) = payload {
            servedLog.append("\(status) \(url.path())\(status == 206 ? " [\(range.lowerBound)-\(range.upperBound - 1)]" : "")")
        }
        respond(task, payload: payload, url: url)
    }

    private func respond(_ task: any WKURLSchemeTask, payload: Payload, url: URL?) {
        guard let url else { return }
        switch payload {
        case .failure(let status):
            task.didReceive(HTTPURLResponse(url: url, statusCode: status, httpVersion: "HTTP/1.1", headerFields: ["Content-Length": "0"])!)
            task.didReceive(Data())
            task.didFinish()
        case .file(let status, let data, let range, let size, let mime):
            var headers = [
                "Content-Type": mime,
                "Content-Length": "\(data.count)",
                "Accept-Ranges": "bytes",
                "Cache-Control": "no-store",
                "X-Content-Type-Options": "nosniff",
            ]
            if status == 206 {
                headers["Content-Range"] = "bytes \(range.lowerBound)-\(range.upperBound - 1)/\(size)"
            }
            task.didReceive(HTTPURLResponse(url: url, statusCode: status, httpVersion: "HTTP/1.1", headerFields: headers)!)
            task.didReceive(data)
            task.didFinish()
        }
    }

    enum Payload: Sendable {
        case failure(status: Int)
        case file(status: Int, data: Data, range: Range<Int>, size: Int, mime: String)
    }

    /// Resolves a request path inside `root`, refusing traversal, hidden segments and symlink escapes.
    nonisolated static func confinedFile(root: URL, segments: [String]) -> URL? {
        guard !segments.isEmpty,
              segments.allSatisfy({ !$0.isEmpty && $0 != "." && $0 != ".." && !$0.hasPrefix(".") && !$0.contains("\0") }) else {
            return nil
        }
        let candidate = segments.reduce(root) { $0.appendingPathComponent($1, isDirectory: false) }
            .resolvingSymlinksInPath().standardizedFileURL
        guard candidate.path.hasPrefix(root.path + "/") else { return nil }
        var isDirectory: ObjCBool = false
        guard FileManager.default.fileExists(atPath: candidate.path, isDirectory: &isDirectory), !isDirectory.boolValue else {
            return nil
        }
        return candidate
    }

    nonisolated static func read(file: URL, rangeHeader: String?) -> Payload {
        guard let handle = try? FileHandle(forReadingFrom: file),
              let size = try? FileManager.default.attributesOfItem(atPath: file.path)[.size] as? Int else {
            return .failure(status: 500)
        }
        defer { try? handle.close() }
        let mime = UTType(filenameExtension: file.pathExtension)?.preferredMIMEType ?? "application/octet-stream"
        var status = 200
        var range = 0..<size
        if let rangeHeader, let parsed = parseRange(rangeHeader, size: size) {
            status = 206
            range = parsed
        }
        try? handle.seek(toOffset: UInt64(range.lowerBound))
        let data = (try? handle.read(upToCount: range.count)) ?? Data()
        return .file(status: status, data: data, range: range, size: size, mime: mime)
    }

    nonisolated static func parseRange(_ header: String, size: Int) -> Range<Int>? {
        guard header.hasPrefix("bytes="), size > 0 else { return nil }
        let spec = header.dropFirst("bytes=".count).split(separator: ",").first.map(String.init) ?? ""
        let parts = spec.split(separator: "-", omittingEmptySubsequences: false).map(String.init)
        guard parts.count == 2 else { return nil }
        if parts[0].isEmpty, let suffix = Int(parts[1]), suffix > 0 {
            return max(0, size - suffix)..<size
        }
        guard let start = Int(parts[0]), start < size else { return nil }
        let end = parts[1].isEmpty ? size - 1 : min(Int(parts[1]) ?? size - 1, size - 1)
        return end >= start ? start..<(end + 1) : nil
    }
}
