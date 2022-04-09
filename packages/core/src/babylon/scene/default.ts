import * as BABYLON from '@babylonjs/core'
import '@babylonjs/loaders'

// CreateScene function that creates and return the scene
export const createScene = (engine: BABYLON.Engine) => {
  // Create a basic BJS Scene object
  const scene = new BABYLON.Scene(engine)
  scene.clearColor = new BABYLON.Color4(0, 0, 0, 0)

  const camera = new BABYLON.ArcRotateCamera('camera', Math.PI / 4, Math.PI / 2.5, 15, BABYLON.Vector3.Zero(), scene)
  camera.attachControl(null, true)

  camera.lowerRadiusLimit = 1
  camera.upperRadiusLimit = 25

  scene.activeCameras?.push(camera)

  // @ts-expect-error do not need used
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const light = new BABYLON.HemisphericLight('light', new BABYLON.Vector3(0, 1, 0), scene)

  // const box = BABYLON.MeshBuilder.CreateBox('box', {})

  // Create a default skybox with an environment.
  const hdrTexture = BABYLON.CubeTexture.CreateFromPrefilteredData('/assets/textures/environment.dds', scene)
  // @ts-expect-error do not need used
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const currentSkybox = scene.createDefaultSkybox(hdrTexture, true)

  BABYLON.SceneLoader.Append('/assets/scenes/low_poly_medieval_island/', 'scene.gltf', scene, () => {
    // Convert to physics object and position
  })

  // Return the created scene
  return scene
}
