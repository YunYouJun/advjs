import type { Ref } from 'vue'
import type { AuthoringGraph } from './types'
import { nextTick, onMounted, onUnmounted, shallowRef, watch } from 'vue'

export function useAuthoringCanvas(viewport: Readonly<Ref<HTMLElement | null>>, graph: () => AuthoringGraph, selected: () => string, size: () => { width: number, height: number }) {
  const zoom = shallowRef(0.85)
  const x = shallowRef(32)
  const y = shallowRef(32)
  let drag: { x: number, y: number, px: number, py: number, pointer: number } | null = null
  let observer: ResizeObserver | undefined
  function center() {
    const node = graph().nodes.find(node => node.id === selected()) ?? graph().nodes[0]
    if (!node || !viewport.value)
      return
    x.value = viewport.value.clientWidth * 0.27 - (node.x + size().width / 2) * zoom.value
    y.value = viewport.value.clientHeight / 2 - (node.y + size().height / 2) * zoom.value
  }
  function scale(factor: number) {
    if (!viewport.value)
      return
    const next = Math.min(1.5, Math.max(0.15, zoom.value * factor))
    const cx = viewport.value.clientWidth / 2
    const cy = viewport.value.clientHeight / 2
    x.value = cx - (cx - x.value) * next / zoom.value
    y.value = cy - (cy - y.value) * next / zoom.value
    zoom.value = next
  }
  function fit() {
    if (!viewport.value)
      return
    zoom.value = Math.max(0.15, Math.min(1, (viewport.value.clientWidth - 48) / Math.max(1, graph().width), (viewport.value.clientHeight - 48) / Math.max(1, graph().height)))
    x.value = (viewport.value.clientWidth - graph().width * zoom.value) / 2
    y.value = (viewport.value.clientHeight - graph().height * zoom.value) / 2
  }
  function wheel(event: WheelEvent) {
    if (event.ctrlKey || event.metaKey) {
      scale(event.deltaY < 0 ? 1.1 : 1 / 1.1)
    }
    else {
      x.value -= event.deltaX
      y.value -= event.deltaY
    }
  }
  function start(event: PointerEvent) {
    if (drag || (event.target as Element).closest('button') || event.button !== 0 || !viewport.value)
      return
    drag = { x: x.value, y: y.value, px: event.clientX, py: event.clientY, pointer: event.pointerId }
    viewport.value.setPointerCapture(event.pointerId)
  }
  function move(event: PointerEvent) {
    if (drag?.pointer === event.pointerId) {
      x.value = drag.x + event.clientX - drag.px
      y.value = drag.y + event.clientY - drag.py
    }
  }
  function end(event: PointerEvent) {
    if (drag?.pointer !== event.pointerId)
      return
    drag = null
    if (viewport.value?.hasPointerCapture(event.pointerId))
      viewport.value.releasePointerCapture(event.pointerId)
  }
  watch(() => [graph().id, selected()], async () => {
    await nextTick()
    center()
  })
  onMounted(() => {
    center()
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(center)
      if (viewport.value)
        observer.observe(viewport.value)
    }
  })
  onUnmounted(() => {
    observer?.disconnect()
    drag = null
  })
  return { zoom, x, y, center, scale, fit, wheel, start, move, end }
}
