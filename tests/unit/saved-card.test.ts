import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, expect, it, vi } from 'vitest'
import SavedCard from '../../themes/theme-default/components/save/SavedCard.vue'

const { app, game, route, router, snapshot, restore } = vi.hoisted(() => ({
  app: { showLoadMenu: true },
  game: { read: vi.fn() },
  route: { path: '/play' },
  router: { push: vi.fn() },
  snapshot: { state: { cursor: { chapterId: 'chapter-1', nodeId: 'line-1' } } },
  restore: vi.fn(),
}))

vi.mock('@advjs/client', () => ({
  createManualSaveSlot: (index: number) => ({ kind: 'manual', index }),
  screenshotGameThumb: vi.fn(),
  useAppStore: () => app,
  useGameStore: () => game,
  useAdvContext: () => ({ $adv: { runtime: { restore }, store: {} } }),
}))
vi.mock('@advjs/theme-default', () => ({ assets: { images: { defaultBgUrl: '' } } }))
vi.mock('vue-router', () => ({ useRoute: () => route, useRouter: () => router }))
vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))

beforeEach(() => {
  vi.clearAllMocks()
  app.showLoadMenu = true
  route.path = '/play'
  game.read.mockResolvedValue({ snapshot, meta: {}, updatedAt: 1 })
})

it.each(['/play', '/'])('loads in the embedded player at %s without leaving its host', async (path) => {
  route.path = path
  const wrapper = mount(SavedCard, { props: { type: 'load' } })
  await flushPromises()
  await wrapper.get('button[aria-label="save.load_from_slot"]').trigger('click')
  await flushPromises()

  expect(restore).toHaveBeenCalledWith(snapshot)
  expect(app.showLoadMenu).toBe(false)
  expect(router.push).not.toHaveBeenCalled()
  wrapper.unmount()
})

it('returns a standalone load page to the game without opening the modal', async () => {
  app.showLoadMenu = false
  route.path = '/load'
  const wrapper = mount(SavedCard, { props: { type: 'load' } })
  await flushPromises()
  await wrapper.get('button[aria-label="save.load_from_slot"]').trigger('click')
  await flushPromises()

  expect(restore).toHaveBeenCalledWith(snapshot)
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
