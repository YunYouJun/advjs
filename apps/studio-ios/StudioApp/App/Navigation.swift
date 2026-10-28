import Foundation
import SwiftUI

/// Top-level entries. World and Play join as their features ship (P3, P4).
enum RootTab: String, Hashable {
    case workspace
    case me
}

/// Parts of an open project.
enum ProjectSection: String, Hashable, CaseIterable, Identifiable {
    case overview
    case files
    case health

    var id: String { rawValue }

    var title: LocalizedStringKey {
        switch self {
        case .overview: "Overview"
        case .files: "Files"
        case .health: "Project Health"
        }
    }

    var systemImage: String {
        switch self {
        case .overview: "square.grid.2x2"
        case .files: "folder"
        case .health: "stethoscope"
        }
    }
}

/// Sidebar selection in the iPad layout.
enum SidebarItem: Hashable {
    case project(UUID)
    case recentlyDeleted
    case settings
}

/// Navigation destinations inside a project.
enum ProjectRoute: Hashable {
    case section(ProjectSection)
    case folder(String)
    case file(String)
}
