/* eslint-disable @typescript-eslint/no-unused-vars */
import * as BABYLON from '@babylonjs/core'
import '@babylonjs/loaders'
import { createVRMScene } from './vrm'

// todo: extract canvas element
export async function setup(canvas: HTMLCanvasElement) {
  await import('babylon-vrm-loader')

  // Load the 3D engine
  const engine = new BABYLON.Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true })

  // CreateScene function that creates and return the scene
  const createScene = function() {
    // Create a basic BJS Scene object
    const scene = new BABYLON.Scene(engine)
    scene.clearColor = new BABYLON.Color4(0, 0, 0, 0)

    const camera = new BABYLON.ArcRotateCamera('camera', Math.PI / 4, Math.PI / 2.5, 15, BABYLON.Vector3.Zero(), scene)
    camera.attachControl(canvas, true)

    camera.lowerRadiusLimit = 1
    camera.upperRadiusLimit = 25

    scene.activeCameras?.push(camera)

    // @ts-expect-error do not need used
    const light = new BABYLON.HemisphericLight('light', new BABYLON.Vector3(0, 1, 0), scene)

    // const box = BABYLON.MeshBuilder.CreateBox('box', {})

    // Create a default skybox with an environment.
    const hdrTexture = BABYLON.CubeTexture.CreateFromPrefilteredData('/assets/textures/environment.dds', scene)
    // @ts-expect-error do not need used
    const currentSkybox = scene.createDefaultSkybox(hdrTexture, true)

    BABYLON.SceneLoader.Append('/assets/scenes/low_poly_medieval_island/', 'scene.gltf', scene, (scene) => {
      // Convert to physics object and position

    })

    // Return the created scene
    return scene
  }
  // call the createScene function
  const scene = createScene()

  // a new scene for vrm
  const vrmScene = createVRMScene(engine)

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
