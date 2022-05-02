import * as BABYLON from '@babylonjs/core'
import { demoVrm } from '@advjs/shared'
import { isDev } from '@advjs/shared/utils'
import { createArcRotateCamera, createScene, createVRM, createVRMScene } from '@advjs/core/babylon'

/**
 * 创建人物场景
 * @param engine
 * @returns
 */
export const createCharacterScene = (engine: BABYLON.Engine) => {
  // a new scene for vrm
  const scene = createVRMScene(engine)
  createArcRotateCamera(scene)
  createVRM(scene, (isDev ? '/assets' : '') + demoVrm.rootUrl, demoVrm.name, () => { })
  // Lights
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  // eslint-disable-next-line no-new
  new BABYLON.DirectionalLight('light', new BABYLON.Vector3(0, 2, 0), scene)
  return scene
}

/**
 * 初始化
 * @param canvas
 * @returns
 */
export const setup = async (canvas: HTMLCanvasElement) => {
  // Load the 3D engine
  const engine = new BABYLON.Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true })
  const scene = createScene(engine)

  const vrmScene = createCharacterScene(engine)

  // run the render loop
  engine.runRenderLoop(() => {
    scene.render()

    vrmScene.render()
  })

  // the canvas/window resize event handler
  window.addEventListener('resize', () => {
    engine.resize()
  })

  return {
    scene,
    vrmScene,
  }
}
