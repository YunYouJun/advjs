import type { Directive } from 'vue'
import { clampNumber, stepNumber } from '../components/input/numeric'

export interface Config {
  props: { modelValue: number, step?: number, min?: number, max?: number, disabled?: boolean }
  onChange: (value: number) => void
  onClick?: (event: PointerEvent) => void
  onDown?: (event: PointerEvent) => void
  onUp?: (event: PointerEvent) => void
}

/** Pointer capture keeps scrubbing local, including cancellation and unmount. */
export default function numberDrag(config: Config): Directive<HTMLElement> {
  let started: { x: number, value: number, pointerId: number, moved: boolean } | undefined
  const { props } = config
  function down(event: PointerEvent) {
    if (event.button !== 0 || props.disabled || !props.step || !Number.isFinite(props.modelValue))
      return
    event.preventDefault()
    started = { x: event.clientX, value: props.modelValue, pointerId: event.pointerId, moved: false }
    ;(event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId)
    config.onDown?.(event)
  }
  function move(event: PointerEvent) {
    if (!started || event.pointerId !== started.pointerId || props.disabled || !props.step)
      return
    const distance = event.clientX - started.x
    if (!started.moved && Math.abs(distance) < 3)
      return
    started.moved = true
    const step = event.shiftKey ? props.step / 20 : props.step
    let next = stepNumber(started.value, distance * step)
    if (event.ctrlKey) {
      const snap = props.step * (event.shiftKey ? 1 : 10)
      next = Number((Math.round(next / snap) * snap).toPrecision(15))
    }
    config.onChange(clampNumber(next, props.min, props.max))
  }
  function up(event: PointerEvent) {
    if (!started || event.pointerId !== started.pointerId)
      return
    const click = !started.moved && event.type === 'pointerup' && !props.disabled
    started = undefined
    config.onUp?.(event)
    if (click)
      config.onClick?.(event)
  }
  return {
    mounted(el) {
      el.addEventListener('pointerdown', down)
      el.addEventListener('pointermove', move)
      el.addEventListener('pointerup', up)
      el.addEventListener('pointercancel', up)
      el.addEventListener('lostpointercapture', up)
    },
    unmounted(el) {
      started = undefined
      el.removeEventListener('pointerdown', down)
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
      el.removeEventListener('pointercancel', up)
      el.removeEventListener('lostpointercapture', up)
    },
  }
}
