import { ref } from 'vue'
import type { Directive } from 'vue'

let pointerLockSupported = true

export interface Config {
  props: {
    modelValue: number
    step?: number
    min?: number
    max?: number
  }
  onChange: (value: number) => void
  onClick?: (e: MouseEvent) => void
  onDown?: (e: MouseEvent) => void
  onUp?: (e: MouseEvent) => void
}

export default function numberDrag(config: Config): Directive {
  const elRef = ref<HTMLElement>()
  let started:
    | {
      moved: number
      value: number
      ts: number
    }
    | undefined

  const { props } = config

  function onMousedown(e: MouseEvent) {
    if (!props.step)
      return

    config.onDown?.(e)
    if (typeof props.modelValue === 'number') {
      started = {
        moved: 0,
        value: props.modelValue,
        ts: Date.now(),
      }
      document.addEventListener('mousemove', onMousemove)
      if (e.target === elRef.value)
        requestPointerLock(elRef.value)
    }
  }

  function onMouseup(e: MouseEvent) {
    config.onUp?.(e)
    if (!started)
      return

    document.removeEventListener('mousemove', onMousemove)
    if (pointerLockSupported)
      document.exitPointerLock()

    if (started.moved === 0)
      config?.onClick?.(e)

    started = undefined
  }

  function onMousemove(e: MouseEvent) {
    if (!started || !props.step)
      return

    if (started.moved === 0) {
      // The first mousemove event Firefox has misbehaving movementX values, bug 1417702
      started.moved = Math.min(1, Math.max(e.movementX, -1))
    }
    else {
      started.moved += e.movementX
    }

    const mouseStep = e.shiftKey ? props.step / 20 : props.step
    const offset = started.moved * mouseStep
    let value = started.value + offset
    if (e.ctrlKey) {
      const rest = value % (props.step * (e.shiftKey ? 1 : 10))
      value -= rest
    }

    if (typeof props.min === 'number' && value < props.min)
      value = props.min

    if (typeof props.max === 'number' && value > props.max)
      value = props.max

    config.onChange(value)
  }

  return {
    mounted: (el) => {
      elRef.value = el
      el.addEventListener('mousedown', onMousedown)
      document.addEventListener('mouseup', onMouseup)
    },
    unmounted(el) {
      el.removeEventListener('mousedown', onMousedown)
      document.removeEventListener('mouseup', onMouseup)
      document.removeEventListener('mousemove', onMousemove)
    },
  }
}

async function requestPointerLock(el: HTMLElement) {
  if (!pointerLockSupported)
    return

  try {
    await el.requestPointerLock()
  }
  catch (err) {
    console.warn(err)
    pointerLockSupported = false
  }
}
