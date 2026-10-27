import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import AGUISection from '../../../packages/gui/client/components/AGUISection.vue'
import AGUICodeBlock from '../../../packages/gui/client/components/code/AGUICodeBlock.vue'
import AGUITag from '../../../packages/gui/client/components/tag/AGUITag.vue'

const wrappers: Array<{ unmount: () => void }> = []
const clipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, 'clipboard')
afterEach(() => {
  wrappers.splice(0).forEach(wrapper => wrapper.unmount())
  window.getSelection()?.removeAllRanges()
  if (clipboardDescriptor)
    Object.defineProperty(navigator, 'clipboard', clipboardDescriptor)
  else
    Reflect.deleteProperty(navigator, 'clipboard')
  vi.useRealTimers()
  vi.restoreAllMocks()
})
function deferred() {
  let resolve!: () => void
  let reject!: (error: Error) => void
  const promise = new Promise<void>((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}

describe('aGUI authoring sections', () => {
  it('associates distinct headings and descriptions while preserving content, action and footer slots', () => {
    const wrapper = mount(defineComponent({
      setup: () => () => h('div', [
        h(AGUISection, { title: '选择角色', description: '先保存人物音色。', step: 1 }, { default: () => h('p', '角色字段'), actions: () => h('button', { type: 'button' }, '刷新'), footer: () => h('p', '审核后继续') }),
        h(AGUISection, { title: '并列设置' }, () => h('p', '其他设置')),
      ]),
    }))
    wrappers.push(wrapper)
    const sections = wrapper.findAll('section')
    const headings = sections.map(section => section.get('h3'))
    expect(headings[0]!.text()).toBe('1选择角色')
    expect(headings[0]!.attributes('id')).not.toBe(headings[1]!.attributes('id'))
    for (const [index, section] of sections.entries())
      expect(section.attributes('aria-labelledby')).toBe(headings[index]!.attributes('id'))
    expect(sections[0]!.get(`#${sections[0]!.attributes('aria-describedby')}`).text()).toBe('先保存人物音色。')
    expect(sections[0]!.get('button').text()).toBe('刷新')
    expect(sections[0]!.get('footer').text()).toBe('审核后继续')
    expect(sections[0]!.text()).toContain('角色字段')
    expect(sections[1]!.attributes('aria-describedby')).toBeUndefined()
    expect(sections[1]!.find('footer').exists()).toBe(false)
    expect(sections[1]!.find('.agui-section__step').exists()).toBe(false)
  })
})

describe('aGUI tag compatibility', () => {
  it.each(['default', 'primary', 'danger'] as const)('preserves the %s theme, closable event and independent close action', async (theme) => {
    const parentClick = vi.fn()
    const close = vi.fn()
    const wrapper = mount(defineComponent({ setup: () => () => h('div', { onClick: parentClick }, [h(AGUITag, { theme, closable: true, onClose: close }, () => '旧标签')]) }))
    wrappers.push(wrapper)
    expect(wrapper.get('.agui-tag').classes()).toContain(`agui-tag--${theme}`)
    expect(wrapper.get('button').attributes('type')).toBe('button')
    await wrapper.get('button').trigger('click')
    expect(close).toHaveBeenCalledOnce()
    expect(parentClick).not.toHaveBeenCalled()
    expect(wrapper.text()).toBe('旧标签')
  })

  it('supports status tones without removing the legacy API or visible status text', async () => {
    const wrapper = mount(AGUITag, { props: { tone: 'success', theme: 'primary', closable: true }, slots: { default: '已就绪' } })
    wrappers.push(wrapper)
    expect(wrapper.classes()).toContain('agui-tag--primary')
    expect(wrapper.classes()).toContain('agui-tag--tone-success')
    expect(wrapper.text()).toBe('已就绪')
    await wrapper.setProps({ tone: 'warning', closable: false })
    expect(wrapper.classes()).toContain('agui-tag--tone-warning')
    expect(wrapper.find('button').exists()).toBe(false)
  })
})

describe('aGUI selectable code blocks', () => {
  it('copies the exact complete text through the browser clipboard and clears success after two seconds', async () => {
    vi.useFakeTimers()
    const writeText = vi.fn(async () => {})
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    const code = 'pnpm add @advjs/plugin-breeze-tts\n# 保留完整命令'
    const wrapper = mount(AGUICodeBlock, { props: { code, label: '安装命令', copyLabel: '复制命令', copiedLabel: '已复制', copyErrorLabel: '复制失败，请手动复制。' } })
    wrappers.push(wrapper)
    await wrapper.get('button').trigger('click')
    await nextTick()
    expect(writeText).toHaveBeenCalledExactlyOnceWith(code)
    expect(wrapper.get('pre').text()).toBe(code)
    expect(wrapper.get('pre').attributes('aria-label')).toBe('安装命令')
    expect(wrapper.get('[role="status"]').text()).toBe('已复制')
    await vi.advanceTimersByTimeAsync(1999)
    expect(wrapper.get('[role="status"]').text()).toBe('已复制')
    await vi.advanceTimersByTimeAsync(1)
    expect(wrapper.get('[role="status"]').text()).toBe('')
  })

  it('keeps escaped code intact and selects it for manual copying when clipboard access fails', async () => {
    const code = '<script>window.invalid = true</script>\n完整配置'
    const copy = vi.fn(async () => {
      throw new Error('Clipboard permission denied')
    })
    const wrapper = mount(AGUICodeBlock, { attachTo: document.body, props: { code, label: '项目配置', copy, copyLabel: '复制', copyErrorLabel: '复制失败，已选中代码，请用键盘或菜单手动复制。' } })
    wrappers.push(wrapper)
    await wrapper.get('button').trigger('click')
    await flushPromises()
    expect(wrapper.find('script').exists()).toBe(false)
    expect(wrapper.get('code').text()).toBe(code)
    expect(wrapper.get('[role="status"]').text()).toContain('请用键盘或菜单手动复制')
    expect(document.activeElement).toBe(wrapper.get('pre').element)
    expect(window.getSelection()?.toString()).toBe(code)
    expect(wrapper.get('pre').attributes('aria-describedby')).toBe(wrapper.get('[role="status"]').attributes('id'))
    window.getSelection()?.removeAllRanges()
    await wrapper.get('pre').trigger('keydown', { key: 'a', ctrlKey: true })
    expect(window.getSelection()?.toString()).toBe(code)
  })

  it.each(['success', 'failure'] as const)('ignores a late %s after the code changes and preserves the next copy state', async (outcome) => {
    const first = deferred()
    const second = deferred()
    const copy = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    const wrapper = mount(AGUICodeBlock, { props: { code: 'old command', copy } })
    wrappers.push(wrapper)
    await wrapper.get('button').trigger('click')
    await wrapper.setProps({ code: 'new command' })
    await wrapper.get('button').trigger('click')
    if (outcome === 'success')
      first.resolve()
    else
      first.reject(new Error('Late failure'))
    await flushPromises()
    expect(wrapper.get('button').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[role="status"]').text()).toBe('')
    second.resolve()
    await flushPromises()
    expect(copy.mock.calls.map(call => call[0])).toEqual(['old command', 'new command'])
    expect(wrapper.get('button').attributes('disabled')).toBeUndefined()
    expect(wrapper.get('[role="status"]').text()).toBe('Copied')
  })

  it('ignores an obsolete copy callback result even if the code stays the same', async () => {
    const first = deferred()
    const wrapper = mount(AGUICodeBlock, { props: { code: 'unchanged', copy: () => first.promise } })
    wrappers.push(wrapper)
    await wrapper.get('button').trigger('click')
    const copy = vi.fn(async () => {})
    await wrapper.setProps({ copy })
    first.reject(new Error('Old clipboard transport'))
    await flushPromises()
    expect(wrapper.get('[role="status"]').text()).toBe('')
    await wrapper.get('button').trigger('click')
    await flushPromises()
    expect(copy).toHaveBeenCalledExactlyOnceWith('unchanged')
  })

  it('cleans success timers on unmount and does not schedule feedback for a late response', async () => {
    vi.useFakeTimers()
    const wrapper = mount(AGUICodeBlock, { props: { code: 'command', copy: async () => {} } })
    wrappers.push(wrapper)
    await wrapper.get('button').trigger('click')
    await nextTick()
    expect(vi.getTimerCount()).toBe(1)
    wrapper.unmount()
    expect(vi.getTimerCount()).toBe(0)
    const waiting = deferred()
    const late = mount(AGUICodeBlock, { props: { code: 'next command', copy: () => waiting.promise } })
    wrappers.push(late)
    await late.get('button').trigger('click')
    late.unmount()
    waiting.resolve()
    await nextTick()
    expect(vi.getTimerCount()).toBe(0)
  })
})
