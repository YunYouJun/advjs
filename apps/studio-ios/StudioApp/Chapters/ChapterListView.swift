import StudioKit
import SwiftUI

struct ChapterListView: View {
    let session: ProjectSession
    @Environment(AppModel.self) private var model
    @State private var search = ""
    @State private var filename = ""
    @State private var creating = false
    @State private var deleting: String?
    @State private var isWorking = false

    private var paths: [String] {
        let chapters = session.index?.chapters.map(\.file) ?? []
        let recovered = session.drafts.map(\.path).filter { $0.hasSuffix(".adv.md") && !chapters.contains($0) }
        return (chapters + recovered).filter { path in
            let name = (path as NSString).lastPathComponent
            return search.isEmpty || name.localizedStandardContains(search)
                || title(path)?.localizedStandardContains(search) == true
        }
    }

    private func title(_ path: String) -> String? {
        session.index?.chapters.first { $0.file == path }?.title
    }

    var body: some View {
        List(paths, id: \.self) { path in
            NavigationLink(value: path.hasSuffix(".adv.md") ? ProjectRoute.chapter(path) : ProjectRoute.file(path)) {
                FileRow(session: session, path: path, title: title(path))
            }
            .accessibilityIdentifier("chapter-\(path)")
            .swipeActions(allowsFullSwipe: false) {
                if path.hasSuffix(".adv.md") {
                    Button("Delete", systemImage: "trash", role: .destructive) { deleting = path }
                }
            }
        }
        .overlay {
            if paths.isEmpty {
                if search.isEmpty {
                    ContentUnavailableView("No Chapters", systemImage: "book.pages")
                }
                else {
                    ContentUnavailableView.search(text: search)
                }
            }
        }
        .navigationTitle("Chapters")
        .searchable(text: $search, prompt: "Search Chapters")
        .refreshable { await session.reload() }
        .toolbar {
            if session.index?.format == "adv-md" {
                ToolbarItem(placement: .primaryAction) {
                    Button("New Chapter", systemImage: "plus") {
                        filename = ""
                        creating = true
                    }
                    .accessibilityIdentifier("new-chapter")
                }
            }
        }
        .disabled(isWorking)
        .alert("New Chapter", isPresented: $creating) {
            TextField("Filename", text: $filename)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
            Button("Cancel", role: .cancel) {}
            Button("Create", action: create)
        }
        .confirmationDialog("Delete Chapter?", isPresented: Binding(
            get: { deleting != nil }, set: { if !$0 { deleting = nil } }
        ), titleVisibility: .visible, presenting: deleting) { path in
            Button("Delete", role: .destructive) {
                run {
                    if session.snapshot?.paths.contains(path) == true {
                        try await session.deleteFile(path)
                    }
                    else {
                        session.discardDraft(path)
                    }
                }
            }
        } message: { path in
            Text((path as NSString).lastPathComponent)
        }
    }

    private func create() {
        let name = filename
        run {
            let path = try await session.chapterPath(filename: name)
            let title = try await session.chapterForm(path: path, source: "").title
            let contents = try await session.chapterSource(path: path, form: ChapterForm(title: title), source: "", initialBody: "")
            try await session.createFile(path, contents: contents)
        }
    }

    private func run(_ action: @escaping () async throws -> Void) {
        isWorking = true
        Task {
            defer { isWorking = false }
            do { try await action() }
            catch { model.report(error) }
        }
    }
}
