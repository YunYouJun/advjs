import StudioKit
import SwiftUI
import UIKit

/// UIKit provides TextKit 2, undo, VoiceOver, Find and Replace, and hardware keyboard editing.
struct AdvScriptTextView: UIViewRepresentable {
    let path: String
    let text: String
    let jump: SourceLocation?
    let jumpID: UUID
    let restoredPosition: SourceLocation?
    let characters: [String]
    let scenes: [String]
    let onEdit: (String) -> Void
    let onPosition: (SourceLocation) -> Void
    let onPlaytest: (SourceLocation) -> Void

    func makeCoordinator() -> Coordinator { Coordinator(self) }

    func makeUIView(context: Context) -> ScriptEditor {
        let editor = ScriptEditor(usingTextLayoutManager: true)
        editor.text = text
        let descriptor = UIFontDescriptor.preferredFontDescriptor(withTextStyle: .body)
        editor.font = UIFont(descriptor: descriptor.withDesign(.monospaced) ?? descriptor, size: 0)
        editor.adjustsFontForContentSizeCategory = true
        editor.autocorrectionType = .no
        editor.autocapitalizationType = .none
        editor.smartDashesType = .no
        editor.smartQuotesType = .no
        editor.smartInsertDeleteType = .no
        editor.keyboardDismissMode = .interactive
        editor.isFindInteractionEnabled = true
        editor.accessibilityLabel = String(localized: "Source File")
        editor.accessibilityIdentifier = "chapter-source"
        editor.textLayoutManager?.renderingAttributesValidator = { layout, fragment in
            guard let paragraph = fragment.textElement as? NSTextParagraph,
                  let range = paragraph.elementRange,
                  let color = AdvScriptHighlight.color(for: paragraph.attributedString.string) else { return }
            layout.setRenderingAttributes([.foregroundColor: color], for: range)
        }
        context.coordinator.installToolbar(on: editor)
        // UIKit can report a selection change when assigning the initial text.
        editor.delegate = context.coordinator
        return editor
    }

    func updateUIView(_ editor: ScriptEditor, context: Context) {
        editor.runPlaytest = { [weak editor] in
            guard let editor else { return }
            onPlaytest(SourceLocation(path: path, offset: editor.selectedRange.location, in: editor.text as NSString))
        }
        let coordinator = context.coordinator
        coordinator.parent = self
        coordinator.isUpdating = true
        defer { coordinator.isUpdating = false }
        if editor.text != text {
            let selection = editor.selectedRange
            editor.text = text
            editor.selectedRange = NSRange(location: min(selection.location, (text as NSString).length), length: 0)
        }
        if coordinator.characters != characters || coordinator.scenes != scenes {
            coordinator.installToolbar(on: editor)
        }
        if jumpID != coordinator.appliedJump {
            let target = coordinator.appliedJump == nil ? restoredPosition ?? jump : jump
            coordinator.appliedJump = jumpID
            if let target {
                let range = NSRange(location: target.insertionOffset(in: text as NSString), length: 0)
                editor.selectedRange = range
                DispatchQueue.main.async { [weak editor] in editor?.scrollRangeToVisible(range) }
            }
        }
    }

    final class ScriptEditor: UITextView {
        var runPlaytest: (() -> Void)?

        override var keyCommands: [UIKeyCommand]? {
            let run = UIKeyCommand(input: "r", modifierFlags: .command, action: #selector(playFromCaret))
            run.discoverabilityTitle = String(localized: "Run Playtest")
            run.wantsPriorityOverSystemBehavior = true
            return (super.keyCommands ?? []) + [run]
        }

        @objc private func playFromCaret() {
            runPlaytest?()
        }
    }

    final class Coordinator: NSObject, UITextViewDelegate {
        var parent: AdvScriptTextView
        var appliedJump: UUID?
        var isUpdating = false
        var characters: [String] = []
        var scenes: [String] = []

        init(_ parent: AdvScriptTextView) { self.parent = parent }

        func textViewDidChange(_ textView: UITextView) {
            guard !isUpdating else { return }
            parent.onEdit(textView.text)
            textViewDidChangeSelection(textView)
        }

        func textViewDidChangeSelection(_ textView: UITextView) {
            guard !isUpdating else { return }
            parent.onPosition(SourceLocation(path: parent.path, offset: textView.selectedRange.location, in: textView.text as NSString))
        }

        func installToolbar(on editor: UITextView) {
            characters = parent.characters
            scenes = parent.scenes
            let toolbar = UIToolbar()
            let characterMenu = referenceButton("Insert Character", image: "person", names: characters) { [weak editor] name in
                Self.insertReference("@\(name)\n", prefix: "@", into: editor)
            }
            let sceneMenu = referenceButton("Insert Scene", image: "photo", names: scenes) { [weak editor] name in
                Self.insertReference("【\(name)】\n", prefix: "【", into: editor)
            }
            toolbar.items = [
                characterMenu, sceneMenu, .flexibleSpace(),
                item("Find and Replace", image: "magnifyingglass") { [weak editor] in
                    editor?.findInteraction?.presentFindNavigator(showingReplace: true)
                },
                item("Undo", image: "arrow.uturn.backward") { [weak editor] in editor?.undoManager?.undo() },
                item("Redo", image: "arrow.uturn.forward") { [weak editor] in editor?.undoManager?.redo() },
            ]
            toolbar.sizeToFit()
            editor.inputAccessoryView = toolbar
            if editor.isFirstResponder { editor.reloadInputViews() }
        }

        private static func insertReference(_ reference: String, prefix: String, into editor: UITextView?) {
            guard let editor else { return }
            let range = editor.selectedRange
            let source = editor.text as NSString
            if range.length == 0, range.location <= source.length, range.location > 0 {
                var lineStart = 0
                source.getLineStart(&lineStart, end: nil, contentsEnd: nil,
                                    for: NSRange(location: range.location, length: 0))
                let typedRange = NSRange(location: lineStart, length: range.location - lineStart)
                let typed = source.substring(with: typedRange)
                if typed.hasPrefix(prefix), !typed.contains("】"),
                   reference.localizedCaseInsensitiveContains(typed) {
                    editor.selectedRange = typedRange
                }
            }
            editor.insertText(reference)
        }

        private func referenceButton(_ label: LocalizedStringResource, image: String, names: [String],
                                     select: @escaping (String) -> Void) -> UIBarButtonItem {
            let title = String(localized: label)
            let actions = names.map { name in UIAction(title: name) { _ in select(name) } }
            let item = UIBarButtonItem(title: title, image: UIImage(systemName: image), menu: UIMenu(title: title, children: actions))
            item.accessibilityLabel = title
            item.isEnabled = !actions.isEmpty
            return item
        }

        private func item(_ label: LocalizedStringResource, image: String, action: @escaping () -> Void) -> UIBarButtonItem {
            let title = String(localized: label)
            let item = UIBarButtonItem(primaryAction: UIAction(title: title, image: UIImage(systemName: image)) { _ in action() })
            item.accessibilityLabel = title
            return item
        }
    }
}

enum AdvScriptHighlight {
    /// Display-only paragraph accents. The engine owns AdvScript syntax and diagnostics.
    static func color(for line: String) -> UIColor? {
        let text = line.drop(while: \.isWhitespace)
        if text.hasPrefix("【") { return .systemIndigo }
        if text.hasPrefix("@") { return .systemPurple }
        if text.hasPrefix("（") || text.hasPrefix(">") { return .secondaryLabel }
        if text.hasPrefix("#") || text.hasPrefix("- ") { return .systemBlue }
        if text.hasPrefix("<!--") || text.hasPrefix("---") { return .secondaryLabel }
        return nil
    }
}
