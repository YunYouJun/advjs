import type { MaybeRefOrGetter } from 'vue'
import type { AdvContext } from '../types'
import { useAppStore } from '@advjs/client'
import { useEventListener, useMagicKeys } from '@vueuse/core'
import { consola } from 'consola'
import { getCurrentScope, onScopeDispose, toValue, watch } from 'vue'
import { GamepadButton, useAdvGamepad } from './useAdvGamepad'
import { useAdvQuickSave } from './useAdvQuickSave'

export interface AdvKeysOptions {
  /** The game's root element; right-click and wheel listen here and focus inside it always counts. */
  root?: MaybeRefOrGetter<HTMLElement | null | undefined>
  /**
   * - `page` (default): shortcuts also work while nothing is focused, as on a standalone game page.
   * - `focus`: only while focus is inside `root`, e.g. a preview embedded in an editor.
   */
  scope?: MaybeRefOrGetter<'page' | 'focus' | false>
}

const TEXT_ENTRY = 'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"]'
const ACTIVATABLE = 'button, a[href], summary, input, [role="button"], [role="link"]'
const GAMEPAD_ACTIVATABLE = 'button, a[href], summary, input[type="radio"], input[type="checkbox"], [role="button"], [role="link"]'
const FOCUSABLE = `${ACTIVATABLE}, select, textarea, [tabindex]`
const DIALOG = '[role="dialog"], [aria-modal="true"]'
const INACTIVE = '[inert], [aria-hidden="true"], [hidden], [aria-disabled="true"], :disabled'

function canFocus(element: HTMLElement) {
  return element.tabIndex >= 0 && !element.closest(INACTIVE)
    && (element.checkVisibility?.({ visibilityProperty: true }) ?? true)
}

/**
 * Register the player's keyboard, mouse and gamepad shortcuts.
 *
 * | Input                          | Action                               |
 * | ------------------------------ | ------------------------------------ |
 * | Space / Enter / Gamepad A      | advance (restores a hidden UI first) |
 * | Ctrl (hold)                    | skip while held                      |
 * | A / Gamepad X                  | toggle auto-play                     |
 * | H / right-click                | hide or show the UI                  |
 * | L / wheel up / Gamepad Y       | backlog                              |
 * | S / F5, F9                     | quick save, quick load               |
 * | Esc                            | settings menu                        |
 * | Gamepad B                      | close menu, else roll back           |
 * | Gamepad D-pad                  | move focus (choices, menus)          |
 * | T+C                            | toggle canvas (debug)                |
 *
 * Nothing fires while a menu is open or the player is typing (`uiBlocked`); Space/Enter also leave
 * focused buttons to the browser.
 */
export function useAdvKeys($adv: AdvContext, options: AdvKeysOptions = {}) {
  const app = useAppStore()
  // Resolved on first use so hosts that never quick save need no game store.
  const quick = () => useAdvQuickSave($adv)

  const keys = useMagicKeys()

  const advKeys = [
    {
      name: 'toggleCanvas',
      keys: 'T+C',
      description: 'Toggle Canvas',
      callback: () => {
        app.toggleCanvas()
        consola.info(`Canvas: ${app.showCanvas}`)
      },
    },
  ]

  function menuOpen() {
    return app.showGlossary || app.showHistory || app.showSaveMenu || app.showLoadMenu || app.menus.settings
  }

  function uiBlocked(activation = false, target = document.activeElement) {
    return menuOpen() || !!target?.closest(activation ? `${ACTIVATABLE}, ${TEXT_ENTRY}` : TEXT_ENTRY)
  }

  function inScope(target = document.activeElement) {
    const scope = toValue(options.scope)
    if (scope === false)
      return false
    const root = toValue(options.root)
    if (root && target && root.contains(target)) {
      const owner = target.closest('[data-adv-key-controls]')
      return !owner || owner === root
    }
    return scope !== 'focus' && (!target || target === document.body)
  }

  function closeMenus() {
    app.showGlossary = false
    app.glossaryTerm = undefined
    app.showHistory = false
    app.showSaveMenu = false
    app.showLoadMenu = false
    app.menus.settings = false
  }

  function advance() {
    if (!app.showUi) {
      app.showUi = true
      return
    }
    const status = $adv.store.state?.status
    const kind = $adv.store.current?.kind
    if (status !== 'playing' || !kind || kind === 'choices' || kind === 'end')
      return
    void runAdvance()
  }

  async function runAdvance() {
    try {
      await ($adv.advanceHandler ?? $adv.runtime.next)()
    }
    catch (error) {
      console.warn('[advjs] Unable to advance', error)
    }
  }

  function toggleAuto() {
    $adv.$auto.toggle()
    consola.info(`Auto: ${$adv.$auto.enabled.value}`)
  }

  function openHistory() {
    app.showUi = true
    app.showHistory = true
  }

  function openMenu() {
    if (!app.showUi)
      app.showUi = true
    else
      app.menus.settings = true
  }

  function rollback() {
    if (!app.showUi) {
      app.showUi = true
      return
    }
    try {
      $adv.runtime.back()
    }
    catch (error) {
      // No checkpoint yet (story start) or an activity that cannot roll back.
      consola.info('Rollback unavailable', error)
    }
  }

  const keyActions: Record<string, { run: () => unknown, activation?: boolean }> = {
    ' ': { run: advance, activation: true },
    'enter': { run: advance, activation: true },
    'a': { run: toggleAuto },
    'h': { run: () => app.toggleUi() },
    'l': { run: openHistory },
    's': { run: () => quick().quickSave() },
    'f5': { run: () => quick().quickSave() },
    'f9': { run: () => quick().quickLoad() },
    'escape': { run: openMenu },
  }

  if (typeof window === 'undefined')
    return { advance, uiBlocked }

  // Dialogs close themselves on Escape before the event reaches `window`; remember they were open
  // so the same key press does not reopen the menu.
  let menuOpenAtKeydown = false
  useEventListener(window, 'keydown', () => {
    menuOpenAtKeydown = menuOpen()
  }, { capture: true })
  let skipHeld = false

  function releaseSkip() {
    if (!skipHeld)
      return
    skipHeld = false
    $adv.$auto.skipEnabled.value = false
  }

  // Once skip has stopped on a boundary, releasing Ctrl must leave a later toolbar
  // toggle alone, including a toggle that happens before Ctrl is released.
  watch($adv.$auto.skipEnabled, (skipping) => {
    if (!skipping)
      skipHeld = false
  }, { flush: 'sync' })

  useEventListener(window, 'keydown', (event: KeyboardEvent) => {
    const eventTarget = event.composedPath()[0]
    const target = eventTarget instanceof Element ? eventTarget : document.activeElement
    if (event.key === 'Control') {
      if (!event.repeat && !event.altKey && !event.metaKey && !event.shiftKey && !event.defaultPrevented
        && !event.isComposing && inScope(target) && !uiBlocked(true, target) && !$adv.$auto.skipEnabled.value) {
        $adv.$auto.toggleSkip()
        skipHeld = $adv.$auto.skipEnabled.value
      }
      return
    }
    if (event.ctrlKey)
      releaseSkip()
    if (event.ctrlKey || event.metaKey || event.altKey || event.isComposing || event.defaultPrevented)
      return
    const action = keyActions[event.key.toLowerCase()]
    if (!action || menuOpenAtKeydown || !inScope(target) || uiBlocked(action.activation, target))
      return
    event.preventDefault()
    if (!event.repeat)
      action.run()
  })
  useEventListener(window, 'keyup', (event: KeyboardEvent) => {
    if (event.key === 'Control' && !event.ctrlKey)
      releaseSkip()
  }, { capture: true })
  useEventListener(window, 'blur', releaseSkip)
  useEventListener(document, 'visibilitychange', () => {
    if (document.hidden)
      releaseSkip()
  })
  useEventListener(document, 'focusin', (event: FocusEvent) => {
    if (event.target instanceof Element && (!inScope(event.target) || event.target.closest(TEXT_ENTRY)))
      releaseSkip()
  })
  watch(() => toValue(options.scope), (scope) => {
    if (scope === false)
      releaseSkip()
  })
  if (getCurrentScope())
    onScopeDispose(releaseSkip)

  useEventListener(() => toValue(options.root), 'contextmenu', (event: MouseEvent) => {
    if (toValue(options.scope) === false || menuOpen() || (event.target instanceof Element && event.target.closest(TEXT_ENTRY)))
      return
    event.preventDefault()
    app.toggleUi()
  })

  useEventListener(() => toValue(options.root), 'wheel', (event: WheelEvent) => {
    if (toValue(options.scope) === false || event.ctrlKey || event.deltaY >= 0 || uiBlocked() || canScrollUp(event.target, toValue(options.root)))
      return
    openHistory()
  }, { passive: true })

  function activeDialog(root: HTMLElement) {
    return Array.from(root.querySelectorAll<HTMLElement>(DIALOG))
      .findLast(dialog => !dialog.closest(INACTIVE) && (dialog.checkVisibility?.() ?? true))
  }

  /** Move focus to the previous or next control in the active dialog or choice list. */
  function moveFocus(step: 1 | -1) {
    const root = toValue(options.root)
    if (!root)
      return
    const dialog = activeDialog(root)
    const choices = $adv.store.state?.status === 'waiting-choice' ? root.querySelector('.adv-options-container') : null
    const container = dialog ?? choices ?? root
    const items = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(canFocus)
    if (!items.length)
      return
    const index = items.indexOf(document.activeElement as HTMLElement)
    const next = index === -1
      ? (step === 1 ? items[0] : items[items.length - 1])
      : items[(index + step + items.length) % items.length]
    next.focus()
  }

  useAdvGamepad((button) => {
    if (!inScope())
      return
    const focused = document.activeElement
    switch (button) {
      case GamepadButton.A: {
        const root = toValue(options.root)
        const dialog = root && activeDialog(root)
        if (focused instanceof HTMLElement && focused.matches(GAMEPAD_ACTIVATABLE) && canFocus(focused)
          && (!menuOpen() || dialog?.contains(focused))) {
          focused.click()
        }
        else if (!uiBlocked(true)) {
          advance()
        }
        break
      }
      case GamepadButton.B:
        if (menuOpen())
          closeMenus()
        else if (!uiBlocked())
          rollback()
        break
      case GamepadButton.X:
        if (!uiBlocked())
          toggleAuto()
        break
      case GamepadButton.Y:
        if (app.showHistory)
          app.showHistory = false
        else if (!uiBlocked())
          openHistory()
        break
      case GamepadButton.Up:
      case GamepadButton.Left:
        moveFocus(-1)
        break
      case GamepadButton.Down:
      case GamepadButton.Right:
        moveFocus(1)
        break
    }
  })

  advKeys.forEach((item) => {
    watch(keys[item.keys], (v) => {
      if (v && inScope() && !uiBlocked()) {
        consola.info(item.description)
        item.callback()
      }
    })
  })

  return { advance, uiBlocked }
}

/** Let scrollable content such as a long choice list scroll before the backlog opens. */
function canScrollUp(target: EventTarget | null, root: HTMLElement | null | undefined) {
  for (let element = target instanceof Element ? target : null; element && element !== root; element = element.parentElement) {
    if (element.scrollTop > 0)
      return true
  }
  return false
}

/**
 * Register a text view's advance so keyboard and gamepad advance it the same way as a click.
 * Call from the component's setup; it unregisters when the component unmounts.
 */
export function useAdvAdvanceHandler($adv: AdvContext, handler: () => unknown) {
  $adv.advanceHandler = handler
  if (getCurrentScope()) {
    onScopeDispose(() => {
      if ($adv.advanceHandler === handler)
        $adv.advanceHandler = undefined
    })
  }
}
