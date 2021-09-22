import * as monaco from 'monaco-editor'

import 'monaco-editor/min/vs/editor/editor.main.css'

import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import JsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker'
import CssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker'
import HtmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker'
import TsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker'

import { compilerOptions } from './options'
import { initInputEditor, initOutputEditor } from './utils'

// @ts-ignore
self.MonacoEnvironment = {
  getWorker(_: string, label: string) {
    if (label === 'json') return new JsonWorker()

    if (label === 'css' || label === 'scss' || label === 'less')
      return new CssWorker()

    if (label === 'html' || label === 'handlebars' || label === 'razor')
      return new HtmlWorker()

    if (label === 'typescript' || label === 'javascript') return new TsWorker()

    return new EditorWorker()
  },
}

function compileFn(source: string) {
  return {
    code: source,
  }
}

declare global {
  interface Window {
    monaco: typeof monaco
    _deps: any
    init: () => void
  }
}

interface PersistedState {
  src: string
  options: any
}

// window.init = init;
export function init() {
  const persistedState: PersistedState = JSON.parse(
    decodeURIComponent(window.location.hash.slice(1))
      || localStorage.getItem('state')
      || '{}',
  )

  const inputEditor = initInputEditor(
    document.getElementById('input-editor')!,
    {
      value: persistedState.src || '# Hello World!',
    },
  )

  const outputEditor = initOutputEditor(
    document.getElementById('output-editor')!,
  )

  Object.assign(compilerOptions, persistedState.options)

  let lastSuccessfulCode: string

  function compileCode(source: string): string {
    // console.clear()
    try {
      // const start = performance.now()
      const { code } = compileFn(source)
      // console.log(`Compiled in ${(performance.now() - start).toFixed(2)}ms.`)
      // console.log('Options: ', compilerOptions)
      lastSuccessfulCode = `${code}\n\n// Check the console for the AST`
    }
    catch (e) {
      lastSuccessfulCode = `/* ERROR: ${e.message} (see console for more info) */`
      // console.error(e)
    }
    return lastSuccessfulCode
  }

  function reCompile() {
    const src = inputEditor.getValue()
    // every time we re-compile, persist current state
    const state = JSON.stringify({
      src,
      options: compilerOptions,
    } as PersistedState)
    localStorage.setItem('state', state)
    window.location.hash = encodeURIComponent(state)
    const res = compileCode(src)
    if (res) outputEditor.setValue(res)
  }

  // handle resize
  window.addEventListener('resize', () => {
    inputEditor.layout()
    outputEditor.layout()
  })

  inputEditor.onDidChangeModelContent(debounce(reCompile))

  function debounce<T extends(...args: any[]) => any>(fn: T, delay = 300): T {
    let prevTimer: number | null = null
    return ((...args: any[]) => {
      if (prevTimer) clearTimeout(prevTimer)

      prevTimer = window.setTimeout(() => {
        fn(...args)
        prevTimer = null
      }, delay)
    }) as any
  }
}
