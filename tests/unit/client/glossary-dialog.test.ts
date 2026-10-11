import type { RuntimeNode } from '@advjs/types'
import { mount } from '@vue/test-utils'
import { afterEach, expect, it, vi } from 'vitest'
import { defineComponent, h, reactive, shallowRef } from 'vue'
import { createI18n } from 'vue-i18n'
import PrintWords from '../../../packages/client/components/animation/PrintWords.vue'
import AdvDialogBox from '../../../packages/client/components/internals/dialog/AdvDialogBox.vue'
import AdvGlossaryModal from '../../../packages/client/components/ui/AdvGlossaryModal.vue'
import { glossaryReferences } from '../../../packages/client/utils/glossary'

const app = reactive<{ showGlossary: boolean, glossaryTerm?: { identifier: string, definition: string } }>({ showGlossary: false })
const current = shallowRef<RuntimeNode>()
const next = vi.fn()
const adv = {
  store: { get current() { return current.value } },
  runtime: { next },
  config: shallowRef({ showCharacterAvatar: false, cdn: { enable: false } }),
  gameConfig: shallowRef({ characters: [] }),
  $auto: { notifyPrintDone: vi.fn() },
}
const settings = { storage: { speech: false, text: { curSpeed: 'normal', curFontSize: 'normal', curDisplayMode: 'type' } } }
vi.mock('@advjs/client', () => ({ speak: vi.fn(), useAdvContext: () => ({ $adv: adv }), useSettingsStore: () => settings, useAppStore: () => app }))
vi.mock('../../../packages/client/composables/useAdvMotionPreference', () => ({ useAdvMotionPreference: () => shallowRef('none') }))

let wrapper: ReturnType<typeof mount>
afterEach(() => {
  wrapper?.unmount()
  document.body.innerHTML = ''
  vi.clearAllMocks()
})

function mountDialogue() {
  current.value = { id: 'line', kind: 'dialog', data: {
    text: '中文[星]再[星]',
    glossary: [
      { identifier: '星', label: '[星]', definition: '中文解释 <img src=x onerror=alert(1)>', start: 2, end: 5 },
      { identifier: '星', label: '[星]', definition: '中文解释 <img src=x onerror=alert(1)>', start: 6, end: 9 },
    ],
  } }
  wrapper = mount(defineComponent({ setup: () => () => h('div', [h(AdvDialogBox, { node: current.value! }), h(AdvGlossaryModal)]) }), {
    attachTo: document.body,
    global: {
      plugins: [createI18n({ legacy: false, locale: 'en', messages: { en: { button: { close: 'Close' }, ui: { dialog: 'Dialog' } } } })],
      components: {
        PrintWords,
        AdvIconButton: { props: ['title'], setup: (props, { slots }) => () => h('button', { 'type': 'button', 'aria-label': props.title }, slots.default?.()) },
      },
    },
  })
  return wrapper
}

it('reveals focusable references, dismisses on Escape, restores focus and reopens without advancing', async () => {
  mountDialogue()
  const markers = wrapper.findAll('.adv-glossary-reference')
  expect(markers).toHaveLength(2)
  expect(markers[0].attributes('tabindex')).toBe('-1')
  await wrapper.get('.adv-dialog-box').trigger('click')
  expect(markers[0].attributes('tabindex')).toBe('0')
  for (const marker of markers) {
    ;(marker.element as HTMLElement).focus()
    await marker.trigger('click')
    await vi.waitFor(() => expect(document.querySelector('[role=dialog]')).not.toBeNull())
    expect(app.showGlossary).toBe(true)
    expect(next).not.toHaveBeenCalled()
    expect(document.querySelector('.adv-glossary-definition')?.textContent).toContain('<img src=x')
    expect(document.querySelector('.adv-glossary-definition img')).toBeNull()
    await vi.waitFor(() => expect(document.querySelector('[role=dialog]')?.contains(document.activeElement)).toBe(true))
    document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await vi.waitFor(() => expect(document.querySelector('[role=dialog]')).toBeNull())
    expect(app.showGlossary).toBe(false)
    await vi.waitFor(() => expect(document.activeElement).toBe(marker.element))
    expect(next).not.toHaveBeenCalled()
  }
})

it('closes on button dismissal, replacement node/save restoration, and unmount', async () => {
  mountDialogue()
  await wrapper.get('.adv-dialog-box').trigger('click')
  await wrapper.findAll('.adv-glossary-reference')[0].trigger('click')
  await vi.waitFor(() => expect(document.querySelector('[aria-label=Close]')).not.toBeNull())
  ;(document.querySelector('[aria-label=Close]') as HTMLElement).click()
  await vi.waitFor(() => expect(app.showGlossary).toBe(false))
  await wrapper.findAll('.adv-glossary-reference')[0].trigger('click')
  current.value = { ...current.value!, data: { text: '下一句' } }
  await wrapper.vm.$nextTick()
  expect(app.showGlossary).toBe(false)
  expect(wrapper.findAll('.adv-glossary-reference')).toHaveLength(0)
  expect(document.querySelector('[role=dialog]')).toBeNull()
  expect(next).not.toHaveBeenCalled()
  wrapper.unmount()
  expect(app.showGlossary).toBe(false)
})

it('rejects malformed/overlapping runtime reference spans', () => {
  const good = { identifier: 'x', label: '[x]', definition: 'safe', start: 0, end: 3 }
  expect(glossaryReferences([good, good, { ...good, start: -1 }, { ...good, end: 100 }, { ...good, label: '<b>' }], '[x]')).toEqual([good])
  expect(glossaryReferences('not an array', '[x]')).toEqual([])
})
