import { mount } from '@vue/test-utils'
import { beforeEach, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import { useAdvStartActions } from '../../../packages/client/composables/useAdvStartActions'

const { game, router, app, unlock } = vi.hoisted(() => ({
  game: { pendingRestore: undefined as unknown },
  router: { push: vi.fn() },
  app: { menus: { settings: false }, toggleShowLoadMenu: vi.fn() },
  unlock: vi.fn(async () => true),
}))
vi.mock('../../../packages/client/stores', () => ({ useAppStore: () => app, useGameStore: () => game }))
vi.mock('vue-router', () => ({ useRouter: () => router }))
vi.mock('../../../packages/client/composables/useAdvContext', () => ({ useAdvContext: () => ({ $adv: { $audio: { unlock } } }) }))

beforeEach(() => vi.resetAllMocks())

it('an explicit new start clears a failed queued restore and preserves chapter/node targets', async () => {
  game.pendingRestore = { saved: true }
  let actions!: ReturnType<typeof useAdvStartActions>
  const wrapper = mount(defineComponent({
    setup() { actions = useAdvStartActions() },
    template: '<div />',
  }))
  await actions.startGame({ chapterId: 'opening', nodeId: 'line-2' })
  expect(game.pendingRestore).toBeUndefined()
  expect(unlock).toHaveBeenCalledOnce()
  expect(router.push).toHaveBeenCalledWith({ path: '/game', query: { chapter: 'opening', node: 'line-2' } })
  game.pendingRestore = { saved: true }
  await actions.startGame()
  expect(game.pendingRestore).toBeUndefined()
  expect(router.push).toHaveBeenLastCalledWith({ path: '/game' })
  wrapper.unmount()
})
