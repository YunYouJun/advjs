import type { editor as MonacoEditor } from 'monaco-editor'

export type StoryTemplateKind = 'dialogue' | 'choice'

/** Insert a Markdown block through Monaco's edit stack, preserving the draft and undo. */
export function insertStoryTemplate(editor: MonacoEditor.IStandaloneCodeEditor, kind: StoryTemplateKind, locale: string) {
  const model = editor.getModel()
  const range = editor.getSelection()
  if (!model || !range)
    return false
  const zh = locale === 'zh-CN'
  const placeholder = kind === 'dialogue' ? (zh ? '角色' : 'Character') : (zh ? '选项一' : 'Option one')
  const block = kind === 'dialogue'
    ? `@${placeholder}\n${zh ? '对白内容。' : 'Dialogue text.'}`
    : `- [ ] ${placeholder}\n- [ ] ${zh ? '选项二' : 'Option two'}`
  const start = model.getOffsetAt({ lineNumber: range.startLineNumber, column: range.startColumn })
  const end = model.getOffsetAt({ lineNumber: range.endLineNumber, column: range.endColumn })
  const content = model.getValue()
  const before = content.slice(0, start).replaceAll('\r\n', '\n')
  const after = content.slice(end).replaceAll('\r\n', '\n')
  const prefix = !before || before.endsWith('\n\n') ? '' : before.endsWith('\n') ? '\n' : '\n\n'
  const suffix = after.startsWith('\n\n') ? '' : after.startsWith('\n') ? '\n' : '\n\n'
  const eol = model.getEOL()
  const text = `${prefix}${block}${suffix}`.replaceAll('\n', eol)
  editor.pushUndoStop()
  const inserted = editor.executeEdits('advjs.story-template', [{ range, text, forceMoveMarkers: true }])
  editor.pushUndoStop()
  if (!inserted)
    return false
  const offset = start + prefix.replaceAll('\n', eol).length + (kind === 'dialogue' ? 1 : 6)
  const selectionStart = model.getPositionAt(offset)
  const selectionEnd = model.getPositionAt(offset + placeholder.length)
  editor.setSelection({ startLineNumber: selectionStart.lineNumber, startColumn: selectionStart.column, endLineNumber: selectionEnd.lineNumber, endColumn: selectionEnd.column })
  editor.revealPositionInCenterIfOutsideViewport(selectionStart)
  editor.focus()
  return true
}
