import Foundation

public struct WorldRelationship: Equatable, Sendable {
    public let source: String
    public let target: String
    public let label: String
}

/// Links point at exact source paths so legacy filenames and display-name
/// edits can still open the correct document.
public enum WorldRelationships {
    public static func characters(_ entries: [ContentEntry]) -> [WorldRelationship] {
        let byID = Dictionary(entries.compactMap { entry in entry.contentID.map { ($0, entry.path) } }, uniquingKeysWith: { first, _ in first })
        return entries.flatMap { entry in
            let links = entry.data?["relationships"]?.array ?? []
            return links.compactMap { link -> WorldRelationship? in
                guard let targetID = link.object?["targetId"]?.string, let target = byID[targetID], target != entry.path else { return nil }
                return WorldRelationship(source: entry.path, target: target, label: link.object?["type"]?.string ?? "")
            }
        }
    }

    public static func locations(_ entries: [ContentEntry], characters: [ContentEntry]) -> [WorldRelationship] {
        let names = Dictionary(characters.compactMap { entry in entry.contentID.map { ($0, entry.name) } }, uniquingKeysWith: { first, _ in first })
        let visits = entries.map { Set($0.data?["linkedCharacters"]?.array?.compactMap(\.string) ?? []) }
        return entries.indices.flatMap { source in
            entries.indices.dropFirst(source + 1).compactMap { target -> WorldRelationship? in
                let shared = visits[source].intersection(visits[target]).compactMap { names[$0] }.sorted()
                guard !shared.isEmpty else { return nil }
                return WorldRelationship(source: entries[source].path, target: entries[target].path, label: shared.joined(separator: ", "))
            }
        }
    }
}
