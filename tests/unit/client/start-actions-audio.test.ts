import type { App } from 'vue'
import type { Router } from 'vue-router'
import type { AdvStartTarget } from '../../../packages/client/composables/useAdvStartActions'
import { createPinia } from 'pinia'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp, h } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { useAdvStartActions } from '../../../packages/client/composables/useAdvStartActions'
import { injectionAdvContext } from '../../../packages/client/constants'
import { useAppStore } from '../../../packages/client/stores/app'

const apps: App[] = []

afterEach(() => {
  apps.splice(0).forEach(app => app.unmount())
  document.body.innerHTML = ''
  localStorage.clear()
  vi.restoreAllMocks()
})

async function mountStart(unlock: () => Promise<boolean>, target?: AdvStartTarget) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: ['/start', '/game', '/flow-chart', '/help'].map(path => ({ path, component: { render: () => h('div') } })),
  })
  await router.push('/start')
  await router.isReady()
  const push = vi.spyOn(router, 'push')
  const pinia = createPinia()
  let actions!: ReturnType<typeof useAdvStartActions>
  let navigation: ReturnType<Router['push']> | undefined
  const app = createApp({
    setup() {
      actions = useAdvStartActions()
      return () => h('button', {
        type: 'button',
        onClick: () => {
          navigation = actions.startGame(target)
        },
      }, 'Start')
    },
  })
  app.provide(injectionAdvContext, { $audio: { unlock } } as never)
  app.use(pinia)
  app.use(router)
  const container = document.createElement('div')
  document.body.append(container)
  app.mount(container)
  apps.push(app)
  return { router, push, actions, appStore: useAppStore(pinia), button: container.querySelector('button')!, navigation: () => navigation }
}

describe('shared start action audio gesture', () => {
  it.each([
    { target: undefined, query: {} },
    { target: { chapterId: 'opening' }, query: { chapter: 'opening' } },
    { target: { chapterId: 'chapter two', nodeId: 'first-line' }, query: { chapter: 'chapter two', node: 'first-line' } },
  ])('starts unlock synchronously before navigating with target $target while unlock is pending', async ({ target, query }) => {
    const deferred = Promise.withResolvers<boolean>()
    const unlock = vi.fn(() => deferred.promise)
    const { button, router, push, navigation } = await mountStart(unlock, target)

    button.click()

    // Assertions run in the same turn as the native click, before any microtask.
    expect(unlock).toHaveBeenCalledOnce()
    expect(push).toHaveBeenCalledExactlyOnceWith({ path: '/game', ...(target ? { query } : {}) })
    expect(unlock.mock.invocationCallOrder[0]).toBeLessThan(push.mock.invocationCallOrder[0])
    expect(navigation()).toBe(push.mock.results[0].value)
    await navigation()
    expect(router.currentRoute.value.path).toBe('/game')
    expect(router.currentRoute.value.query).toEqual(query)
    deferred.resolve(true)
    await deferred.promise
  })

  it('handles denied unlock without rejecting navigation or leaving an unhandled rejection', async () => {
    const deferred = Promise.withResolvers<boolean>()
    const unlock = vi.fn(() => deferred.promise)
    const { button, router, navigation } = await mountStart(unlock)
    button.click()
    deferred.reject(new DOMException('Audio requires a user gesture', 'NotAllowedError'))
    await expect(navigation()).resolves.toBeUndefined()
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(router.currentRoute.value.path).toBe('/game')
  })

  it('still navigates if a host throws synchronously while accessing audio', async () => {
    const unlock = vi.fn((): Promise<boolean> => {
      throw new Error('Audio context unavailable')
    })
    const { button, router, navigation } = await mountStart(unlock)
    button.click()
    await expect(navigation()).resolves.toBeUndefined()
    expect(router.currentRoute.value.path).toBe('/game')
  })

  it('preserves the other shared menu actions without unlocking audio', async () => {
    const unlock = vi.fn(async () => true)
    const { actions, router, appStore } = await mountStart(unlock)
    actions.openLoadGame()
    expect(appStore.showLoadMenu).toBe(true)
    actions.openSettings()
    expect(appStore.menus.settings).toBe(true)
    await actions.openFlowChart()
    expect(router.currentRoute.value.path).toBe('/flow-chart')
    await actions.openHelp()
    expect(router.currentRoute.value.path).toBe('/help')
    expect(unlock).not.toHaveBeenCalled()
  })
})
