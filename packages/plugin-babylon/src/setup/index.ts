import * as BABYLON from '@babylonjs/core'
import { demoVrm } from '@advjs/shared'
import { createScene } from '../scene'
import { createArcRotateCamera } from '../camera'
import { createVRM } from '../vrm'

/**
 * 创建人物场景
 */
export async function createCharacterScene(scene: BABYLON.Scene) {
  await createVRM(scene, (__DEV__ ? '/assets' : '') + demoVrm.rootUrl, demoVrm.name, () => { })
  if (!scene)
    throw new Error('createVRM failed')

  // a new scene for vrm
  createArcRotateCamera(scene)
  // Lights

  // eslint-disable-next-line no-new
  new BABYLON.DirectionalLight('light', new BABYLON.Vector3(0, 2, 0), scene)
  return scene
}

/**
 * 初始化
 * @param canvas
 */
export async function setup(canvas: HTMLCanvasElement) {
  // Load the 3D engine
  const engine = new BABYLON.Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true })
  const { scene } = await createScene(engine)

  const vrmScene = await createCharacterScene(scene)

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
    engine,
    scene,
    vrmScene,

    /**
     * dispose
     */
    dispose: () => {
      scene.dispose()
      vrmScene.dispose()
      engine.dispose()
    },
  }
}
