import type { AdvProjectDiagnostic } from '@advjs/types'
import { expect, it } from 'vitest'
import { createApp, h, nextTick, shallowRef } from 'vue'
import ProjectFlowDiagnostics from '../../../editor/core/app/components/system/flow/ProjectFlowDiagnostics.vue'

it('bounds large diagnostic rendering while preserving exact source actions and resetting a refreshed page', async () => {
  const diagnostics = shallowRef<AdvProjectDiagnostic[]>(Array.from({ length: 1000 }, (_, index) => ({
    code: `MISSING_TARGET_${index}`,
    severity: 'error',
    message: `Missing target ${index}`,
    path: 'adv/chapters/long.adv.md',
    line: index + 1,
    column: 3,
  })))
  let opened: AdvProjectDiagnostic | undefined
  const container = document.createElement('div')
  document.body.append(container)
  const app = createApp(() => h(ProjectFlowDiagnostics, {
    diagnostics: diagnostics.value,
    zh: true,
    busy: false,
    onOpen: (item: AdvProjectDiagnostic) => {
      opened = item
    },
  }))
  const button = (name: string) => container.querySelector<HTMLButtonElement>(`button[title="${name}"]`)!
  app.mount(container)
  try {
    expect(container.querySelectorAll('.diagnostic')).toHaveLength(50)
    button('下一组诊断').click()
    await nextTick()
    expect(container.querySelectorAll('.diagnostic')).toHaveLength(50)
    container.querySelector<HTMLButtonElement>('[data-flow-diagnostic="MISSING_TARGET_50"]')!.click()
    expect(opened).toBe(diagnostics.value[50])
    expect(opened).toMatchObject({ path: 'adv/chapters/long.adv.md', line: 51, column: 3 })
    diagnostics.value = [diagnostics.value[999]!]
    await nextTick()
    expect(container.querySelectorAll('.diagnostic')).toHaveLength(1)
    expect(container.querySelector('[data-flow-diagnostic="MISSING_TARGET_999"]')).not.toBeNull()
    expect(container.querySelector('.diagnostic-pagination')).toBeNull()
  }
  finally {
    app.unmount()
    container.remove()
  }
})
