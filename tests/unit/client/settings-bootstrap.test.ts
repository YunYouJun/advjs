import type { RuntimeProgram } from '@advjs/types'
import { RUNTIME_SCHEMA_VERSION } from '@advjs/types'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { expect, it, vi } from 'vitest'
import { computed, effectScope, nextTick } from 'vue'
import RightTools from '../../../packages/client/components/menu/RightTools.vue'
import { injectionAdvContext } from '../../../packages/client/constants'
import { setupAdvContext } from '../../../packages/client/setup/context'

vi.mock('vue-router', () => ({ useRouter: () => ({ getRoutes: () => [{ path: '/start' }, { path: '/game' }], push: vi.fn() }) }))
vi.mock('vue-i18n', async importOriginal => ({
  ...await importOriginal<typeof import('vue-i18n')>(),
  useI18n: () => ({ t: (key: string) => key }),
}))

it('does not offer saving the real title bootstrap, then enables Save after the game starts', async () => {
  const pinia = createPinia()
  setActivePinia(pinia)
  const scope = effectScope()
  const empty = computed(() => ({}))
  const context = scope.run(() => setupAdvContext({
    config: empty as never,
    gameConfig: empty as never,
    themeConfig: empty,
    pinia,
  }))!
  const wrapper = mount(RightTools, {
    global: {
      plugins: [pinia],
      provide: { [injectionAdvContext as symbol]: context },
      stubs: { AdvButton: { template: '<button><slot /></button>' } },
    },
  })
  const labels = () => wrapper.findAll('button').map(button => button.text())
  try {
    expect(context.store.program?.id).toBe('advjs:bootstrap')
    expect(context.store.current?.kind).toBe('end')
    expect(context.store.state.status).toBe('idle')
    expect(labels()).not.toContain('menu.save_game')
    expect(labels()).toContain('menu.load_game')

    await context.runtime.start()
    await nextTick()
    expect(context.store.state.status).toBe('ended')
    expect(labels()).not.toContain('menu.save_game')

    const program: RuntimeProgram = {
      schemaVersion: RUNTIME_SCHEMA_VERSION,
      id: 'real-game',
      hash: 'real-game-v1',
      entry: { chapterId: 'opening', nodeId: 'line' },
      requiredPlugins: {},
      chapters: {
        opening: {
          id: 'opening',
          entry: 'line',
          order: ['line', 'end'],
          nodes: {
            line: { id: 'line', kind: 'text', data: { text: 'hello' }, next: { chapterId: 'opening', nodeId: 'end' } },
            end: { id: 'end', kind: 'end' },
          },
        },
      },
    }
    context.runtime.install(program)
    await nextTick()
    expect(labels()).not.toContain('menu.save_game')
    await context.runtime.start()
    await nextTick()
    expect(labels()).toContain('menu.save_game')
    await context.runtime.next()
    await nextTick()
    expect(context.store.state.status).toBe('ended')
    expect(labels()).toContain('menu.save_game')
  }
  finally {
    wrapper.unmount()
    context.runtime.dispose()
    scope.stop()
  }
})
