export interface CharacterState {
  x: number
  y: number
  z: number
  heading: number
  verticalSpeed: number
  grounded: boolean
  moving: boolean
  running: boolean
  distance: number
}

const movementKeys = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight', 'ShiftLeft', 'ShiftRight', 'Space'])
const walkSpeed = 2.5
const runSpeed = 5
const gravity = 18
const jumpSpeed = 7
const mapLimit = 6.5

function initialState(): CharacterState {
  return { x: 0, y: 0, z: -2.5, heading: 0, verticalSpeed: 0, grounded: true, moving: false, running: false, distance: 0 }
}

/** Flat-ground demo simulation; it owns no DOM, Vue or Three.js objects. */
export function createCharacterController() {
  const state = initialState()
  const keys = new Set<string>()
  let jumpRequested = false

  function clearInput() {
    keys.clear()
    jumpRequested = false
    state.moving = false
    state.running = false
  }

  function setKey(code: string, pressed: boolean, repeat = false) {
    if (!movementKeys.has(code))
      return false
    if (pressed) {
      if (code === 'Space' && !repeat && !keys.has(code))
        jumpRequested = true
      keys.add(code)
    }
    else {
      keys.delete(code)
    }
    return true
  }

  function update(deltaSeconds: number, forward = { x: 0, z: -1 }) {
    if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0)
      return
    const delta = Math.min(deltaSeconds, 0.1)
    const forwardInput = Number(keys.has('KeyW') || keys.has('ArrowUp')) - Number(keys.has('KeyS') || keys.has('ArrowDown'))
    const rightInput = Number(keys.has('KeyD') || keys.has('ArrowRight')) - Number(keys.has('KeyA') || keys.has('ArrowLeft'))
    const inputLength = Math.hypot(forwardInput, rightInput)
    const forwardLength = Math.hypot(forward.x, forward.z)
    const fx = forwardLength > 0.0001 ? forward.x / forwardLength : 0
    const fz = forwardLength > 0.0001 ? forward.z / forwardLength : -1
    const running = keys.has('ShiftLeft') || keys.has('ShiftRight')
    const speed = running ? runSpeed : walkSpeed
    let distance = 0
    if (inputLength) {
      const dx = (fx * forwardInput - fz * rightInput) / inputLength
      const dz = (fz * forwardInput + fx * rightInput) / inputLength
      const x = Math.max(-mapLimit, Math.min(mapLimit, state.x + dx * speed * delta))
      const z = Math.max(-mapLimit, Math.min(mapLimit, state.z + dz * speed * delta))
      distance = Math.hypot(x - state.x, z - state.z)
      state.x = x
      state.z = z
      state.heading = Math.atan2(dx, dz)
    }
    state.distance += distance
    state.moving = distance > 0
    state.running = state.moving && running

    if (jumpRequested && state.grounded) {
      state.verticalSpeed = jumpSpeed
      state.grounded = false
    }
    jumpRequested = false
    if (!state.grounded) {
      state.y += state.verticalSpeed * delta - gravity * delta * delta / 2
      state.verticalSpeed -= gravity * delta
      if (state.y <= 0) {
        state.y = 0
        state.verticalSpeed = 0
        state.grounded = true
      }
    }
  }

  return {
    state: state as Readonly<CharacterState>,
    setKey,
    clearInput,
    update,
    reset() {
      clearInput()
      Object.assign(state, initialState())
    },
  }
}

export type CharacterController = ReturnType<typeof createCharacterController>

/** Only the focused play surface owns movement keys; blur releases every key. */
export function bindCharacterKeyboard(element: HTMLElement, controller: CharacterController) {
  const tabIndex = element.getAttribute('tabindex')
  const shortcuts = element.getAttribute('aria-keyshortcuts')
  element.tabIndex = 0
  element.setAttribute('aria-keyshortcuts', 'W A S D ArrowUp ArrowLeft ArrowDown ArrowRight Shift Space R Escape')

  function focus() {
    element.focus({ preventScroll: true })
  }
  function keydown(event: KeyboardEvent) {
    if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || document.activeElement !== element)
      return
    if (event.code === 'Escape') {
      element.blur()
    }
    else if (event.code === 'KeyR') {
      if (!event.repeat)
        controller.reset()
    }
    else if (!controller.setKey(event.code, true, event.repeat)) {
      return
    }
    event.preventDefault()
    event.stopPropagation()
  }
  function keyup(event: KeyboardEvent) {
    if (controller.setKey(event.code, false) && document.activeElement === element) {
      event.preventDefault()
      event.stopPropagation()
    }
  }
  function visibilityChange() {
    if (document.hidden)
      controller.clearInput()
  }
  element.addEventListener('pointerdown', focus)
  element.addEventListener('keydown', keydown)
  element.addEventListener('keyup', keyup)
  element.addEventListener('blur', controller.clearInput)
  window.addEventListener('blur', controller.clearInput)
  document.addEventListener('visibilitychange', visibilityChange)

  return () => {
    controller.clearInput()
    element.removeEventListener('pointerdown', focus)
    element.removeEventListener('keydown', keydown)
    element.removeEventListener('keyup', keyup)
    element.removeEventListener('blur', controller.clearInput)
    window.removeEventListener('blur', controller.clearInput)
    document.removeEventListener('visibilitychange', visibilityChange)
    if (tabIndex === null)
      element.removeAttribute('tabindex')
    else
      element.setAttribute('tabindex', tabIndex)
    if (shortcuts === null)
      element.removeAttribute('aria-keyshortcuts')
    else
      element.setAttribute('aria-keyshortcuts', shortcuts)
  }
}
