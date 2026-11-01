import StudioKit
import SwiftUI

/// Deleted projects, kept for 30 days.
struct RecentlyDeletedView: View {
    @Environment(AppModel.self) private var model
    @State private var confirming: DeletedProject?

    var body: some View {
        List {
            ForEach(model.library.recentlyDeleted) { deleted in
                VStack(alignment: .leading, spacing: 2) {
                    Text(deleted.name)
                    Text(daysLeftText(deleted))
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                .swipeActions(edge: .leading) {
                    Button {
                        restore(deleted)
                    } label: {
                        Label("Recover", systemImage: "arrow.uturn.backward")
                    }
                    .tint(.green)
                }
                .swipeActions(edge: .trailing) {
                    Button(role: .destructive) {
                        confirming = deleted
                    } label: {
                        Label("Delete Permanently", systemImage: "trash")
                    }
                }
                .contextMenu {
                    Button {
                        restore(deleted)
                    } label: {
                        Label("Recover", systemImage: "arrow.uturn.backward")
                    }
                    Button(role: .destructive) {
                        confirming = deleted
                    } label: {
                        Label("Delete Permanently", systemImage: "trash")
                    }
                }
            }
        }
        .overlay {
            if model.library.recentlyDeleted.isEmpty {
                ContentUnavailableView("No Recently Deleted Projects", systemImage: "trash", description: Text("Deleted projects stay here for 30 days."))
            }
        }
        .navigationTitle("Recently Deleted")
        .confirmationDialog(
            "Delete “\(confirming?.name ?? "")” permanently?",
            isPresented: Binding(get: { confirming != nil }, set: { if !$0 { confirming = nil } }),
            titleVisibility: .visible
        ) {
            Button("Delete Permanently", role: .destructive) {
                if let deleted = confirming {
                    Task {
                        do { try await model.library.deletePermanently(deleted.id) }
                        catch { model.report(error) }
                    }
                }
            }
        } message: {
            Text("This can’t be undone.")
        }
    }

    private func daysLeftText(_ deleted: DeletedProject) -> String {
        let remaining = deleted.deletedAt.addingTimeInterval(ProjectStore.retention).timeIntervalSinceNow
        let days = max(0, Int((remaining / 86_400).rounded(.up)))
        return String(localized: "\(days) days left")
    }

    private func restore(_ deleted: DeletedProject) {
        Task {
            do { try await model.library.restore(deleted.id) }
            catch { model.report(error) }
        }
    }
}
