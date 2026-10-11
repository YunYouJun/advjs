import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, expect, it, vi } from 'vitest'
import GamePage from '../../../packages/client/pages/game.vue'

const { game, adv, route } = vi.hoisted(() => ({
  game: { pendingRestore: undefined as unknown },
  adv: {
    init: vi.fn(),
    runtime: { restore: vi.fn(), start: vi.fn(), go: vi.fn() },
    store: { program: { chapters: { opening: { entry: 'first' } } } },
  },
  route: { query: {} as Record<string, string> },
}))
vi.mock('../../../packages/client/pages/game.vue?vue&type=route&index=0&lang.yaml', () => ({ default: () => {} }))
vi.mock('@advjs/client', () => ({ useAdvContext: () => ({ $adv: adv }), useGameStore: () => game }))
vi.mock('vue-router', () => ({ useRoute: () => route }))

beforeEach(() => {
  vi.resetAllMocks()
  game.pendingRestore = undefined
  route.query = {}
})

function renderPage(onError = vi.fn()) {
  return mount(GamePage, { global: { stubs: { AdvGame: true }, config: { errorHandler: onError } } })
}

it('waits for initialization and restores before considering explicit chapter targets', async () => {
  let initialize!: () => void
  adv.init.mockImplementation(() => new Promise<void>((resolve) => {
    initialize = resolve
  }))
  const snapshot = { saved: true }
  game.pendingRestore = snapshot
  route.query = { chapter: 'opening', node: 'different' }
  const wrapper = renderPage()
  expect(adv.runtime.restore).not.toHaveBeenCalled()
  expect(game.pendingRestore).toBe(snapshot)
  initialize()
  await flushPromises()
  expect(adv.runtime.restore).toHaveBeenCalledWith(snapshot)
  expect(game.pendingRestore).toBeUndefined()
  expect(adv.runtime.start).not.toHaveBeenCalled()
  expect(adv.runtime.go).not.toHaveBeenCalled()
  wrapper.unmount()
})

it.each(['init', 'restore'] as const)('retains the snapshot when %s fails and allows a retry', async (stage) => {
  const snapshot = { saved: true }
  const error = new Error('failed load')
  game.pendingRestore = snapshot
  if (stage === 'init') {
    adv.init.mockRejectedValueOnce(error)
  }
  else {
    adv.runtime.restore.mockImplementationOnce(() => {
      throw error
    })
  }
  const onError = vi.fn()
  const first = renderPage(onError)
  await flushPromises()
  expect(onError.mock.calls[0][0]).toBe(error)
  expect(game.pendingRestore).toBe(snapshot)
  expect(adv.runtime.start).not.toHaveBeenCalled()
  first.unmount()
  const retry = renderPage()
  await flushPromises()
  expect(adv.runtime.restore).toHaveBeenLastCalledWith(snapshot)
  expect(game.pendingRestore).toBeUndefined()
  retry.unmount()
})

it('does not restore into an unmounted page after slow initialization', async () => {
  let initialize!: () => void
  adv.init.mockImplementation(() => new Promise<void>((resolve) => {
    initialize = resolve
  }))
  const snapshot = { saved: true }
  game.pendingRestore = snapshot
  const wrapper = renderPage()
  wrapper.unmount()
  initialize()
  await flushPromises()
  expect(adv.runtime.restore).not.toHaveBeenCalled()
  expect(adv.runtime.start).not.toHaveBeenCalled()
  expect(game.pendingRestore).toBe(snapshot)
})

it('preserves chapter targeting and normal fresh starts without a pending restore', async () => {
  route.query = { chapter: 'opening' }
  const target = renderPage()
  await flushPromises()
  expect(adv.runtime.go).toHaveBeenCalledWith({ chapterId: 'opening', nodeId: 'first' })
  target.unmount()
  route.query = {}
  const fresh = renderPage()
  await flushPromises()
  expect(adv.runtime.start).toHaveBeenCalledOnce()
  fresh.unmount()
})
