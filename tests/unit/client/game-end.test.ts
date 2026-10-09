import type { ThemeConfig } from '@advjs/types'
import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { h, nextTick, reactive, shallowRef } from 'vue'
import AdvEnd from '../../../packages/client/components/adv/AdvEnd.vue'
import AdvGame from '../../../packages/client/components/game/AdvGame.vue'
import AdvContainer from '../../../packages/client/components/internals/AdvContainer.vue'

const app = { isHorizontal: true, rotation: 0, transition: false, showUi: true, menus: {} }
const adv = {
  config: shallowRef({ viewportFit: 'responsive' }),
  themeConfig: shallowRef<ThemeConfig>({}),
  store: reactive({ current: undefined, state: { status: 'idle', stage: {} } }),
  resources: { tachiesMapRef: shallowRef({}) },
}

vi.mock('@advjs/client', () => ({ useAppStore: () => app }))
vi.mock('../../../packages/client/stores', () => ({ useAppStore: () => app }))
vi.mock('../../../packages/client/composables', () => ({ useBeforeUnload: vi.fn() }))
vi.mock('../../../packages/client/composables/useAdvContext', () => ({ useAdvContext: () => ({ $adv: adv }) }))
vi.mock('../../../packages/client/composables/useAdvMotionPreference', () => ({ useAdvMotionPreference: () => shallowRef('none') }))

const wrappers: ReturnType<typeof mount>[] = []
afterEach(() => {
  wrappers.splice(0).forEach(wrapper => wrapper.unmount())
  adv.store.state.status = 'idle'
  adv.themeConfig.value = {}
})

function renderEnd(theme = shallowRef<ThemeConfig>({}), text = shallowRef<string>()) {
  const wrapper = mount({
    render: () => h(AdvContainer, { theme: theme.value, width: 320 }, () => h(AdvEnd, { text: text.value })),
  })
  wrappers.push(wrapper)
  return wrapper
}

describe('customizable game ending', () => {
  it('keeps the default label and reacts to local theme changes and removal', async () => {
    const theme = shallowRef<ThemeConfig>({})
    const wrapper = renderEnd(theme)
    expect(wrapper.get('[role="status"]').text()).toBe('- END -')

    theme.value = { ui: { end: { text: '故事完\n感谢游玩' } } }
    await nextTick()
    expect(wrapper.get('[role="status"]').text()).toBe('故事完\n感谢游玩')

    theme.value = { ui: { end: { text: '' } } }
    await nextTick()
    expect(wrapper.find('.adv-end').exists()).toBe(true)
    expect(wrapper.find('.adv-end__text').exists()).toBe(false)

    theme.value = {}
    await nextTick()
    expect(wrapper.get('[role="status"]').text()).toBe('- END -')
  })

  it('applies ending tokens only to the configured game and removes overrides', async () => {
    const tokens = {
      '--adv-end-bg': '#18202a',
      '--adv-end-color': '#efce8d',
      '--adv-end-font-family': 'serif',
      '--adv-end-font-size': '3rem',
      '--adv-end-font-weight': '500',
      '--adv-end-letter-spacing': '0.2em',
      '--adv-end-text-shadow': '0 2px 8px #000',
      '--adv-end-padding': '2rem',
      '--adv-end-align-items': 'flex-end',
      '--adv-end-justify-content': 'flex-start',
    } as const
    const theme = shallowRef<ThemeConfig>({ ui: { end: { text: '完' }, tokens } })
    const first = renderEnd(theme)
    const second = renderEnd()
    const firstRoot = first.get('[data-adv-ui="game"]').element as HTMLElement
    const secondRoot = second.get('[data-adv-ui="game"]').element as HTMLElement
    for (const [name, value] of Object.entries(tokens)) {
      expect(firstRoot.style.getPropertyValue(name)).toBe(value)
      expect(secondRoot.style.getPropertyValue(name)).toBe('')
      expect(document.documentElement.style.getPropertyValue(name)).toBe('')
    }
    expect(first.get('.adv-end__text').text()).toBe('完')
    expect(second.get('.adv-end__text').text()).toBe('- END -')

    theme.value = {}
    await nextTick()
    for (const name of Object.keys(tokens))
      expect(firstRoot.style.getPropertyValue(name)).toBe('')
  })

  it('renders plain text safely and lets a prop override theme content', async () => {
    const theme = shallowRef<ThemeConfig>({ ui: { end: { text: '<img src=x onerror=alert(1)>' } } })
    const text = shallowRef<string>()
    const wrapper = renderEnd(theme, text)
    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.get('.adv-end__text').text()).toBe('<img src=x onerror=alert(1)>')
    text.value = 'To be continued'
    await nextTick()
    expect(wrapper.get('.adv-end__text').text()).toBe('To be continued')
    text.value = undefined
    await nextTick()
    expect(wrapper.get('.adv-end__text').text()).toBe('<img src=x onerror=alert(1)>')
    theme.value = { ui: { end: { text: 123 } } } as unknown as ThemeConfig
    await nextTick()
    expect(wrapper.get('.adv-end__text').text()).toBe('- END -')
  })

  it('supports custom content and actions within the default ending surface', async () => {
    const restart = vi.fn()
    const wrapper = mount(AdvEnd, {
      props: { text: '感谢游玩' },
      attrs: { class: 'custom-end', style: { textAlign: 'left' } },
      slots: {
        default: ({ text }: { text: string }) => h('button', { type: 'button', onClick: restart }, text),
      },
    })
    wrappers.push(wrapper)
    expect(wrapper.classes()).toContain('custom-end')
    expect((wrapper.element as HTMLElement).style.textAlign).toBe('left')
    expect(wrapper.find('.adv-end__text').exists()).toBe(false)
    await wrapper.get('button').trigger('click')
    expect(restart).toHaveBeenCalledOnce()
    expect(wrapper.get('button').text()).toBe('感谢游玩')
  })

  it('shows the game end slot only after ending and falls back to AdvEnd', async () => {
    const global = {
      components: { AdvContainer, AdvEnd },
      stubs: Object.fromEntries([
        'AdvScene',
        'AdvPixiCanvas',
        'AdvCg',
        'AdvTachieBox',
        'AdvBlack',
        'BaseLayer',
        'AdvDialogBox',
        'AdvChoice',
        'DialogControls',
        'AdvActivity',
        'AdvGameModals',
        'AdvGameUI',
      ].map(name => [name, true])),
    }
    const wrapper = mount(AdvGame, {
      global,
      slots: { end: () => h('section', { class: 'custom-ending' }, '自定义片尾') },
    })
    const fallback = mount(AdvGame, { global })
    wrappers.push(wrapper, fallback)
    expect(wrapper.find('.custom-ending').exists()).toBe(false)
    expect(fallback.find('.adv-end').exists()).toBe(false)

    adv.themeConfig.value = { ui: { end: { text: '完' } } }
    adv.store.state.status = 'ended'
    await nextTick()
    expect(wrapper.get('.custom-ending').text()).toBe('自定义片尾')
    expect(wrapper.find('.adv-end').exists()).toBe(false)
    expect(fallback.get('.adv-end__text').text()).toBe('完')

    adv.store.state.status = 'idle'
    await nextTick()
    expect(wrapper.find('.custom-ending').exists()).toBe(false)
    expect(fallback.find('.adv-end').exists()).toBe(false)
  })
})
