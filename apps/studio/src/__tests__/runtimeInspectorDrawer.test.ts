import type { RuntimeSnapshot } from '@advjs/types'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'
import RuntimeInspectorDrawer from '../components/RuntimeInspectorDrawer.vue'

const snapshot: RuntimeSnapshot = {
  schemaVersion: 1,
  program: { id: 'preview', hash: 'preview-v1' },
  state: {
    status: 'playing',
    cursor: { chapterId: 'one', nodeId: 'line' },
    variables: {},
    stage: { background: '', bgm: '', cg: '', tachies: {} },
    choices: [],
    visited: [],
  },
  checkpoints: [],
  createdAt: 1,
}

function mountDrawer() {
  const i18n = createI18n({
    legacy: false,
    locale: 'en',
    messages: {
      en: {
        runtimeInspector: {
          title: 'Runtime inspector',
          close: 'Close',
          copy: 'Copy',
          download: 'Download',
          copied: 'Copied',
          emptyTrace: 'Empty',
          reviewNotice: 'Review',
          previewVariables: 'Preview variables',
          applyVariables: 'Apply variables',
        },
      },
    },
  })
  return mount(RuntimeInspectorDrawer, {
    props: {
      open: true,
      snapshot,
      previewVariables: { route: 'day' },
    },
    global: {
      plugins: [i18n],
      stubs: {
        Teleport: true,
        RuntimeInspectorPanel: true,
      },
    },
  })
}

describe('runtime inspector drawer preview variables', () => {
  it('validates and publishes temporary authoring variables', async () => {
    const wrapper = mountDrawer()
    const textarea = wrapper.get('textarea')
    expect(textarea.element.value).toContain('"route": "day"')

    await textarea.setValue('{"route":"night","score":2}')
    await wrapper.get('.runtime-inspector-drawer__variables button').trigger('click')
    expect(wrapper.emitted('updatePreviewVariables')?.[0]).toEqual([{ route: 'night', score: 2 }])

    await textarea.setValue('[]')
    await wrapper.get('.runtime-inspector-drawer__variables button').trigger('click')
    expect(wrapper.emitted('updatePreviewVariables')).toHaveLength(1)
    expect(wrapper.text()).toContain('Preview variables must be a JSON object')
  })
})
