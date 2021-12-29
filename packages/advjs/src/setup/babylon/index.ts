/* eslint-disable @typescript-eslint/no-unused-vars */
import * as BABYLON from 'babylonjs'
import 'babylonjs-loaders'

// todo: extract canvas element
export function setup(canvas: HTMLCanvasElement) {
  // Load the 3D engine
  const engine = new BABYLON.Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true })

  // CreateScene function that creates and return the scene
  const createScene = function() {
    // Create a basic BJS Scene object
    const scene = new BABYLON.Scene(engine)

    const camera = new BABYLON.ArcRotateCamera('camera', Math.PI / 4, Math.PI / 2.5, 15, BABYLON.Vector3.Zero(), scene)
    camera.attachControl(canvas, true)

    camera.lowerRadiusLimit = 2
    camera.upperRadiusLimit = 25

    // @ts-ignore
    const light = new BABYLON.HemisphericLight('light', new BABYLON.Vector3(0, 1, 0), scene)

    // @ts-ignore
    // const box = BABYLON.MeshBuilder.CreateBox('box', {})

    // Create a default skybox with an environment.
    const hdrTexture = BABYLON.CubeTexture.CreateFromPrefilteredData('/assets/textures/environment.dds', scene)
    // @ts-ignore
    const currentSkybox = scene.createDefaultSkybox(hdrTexture, true)

    // BABYLON.SceneLoader.Append('/models/low_poly_winter_scene/', 'scene.gltf', scene)
    BABYLON.SceneLoader.Append('/assets/scenes/low_poly_medieval_island/', 'scene.gltf', scene)

    // Return the created scene
    return scene
  }
  // call the createScene function
  const scene = createScene()

  // run the render loop
  engine.runRenderLoop(() => {
    scene.render()
  })

  // the canvas/window resize event handler
  window.addEventListener('resize', () => {
    engine.resize()
  })

  return {
    scene,
  }
}
