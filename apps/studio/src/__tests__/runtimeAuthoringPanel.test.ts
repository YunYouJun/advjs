import type { ChapterInfo } from '../composables/useProjectContent'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'
import RuntimeAuthoringPanel from '../components/RuntimeAuthoringPanel.vue'

const messages = {
  en: {
    runtimeAuthoring: {
      preview: 'Preview',
      program: 'Program',
      diagnostics: 'Diagnostics',
      compiling: 'Compiling',
      noDiagnostics: 'No diagnostics',
      noProgram: 'No program',
      sourceUnknown: 'Unknown source',
    },
  },
}

function chapter(file: string, content: string): ChapterInfo {
  return { file, content, name: file, preview: '' }
}

function mountPanel(chapters: ChapterInfo[], file: string, content: string) {
  const i18n = createI18n({ legacy: false, locale: 'en', messages })
  return mount(RuntimeAuthoringPanel, {
    props: { chapters, file, content, settings: {} },
    global: {
      plugins: [i18n],
      stubs: { AdvPreviewPanel: true },
    },
  })
}

afterEach(() => vi.useRealTimers())

describe('runtimeAuthoringPanel', () => {
  it('shows live diagnostics and emits source selection', async () => {
    vi.useFakeTimers()
    const file = 'adv/chapters/one.adv.md'
    const wrapper = mountPanel([
      chapter(file, '# One {#start}'),
      chapter('adv/chapters/two.adv.md', '# Two {#arrival}'),
    ], file, '# One {#start}\n\n- [Broken](two#missing)')

    await vi.advanceTimersByTimeAsync(301)
    await flushPromises()
    await wrapper.get('[data-authoring-tab="diagnostics"]').trigger('click')

    expect(wrapper.text()).toContain('ADV_RUNTIME_UNKNOWN_TARGET')
    await wrapper.get('[data-runtime-diagnostic]').trigger('click')
    expect(wrapper.emitted('selectSource')?.[0]).toEqual([file, 3, 1])
  })

  it('groups compiled program rows by chapter', async () => {
    vi.useFakeTimers()
    const file = 'adv/chapters/one.adv.md'
    const wrapper = mountPanel([
      chapter(file, '# One {#start}\n\nHello.'),
    ], file, '# One {#start}\n\nHello.')

    await vi.advanceTimersByTimeAsync(301)
    await flushPromises()
    await wrapper.get('[data-authoring-tab="program"]').trigger('click')

    expect(wrapper.text()).toContain('one')
    expect(wrapper.text()).toContain('start')
    expect(wrapper.text()).toContain('anchor')
  })
})
