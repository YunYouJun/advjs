import type { App, Ref } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, h, nextTick, reactive, shallowRef } from 'vue'
import { describeReportValue, formatEditorErrorReport } from '../../../apps/desktop/src/error-report'
import AECopyErrorButton from '../../../editor/core/app/components/error/AECopyErrorButton.vue'

describe('editor error reports', () => {
  it('keeps error causes, stacks and context while redacting credentials', () => {
    const error = Object.assign(new Error('request failed', { cause: new Error('connection refused') }), { code: 'ECONNREFUSED' })
    const report = formatEditorErrorReport({
      source: 'Open project',
      error,
      project: 'rain',
      version: '0.1.4',
      environment: 'Desktop test',
      details: { apiKey: 'api-secret', token: 'token-secret', path: 'adv/chapters/intro.adv.md' },
      logs: ['Authorization: Bearer bearer-secret', 'http://localhost/#advjs-token=url-secret', 'session-secret'],
    }, ['session-secret'])
    for (const text of ['request failed', 'connection refused', 'ECONNREFUSED', 'stack', 'adv/chapters/intro.adv.md', 'rain', '0.1.4', 'Desktop test'])
      expect(report).toContain(text)
    for (const secret of ['api-secret', 'token-secret', 'bearer-secret', 'url-secret', 'session-secret'])
      expect(report).not.toContain(secret)
    expect(report).toContain('[redacted]')
  })

  it('serializes circular objects and bigint values without losing the original message', () => {
    const data: Record<string, unknown> = { message: 'write failed', bytes: 12n }
    data.self = data
    const report = describeReportValue(data)
    expect(report).toContain('write failed')
    expect(report).toContain('12')
    expect(report).toContain('[Circular]')
  })
})

let app: App | undefined
const writeText = vi.fn()
const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard')
beforeEach(() => {
  writeText.mockReset().mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
  vi.stubGlobal('useI18n', () => ({ locale: shallowRef('en') }))
  vi.stubGlobal('useProjectStore', () => reactive({ rootDir: { name: 'rain' }, workspaceMode: 'browser' }))
  vi.stubGlobal('useConsoleStore', () => ({ logList: [{ type: 'error', message: 'original error', data: { token: 'secret-token' } }] }))
})
afterEach(() => {
  app?.unmount()
  document.body.innerHTML = ''
  delete window.advDesktop
  if (originalClipboard)
    Object.defineProperty(navigator, 'clipboard', originalClipboard)
  else
    Reflect.deleteProperty(navigator, 'clipboard')
  vi.unstubAllGlobals()
})

function mount(error: Ref<unknown> = shallowRef(new Error('Directory removed')), compact = false, copiedLabel?: string) {
  const root = document.createElement('div')
  document.body.append(root)
  app = createApp({ render: () => h(AECopyErrorButton, { source: 'Project recovery', error: error.value, details: { status: 'unavailable' }, compact, copiedLabel }) })
  app.mount(root)
  return root
}

describe('copy error button', () => {
  it('keeps compact actions named and announces successful copying without growing the label', async () => {
    const root = mount(undefined, true)
    const button = root.querySelector('button')!
    expect(button.getAttribute('aria-label')).toBe('Copy error details')
    expect(button.textContent).toBe('')
    button.click()
    await vi.waitFor(() => expect(button.getAttribute('aria-label')).toContain('Copied'))
    expect(button.title).toContain('Copied')
    expect(button.textContent).toBe('')
    expect(writeText.mock.calls[0][0]).toContain('Directory removed')
  })

  it('distinguishes the copied report and returns a compact action to copying after two seconds', async () => {
    const root = mount(undefined, true, 'Error details copied')
    const button = root.querySelector('button')!
    vi.useFakeTimers()
    try {
      button.click()
      await vi.advanceTimersByTimeAsync(0)
      expect(button.title).toBe('Error details copied')
      expect(button.getAttribute('aria-label')).toBe('Error details copied')
      await vi.advanceTimersByTimeAsync(2000)
      expect(button.title).toBe('Copy error details')
      expect(button.querySelector('.i-ri-file-copy-line')).not.toBeNull()
      expect(button.disabled).toBe(false)
    }
    finally {
      vi.useRealTimers()
    }
  })

  it('reports success only after writing the complete diagnostic report', async () => {
    let resolve!: () => void
    writeText.mockReturnValue(new Promise<void>(done => resolve = done))
    const root = mount()
    const button = root.querySelector('button')!
    button.click()
    await nextTick()
    expect(button.disabled).toBe(true)
    expect(button.textContent).not.toContain('Copied')
    const report = writeText.mock.calls[0][0]
    expect(report).toContain('Directory removed')
    expect(report).toContain('rain')
    expect(report).toContain('unavailable')
    expect(report).toContain('original error')
    expect(report).not.toContain('secret-token')
    resolve()
    await vi.waitFor(() => expect(button.textContent).toContain('Copied'))
    expect(button.disabled).toBe(false)
  })

  it('shows a selectable report when clipboard access fails and allows retry', async () => {
    writeText.mockRejectedValueOnce(new Error('Permission denied'))
    const root = mount()
    const button = root.querySelector('button')!
    button.click()
    await vi.waitFor(() => expect(root.querySelector('[role=alert]')).not.toBeNull())
    expect(button.textContent).not.toContain('Copied')
    const textarea = root.querySelector('textarea')!
    expect(textarea.readOnly).toBe(true)
    expect(textarea.value).toContain('Directory removed')
    button.click()
    await vi.waitFor(() => expect(button.textContent).toContain('Copied'))
    expect(root.querySelector('textarea')).toBeNull()
  })

  it('does not mark a new error as copied when it changes during a clipboard write', async () => {
    let resolve!: () => void
    writeText.mockReturnValue(new Promise<void>(done => resolve = done))
    const error = shallowRef(new Error('First failure'))
    const root = mount(error)
    const button = root.querySelector('button')!
    button.click()
    error.value = new Error('Second failure')
    await nextTick()
    resolve()
    await vi.waitFor(() => expect(button.disabled).toBe(false))
    expect(writeText.mock.calls[0][0]).toContain('First failure')
    expect(button.textContent).not.toContain('Copied')
  })

  it('uses the finite native clipboard API in the desktop host', async () => {
    const copyErrorReport = vi.fn().mockResolvedValue(undefined)
    window.advDesktop = { copyErrorReport } as unknown as NonNullable<Window['advDesktop']>
    const root = mount()
    root.querySelector('button')!.click()
    await vi.waitFor(() => expect(copyErrorReport).toHaveBeenCalledOnce())
    expect(copyErrorReport.mock.calls[0][0]).toContain('Desktop')
    expect(writeText).not.toHaveBeenCalled()
  })
})
