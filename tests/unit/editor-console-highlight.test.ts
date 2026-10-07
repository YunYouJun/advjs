import type { App } from 'vue'
import type { JsonHighlightToken } from '../../packages/shared/json-highlight'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp, h, nextTick, shallowRef } from 'vue'
import { describeReportValue } from '../../apps/desktop/src/error-report'
import AEConsoleLogData from '../../editor/core/app/components/panel/view/AEConsoleLogData.vue'
import { highlightJson } from '../../editor/core/app/services/shiki'
import { highlightBrowserJson } from '../../editor/core/app/services/shiki-browser'
import { canHighlightJson, MAX_JSON_HIGHLIGHT_LENGTH } from '../../packages/shared/json-highlight'

vi.mock('../../editor/core/app/services/shiki', () => ({ highlightJson: vi.fn() }))

let app: App | undefined
afterEach(() => {
  app?.unmount()
  app = undefined
  document.body.innerHTML = ''
  vi.resetAllMocks()
})

describe('console JSON highlighting', () => {
  it('recognizes JSON scalars, objects and arrays while keeping plain and large data unhighlighted', () => {
    for (const code of ['false', '0', 'null', '"text"', '[]', '{"count":1}'])
      expect(canHighlightJson(code)).toBe(true)
    for (const code of ['', 'Error: failed\n at file.ts:1', '{"invalid":}', JSON.stringify('x'.repeat(MAX_JSON_HIGHLIGHT_LENGTH))])
      expect(canHighlightJson(code)).toBe(false)
  })

  it('uses AGUI syntax tokens without losing whitespace, escapes, or HTML-like strings', async () => {
    const code = '{\r\n  "name": "<img src=x onerror=alert(1)>",\r\n  "count": -1.2e3,\r\n  "flags": [true, false, null],\r\n  "quoted\\\"key": "escaped\\nline"\r\n}\r\n'
    const tokens = await highlightBrowserJson(code)
    expect(tokens.map(token => token.content).join('')).toBe(code)
    const color = (content: string) => tokens.find(token => token.content.includes(content))?.color
    expect(color('name')).toBe('var(--agui-c-syntax-key)')
    expect(color('<img src=x onerror=alert(1)>')).toBe('var(--agui-c-syntax-string)')
    expect(color('-1.2e3')).toBe('var(--agui-c-syntax-number)')
    for (const value of ['true', 'false', 'null'])
      expect(color(value)).toBe('var(--agui-c-syntax-literal)')
  })

  it('keeps data readable during loading and escapes highlighted strings as text', async () => {
    const data = { chapters: 1, value: '<img src=x onerror=alert(1)>', token: 'private-token' }
    const code = describeReportValue(data)
    let resolve!: (tokens: JsonHighlightToken[]) => void
    vi.mocked(highlightJson).mockReturnValue(new Promise(done => resolve = done))
    const root = document.createElement('div')
    document.body.append(root)
    app = createApp({ render: () => h(AEConsoleLogData, { data }) })
    app.mount(root)
    expect(root.querySelector('pre')!.textContent).toBe(code)
    resolve(await highlightBrowserJson(code))
    await vi.waitFor(() => expect(root.querySelectorAll('span').length).toBeGreaterThan(0))
    expect(root.querySelector('pre')!.textContent).toBe(code)
    expect(root.querySelector('img')).toBeNull()
    expect(root.textContent).toContain('[redacted]')
    expect(root.textContent).not.toContain('private-token')
  })

  it('ignores an old highlight result when data changes or the row unmounts', async () => {
    const resolves: Array<(tokens: JsonHighlightToken[]) => void> = []
    vi.mocked(highlightJson).mockImplementation(() => new Promise(done => resolves.push(done)))
    const data = shallowRef<unknown>({ first: 1 })
    const root = document.createElement('div')
    document.body.append(root)
    app = createApp({ render: () => h(AEConsoleLogData, { data: data.value }) })
    app.mount(root)
    data.value = false
    await nextTick()
    resolves[1]([{ content: 'false', color: 'var(--agui-c-syntax-literal)' }])
    await vi.waitFor(() => expect(root.querySelector('span')?.textContent).toBe('false'))
    resolves[0]([{ content: 'stale' }])
    await nextTick()
    expect(root.querySelector('pre')!.textContent).toBe('false')
    data.value = null
    await nextTick()
    app.unmount()
    app = undefined
    resolves[2]([{ content: 'null' }])
    await nextTick()
    expect(root.textContent).toBe('')
  })

  it('retains raw text when highlighting is unavailable', async () => {
    vi.mocked(highlightJson).mockResolvedValue(undefined)
    const data = 'Error: failed\n at file.ts:1'
    const root = document.createElement('div')
    app = createApp({ render: () => h(AEConsoleLogData, { data }) })
    app.mount(root)
    await nextTick()
    expect(root.querySelector('pre')!.textContent).toBe(data)
    expect(root.querySelector('span')).toBeNull()
  })
})
