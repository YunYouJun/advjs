import { getCurrentInstance, onMounted, watch } from 'vue'
import type * as m from 'monaco-editor'
import { isDark } from '../composables'

const sharedEditorOptions: m.editor.IStandaloneEditorConstructionOptions = {
  theme: isDark.value ? 'vs-dark' : 'vs',
  tabSize: 2,
  fontSize: 14,
  wordWrap: 'on',
}

async function setup() {
  const monaco = await import('monaco-editor')

  await Promise.all([
    // load workers
    (async () => {
      const [
        { default: EditorWorker },
        { default: JsonWorker },
        { default: CssWorker },
        { default: HtmlWorker },
        { default: TsWorker },
      ] = await Promise.all([
        import('monaco-editor/esm/vs/editor/editor.worker?worker'),
        import('monaco-editor/esm/vs/language/json/json.worker?worker'),
        import('monaco-editor/esm/vs/language/css/css.worker?worker'),
        import('monaco-editor/esm/vs/language/html/html.worker?worker'),
        import('monaco-editor/esm/vs/language/typescript/ts.worker?worker'),
      ])

      window.MonacoEnvironment = {
        getWorker(_: any, label: string) {
          if (label === 'json')
            return new JsonWorker()
          if (label === 'css' || label === 'scss' || label === 'less')
            return new CssWorker()
          if (label === 'html' || label === 'handlebars' || label === 'razor')
            return new HtmlWorker()
          if (label === 'typescript' || label === 'javascript')
            return new TsWorker()
          return new EditorWorker()
        },
      }
    })(),
  ])

  if (getCurrentInstance())
    await new Promise<void>(resolve => onMounted(resolve))

  // init editors

  /**
   * 输入编辑器 Markdown
   * @param container
   * @param options
   */
  function initInputEditor(
    container: HTMLElement,
    options?: m.editor.IStandaloneEditorConstructionOptions,
  ) {
    const editor = monaco.editor.create(container, {
      language: 'markdown',
      ...sharedEditorOptions,
      ...options,
    })

    // add resize for editor
    globalThis.addEventListener('resize', () => {
      editor.layout()
    })
    return editor
  }

  /**
   * 输出编辑器 JSON Preview
   * @param container
   * @param options
   */
  function initOutputEditor(
    container: HTMLElement,
    options?: m.editor.IStandaloneEditorConstructionOptions,
  ) {
    const editor = monaco.editor.create(container, {
      language: 'json',
      readOnly: true,
      ...sharedEditorOptions,
      ...options,
    })

    // add resize for editor
    globalThis.addEventListener('resize', () => {
      editor.layout()
    })
    return editor
  }

  watch(isDark, (val) => {
    monaco.editor.setTheme(val ? 'vs-dark' : 'vs')
  })

  return {
    monaco,

    initInputEditor,
    initOutputEditor,
  }
}

export default setup
