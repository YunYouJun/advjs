import type { editor as MonacoEditor } from 'monaco-editor'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'
import { modelPreviewFormat, useModelPreview } from '../../../editor/core/app/composables/useModelPreview'
import { useMonacoStore } from '../../../editor/core/app/stores/useMonacoStore'
import { insertStoryTemplate } from '../../../editor/core/app/utils/story-templates'

afterEach(() => vi.unstubAllGlobals())

describe('chapter editor binding', () => {
  it('enables commands only for the current editor and releases the binding on disposal', async () => {
    setActivePinia(createPinia())
    const store = useMonacoStore()
    const ready = ref(false)
    const insert = vi.fn(async () => {})
    const release = store.registerChapterEditor({ canInsert: () => ready.value, insert })
    expect(store.canInsertStory).toBe(false)
    await store.insertStory('dialogue', 'zh-CN')
    expect(insert).not.toHaveBeenCalled()
    ready.value = true
    await store.insertStory('choice', 'en')
    expect(insert).toHaveBeenCalledWith('choice', 'en')
    const nextInsert = vi.fn(async () => {})
    const releaseNext = store.registerChapterEditor({ canInsert: () => true, insert: nextInsert })
    release()
    await store.insertStory('dialogue', 'zh-CN')
    expect(nextInsert).toHaveBeenCalledOnce()
    releaseNext()
    expect(store.canInsertStory).toBe(false)
  })
})

function textEditor(content: string, start: number, end = start, eol = '\n') {
  function positionAt(offset: number) {
    const lines = content.slice(0, offset).split(eol)
    return { lineNumber: lines.length, column: lines.at(-1)!.length + 1 }
  }
  function offsetAt(position: { lineNumber: number, column: number }) {
    return content.split(eol).slice(0, position.lineNumber - 1).reduce((size, line) => size + line.length + eol.length, 0) + position.column - 1
  }
  const from = positionAt(start)
  const to = positionAt(end)
  const selection = { startLineNumber: from.lineNumber, startColumn: from.column, endLineNumber: to.lineNumber, endColumn: to.column }
  const model = { getValue: () => content, getEOL: () => eol, getOffsetAt: offsetAt, getPositionAt: positionAt }
  const setSelection = vi.fn()
  const instance = {
    getModel: () => model,
    getSelection: () => selection,
    pushUndoStop: vi.fn(),
    executeEdits: (_: string, edits: { text: string }[]) => {
      content = content.slice(0, start) + edits[0]!.text + content.slice(end)
      return true
    },
    setSelection,
    revealPositionInCenterIfOutsideViewport: vi.fn(),
    focus: vi.fn(),
  } as unknown as MonacoEditor.IStandaloneCodeEditor
  return { instance, content: () => content, setSelection }
}

describe('story templates', () => {
  it('inserts at the selection between existing paragraphs and selects the character name', () => {
    const editor = textEditor('草稿前文\n\n替换\n\n草稿后文', 6, 8)
    expect(insertStoryTemplate(editor.instance, 'dialogue', 'zh-CN')).toBe(true)
    expect(editor.content()).toBe('草稿前文\n\n@角色\n对白内容。\n\n草稿后文')
    expect(editor.setSelection).toHaveBeenCalledWith({ startLineNumber: 3, startColumn: 2, endLineNumber: 3, endColumn: 4 })
  })

  it('keeps Windows line endings and block boundaries when inserting choices', () => {
    const editor = textEditor('前文\r\n\r\n后文', 6, 6, '\r\n')
    insertStoryTemplate(editor.instance, 'choice', 'en')
    expect(editor.content()).toBe('前文\r\n\r\n- [ ] Option one\r\n- [ ] Option two\r\n\r\n后文')
    expect(editor.setSelection).toHaveBeenCalledWith({ startLineNumber: 3, startColumn: 7, endLineNumber: 3, endColumn: 17 })
  })
})

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

describe('model preview lifecycle', () => {
  it('infers format without decoding URL bytes and skips missing or unsupported sources', () => {
    expect(modelPreviewFormat('/model%2520name.GLB?token=1', '')).toBe('glb')
    expect(modelPreviewFormat('/opaque', ' GLTF ')).toBe('gltf')
    const loader = vi.fn(async () => {})
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    const scope = effectScope()
    scope.run(() => useModelPreview(() => '', () => 'gltf', loader))
    scope.run(() => useModelPreview(() => '/file.obj', () => '', loader))
    expect(loader).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
    scope.stop()
  })

  it('never parses GLB as JSON and ignores old element events after retry or disposal', async () => {
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    const scope = effectScope()
    const preview = scope.run(() => useModelPreview(() => '/model.glb', () => '', async () => {}))!
    await nextTick()
    const first = preview.viewer.value!
    first.failed()
    expect(preview.modelState.value).toBe('error')
    preview.retry()
    await nextTick()
    await nextTick()
    first.loaded()
    expect(preview.modelState.value).toBe('loading')
    const current = preview.viewer.value!
    current.loaded()
    expect(preview.modelState.value).toBe('ready')
    expect(preview.jsonState.value).toBe('idle')
    expect(fetch).not.toHaveBeenCalled()
    scope.stop()
    current.failed()
    expect(preview.modelState.value).toBe('ready')
  })

  it('aborts old glTF requests and discards late imports and responses when the URL changes', async () => {
    const oldFetch = deferred<Response>()
    const oldLoader = deferred<void>()
    const fetch = vi.fn().mockReturnValueOnce(oldFetch.promise).mockResolvedValueOnce(new Response('{"asset":{"version":"2.0"}}'))
    vi.stubGlobal('fetch', fetch)
    const loader = vi.fn().mockReturnValueOnce(oldLoader.promise).mockResolvedValueOnce(undefined)
    const source = ref('/old.gltf')
    const scope = effectScope()
    const preview = scope.run(() => useModelPreview(() => source.value, () => '', loader))!
    const signal = fetch.mock.calls[0]![1].signal as AbortSignal
    source.value = '/new.gltf'
    await nextTick()
    await vi.waitFor(() => expect(preview.jsonState.value).toBe('ready'))
    expect(signal.aborted).toBe(true)
    oldFetch.resolve(new Response('{"old":true}'))
    oldLoader.resolve()
    await nextTick()
    await nextTick()
    expect(preview.jsonContent.value).toContain('"asset"')
    expect(preview.viewer.value?.src).toBe('/new.gltf')
    scope.stop()
  })

  it('reports HTTP and JSON failures and lets a new attempt recover', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response('missing', { status: 404 })).mockResolvedValueOnce(new Response('invalid')).mockResolvedValueOnce(new Response('{}')))
    const scope = effectScope()
    const preview = scope.run(() => useModelPreview(() => '/model.gltf', () => '', async () => {}))!
    await vi.waitFor(() => expect(preview.jsonError.value).toBe('HTTP 404'))
    preview.retry()
    await vi.waitFor(() => expect(preview.jsonState.value).toBe('error'))
    expect(preview.jsonError.value).not.toBe('HTTP 404')
    preview.retry()
    await vi.waitFor(() => expect(preview.jsonContent.value).toBe('{}'))
    scope.stop()
  })

  it('surfaces a registration failure and retries loading the renderer', async () => {
    const loader = vi.fn().mockRejectedValueOnce(new Error('chunk failed')).mockResolvedValueOnce(undefined)
    const scope = effectScope()
    const preview = scope.run(() => useModelPreview(() => '/model.glb', () => '', loader))!
    await vi.waitFor(() => expect(preview.modelState.value).toBe('error'))
    preview.retry()
    await vi.waitFor(() => expect(preview.viewer.value).toBeDefined())
    expect(preview.modelState.value).toBe('loading')
    scope.stop()
  })
})
