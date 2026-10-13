import type { VueWrapper } from '@vue/test-utils'
import type { useNativeFlowAuthoring } from '../../../editor/core/app/composables/useNativeFlowAuthoring'
import type { JsonHighlightToken } from '../../../packages/shared/json-highlight'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref, shallowRef } from 'vue'
import NativeFlowJsonPreview from '../../../editor/core/app/components/system/flow/NativeFlowJsonPreview.vue'
import NativeFlowProposalPanel from '../../../editor/core/app/components/system/flow/NativeFlowProposalPanel.vue'
import { highlightJson } from '../../../editor/core/app/services/shiki'
import { highlightBrowserJson } from '../../../editor/core/app/services/shiki-browser'
import { MAX_JSON_HIGHLIGHT_LENGTH } from '../../../packages/shared/json-highlight'

vi.mock('../../../editor/core/app/services/shiki', () => ({ highlightJson: vi.fn() }))

const wrappers: VueWrapper[] = []
const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard')
const writeText = vi.fn<(code: string) => Promise<void>>()
const source = '{\r\n  "text": "<img src=x onerror=alert(1)>",\r\n  "quoted\\\"key": "escaped\\nline",\r\n  "count": 2, "flags": [true, false, null]\r\n}\r\n'

beforeEach(() => {
  vi.mocked(highlightJson).mockResolvedValue(undefined)
  writeText.mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
})

afterEach(() => {
  wrappers.splice(0).forEach(wrapper => wrapper.unmount())
  if (originalClipboard)
    Object.defineProperty(navigator, 'clipboard', originalClipboard)
  else
    Reflect.deleteProperty(navigator, 'clipboard')
  vi.resetAllMocks()
})

function preview(code = source) {
  const wrapper = mount(NativeFlowJsonPreview, { props: { code, title: '当前版本' } })
  wrappers.push(wrapper)
  return wrapper
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: Error) => void
  const promise = new Promise<T>((done, fail) => {
    resolve = done
    reject = fail
  })
  return { promise, resolve, reject }
}

describe('native Flow read-only JSON preview', () => {
  it('keeps exact source readable during highlighting and renders AGUI tokens as escaped text', async () => {
    const request = deferred<JsonHighlightToken[]>()
    vi.mocked(highlightJson).mockReturnValue(request.promise)
    const wrapper = preview()
    expect(wrapper.get('pre').element.textContent).toBe(source)
    expect(wrapper.get('pre').attributes()).toMatchObject({ 'tabindex': '0', 'role': 'region', 'aria-label': '当前版本 JSON 只读源码' })
    expect(wrapper.text()).toContain('JSON · 只读')
    expect(wrapper.findAll('textarea, input, [contenteditable="true"]')).toHaveLength(0)
    const tokens = await highlightBrowserJson(source)
    request.resolve(tokens)
    await flushPromises()
    expect(wrapper.get('pre').element.textContent).toBe(source)
    expect(wrapper.findAll('pre span')).toHaveLength(tokens.length)
    expect(wrapper.find('img').exists()).toBe(false)
    const colors = wrapper.findAll('pre span').map(span => span.attributes('style'))
    for (const role of ['key', 'string', 'number', 'literal', 'punctuation'])
      expect(colors).toContain(`color: var(--agui-c-syntax-${role});`)
    await wrapper.get('button').trigger('click')
    expect(writeText).toHaveBeenCalledExactlyOnceWith(source)
    expect(wrapper.get('[role="status"]').text()).toBe('已复制当前版本 JSON')
  })

  it('skips tokenization for large source while preserving and copying the complete text', async () => {
    const code = `${JSON.stringify({ text: '长'.repeat(MAX_JSON_HIGHLIGHT_LENGTH) })}\n`
    const wrapper = preview(code)
    await flushPromises()
    expect(highlightJson).not.toHaveBeenCalled()
    expect(wrapper.get('pre').element.textContent).toBe(code)
    expect(wrapper.findAll('pre span')).toHaveLength(0)
    expect(wrapper.text()).toContain('内容较大，已显示完整纯文本；仍可复制')
    await wrapper.get('button').trigger('click')
    expect(writeText).toHaveBeenCalledExactlyOnceWith(code)
  })

  it.each(['unavailable', 'rejected', 'mismatched'] as const)('retains exact copyable plain text when highlighting is %s', async (failure) => {
    if (failure === 'rejected')
      vi.mocked(highlightJson).mockRejectedValue(new Error('Highlighter failed'))
    else if (failure === 'mismatched')
      vi.mocked(highlightJson).mockResolvedValue([{ content: 'Changed by highlighter' }])
    const wrapper = preview()
    await flushPromises()
    expect(wrapper.get('pre').element.textContent).toBe(source)
    expect(wrapper.findAll('pre span')).toHaveLength(0)
    await wrapper.get('button').trigger('click')
    expect(writeText).toHaveBeenCalledExactlyOnceWith(source)
  })

  it('ignores obsolete highlighting after source replacement or unmount', async () => {
    const old = deferred<JsonHighlightToken[]>()
    const current = deferred<JsonHighlightToken[]>()
    const afterUnmount = deferred<JsonHighlightToken[]>()
    vi.mocked(highlightJson).mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise).mockReturnValueOnce(afterUnmount.promise)
    const wrapper = preview()
    await wrapper.setProps({ code: 'false' })
    expect(wrapper.get('pre').element.textContent).toBe('false')
    current.resolve([{ content: 'false', color: 'var(--agui-c-syntax-literal)' }])
    await flushPromises()
    old.resolve([{ content: source, color: 'var(--agui-c-syntax-string)' }])
    await flushPromises()
    expect(wrapper.get('pre span').text()).toBe('false')
    await wrapper.setProps({ code: 'null' })
    expect(wrapper.findAll('pre span')).toHaveLength(0)
    wrapper.unmount()
    afterUnmount.reject(new Error('Unmounted highlighter'))
    await flushPromises()
    expect(wrapper.exists()).toBe(false)
  })

  it('shows accessible copy failure and lets the user retry without altering the source', async () => {
    const wrapper = preview()
    writeText.mockRejectedValueOnce(new Error('Permission denied'))
    await wrapper.get('button').trigger('click')
    await flushPromises()
    const status = wrapper.get('[role="status"]')
    expect(status.attributes()).toMatchObject({ 'aria-live': 'polite', 'aria-atomic': 'true' })
    expect(status.text()).toBe('复制失败，请选中下方 JSON 手动复制')
    expect(status.classes()).toContain('json-preview-error')
    expect(wrapper.get('pre').element.textContent).toBe(source)
    await wrapper.get('button').trigger('click')
    await flushPromises()
    expect(status.text()).toBe('已复制当前版本 JSON')
    expect(status.classes()).not.toContain('json-preview-error')
    expect(writeText).toHaveBeenCalledTimes(2)
  })

  it('provides manual-copy guidance when the clipboard is unavailable', async () => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined })
    const wrapper = preview()
    await wrapper.get('button').trigger('click')
    expect(wrapper.get('[role="status"]').text()).toBe('复制失败，请选中下方 JSON 手动复制')
    expect(wrapper.get('pre').element.textContent).toBe(source)
  })

  it('blocks duplicate copies and ignores stale copy completion after source replacement or unmount', async () => {
    const old = deferred<void>()
    const current = deferred<void>()
    const afterUnmount = deferred<void>()
    writeText.mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise).mockReturnValueOnce(afterUnmount.promise)
    const wrapper = preview()
    const button = wrapper.get('button')
    await button.trigger('click')
    expect(button.attributes('disabled')).toBeDefined()
    await button.trigger('click')
    expect(writeText).toHaveBeenCalledTimes(1)
    await wrapper.setProps({ code: 'null' })
    expect(button.attributes('disabled')).toBeUndefined()
    expect(wrapper.get('[role="status"]').text()).toBe('')
    await button.trigger('click')
    old.resolve()
    await flushPromises()
    expect(button.attributes('disabled')).toBeDefined()
    expect(wrapper.get('[role="status"]').text()).toBe('')
    current.resolve()
    await flushPromises()
    expect(wrapper.get('[role="status"]').text()).toBe('已复制当前版本 JSON')
    expect(writeText).toHaveBeenNthCalledWith(2, 'null')
    await button.trigger('click')
    wrapper.unmount()
    afterUnmount.reject(new Error('Unmounted clipboard'))
    await flushPromises()
    expect(wrapper.exists()).toBe(false)
  })
})

describe('native Flow proposal source disclosure', () => {
  it('keeps dialogue review first, lazily mounts read-only source, and resets on a new review', async () => {
    const baseline = { nodes: [{ id: 'hello', lineId: 'line-1', text: '原对白' }] }
    const proposed = { nodes: [{ id: 'hello', lineId: 'line-1', text: '提案对白' }] }
    const review = { plan: {
      valid: true,
      baseline,
      proposed,
      before: `${JSON.stringify(baseline, null, 2)}\n`,
      after: `${JSON.stringify(proposed, null, 2)}\n`,
      diagnostics: [],
      changes: { nodes: [], chapterFields: [], lines: [{ nodeId: 'hello', lineId: 'line-1', kind: 'updated', fields: ['text'] }] },
    } }
    const proposal = shallowRef<typeof review>()
    const state = {
      proposal,
      path: ref('adv/chapters/intro.chapter.json'),
      dirty: ref(false),
      loading: ref(false),
      saving: ref(false),
      dismissProposal: () => { proposal.value = undefined },
    } as unknown as ReturnType<typeof useNativeFlowAuthoring>
    proposal.value = review
    const wrapper = mount(NativeFlowProposalPanel, { props: { state } })
    wrappers.push(wrapper)
    expect(wrapper.get('[data-testid="native-proposal-line-diff"]').text()).toContain('当前原对白')
    expect(wrapper.get('[data-testid="native-proposal-line-diff"]').text()).toContain('提案提案对白')
    expect(wrapper.find('textarea').exists()).toBe(false)
    expect(wrapper.find('pre').exists()).toBe(false)
    expect(highlightJson).not.toHaveBeenCalled()
    const disclosure = wrapper.get('[data-testid="native-proposal-source-diff"]')
    ;(disclosure.element as HTMLDetailsElement).open = true
    await disclosure.trigger('toggle')
    expect(wrapper.get('[data-testid="native-proposal-before-json"] pre').element.textContent).toBe(review.plan.before)
    expect(wrapper.get('[data-testid="native-proposal-after-json"] pre').element.textContent).toBe(review.plan.after)
    expect(highlightJson).toHaveBeenCalledTimes(2)
    ;(disclosure.element as HTMLDetailsElement).open = false
    await disclosure.trigger('toggle')
    expect(wrapper.find('pre').exists()).toBe(false)
    ;(disclosure.element as HTMLDetailsElement).open = true
    await disclosure.trigger('toggle')
    expect(highlightJson).toHaveBeenCalledTimes(4)
    proposal.value = { ...review }
    await flushPromises()
    expect((disclosure.element as HTMLDetailsElement).open).toBe(false)
    expect(wrapper.find('pre').exists()).toBe(false)
    await wrapper.get('[data-testid="native-proposal-edit"]').trigger('click')
    expect(wrapper.find('textarea').exists()).toBe(true)
    expect(wrapper.find('pre').exists()).toBe(false)
  })
})
