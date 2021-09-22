import * as monaco from 'monaco-editor'

const sharedEditorOptions: monaco.editor.IStandaloneEditorConstructionOptions = {
  theme: 'vs-dark',
  tabSize: 2,
  fontSize: 14,
}

/**
 * 输入编辑器
 * @param container
 * @param options
 */
export function initInputEditor(
  container: HTMLElement,
  options?: monaco.editor.IStandaloneEditorConstructionOptions,
) {
  const editor = monaco.editor.create(container, {
    language: 'markdown',
    ...options,
    ...sharedEditorOptions,
  })
  return editor
}

/**
 * 输出编辑器
 * @param container
 * @param options
 */
export function initOutputEditor(
  container: HTMLElement,
  options?: monaco.editor.IStandaloneEditorConstructionOptions,
) {
  const editor = monaco.editor.create(container, {
    language: 'json',

    readOnly: false,
    ...options,
    ...sharedEditorOptions,
  })
  return editor
}
