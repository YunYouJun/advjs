import type { App } from 'vue'
import type { JsonHighlightToken } from '../../packages/shared/json-highlight'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp, h, nextTick, ref } from 'vue'
import { jsonHighlightKey } from '../../packages/devtools/client/composables/useJsonHighlight'
import JsonCode from '../../packages/devtools/client/views/JsonCode.vue'
import JsonDetails from '../../packages/devtools/client/views/JsonDetails.vue'

let app: App | undefined
afterEach(() => {
  app?.unmount()
  app = undefined
  document.body.innerHTML = ''
})

describe('devTools JSON views', () => {
  it('keeps pending JSON readable, waits for RPC, and renders HTML-like data as text', async () => {
    const code = JSON.stringify({ value: '<img src=x onerror=alert(1)>' }, null, 2)
    const ready = ref(false)
    let resolve!: (tokens: JsonHighlightToken[]) => void
    const highlight = vi.fn(() => new Promise<JsonHighlightToken[]>(done => resolve = done))
    const root = document.createElement('div')
    document.body.append(root)
    app = createApp({ render: () => h(JsonCode, { code }) })
    app.provide(jsonHighlightKey, { ready, highlight })
    app.mount(root)
    expect(highlight).not.toHaveBeenCalled()
    expect(root.querySelector('pre')?.textContent).toBe(code)
    ready.value = true
    await nextTick()
    resolve([{ content: code, color: 'var(--agui-c-syntax-string)' }])
    await vi.waitFor(() => expect(root.querySelector('span')?.textContent).toBe(code))
    expect(root.querySelector('img')).toBeNull()
  })

  it('ignores stale results after data changes and keeps text on service failures', async () => {
    const code = ref('1')
    const resolves: Array<(tokens: JsonHighlightToken[]) => void> = []
    const highlight = vi.fn(() => new Promise<JsonHighlightToken[]>(done => resolves.push(done)))
    const root = document.createElement('div')
    app = createApp({ render: () => h(JsonCode, { code: code.value }) })
    app.provide(jsonHighlightKey, { ready: ref(true), highlight })
    app.mount(root)
    code.value = '2'
    await nextTick()
    resolves[1]([{ content: '2', color: 'var(--agui-c-syntax-number)' }])
    await vi.waitFor(() => expect(root.querySelector('span')?.textContent).toBe('2'))
    resolves[0]([{ content: '1' }])
    await nextTick()
    expect(root.querySelector('pre')?.textContent).toBe('2')
    highlight.mockRejectedValueOnce(new Error('Service disconnected'))
    code.value = 'null'
    await nextTick()
    await nextTick()
    expect(root.querySelector('pre')?.textContent).toBe('null')
    expect(root.querySelector('span')).toBeNull()
    code.value = 'false'
    await nextTick()
    app.unmount()
    app = undefined
    resolves[2]([{ content: 'false' }])
    await nextTick()
    expect(root.textContent).toBe('')
  })

  it('requests highlighting only when a JSON section is expanded', async () => {
    const highlight = vi.fn().mockResolvedValue([{ content: '{"score":7}' }])
    const root = document.createElement('div')
    document.body.append(root)
    app = createApp({ render: () => h(JsonDetails, { title: '舞台', value: { score: 7 } }) })
    app.provide(jsonHighlightKey, { ready: ref(true), highlight })
    app.mount(root)
    expect(highlight).not.toHaveBeenCalled()
    root.querySelector('summary')!.click()
    await vi.waitFor(() => expect(highlight).toHaveBeenCalledOnce())
    root.querySelector('summary')!.click()
    await vi.waitFor(() => expect(root.querySelector('pre span')).toBeNull())
    expect(root.querySelector('pre')?.textContent).toBe(JSON.stringify({ score: 7 }, null, 2))
  })
})
