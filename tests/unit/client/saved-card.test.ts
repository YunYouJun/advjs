import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, expect, it, vi } from 'vitest'
import GamePage from '../../../packages/client/pages/game.vue'
import SavedCard from '../../../themes/theme-default/components/save/SavedCard.vue'

const { app, game, route, router, snapshot, restore, init, start } = vi.hoisted(() => ({
  app: { showLoadMenu: true, toggleShowLoadMenu() { this.showLoadMenu = !this.showLoadMenu } },
  game: { read: vi.fn(), pendingRestore: undefined as unknown },
  route: { path: '/play', query: {} },
  router: { push: vi.fn() },
  snapshot: { state: { cursor: { chapterId: 'chapter-1', nodeId: 'line-1' } } },
  restore: vi.fn(),
  init: vi.fn(),
  start: vi.fn(),
}))

vi.mock('../../../packages/client/pages/game.vue?vue&type=route&index=0&lang.yaml', () => ({ default: () => {} }))
vi.mock('@advjs/client', () => ({
  injectionAdvPlayer: '$advjs-player',
  createManualSaveSlot: (index: number) => ({ kind: 'manual', index }),
  screenshotGameThumb: vi.fn(),
  useAppStore: () => app,
  useGameStore: () => game,
  useAdvContext: () => ({ $adv: { init, runtime: { restore, start }, store: {} } }),
}))
vi.mock('@advjs/theme-default', () => ({ assets: { images: { defaultBgUrl: '' } } }))
vi.mock('vue-router', () => ({ useRoute: () => route, useRouter: () => router }))
vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))

beforeEach(() => {
  vi.resetAllMocks()
  app.showLoadMenu = true
  game.pendingRestore = undefined
  route.path = '/play'
  game.read.mockResolvedValue({ snapshot, meta: {}, updatedAt: 1 })
})

it.each(['/play', '/'])('loads in the embedded player at %s without leaving its host', async (path) => {
  route.path = path
  const wrapper = mount(SavedCard, { props: { type: 'load' }, global: { provide: { '$advjs-player': true } } })
  await flushPromises()
  await wrapper.get('button[aria-label="save.load_from_slot"]').trigger('click')
  await flushPromises()

  expect(restore).toHaveBeenCalledWith(snapshot)
  expect(app.showLoadMenu).toBe(false)
  expect(router.push).not.toHaveBeenCalled()
  wrapper.unmount()
})

it.each(['/load', '/start'])('queues standalone restores at %s until the game has initialized', async (path) => {
  app.showLoadMenu = path === '/start'
  route.path = path
  const wrapper = mount(SavedCard, { props: { type: 'load' } })
  await flushPromises()
  await wrapper.get('button[aria-label="save.load_from_slot"]').trigger('click')
  await flushPromises()

  expect(restore).not.toHaveBeenCalled()
  expect(game.pendingRestore).toBe(snapshot)
  expect(app.showLoadMenu).toBe(false)
  expect(router.push).toHaveBeenCalledWith('/game')
  wrapper.unmount()
})

it('keeps empty load slots disabled', async () => {
  game.read.mockResolvedValue(undefined)
  const wrapper = mount(SavedCard, { props: { type: 'load' } })
  await flushPromises()
  expect(wrapper.get('button[aria-label="save.load_from_slot"]').attributes('disabled')).toBeDefined()
  expect(restore).not.toHaveBeenCalled()
  wrapper.unmount()
})

it('clears an aborted navigation without closing the load menu or restoring', async () => {
  route.path = '/start'
  router.push.mockResolvedValueOnce({ type: 4 })
  const wrapper = mount(SavedCard, { props: { type: 'load' } })
  await flushPromises()
  await wrapper.get('button[aria-label="save.load_from_slot"]').trigger('click')
  await flushPromises()
  expect(game.pendingRestore).toBeUndefined()
  expect(app.showLoadMenu).toBe(true)
  expect(restore).not.toHaveBeenCalled()
  expect(wrapper.attributes('data-busy')).toBe('false')
  wrapper.unmount()
})

it.each(['navigation', 'restore'] as const)('allows retry after a failed %s', async (stage) => {
  route.path = stage === 'navigation' ? '/start' : '/game'
  const error = new Error('load failed')
  if (stage === 'navigation') {
    router.push.mockRejectedValueOnce(error)
  }
  else {
    restore.mockImplementationOnce(() => {
      throw error
    })
  }
  const onError = vi.fn()
  const wrapper = mount(SavedCard, { props: { type: 'load' }, global: { config: { errorHandler: onError } } })
  await flushPromises()
  const load = wrapper.get('button[aria-label="save.load_from_slot"]')
  await load.trigger('click')
  await flushPromises()
  expect(onError.mock.calls[0][0]).toBe(error)
  expect(app.showLoadMenu).toBe(true)
  expect(game.pendingRestore).toBeUndefined()
  expect(wrapper.attributes('data-busy')).toBe('false')
  await load.trigger('click')
  await flushPromises()
  expect(app.showLoadMenu).toBe(false)
  expect(stage === 'navigation' ? router.push : restore).toHaveBeenCalledTimes(2)
  wrapper.unmount()
})

it('does not erase a newer restore when an older navigation fails', async () => {
  route.path = '/start'
  let reject!: (error: Error) => void
  router.push.mockImplementationOnce(() => new Promise((_, rejectPromise) => {
    reject = rejectPromise
  }))
  const wrapper = mount(SavedCard, { props: { type: 'load' }, global: { config: { errorHandler: vi.fn() } } })
  await flushPromises()
  await wrapper.get('button[aria-label="save.load_from_slot"]').trigger('click')
  const newer = { saved: 'newer' }
  game.pendingRestore = newer
  reject(new Error('old navigation'))
  await flushPromises()
  expect(game.pendingRestore).toBe(newer)
  wrapper.unmount()
})

it('consumes a retained failed load after an in-place retry so remount does not restore it again', async () => {
  route.path = '/game'
  game.pendingRestore = { saved: 'old failed request' }
  const wrapper = mount(SavedCard, { props: { type: 'load' } })
  await flushPromises()
  await wrapper.get('button[aria-label="save.load_from_slot"]').trigger('click')
  await flushPromises()
  expect(restore).toHaveBeenCalledWith(snapshot)
  expect(game.pendingRestore).toBeUndefined()
  wrapper.unmount()

  const remounted = mount(GamePage, { global: { stubs: { AdvGame: true } } })
  await flushPromises()
  expect(init).toHaveBeenCalledOnce()
  expect(start).toHaveBeenCalledOnce()
  expect(restore).toHaveBeenCalledOnce()
  remounted.unmount()
})

it('keeps the pending load when an in-place retry fails', async () => {
  route.path = '/game'
  const pending = { saved: 'failed request' }
  game.pendingRestore = pending
  restore.mockImplementationOnce(() => {
    throw new Error('still invalid')
  })
  const wrapper = mount(SavedCard, { props: { type: 'load' }, global: { config: { errorHandler: vi.fn() } } })
  await flushPromises()
  await wrapper.get('button[aria-label="save.load_from_slot"]').trigger('click')
  await flushPromises()
  expect(game.pendingRestore).toBe(pending)
  expect(app.showLoadMenu).toBe(true)
  wrapper.unmount()
})

it('does not erase a newer queued request created while restoring in place', async () => {
  route.path = '/game'
  game.pendingRestore = { saved: 'old request' }
  const newer = { saved: 'new request' }
  restore.mockImplementationOnce(() => {
    game.pendingRestore = newer
  })
  const wrapper = mount(SavedCard, { props: { type: 'load' } })
  await flushPromises()
  await wrapper.get('button[aria-label="save.load_from_slot"]').trigger('click')
  await flushPromises()
  expect(game.pendingRestore).toBe(newer)
  wrapper.unmount()
})
