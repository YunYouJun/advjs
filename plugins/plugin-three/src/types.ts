import type { Intersection, Object3D, OrthographicCamera, PerspectiveCamera, Scene, WebGLRenderer } from 'three'
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js'

export interface ThreeViewportOptions {
  /** Borrowed scene: its resources remain the caller's responsibility. */
  scene?: Scene
  camera?: PerspectiveCamera | OrthographicCamera
  controls?: boolean
  /** Defaults to the device pixel ratio, capped at 2. */
  pixelRatio?: number
  /** Static scenes render on demand; enable this for animations. */
  continuous?: boolean
  /** Limit picking to interactive roots, excluding scenery and overlays. */
  pickObjects?: () => Object3D[]
  /** Called after a nonzero logical size changes, before the next render. */
  onResize?: (viewport: ThreeViewport) => void
  onFrame?: (viewport: ThreeViewport, deltaSeconds: number) => void
  onError?: (error: Error) => void
  onContextChange?: (lost: boolean) => void
}

export interface ThreeViewport {
  readonly scene: Scene
  readonly camera: PerspectiveCamera | OrthographicCamera
  readonly renderer: WebGLRenderer
  readonly controls: OrbitControls | undefined
  /** Aborted on disposal, including a component setup failure. */
  readonly signal: AbortSignal
  invalidate: () => void
  resize: () => void
  setActive: (active: boolean) => void
  pick: (clientX: number, clientY: number, objects?: Object3D[]) => Intersection | undefined
  dispose: () => void
}

export type ThreeSceneSetup = (viewport: ThreeViewport) => void | (() => void)
