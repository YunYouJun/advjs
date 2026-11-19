import StudioKit
import SwiftUI

struct ChapterEditorView: View {
    enum Mode { case form, source }

    let session: ProjectSession
    @Environment(AppModel.self) private var model
    @Environment(PlaytestCoordinator.self) private var playtest
    @Environment(\.scenePhase) private var scenePhase
    @State private var path: String
    @State private var mode: Mode
    @State private var form: ChapterForm?
    @State private var initialForm: ChapterForm?
    @State private var formSource = ""
    @State private var diskBaseline: String?
    @State private var lastStagedSource: String?
    @State private var formWork: Task<Void, Never>?
    @State private var isWorking = false
    @State private var filename = ""
    @State private var showRename = false
    @State private var formUnavailable = false
    @State private var cursor: SourceLocation?
    @State private var jump: SourceLocation?
    @State private var jumpID = UUID()
    @State private var compilation: EngineCompilation?

    init(session: ProjectSession, path: String, location: SourceLocation? = nil) {
        self.session = session
        _path = State(initialValue: path)
        _mode = State(initialValue: location == nil ? .form : .source)
        let initialPosition = location?.line == nil ? session.sourcePositions[path] : location
        _cursor = State(initialValue: initialPosition)
        _jump = State(initialValue: initialPosition)
    }

    private var conflict: FileConflict? { session.conflicts.first { $0.path == path } }
    private var canSave: Bool { !isWorking && conflict == nil && (session.hasDraft(path) || formIsEdited) }
    private var formIsEdited: Bool { mode == .form && form != initialForm }
    private var currentSource: String { session.text(at: path) ?? "" }
    private var analysisInput: EngineProjectInput? { try? session.sourceInput(.draft) }
    private var issueCount: Int { compilation?.diagnostics.count ?? 0 }
    private var basename: String { (path as NSString).lastPathComponent }

    var body: some View {
        Group {
            switch mode {
            case .form:
                chapterForm
            case .source:
                chapterSource
            }
        }
        .disabled(isWorking)
        .safeAreaInset(edge: .top, spacing: 0) {
            VStack(spacing: 0) {
                // Swift 6.3 crashes when lowering the actor-isolated method reference.
                Picker("Chapter Editor", selection: Binding(get: { mode }, set: { switchMode($0) })) {
                    Text("Form").tag(Mode.form)
                    Text("Source File").tag(Mode.source)
                }
                .pickerStyle(.segmented)
                .padding(.horizontal)
                .padding(.vertical, 6)
                .background(.bar)
                .disabled(isWorking)
                .accessibilityIdentifier("chapter-editor-mode")

                if let conflict {
                    ConflictBanner(conflict: conflict) { resolution in
                        run {
                            try await stageForm()
                            guard let latest = self.conflict else { return }
                            try await session.resolve(latest, with: resolution)
                            if mode == .form { await loadForm() }
                        }
                    }
                }
                else if session.draftWriteFailed {
                    Label("The draft couldn’t be saved on this device.", systemImage: "exclamationmark.triangle")
                        .font(.footnote)
                        .padding(8)
                }
                else if session.hasDraft(path) {
                    Text("Draft")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .padding(.vertical, 3)
                }
            }
        }
        .navigationTitle(basename)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar { chapterToolbar }
        .focusedSceneValue(\.saveFile, canSave ? SaveAction(path: path, perform: save) : nil)
        .focusedSceneValue(\.runPlaytest, RunPlaytestAction {
            if mode == .source, let cursor { requestPlay(.source(cursor)) }
            else { requestPlay(.chapter(path)) }
        })
        .task { if mode == .form { await loadForm() } }
        .task(id: analysisInput) {
            compilation = nil
            guard let input = analysisInput else { return }
            do {
                try await Task.sleep(for: .milliseconds(200))
                let result = try await session.compile(input)
                guard !Task.isCancelled, analysisInput == input else { return }
                compilation = result
            }
            catch is CancellationError {}
            catch { if !Task.isCancelled { compilation = nil } }
        }
        .onChange(of: currentSource) {
            if mode == .form, !isWorking, !formIsEdited, lastStagedSource != currentSource {
                Task { await loadForm() }
            }
        }
        .onChange(of: form) {
            guard formIsEdited else { return }
            formWork?.cancel()
            formWork = Task {
                try? await Task.sleep(for: .milliseconds(200))
                guard !Task.isCancelled else { return }
                do { try await stageForm() }
                catch is CancellationError {}
                catch { model.report(error) }
            }
        }
        .onChange(of: scenePhase) { _, phase in
            if phase != .active { persistDraft() }
        }
        .onDisappear(perform: persistDraft)
        .alert("Rename Chapter", isPresented: $showRename) {
            TextField("Filename", text: $filename)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
            Button("Cancel", role: .cancel) {}
            Button("Rename", action: rename)
        }
    }

    @ViewBuilder private var chapterForm: some View {
        if let form = Binding($form) {
            Form {
                LabeledContent("Filename") {
                    Button(basename) {
                        filename = basename
                        showRename = true
                    }
                    .disabled(conflict != nil)
                    .accessibilityLabel("Rename Chapter")
                    .accessibilityIdentifier("rename-chapter")
                }
                TextField("Chapter Title", text: form.title)
                    .accessibilityIdentifier("chapter-title")
                TextField("Plot Summary", text: form.plotSummary, axis: .vertical)
                    .lineLimit(2...5)
                    .accessibilityIdentifier("chapter-summary")
                Section("Chapter Content") {
                    TextEditor(text: form.body)
                        .font(.body.monospaced())
                        .frame(minHeight: 200)
                        .accessibilityLabel("Chapter Content")
                        .accessibilityIdentifier("chapter-body")
                }
            }
        }
        else if formUnavailable {
            ContentUnavailableView("Can’t Read Chapter Metadata", systemImage: "exclamationmark.triangle",
                                   description: Text("Open the source file to edit this chapter."))
        }
        else {
            ProgressView()
        }
    }

    private var chapterSource: some View {
        let baseline = session.snapshot?.files[path]
        return AdvScriptTextView(
            path: path, text: currentSource, jump: jump, jumpID: jumpID, restoredPosition: cursor,
            characters: Array(Set(session.index?.characters.flatMap { [$0.name, $0.id] } ?? [])).sorted(),
            scenes: Array(Set(session.index?.scenes.flatMap { [$0.name, $0.id].compactMap { $0 } } ?? [])).sorted(),
            onEdit: { text in session.stageDraft(text, for: path, basedOn: baseline) },
            onPosition: { position in
                cursor = position
                session.sourcePositions[path] = position
            },
            onPlaytest: { position in requestPlay(.source(position)) }
        )
        .safeAreaInset(edge: .bottom, spacing: 0) {
            VStack(alignment: .leading, spacing: 0) {
                if let issue = compilation?.diagnostics.first(where: { $0.file == path }), let target = issue.location {
                    Button {
                        jump = target
                        jumpID = UUID()
                        session.sourcePositions[path] = target
                        cursor = target
                    } label: {
                        Label(issue.message, systemImage: "exclamationmark.triangle")
                            .lineLimit(2)
                            .font(.footnote)
                    }
                    .padding(.horizontal)
                    .padding(.top, 4)
                    .accessibilityIdentifier("chapter-inline-diagnostic")
                }
                if let cursor {
                    Text("Line \(cursor.line ?? 1), Column \(cursor.column ?? 1)")
                        .font(.caption.monospacedDigit())
                        .padding(.horizontal)
                        .padding(.vertical, 4)
                        .accessibilityIdentifier("chapter-source-position")
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(.bar)
        }
    }

    @ToolbarContentBuilder private var chapterToolbar: some ToolbarContent {
        ToolbarItem(placement: .secondaryAction) {
            NavigationLink(value: ProjectRoute.analysis) {
                Label("Diagnostics and Program", systemImage: issueCount > 0 ? "exclamationmark.triangle" : "list.bullet.rectangle")
            }
            .accessibilityIdentifier("chapter-analysis")
        }
        ToolbarItem(placement: .primaryAction) {
            Menu {
                Button("Play from Chapter Start") { requestPlay(.chapter(path)) }
                    .accessibilityIdentifier("play-chapter-start")
                if mode == .source, let cursor {
                    Button("Play from Current Line") { requestPlay(.source(cursor)) }
                        .accessibilityIdentifier("play-source-line")
                }
                Button("Play from Project Start") { requestPlay(.project) }
            } label: {
                Label("Playtest", systemImage: "play.fill")
            }
            .disabled(isWorking || playtest.isPreparing)
            .accessibilityIdentifier("play-chapter")
        }
        ToolbarItem(placement: .primaryAction) {
            Button("Save", action: save)
                .disabled(!canSave)
                .accessibilityIdentifier("save-chapter")
        }
        ToolbarItem(placement: .secondaryAction) {
            Button("Discard Changes", systemImage: "arrow.uturn.backward", role: .destructive) {
                formWork?.cancel()
                session.discardDraft(path)
                if mode == .form { Task { await loadForm() } }
            }
            .disabled(!canSave && conflict == nil)
        }
    }

    private func switchMode(_ target: Mode) {
        guard target != mode else { return }
        run {
            try await stageForm()
            if target == .form { await loadForm() }
            if target == .source { jump = cursor }
            mode = target
        }
    }

    private func loadForm() async {
        let source = currentSource
        let disk = session.snapshot?.files[path]
        do {
            let parsed = try await session.chapterForm(path: path, source: source)
            guard !Task.isCancelled, currentSource == source else { return }
            formSource = source
            diskBaseline = disk
            lastStagedSource = source
            initialForm = parsed
            form = parsed
            formUnavailable = false
        }
        catch {
            guard !Task.isCancelled else { return }
            form = nil
            initialForm = nil
            formUnavailable = true
        }
    }

    private func stageForm() async throws {
        guard mode == .form, let submitted = form, let initialForm,
              lastStagedSource != nil else { return }
        let source = try await session.chapterSource(path: path, form: submitted, source: formSource, initialBody: initialForm.body)
        try Task.checkCancellation()
        guard form == submitted else { return }
        guard currentSource == lastStagedSource || !session.hasDraft(path) else {
            throw CoordinatedFiles.WriteError.sourceChanged
        }
        if source == lastStagedSource { return }
        session.stageDraft(source, for: path, basedOn: diskBaseline)
        lastStagedSource = source
    }

    private func persistDraft() {
        formWork?.cancel()
        Task {
            do {
                try await stageForm()
                try session.flushDrafts()
            }
            catch { model.report(error) }
        }
    }

    private func requestPlay(_ start: PlaytestStart) {
        run {
            try await stageForm()
            playtest.offer(session, start: start)
        }
    }

    private func save() {
        run {
            try await stageForm()
            try await session.saveDraft(path)
            if mode == .form { await loadForm() }
        }
    }

    private func rename() {
        let requestedName = filename
        run {
            try await stageForm()
            let nextPath = try await session.chapterPath(filename: requestedName, currentPath: path)
            try await session.renameFile(path, to: nextPath)
            path = nextPath
            await loadForm()
        }
    }

    private func run(_ action: @escaping () async throws -> Void) {
        guard !isWorking else { return }
        formWork?.cancel()
        isWorking = true
        Task {
            defer { isWorking = false }
            do { try await action() }
            catch { model.report(error) }
        }
    }
}
