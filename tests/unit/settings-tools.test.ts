import { mount } from '@vue/test-utils'
import { beforeEach, expect, it, vi } from 'vitest'
import RightTools from '../../packages/client/components/menu/RightTools.vue'

const { app, router } = vi.hoisted(() => ({
  app: { menus: { settings: true }, toggleShowSaveMenu: vi.fn(), toggleShowLoadMenu: vi.fn() },
  router: { getRoutes: vi.fn(), push: vi.fn() },
}))

vi.mock('../../packages/client/composables', () => ({
  isDark: false,
  toggleDark: vi.fn(),
  useAdvContext: () => ({ $adv: { store: { current: { kind: 'text' } } } }),
}))
vi.mock('../../packages/client/stores', () => ({
  useAppStore: () => app,
  useSettingsStore: () => ({ resetSettings: vi.fn() }),
}))
vi.mock('vue-router', () => ({ useRouter: () => router }))
vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key, locale: { value: 'zh-CN' }, availableLocales: ['zh-CN', 'en'] }),
}))

beforeEach(() => {
  vi.clearAllMocks()
  app.menus.settings = true
  router.getRoutes.mockReturnValue([{ path: '/' }, { path: '/play' }, { path: '/:pathMatch(.*)*' }])
})

function renderTools() {
  return mount(RightTools, {
    global: { stubs: { AdvButton: { template: '<button><slot /></button>' }, AdvIconButton: true } },
  })
}

it('omits unavailable game pages in an editor host', () => {
  const wrapper = renderTools()
  const buttons = wrapper.findAll('button').map(button => button.text())
  expect(buttons).toContain('menu.save_game')
  expect(buttons).toContain('menu.load_game')
  expect(buttons).not.toContain('menu.back_home')
  expect(buttons).not.toContain('menu.help')
  wrapper.unmount()
})

it('opens load controls in place after closing settings', async () => {
  const wrapper = renderTools()
  await wrapper.findAll('button').find(button => button.text() === 'menu.load_game')!.trigger('click')
  expect(app.menus.settings).toBe(false)
  expect(app.toggleShowLoadMenu).toHaveBeenCalledOnce()
  expect(router.push).not.toHaveBeenCalled()
  wrapper.unmount()
})

it('preserves navigation for standalone games that provide the pages', async () => {
  router.getRoutes.mockReturnValue([{ path: '/game' }, { path: '/start' }, { path: '/help' }])
  const wrapper = renderTools()
  await wrapper.findAll('button').find(button => button.text() === 'menu.back_home')!.trigger('click')
  expect(router.push).toHaveBeenCalledWith('/start')
  expect(wrapper.findAll('button').map(button => button.text())).toContain('menu.help')
  wrapper.unmount()
})
