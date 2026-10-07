import { BoxGeometry, Mesh, MeshBasicMaterial, OrthographicCamera, Scene, Texture } from 'three'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createThreeViewport, disposeThreeResources } from '../src'

vi.mock('three', async (importOriginal) => {
  const original = await importOriginal<typeof import('three')>()
  return {
    ...original,
    WebGLRenderer: class {
      render = vi.fn()
      setSize = vi.fn()
      setPixelRatio = vi.fn()
      dispose = vi.fn()
    },
  }
})

const frames = new Map<number, FrameRequestCallback>()
const disposals: Array<() => void> = []
let sequence = 0
beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    frames.set(++sequence, callback)
    return sequence
  })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id))
})
afterEach(() => {
  disposals.splice(0).forEach(dispose => dispose())
  frames.clear()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

function canvas(width = 400, height = 200) {
  const element = document.createElement('canvas')
  document.body.append(element)
  Object.defineProperties(element, { clientWidth: { configurable: true, value: width }, clientHeight: { configurable: true, value: height } })
  vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({ x: 100, y: 50, left: 100, top: 50, right: 900, bottom: 450, width: 800, height: 400, toJSON: () => ({}) })
  return element
}

function flush(time = 0) {
  const pending = [...frames]
  frames.clear()
  pending.forEach(([, callback]) => callback(time))
}

describe('three.js viewport lifecycle', () => {
  it('coalesces static invalidation and adjusts an orthographic camera to the canvas aspect', () => {
    const camera = new OrthographicCamera(-5, 5, 5, -5)
    const viewport = createThreeViewport(canvas(), { camera, pixelRatio: 1.5 })
    disposals.push(viewport.dispose)
    expect(camera.left).toBe(-10)
    expect(camera.right).toBe(10)
    expect(viewport.renderer.setSize).toHaveBeenCalledWith(400, 200, false)
    expect(viewport.renderer.setPixelRatio).toHaveBeenCalledWith(1.5)
    viewport.invalidate()
    viewport.invalidate()
    expect(frames.size).toBe(1)
    flush()
    expect(viewport.renderer.render).toHaveBeenCalledOnce()
    expect(frames.size).toBe(0)
  })

  it('pauses continuous work when inactive, hidden or context-lost and resumes without a large delta', () => {
    const element = canvas()
    const onFrame = vi.fn()
    const onContextChange = vi.fn()
    const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(false)
    const viewport = createThreeViewport(element, { continuous: true, controls: true, onFrame, onContextChange })
    disposals.push(viewport.dispose)
    flush(100)
    flush(120)
    expect(onFrame.mock.calls.at(-1)?.[1]).toBeCloseTo(0.02)
    viewport.setActive(false)
    expect(frames.size).toBe(0)
    expect(viewport.controls?.enabled).toBe(false)
    viewport.setActive(true)
    flush(10000)
    expect(onFrame.mock.calls.at(-1)?.[1]).toBe(0)
    hidden.mockReturnValue(true)
    document.dispatchEvent(new Event('visibilitychange'))
    expect(frames.size).toBe(0)
    hidden.mockReturnValue(false)
    document.dispatchEvent(new Event('visibilitychange'))
    expect(frames.size).toBe(1)
    const lost = new Event('webglcontextlost', { cancelable: true })
    element.dispatchEvent(lost)
    expect(lost.defaultPrevented).toBe(true)
    expect(frames.size).toBe(0)
    element.dispatchEvent(new Event('webglcontextrestored'))
    expect(frames.size).toBe(1)
    expect(onContextChange.mock.calls).toEqual([[true], [false]])
  })

  it('uses client bounds for picking a scaled game canvas and skips hidden objects', () => {
    const viewport = createThreeViewport(canvas())
    disposals.push(viewport.dispose)
    const mesh = new Mesh(new BoxGeometry(2, 2, 2), new MeshBasicMaterial())
    viewport.scene.add(mesh)
    expect(viewport.pick(500, 250)?.object).toBe(mesh)
    expect(viewport.pick(50, 250)).toBeUndefined()
    mesh.visible = false
    expect(viewport.pick(500, 250)).toBeUndefined()
    mesh.visible = true
    viewport.setActive(false)
    expect(viewport.pick(500, 250)).toBeUndefined()
  })

  it('picks only registered roots even when decoration lies in front of them', () => {
    const roots: Mesh[] = []
    const viewport = createThreeViewport(canvas(), { pickObjects: () => roots })
    disposals.push(viewport.dispose)
    const city = new Mesh(new BoxGeometry(2, 2, 2), new MeshBasicMaterial())
    const decoration = new Mesh(new BoxGeometry(2, 2, 2), new MeshBasicMaterial())
    decoration.position.copy(viewport.camera.position).multiplyScalar(0.5)
    viewport.scene.add(city, decoration)
    expect(viewport.pick(500, 250)).toBeUndefined()
    roots.push(city)
    expect(viewport.pick(500, 250)?.object).toBe(city)
    expect(viewport.pick(500, 250, [decoration])?.object).toBe(decoration)
  })

  it('notifies logical size changes after updating camera projection', () => {
    const element = canvas()
    const onResize = vi.fn()
    const viewport = createThreeViewport(element, { onResize })
    disposals.push(viewport.dispose)
    expect(onResize).toHaveBeenCalledWith(viewport)
    viewport.resize()
    expect(onResize).toHaveBeenCalledOnce()
    Object.defineProperty(element, 'clientWidth', { value: 200 })
    viewport.resize()
    expect(onResize).toHaveBeenCalledTimes(2)
    expect('aspect' in viewport.camera && viewport.camera.aspect).toBe(1)
  })

  it('releases owned resources and cancels all callbacks exactly once', () => {
    const element = canvas()
    const viewport = createThreeViewport(element, { controls: true, continuous: true })
    const geometry = new BoxGeometry()
    const texture = new Texture()
    const material = new MeshBasicMaterial({ map: texture })
    const geometryDispose = vi.spyOn(geometry, 'dispose')
    const textureDispose = vi.spyOn(texture, 'dispose')
    const materialDispose = vi.spyOn(material, 'dispose')
    const controlsDispose = vi.spyOn(viewport.controls!, 'dispose')
    viewport.scene.add(new Mesh(geometry, material), new Mesh(geometry, material))
    viewport.dispose()
    viewport.dispose()
    expect(viewport.signal.aborted).toBe(true)
    expect(viewport.renderer.dispose).toHaveBeenCalledOnce()
    expect(geometryDispose).toHaveBeenCalledOnce()
    expect(textureDispose).toHaveBeenCalledOnce()
    expect(materialDispose).toHaveBeenCalledOnce()
    expect(controlsDispose).toHaveBeenCalledOnce()
    window.dispatchEvent(new Event('resize'))
    element.dispatchEvent(new Event('webglcontextrestored'))
    viewport.invalidate()
    expect(frames.size).toBe(0)
  })

  it('leaves borrowed scene resources available to another viewport', () => {
    const scene = new Scene()
    const geometry = new BoxGeometry()
    const material = new MeshBasicMaterial()
    scene.add(new Mesh(geometry, material))
    const dispose = vi.spyOn(geometry, 'dispose')
    createThreeViewport(canvas(), { scene }).dispose()
    expect(dispose).not.toHaveBeenCalled()
    disposeThreeResources(scene)
    expect(dispose).toHaveBeenCalledOnce()
  })

  it('reports render failures and stops the animation loop', () => {
    const onError = vi.fn()
    const viewport = createThreeViewport(canvas(), { continuous: true, onError })
    disposals.push(viewport.dispose)
    vi.mocked(viewport.renderer.render).mockImplementation(() => {
      throw new Error('render failed')
    })
    flush()
    expect(onError.mock.calls[0]?.[0].message).toBe('render failed')
    expect(frames.size).toBe(0)
  })

  it('still releases the renderer if an owned resource cleanup throws', () => {
    const viewport = createThreeViewport(canvas())
    disposals.push(viewport.dispose)
    const geometry = new BoxGeometry()
    viewport.scene.add(new Mesh(geometry, new MeshBasicMaterial()))
    vi.spyOn(geometry, 'dispose').mockImplementation(() => {
      throw new Error('cleanup failed')
    })
    expect(viewport.dispose).toThrow('cleanup failed')
    expect(viewport.signal.aborted).toBe(true)
    expect(viewport.renderer.dispose).toHaveBeenCalledOnce()
    expect(frames.size).toBe(0)
  })

  it('does not allocate zero-size buffers and resizes after a hidden panel becomes visible', () => {
    const element = canvas(0, 0)
    const viewport = createThreeViewport(element)
    disposals.push(viewport.dispose)
    expect(viewport.renderer.setSize).not.toHaveBeenCalled()
    expect(frames.size).toBe(0)
    Object.defineProperties(element, { clientWidth: { value: 320 }, clientHeight: { value: 240 } })
    viewport.resize()
    expect(viewport.renderer.setSize).toHaveBeenCalledWith(320, 240, false)
    expect(frames.size).toBe(1)
  })
})
