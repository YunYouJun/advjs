import type { App } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp, defineComponent, h, nextTick, onMounted, onUnmounted, shallowRef } from 'vue'
import AGUIAccordion from '../../../packages/gui/client/components/accordion/AGUIAccordion.vue'
import AGUIAccordionItem from '../../../packages/gui/client/components/accordion/AGUIAccordionItem.vue'
import AGUIDetails from '../../../packages/gui/client/components/AGUIDetails.vue'

let app: App | undefined
afterEach(() => {
  app?.unmount()
  document.body.innerHTML = ''
})

function mount(render: () => ReturnType<typeof h>) {
  const container = document.createElement('div')
  document.body.append(container)
  app = createApp({ render })
  app.mount(container)
  return container
}

describe('aGUI disclosure content', () => {
  it('mounts content on first expansion and preserves drafts through later folds while excluding closed interaction', async () => {
    const expanded = shallowRef<string[]>([])
    const mounted = vi.fn()
    const unmounted = vi.fn()
    const Draft = defineComponent({
      setup() {
        const draft = shallowRef('未保存草稿')
        onMounted(mounted)
        onUnmounted(unmounted)
        return () => h('input', { value: draft.value, onInput: (event: Event) => draft.value = (event.target as HTMLInputElement).value })
      },
    })
    const container = mount(() => h(AGUIAccordion, {
      'type': 'multiple',
      'modelValue': expanded.value,
      'onUpdate:modelValue': value => expanded.value = value as string[],
    }, () => h(AGUIAccordionItem, { item: { title: '基本信息', value: 'basic' } }, () => h(Draft))))
    await nextTick()
    expect(container.querySelector('input')).toBeNull()
    expect(mounted).not.toHaveBeenCalled()
    const trigger = container.querySelector<HTMLButtonElement>('.AccordionTrigger')!
    trigger.click()
    await nextTick()
    expect(mounted).toHaveBeenCalledOnce()
    const input = container.querySelector('input')!
    input.value = '切换折叠后继续编辑'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await nextTick()
    const content = container.querySelector<HTMLElement>('.AccordionContent')!
    for (let count = 0; count < 2; count++) {
      trigger.click()
      await nextTick()
      expect(trigger.getAttribute('aria-expanded')).toBe('false')
      expect(content.style.display).toBe('none')
      expect(content.hasAttribute('inert')).toBe(true)
      expect(content.getAttribute('aria-hidden')).toBe('true')
      expect(unmounted).not.toHaveBeenCalled()
      trigger.click()
      await nextTick()
      expect(trigger.getAttribute('aria-expanded')).toBe('true')
      expect(content.style.display).not.toBe('none')
      expect(content.hasAttribute('inert')).toBe(false)
      expect(content.hasAttribute('aria-hidden')).toBe(false)
      expect(container.querySelector('input')).toBe(input)
      expect(input.value).toBe('切换折叠后继续编辑')
    }
    expect(mounted).toHaveBeenCalledOnce()
  })

  it.each(['single', 'multiple'] as const)('preserves the %s root policy and named slots', async (type) => {
    const expanded = shallowRef<string | string[]>(type === 'multiple' ? ['basic'] : 'basic')
    const container = mount(() => h(AGUIAccordion, {
      'type': type,
      'modelValue': expanded.value,
      'onUpdate:modelValue': value => expanded.value = value,
    }, () => [
      h(AGUIAccordionItem, { item: { title: '基本信息', value: 'basic' } }, {
        title: () => '基本属性 / General',
        icon: () => h('span', { 'data-custom-icon': true }, '◇'),
        trigger: () => h('span', '2 项'),
        content: () => h('p', '保留内容插槽'),
      }),
      h(AGUIAccordionItem, { item: { title: '播放设置', value: 'playback' } }, () => '播放设置内容'),
    ]))
    await nextTick()
    const triggers = [...container.querySelectorAll<HTMLButtonElement>('.AccordionTrigger')]
    expect(triggers[0]!.textContent).toContain('基本属性 / General')
    expect(triggers[0]!.textContent).toContain('2 项')
    expect(triggers[0]!.querySelector('[data-custom-icon]')).not.toBeNull()
    expect(container.querySelector('.AccordionContent')!.textContent).toBe('保留内容插槽')
    expect(container.querySelector('.AccordionContent')!.getAttribute('aria-labelledby')).toBe(triggers[0]!.id)
    triggers[1]!.click()
    await nextTick()
    expect(triggers[1]!.getAttribute('aria-expanded')).toBe('true')
    expect(triggers[0]!.getAttribute('aria-expanded')).toBe(type === 'multiple' ? 'true' : 'false')
  })

  it('keeps native details attributes, toggle delivery and custom summaries', async () => {
    const toggle = vi.fn()
    const container = mount(() => h('div', [
      h(AGUIDetails, { title: '人物信息', open: true, onToggle: toggle, id: 'character-details' }, () => h('input', { value: '未提交值' })),
      h(AGUIDetails, { title: '自定义摘要' }, { summary: () => h('summary', '替代标题'), default: () => h('p', '详情') }),
    ]))
    const details = container.querySelector<HTMLDetailsElement>('#character-details')!
    const input = details.querySelector('input')!
    expect(details.open).toBe(true)
    details.open = false
    details.dispatchEvent(new Event('toggle'))
    await nextTick()
    expect(toggle).toHaveBeenCalled()
    details.open = true
    expect(details.querySelector('input')).toBe(input)
    expect(input.value).toBe('未提交值')
    expect(container.querySelectorAll('summary')[1]!.textContent).toBe('替代标题')
  })
})
