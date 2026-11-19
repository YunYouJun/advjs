import { useEventListener } from '@vueuse/core'
import { getCurrentScope, onScopeDispose } from 'vue'

/** Button indexes of the W3C "standard" gamepad mapping (Xbox layout names). */
export const GamepadButton = {
  A: 0,
  B: 1,
  X: 2,
  Y: 3,
  Up: 12,
  Down: 13,
  Left: 14,
  Right: 15,
} as const

/**
 * Poll connected gamepads while any is present and report each new button press once.
 * Holding a button does not repeat it.
 */
export function useAdvGamepad(onPress: (button: number) => void) {
  const supported = typeof navigator !== 'undefined' && typeof navigator.getGamepads === 'function'
    && typeof requestAnimationFrame === 'function'
  const pressed = new Map<number, boolean[]>()
  let frame: number | undefined
  let resume = false

  function connected() {
    try {
      return Array.from(navigator.getGamepads()).filter((pad): pad is Gamepad => !!pad?.connected && pad.mapping === 'standard')
    }
    catch {
      // An embedded document can be denied access by its Permissions Policy.
      return []
    }
  }

  function poll() {
    frame = undefined
    const pads = connected()
    if (!pads.length) {
      pressed.clear()
      return
    }
    for (const pad of pads) {
      const previous = pressed.get(pad.index) ?? []
      const current = pad.buttons.map(button => button.pressed)
      pressed.set(pad.index, current)
      if (!document.hidden && !resume) {
        current.forEach((down, button) => {
          if (down && !previous[button])
            onPress(button)
        })
      }
    }
    resume = document.hidden
    frame = requestAnimationFrame(poll)
  }

  function start() {
    if (supported && frame === undefined)
      frame = requestAnimationFrame(poll)
  }

  function stop() {
    if (frame !== undefined)
      cancelAnimationFrame(frame)
    frame = undefined
  }

  if (!supported)
    return { stop }

  useEventListener(document, 'visibilitychange', () => {
    if (document.hidden)
      resume = true
  })
  useEventListener(window, 'gamepadconnected', start)
  useEventListener(window, 'gamepaddisconnected', (event: GamepadEvent) => {
    pressed.delete(event.gamepad.index)
  })
  // Browsers only expose a pad after its first input, but it may already be known.
  if (connected().length)
    start()
  if (getCurrentScope())
    onScopeDispose(stop)
  return { stop }
}
