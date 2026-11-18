import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, shallowRef } from 'vue'
import { createI18n } from 'vue-i18n'
import AdvChoice from '../../../packages/client/components/adv/AdvChoice.vue'
import { useAdvAdvanceHandler, useAdvKeys } from '../../../packages/client/composables/useAdvKeys'
import { createBrowserReadLog } from '../../../packages/client/runtime/read-log'
import { useAppStore } from '../../../packages/client/stores/app'

let app: ReturnType<typeof useAppStore>
const enabled = shallowRef(false)
const skipEnabled = shallowRef(false)
const runtime = { program: shallowRef({ id: 'fixture' }), snapshot: vi.fn(() => ({ cursor: 'opening' })), restore: vi.fn(), next: vi.fn(), back: vi.fn(), choose: vi.fn() }
const game = { save: vi.fn(async () => undefined), read: vi.fn(async () => ({ snapshot: { cursor: 'saved' } })) }
const store = {
  current: { id: 'opening', kind: 'text' } as { id: string, kind: string, data?: unknown },
  state: { status: 'playing', cursor: { chapterId: 'intro', nodeId: 'opening' } },
}
const adv: Record<string, any> = {
  runtime,
  store,
  $auto: {
    enabled,
    skipEnabled,
    stop: () => {
      enabled.value = false
      skipEnabled.value = false
    },
    toggle: () => { enabled.value = !enabled.value },
    toggleSkip: () => { skipEnabled.value = !skipEnabled.value },
  },
}

vi.mock('@advjs/client', () => ({
  useAppStore: () => app,
  useAdvContext: () => ({ $adv: adv }),
  useGameStore: () => game,
  QUICK_SAVE_SLOT: { kind: 'quick' },
}))

const wrappers: ReturnType<typeof mount>[] = []
beforeEach(() => {
  setActivePinia(createPinia())
  app = useAppStore()
  enabled.value = false
  skipEnabled.value = false
  runtime.program.value = { id: 'fixture' }
  store.current = { id: 'opening', kind: 'text' }
  store.state = { status: 'playing', cursor: { chapterId: 'intro', nodeId: 'opening' } }
  delete adv.advanceHandler
  delete adv.readLog
  vi.clearAllMocks()
})
afterEach(() => {
  wrappers.splice(0).forEach(wrapper => wrapper.unmount())
  document.body.innerHTML = ''
  vi.unstubAllGlobals()
})

async function renderGame(scope: 'page' | 'focus' = 'page') {
  const host = defineComponent({
    setup() {
      const root = shallowRef<HTMLElement>()
      useAdvKeys(adv as Parameters<typeof useAdvKeys>[0], { root, scope })
      return () => h('div', { ref: root, class: 'adv-screen', tabindex: -1 }, [
        h('button', { class: 'game-button' }, 'Button'),
        h('input', { class: 'game-input' }),
        app.showHistory
          ? h('div', { role: 'dialog' }, [
              h('button', { disabled: true }, 'Disabled'),
              h('button', { class: 'history-close', onClick: () => { app.showHistory = false } }, 'Close'),
            ])
          : null,
      ])
    },
  })
  const wrapper = mount(host, { attachTo: document.body })
  wrappers.push(wrapper)
  // Element listeners attach after the root ref is set.
  await nextTick()
  return { wrapper, root: wrapper.element as HTMLElement }
}

function press(key: string, init: KeyboardEventInit = {}, type = 'keydown') {
  const event = new KeyboardEvent(type, { key, bubbles: true, cancelable: true, ...init })
  ;(document.activeElement ?? window).dispatchEvent(event)
  return event
}

it('advances with Space and Enter through the text view\'s own handler, and only during playable text', async () => {
  await renderGame()
  const handler = vi.fn()
  press('Enter')
  expect(runtime.next).toHaveBeenCalledOnce()
  useAdvAdvanceHandler(adv as Parameters<typeof useAdvKeys>[0], handler)
  press(' ')
  expect(handler).toHaveBeenCalledOnce()
  store.current = { id: 'decision', kind: 'choices' }
  press('Enter')
  store.current = { id: 'opening', kind: 'text' }
  store.state.status = 'waiting-activity'
  press('Enter')
  expect(handler).toHaveBeenCalledOnce()
  expect(runtime.next).toHaveBeenCalledOnce()
})

it('hides and restores the UI with H and right-click, and restores before advancing', async () => {
  const { root } = await renderGame()
  press('h')
  expect(app.showUi).toBe(false)
  press('Enter')
  expect(app.showUi).toBe(true)
  expect(runtime.next).not.toHaveBeenCalled()
  const contextmenu = new MouseEvent('contextmenu', { bubbles: true, cancelable: true })
  root.dispatchEvent(contextmenu)
  expect(contextmenu.defaultPrevented).toBe(true)
  expect(app.showUi).toBe(false)
  root.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }))
  expect(app.showUi).toBe(true)
})

it('opens the backlog with L or wheel up, but not on wheel down or while content can scroll', async () => {
  const { root } = await renderGame()
  root.dispatchEvent(new WheelEvent('wheel', { deltaY: 40, bubbles: true }))
  expect(app.showHistory).toBe(false)
  const list = root.querySelector('.game-button') as HTMLElement
  Object.defineProperty(list, 'scrollTop', { value: 20, configurable: true })
  list.dispatchEvent(new WheelEvent('wheel', { deltaY: -40, bubbles: true }))
  expect(app.showHistory).toBe(false)
  root.dispatchEvent(new WheelEvent('wheel', { deltaY: -40, bubbles: true }))
  expect(app.showHistory).toBe(true)
  app.showHistory = false
  press('l')
  expect(app.showHistory).toBe(true)
})

it('quick saves with S and F5 without reloading, and quick loads with F9', async () => {
  await renderGame()
  const f5 = press('F5')
  expect(f5.defaultPrevented).toBe(true)
  await flushPromises()
  expect(game.save).toHaveBeenCalledWith({ kind: 'quick' }, { cursor: 'opening' })
  press('s')
  await flushPromises()
  expect(game.save).toHaveBeenCalledTimes(2)
  press('F9')
  await flushPromises()
  expect(runtime.restore).toHaveBeenCalledWith({ cursor: 'saved' })
  // Browser shortcuts such as Ctrl+S stay with the browser.
  expect(press('s', { ctrlKey: true }).defaultPrevented).toBe(false)
  await flushPromises()
  expect(game.save).toHaveBeenCalledTimes(2)
})

it('does not apply a pending quick load to a reinstalled program with the same id', async () => {
  await renderGame()
  let finish!: (record: { snapshot: { cursor: string } }) => void
  game.read.mockImplementationOnce(() => new Promise((resolve) => {
    finish = resolve
  }))
  press('F9')
  runtime.program.value = { id: 'fixture' }
  finish({ snapshot: { cursor: 'old' } })
  await flushPromises()
  expect(runtime.restore).not.toHaveBeenCalled()
})

it('keeps a toolbar skip active after Ctrl is released and stops a held skip on blur', async () => {
  await renderGame()
  skipEnabled.value = true
  press('Control', { ctrlKey: true })
  press('Control', {}, 'keyup')
  expect(skipEnabled.value).toBe(true)
  skipEnabled.value = false

  press('Control', { ctrlKey: true })
  expect(skipEnabled.value).toBe(true)
  skipEnabled.value = false
  skipEnabled.value = true
  press('Control', {}, 'keyup')
  expect(skipEnabled.value).toBe(true)
  skipEnabled.value = false

  press('Control', { ctrlKey: true })
  window.dispatchEvent(new Event('blur'))
  expect(skipEnabled.value).toBe(false)
  press('Control', { ctrlKey: true })
  expect(press('s', { ctrlKey: true }).defaultPrevented).toBe(false)
  expect(skipEnabled.value).toBe(false)
})

it('consumes repeated advance keys without skipping the typewriter or intervening lines', async () => {
  await renderGame()
  press('Enter')
  expect(press('Enter', { repeat: true }).defaultPrevented).toBe(true)
  expect(runtime.next).toHaveBeenCalledOnce()
})

it('opens the menu with Escape, and does not reopen it when Escape closes an open dialog', async () => {
  await renderGame()
  press('Escape')
  expect(app.menus.settings).toBe(true)
  // A dialog that closes itself on Escape before the event reaches window.
  const closer = (event: KeyboardEvent) => {
    if (event.key === 'Escape')
      app.menus.settings = false
  }
  document.addEventListener('keydown', closer)
  press('Escape')
  document.removeEventListener('keydown', closer)
  expect(app.menus.settings).toBe(false)
})

it('respects uiBlocked: open menus, typing, and focused buttons for activation keys', async () => {
  const { root } = await renderGame()
  app.showSaveMenu = true
  for (const key of ['Enter', 'a', 'h', 'l', 's', 'Escape'])
    press(key)
  await flushPromises()
  expect(runtime.next).not.toHaveBeenCalled()
  expect(enabled.value).toBe(false)
  expect(app.showUi).toBe(true)
  expect(app.showHistory).toBe(false)
  expect(game.save).not.toHaveBeenCalled()
  app.showSaveMenu = false
  ;(root.querySelector('.game-input') as HTMLElement).focus()
  press('h')
  expect(app.showUi).toBe(true)
  ;(root.querySelector('.game-button') as HTMLElement).focus()
  press('Enter')
  expect(runtime.next).not.toHaveBeenCalled()
  press('a')
  expect(enabled.value).toBe(true)
})

it('only listens while focus is inside an embedded game', async () => {
  const { root } = await renderGame('focus')
  press('h')
  expect(app.showUi).toBe(true)
  root.focus()
  press('h')
  expect(app.showUi).toBe(false)
})

it('maps gamepad A, B, X, Y and the D-pad, reporting each press once', async () => {
  const frames: FrameRequestCallback[] = []
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => frames.push(callback))
  vi.stubGlobal('cancelAnimationFrame', () => {})
  const buttons = Array.from({ length: 16 }, () => ({ pressed: false }))
  const pad = { index: 0, connected: true, mapping: 'standard', buttons }
  Object.defineProperty(navigator, 'getGamepads', { value: () => [pad], configurable: true })
  const { root } = await renderGame()
  async function tap(index: number) {
    buttons[index].pressed = true
    frames.shift()?.(0)
    frames.shift()?.(0)
    buttons[index].pressed = false
    frames.shift()?.(0)
    await nextTick()
  }

  await tap(0)
  expect(runtime.next).toHaveBeenCalledOnce()
  await tap(2)
  expect(enabled.value).toBe(true)
  const gameButton = root.querySelector<HTMLButtonElement>('.game-button')!
  const gameButtonClick = vi.fn()
  gameButton.addEventListener('click', gameButtonClick)
  gameButton.focus()
  await tap(3)
  expect(app.showHistory).toBe(true)
  await tap(0)
  expect(gameButtonClick).not.toHaveBeenCalled()
  await tap(13)
  expect(document.activeElement).toBe(root.querySelector('.history-close'))
  await tap(0)
  expect(app.showHistory).toBe(false)
  await tap(3)
  await tap(1)
  expect(app.showHistory).toBe(false)
  await tap(1)
  expect(runtime.back).toHaveBeenCalledOnce()
  await tap(13)
  expect(document.activeElement).toBe(root.querySelector('.game-button'))
  pad.mapping = ''
  await tap(0)
  expect(gameButtonClick).not.toHaveBeenCalled()
  delete (navigator as { getGamepads?: unknown }).getGamepads
})

it('marks choices taken in an earlier playthrough with a restylable read state', async () => {
  const readLog = createBrowserReadLog({ id: 'game', hash: 'v1' })
  readLog.capture({
    status: 'waiting-choice',
    cursor: { chapterId: 'intro', nodeId: 'decision' },
    visited: ['intro#decision'],
    choices: [{ node: { chapterId: 'intro', nodeId: 'decision' }, choiceId: 'left' }],
  } as never)
  adv.readLog = readLog
  store.state = { status: 'waiting-choice', cursor: { chapterId: 'intro', nodeId: 'decision' } }
  const wrapper = mount(AdvChoice, {
    props: {
      node: {
        id: 'decision',
        kind: 'choices',
        data: { options: [{ id: 'left', label: 'Left' }, { id: 'right', label: 'Right' }] },
      } as never,
    },
    global: { plugins: [createI18n({ legacy: false, locale: 'en' })] },
  })
  wrappers.push(wrapper)
  const [left, right] = wrapper.findAll('.adv-option')
  expect(left.classes()).toContain('adv-option-read')
  expect(left.attributes('data-read')).toBe('true')
  expect(left.text()).toContain('(chosen before)')
  expect(right.classes()).not.toContain('adv-option-read')
  expect(right.attributes('data-read')).toBeUndefined()
})
