import type { CompileDiagnostic } from '@advjs/core'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'
import RuntimeDiagnosticsOverlay from '../../apps/studio/src/components/RuntimeDiagnosticsOverlay.vue'

const messages = {
  en: {
    runtimeInspector: {
      compileFailed: 'Preview could not compile',
      genericError: 'Preview failed',
      retry: 'Retry preview',
    },
  },
}

function mountOverlay(diagnostics: CompileDiagnostic[], error = '') {
  const i18n = createI18n({ legacy: false, locale: 'en', messages })
  return mount(RuntimeDiagnosticsOverlay, {
    props: { diagnostics, error },
    global: { plugins: [i18n] },
  })
}

describe('runtimeDiagnosticsOverlay', () => {
  it('shows structured compiler codes and source locations', async () => {
    const wrapper = mountOverlay([{
      code: 'ADV_RUNTIME_UNKNOWN_TARGET',
      severity: 'error',
      message: 'Unknown target missing-ending',
      source: { file: 'adv/chapters/one.adv.md', line: 4, column: 2 },
    }])

    expect(wrapper.get('[role="alert"]').text()).toContain('ADV_RUNTIME_UNKNOWN_TARGET')
    expect(wrapper.text()).toContain('adv/chapters/one.adv.md:4:2')
    expect(wrapper.text()).toContain('Unknown target missing-ending')
    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('retry')).toHaveLength(1)
  })

  it('falls back to an unexpected runtime error message', () => {
    const wrapper = mountOverlay([], 'WebGL initialization failed')

    expect(wrapper.text()).toContain('Preview failed')
    expect(wrapper.text()).toContain('WebGL initialization failed')
  })
})
