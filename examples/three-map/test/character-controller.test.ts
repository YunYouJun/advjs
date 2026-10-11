import { afterEach, describe, expect, it, vi } from 'vitest'
import { bindCharacterKeyboard, createCharacterController } from '../src/character-controller'

const cleanups: Array<() => void> = []
afterEach(() => {
  cleanups.splice(0).forEach(cleanup => cleanup())
  vi.restoreAllMocks()
  document.body.innerHTML = ''
})

function advance(controller: ReturnType<typeof createCharacterController>, seconds: number, fps = 60) {
  for (let frame = 0; frame < seconds * fps; frame++)
    controller.update(1 / fps)
}

function playSurface() {
  const canvas = document.createElement('canvas')
  document.body.append(canvas)
  const controller = createCharacterController()
  const cleanup = bindCharacterKeyboard(canvas, controller)
  cleanups.push(cleanup)
  canvas.focus()
  return { canvas, controller, cleanup }
}

function key(element: HTMLElement, type: 'keydown' | 'keyup', code: string, options: KeyboardEventInit = {}) {
  const event = new KeyboardEvent(type, { code, bubbles: true, cancelable: true, ...options })
  element.dispatchEvent(event)
  return event
}

describe('demo character movement', () => {
  it('moves at the same speed across frame rates and normalizes diagonals and duplicate bindings', () => {
    const slow = createCharacterController()
    const fast = createCharacterController()
    const diagonal = createCharacterController()
    slow.setKey('KeyW', true)
    fast.setKey('ArrowUp', true)
    diagonal.setKey('KeyW', true)
    diagonal.setKey('ArrowUp', true)
    diagonal.setKey('KeyD', true)
    advance(slow, 1, 30)
    advance(fast, 1, 120)
    advance(diagonal, 1)
    expect(slow.state.z).toBeCloseTo(fast.state.z)
    expect(slow.state.distance).toBeCloseTo(2.5)
    expect(diagonal.state.distance).toBeCloseTo(slow.state.distance)
    expect(diagonal.state.x).toBeGreaterThan(0)
    expect(diagonal.state.z).toBeLessThan(-2.5)
  })

  it('moves relative to the camera, supports running, and cancels opposing inputs', () => {
    const controller = createCharacterController()
    controller.setKey('KeyW', true)
    controller.setKey('ShiftRight', true)
    controller.update(0.1, { x: 1, z: 0 })
    expect(controller.state.x).toBeCloseTo(0.5)
    expect(controller.state.z).toBe(-2.5)
    expect(controller.state.heading).toBeCloseTo(Math.PI / 2)
    expect(controller.state.running).toBe(true)
    controller.setKey('KeyS', true)
    controller.update(0.1)
    expect(controller.state.moving).toBe(false)
    expect(controller.state.running).toBe(false)
  })

  it('keeps movement in the map and limits a delayed frame', () => {
    const controller = createCharacterController()
    controller.setKey('KeyD', true)
    controller.update(10)
    expect(controller.state.x).toBeCloseTo(0.25)
    advance(controller, 10)
    expect(controller.state.x).toBe(6.5)
    expect(controller.state.moving).toBe(false)
    controller.update(Number.NaN)
    expect(controller.state.x).toBe(6.5)
  })

  it('jumps while moving, falls to the ground, and never auto-jumps from a held or repeated Space', () => {
    const controller = createCharacterController()
    controller.setKey('Space', true)
    controller.setKey('KeyW', true)
    controller.update(0.1)
    expect(controller.state.y).toBeGreaterThan(0)
    expect(controller.state.z).toBeLessThan(-2.5)
    expect(controller.state.grounded).toBe(false)
    controller.setKey('Space', false)
    controller.setKey('Space', true)
    controller.update(0.1)
    expect(controller.state.verticalSpeed).toBeCloseTo(3.4)
    advance(controller, 1)
    controller.setKey('Space', true, true)
    controller.update(0.1)
    expect(controller.state.y).toBe(0)
    expect(controller.state.grounded).toBe(true)
    controller.setKey('Space', false)
    controller.setKey('Space', true)
    controller.update(0.1)
    expect(controller.state.y).toBeGreaterThan(0)
  })

  it('integrates the same jump trajectory across frame rates and resets all motion', () => {
    const slow = createCharacterController()
    const fast = createCharacterController()
    slow.setKey('Space', true)
    fast.setKey('Space', true)
    advance(slow, 0.5, 30)
    advance(fast, 0.5, 120)
    expect(slow.state.y).toBeCloseTo(fast.state.y)
    slow.setKey('KeyD', true)
    slow.reset()
    advance(slow, 1)
    expect(slow.state).toMatchObject({ x: 0, y: 0, z: -2.5, verticalSpeed: 0, grounded: true, moving: false, distance: 0 })
  })
})

describe('demo keyboard ownership', () => {
  it('focuses on pointer input, consumes only game keys and preserves browser shortcuts', () => {
    const { canvas, controller } = playSurface()
    canvas.blur()
    canvas.dispatchEvent(new Event('pointerdown'))
    expect(document.activeElement).toBe(canvas)
    expect(key(canvas, 'keydown', 'Space').defaultPrevented).toBe(true)
    controller.update(0.1)
    expect(controller.state.y).toBeGreaterThan(0)
    expect(key(canvas, 'keydown', 'KeyW', { ctrlKey: true }).defaultPrevented).toBe(false)
    expect(key(canvas, 'keydown', 'KeyW', { metaKey: true }).defaultPrevented).toBe(false)
    expect(key(canvas, 'keydown', 'KeyW', { altKey: true }).defaultPrevented).toBe(false)
    expect(key(canvas, 'keydown', 'Tab').defaultPrevented).toBe(false)
    controller.update(0.1)
    expect(controller.state.z).toBe(-2.5)
  })

  it('releases keys on blur so focusing a button or input cannot move or jump', () => {
    const { canvas, controller } = playSurface()
    key(canvas, 'keydown', 'KeyW')
    controller.update(0.1)
    const z = controller.state.z
    const button = document.createElement('button')
    const input = document.createElement('input')
    document.body.append(button, input)
    button.focus()
    expect(key(button, 'keydown', 'Space').defaultPrevented).toBe(false)
    input.focus()
    key(input, 'keydown', 'KeyW')
    key(input, 'keydown', 'Space')
    canvas.focus()
    controller.update(0.1)
    expect(controller.state.z).toBe(z)
    expect(controller.state.y).toBe(0)
  })

  it('clears pending input on window blur and page hiding', () => {
    const { canvas, controller } = playSurface()
    key(canvas, 'keydown', 'KeyW')
    key(canvas, 'keydown', 'Space')
    window.dispatchEvent(new Event('blur'))
    controller.update(0.1)
    expect(controller.state.z).toBe(-2.5)
    expect(controller.state.y).toBe(0)
    key(canvas, 'keydown', 'KeyD')
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(true)
    document.dispatchEvent(new Event('visibilitychange'))
    controller.update(0.1)
    expect(controller.state.x).toBe(0)
  })

  it('releases on keyup, resets with R, and exits control with Escape', () => {
    const { canvas, controller } = playSurface()
    key(canvas, 'keydown', 'ArrowRight')
    controller.update(0.1)
    expect(controller.state.x).toBeGreaterThan(0)
    expect(key(canvas, 'keyup', 'ArrowRight').defaultPrevented).toBe(true)
    const x = controller.state.x
    controller.update(0.1)
    expect(controller.state.x).toBe(x)
    key(canvas, 'keydown', 'KeyR')
    expect(controller.state.x).toBe(0)
    key(canvas, 'keydown', 'ArrowRight')
    key(canvas, 'keydown', 'Escape')
    controller.update(0.1)
    expect(document.activeElement).not.toBe(canvas)
    expect(controller.state.x).toBe(0)
  })

  it('removes input listeners and restores canvas attributes on scene cleanup', () => {
    const { canvas, controller, cleanup } = playSurface()
    key(canvas, 'keydown', 'KeyW')
    cleanup()
    expect(canvas.hasAttribute('tabindex')).toBe(false)
    expect(canvas.hasAttribute('aria-keyshortcuts')).toBe(false)
    expect(key(canvas, 'keydown', 'KeyD').defaultPrevented).toBe(false)
    controller.update(0.1)
    expect(controller.state.x).toBe(0)
    expect(controller.state.z).toBe(-2.5)
  })
})
