import type { ThreeViewport, ThreeViewportOptions } from '../src'
import { createThreeViewport } from '@advjs/plugin-three'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, h, KeepAlive, nextTick, shallowRef } from 'vue'
import AdvThreeCanvas from '../client/AdvThreeCanvas.vue'

vi.mock('@advjs/plugin-three', () => ({ createThreeViewport: vi.fn() }))

const mounts: Array<() => void> = []
const instances: ThreeViewport[] = []
const options: ThreeViewportOptions[] = []
beforeEach(() => {
  vi.mocked(createThreeViewport).mockImplementation((_canvas, settings = {}) => {
    const controller = new AbortController()
    const viewport = {
      signal: controller.signal,
      invalidate: vi.fn(),
      setActive: vi.fn(),
      pick: vi.fn(),
      dispose: vi.fn(() => controller.abort()),
    } as unknown as ThreeViewport
    instances.push(viewport)
    options.push(settings)
    return viewport
  })
})
afterEach(() => {
  mounts.splice(0).forEach(unmount => unmount())
  instances.length = 0
  options.length = 0
  vi.resetAllMocks()
  document.body.innerHTML = ''
})

function mount(render: () => ReturnType<typeof h>) {
  const root = document.createElement('div')
  document.body.append(root)
  const app = createApp({ render })
  app.mount(root)
  mounts.push(() => app.unmount())
  return root
}

function pointer(canvas: HTMLCanvasElement, type: string, x: number, y: number) {
  const event = new MouseEvent(type, { button: 0, clientX: x, clientY: y, bubbles: true })
  Object.defineProperty(event, 'pointerId', { value: 1 })
  canvas.dispatchEvent(event)
}

describe('three.js Vue canvas boundary', () => {
  it('disposes a partially populated scene when setup fails and supports retry', async () => {
    const setup = vi.fn().mockImplementationOnce(() => {
      throw new Error('asset failed')
    })
    const onError = vi.fn()
    const root = mount(() => h(AdvThreeCanvas, { setup, onError }, {
      error: ({ error, retry }: { error: Error, retry: () => void }) => h('button', { onClick: retry }, error.message),
    }))
    await nextTick()
    expect(instances[0]?.signal.aborted).toBe(true)
    expect(instances[0]?.dispose).toHaveBeenCalledOnce()
    expect(onError.mock.calls[0]?.[0].message).toBe('asset failed')
    root.querySelector('button')!.click()
    await nextTick()
    expect(instances).toHaveLength(2)
    expect(root.querySelector('[role="alert"]')).toBeNull()
  })

  it('cleans up before rebuilding and disposes the latest viewport on unmount', async () => {
    const cleanup = vi.fn()
    const setup = () => cleanup
    const settings = shallowRef<ThreeViewportOptions>({ controls: false })
    mount(() => h(AdvThreeCanvas, { setup, options: settings.value }))
    const first = instances[0]!
    settings.value = { controls: true }
    await nextTick()
    expect(cleanup).toHaveBeenCalledOnce()
    expect(first.dispose).toHaveBeenCalledOnce()
    expect(cleanup.mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(first.dispose).mock.invocationCallOrder[0]!)
    mounts.pop()!()
    expect(cleanup).toHaveBeenCalledTimes(2)
    expect(instances[1]?.dispose).toHaveBeenCalledOnce()
  })

  it('pauses for active changes and KeepAlive without discarding scene resources', async () => {
    const active = shallowRef(true)
    const shown = shallowRef(true)
    mount(() => h(KeepAlive, null, { default: () => shown.value ? h(AdvThreeCanvas, { active: active.value }) : null }))
    const viewport = instances[0]!
    active.value = false
    await nextTick()
    expect(viewport.setActive).toHaveBeenLastCalledWith(false)
    active.value = true
    await nextTick()
    expect(viewport.setActive).toHaveBeenLastCalledWith(true)
    shown.value = false
    await nextTick()
    expect(viewport.setActive).toHaveBeenLastCalledWith(false)
    expect(viewport.dispose).not.toHaveBeenCalled()
    shown.value = true
    await nextTick()
    expect(instances).toHaveLength(1)
    expect(viewport.setActive).toHaveBeenLastCalledWith(true)
  })

  it('selects on clicks, ignores drags and stops the host click handler', () => {
    const onPick = vi.fn()
    const onClick = vi.fn()
    const root = mount(() => h('div', { onClick }, [h(AdvThreeCanvas, { label: 'Map', onPick })]))
    const canvas = root.querySelector('canvas')!
    expect(canvas.getAttribute('aria-label')).toBe('Map')
    pointer(canvas, 'pointerdown', 10, 10)
    pointer(canvas, 'pointerup', 50, 10)
    expect(onPick).not.toHaveBeenCalled()
    pointer(canvas, 'pointerdown', 10, 10)
    pointer(canvas, 'pointermove', 50, 10)
    pointer(canvas, 'pointerup', 10, 10)
    expect(onPick).not.toHaveBeenCalled()
    pointer(canvas, 'pointerdown', 10, 10)
    pointer(canvas, 'pointerup', 11, 12)
    expect(instances[0]?.pick).toHaveBeenCalledWith(11, 12)
    expect(onPick).toHaveBeenCalledOnce()
    canvas.click()
    expect(onClick).not.toHaveBeenCalled()
  })

  it('forwards context notifications and clears the fallback on restoration', async () => {
    const onContextChange = vi.fn()
    const onError = vi.fn()
    const root = mount(() => h(AdvThreeCanvas, { options: { onContextChange }, onError }))
    options[0]?.onContextChange?.(true)
    await nextTick()
    expect(root.querySelector('[role="alert"]')?.textContent).toContain('WebGL context lost')
    expect(onError).toHaveBeenCalledOnce()
    options[0]?.onContextChange?.(false)
    await nextTick()
    expect(root.querySelector('[role="alert"]')).toBeNull()
    expect(onContextChange.mock.calls).toEqual([[true], [false]])
  })
})
