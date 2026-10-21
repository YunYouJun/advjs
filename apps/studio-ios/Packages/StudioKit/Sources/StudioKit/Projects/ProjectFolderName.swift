import Foundation

/// Human-readable folder names for projects in the Files App.
///
/// Folder names are local storage, not project format: Web Studio's slug rule
/// still applies to cloud paths. Names keep CJK text and spaces so authors
/// recognize their projects in Files.
public enum ProjectFolderName {
    public static let maximumLength = 80

    /// A safe folder name for `name`, or `fallback` when nothing usable remains.
    public static func sanitize(_ name: String, fallback: String = "Untitled Project") -> String {
        var scalars = String.UnicodeScalarView()
        for scalar in name.unicodeScalars {
            if scalar.properties.generalCategory == .control || "/\\:".unicodeScalars.contains(scalar) {
                scalars.append(" ")
            }
            else {
                scalars.append(scalar)
            }
        }
        var result = String(scalars)
            .split(whereSeparator: \.isWhitespace)
            .joined(separator: " ")
        // Leading dots hide folders; trailing dots and spaces are trimmed by some file systems.
        while result.hasPrefix(".") { result.removeFirst() }
        while result.hasSuffix(".") || result.hasSuffix(" ") { result.removeLast() }
        if result.count > maximumLength {
            result = String(result.prefix(maximumLength)).trimmingCharacters(in: .whitespaces)
        }
        return result.isEmpty ? fallback : result
    }

    /// Whether an item in `directory` already has `name`, ignoring case. The check
    /// lists the folder rather than asking the volume, because only some volumes
    /// ignore case and projects move between them (Files, iCloud, other computers).
    /// `except` is the item being renamed, so changing only its letter case is allowed.
    public static func isTaken(_ name: String, in directory: URL, except: String? = nil, fileManager: FileManager = .default) -> Bool {
        existingNames(in: directory, fileManager: fileManager)
            .subtracting([except?.lowercased()].compactMap(\.self))
            .contains(name.lowercased())
    }

    /// `base`, or `base 2`, `base 3`… so that no item in `directory` has that name, ignoring case.
    public static func unique(_ base: String, in directory: URL, fileManager: FileManager = .default) -> String {
        let existing = existingNames(in: directory, fileManager: fileManager)
        if !existing.contains(base.lowercased()) {
            return base
        }
        var index = 2
        while existing.contains("\(base) \(index)".lowercased()) {
            index += 1
        }
        return "\(base) \(index)"
    }

    private static func existingNames(in directory: URL, fileManager: FileManager) -> Set<String> {
        Set(((try? fileManager.contentsOfDirectory(atPath: directory.path(percentEncoded: false))) ?? []).map { $0.lowercased() })
    }
}
