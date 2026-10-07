import type { Object3D } from 'three'
import type { ThreeViewport, ThreeViewportOptions } from './types'
import { PerspectiveCamera, Raycaster, Scene, Vector2, WebGLRenderer } from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { disposeThreeResources } from './resources'

/** Create browser rendering infrastructure without owning game state. */
export function createThreeViewport(canvas: HTMLCanvasElement, options: ThreeViewportOptions = {}): ThreeViewport {
  if (options.pixelRatio !== undefined && (!Number.isFinite(options.pixelRatio) || options.pixelRatio <= 0))
    throw new Error('Three.js pixelRatio must be a positive finite number')

  const scene = options.scene ?? new Scene()
  const camera = options.camera ?? new PerspectiveCamera(45, 1, 0.1, 1000)
  if (!options.camera) {
    camera.position.set(0, 8, 12)
    camera.lookAt(0, 0, 0)
  }
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true })
  // Babylon's global canvas declaration has a legacy requestPointerLock return
  // type. Normalize only this DOM boundary; no pointer lock is used here.
  const element = canvas as unknown as HTMLElement
  let controls: OrbitControls | undefined
  try {
    controls = options.controls ? new OrbitControls(camera, element) : undefined
  }
  catch (cause) {
    renderer.dispose()
    throw cause
  }
  const controller = new AbortController()
  const raycaster = new Raycaster()
  let active = true
  let disposed = false
  let contextLost = false
  let frame: number | undefined
  let previousTime: number | undefined
  let width = 0
  let height = 0
  let viewport: ThreeViewport
  let observer: ResizeObserver | undefined
  const canRender = () => active && !disposed && !contextLost && !document.hidden && width > 0 && height > 0

  function cancelFrame() {
    if (frame !== undefined)
      cancelAnimationFrame(frame)
    frame = undefined
    previousTime = undefined
  }

  function invalidate() {
    if (!canRender() || frame !== undefined)
      return
    frame = requestAnimationFrame((time) => {
      frame = undefined
      if (!canRender())
        return
      try {
        const delta = previousTime === undefined ? 0 : Math.min((time - previousTime) / 1000, 0.1)
        previousTime = time
        options.onFrame?.(viewport, delta)
        if (!canRender())
          return
        controls?.update()
        renderer.render(scene, camera)
        if (options.continuous)
          invalidate()
      }
      catch (cause) {
        setActive(false)
        options.onError?.(cause instanceof Error ? cause : new Error(String(cause)))
      }
    })
  }

  function resize() {
    if (disposed)
      return
    const changed = width !== canvas.clientWidth || height !== canvas.clientHeight
    width = canvas.clientWidth
    height = canvas.clientHeight
    if (width <= 0 || height <= 0) {
      cancelFrame()
      return
    }
    renderer.setPixelRatio(options.pixelRatio ?? Math.min(window.devicePixelRatio || 1, 2))
    renderer.setSize(width, height, false)
    const aspect = width / height
    if ('isPerspectiveCamera' in camera) {
      camera.aspect = aspect
    }
    else {
      const center = (camera.left + camera.right) / 2
      const halfWidth = (camera.top - camera.bottom) * aspect / 2
      camera.left = center - halfWidth
      camera.right = center + halfWidth
    }
    camera.updateProjectionMatrix()
    if (changed)
      options.onResize?.(viewport)
    invalidate()
  }

  function setActive(value: boolean) {
    active = value
    if (controls)
      controls.enabled = value && !contextLost && !document.hidden
    if (canRender())
      invalidate()
    else
      cancelFrame()
  }

  function visible(object: Object3D): boolean {
    for (let current: Object3D | null = object; current; current = current.parent) {
      if (!current.visible)
        return false
    }
    return true
  }

  function pick(clientX: number, clientY: number, objects = options.pickObjects?.() ?? scene.children) {
    const bounds = canvas.getBoundingClientRect()
    if (!canRender() || !bounds.width || !bounds.height || clientX < bounds.left || clientX > bounds.right || clientY < bounds.top || clientY > bounds.bottom)
      return undefined
    scene.updateMatrixWorld(true)
    camera.updateMatrixWorld(true)
    raycaster.setFromCamera(new Vector2((clientX - bounds.left) / bounds.width * 2 - 1, 1 - (clientY - bounds.top) / bounds.height * 2), camera)
    return raycaster.intersectObjects(objects, true).find(hit => visible(hit.object))
  }

  function visibilityChange() {
    setActive(active)
  }

  function lost(event: Event) {
    event.preventDefault()
    contextLost = true
    setActive(active)
    options.onContextChange?.(true)
  }

  function restored() {
    contextLost = false
    options.onContextChange?.(false)
    setActive(active)
    resize()
  }

  viewport = {
    scene,
    camera,
    renderer,
    controls,
    signal: controller.signal,
    invalidate,
    resize,
    setActive,
    pick,
    dispose() {
      if (disposed)
        return
      disposed = true
      controller.abort()
      cancelFrame()
      observer?.disconnect()
      window.removeEventListener('resize', resize)
      document.removeEventListener('visibilitychange', visibilityChange)
      canvas.removeEventListener('webglcontextlost', lost)
      canvas.removeEventListener('webglcontextrestored', restored)
      controls?.removeEventListener('change', invalidate)
      try {
        controls?.dispose()
        if (!options.scene)
          disposeThreeResources(scene)
      }
      finally {
        renderer.dispose()
      }
    },
  }
  try {
    controls?.addEventListener('change', invalidate)
    observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(resize)
    observer?.observe(element)
    window.addEventListener('resize', resize)
    document.addEventListener('visibilitychange', visibilityChange)
    canvas.addEventListener('webglcontextlost', lost)
    canvas.addEventListener('webglcontextrestored', restored)
    resize()
  }
  catch (cause) {
    viewport.dispose()
    throw cause
  }
  return viewport
}
