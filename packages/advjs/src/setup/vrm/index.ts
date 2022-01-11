/* eslint-disable @typescript-eslint/no-unused-vars */
import * as BABYLON from '@babylonjs/core'
import '@babylonjs/loaders'
import type { VRMManager } from 'babylon-vrm-loader'
import { createVRMScene, getVrmManager } from '../babylon/vrm'

// todo: extract canvas element
export async function setup(canvas: HTMLCanvasElement, onVRMLoaded?: (vrmManager: VRMManager) => void) {
  await import('babylon-vrm-loader')

  // Load the 3D engine
  const engine = new BABYLON.Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true })

  // a new scene for vrm
  const scene = createVRMScene(engine, () => {
    // on vrm loaded
    const vrmManager = getVrmManager(scene)

    if (onVRMLoaded)
      onVRMLoaded(vrmManager)
  })

  // Create a default skybox with an environment.
  const hdrTexture = BABYLON.CubeTexture.CreateFromPrefilteredData('/assets/textures/environment.dds', scene)
  // @ts-expect-error do not need used
  const currentSkybox = scene.createDefaultSkybox(hdrTexture, true)

  // run the render loop
  engine.runRenderLoop(() => {
    scene.render()
  })

  // the canvas/window resize event handler
  window.addEventListener('resize', () => {
    engine.resize()
  })

  return {
    engine,
    scene,
  }
}
