import * as BABYLON from '@babylonjs/core'
import '@babylonjs/loaders'

function getAssetsPrefix(online = 'https://playground.babylonjs.com', local = '/assets') {
  return __DEV__ ? local : online
}

// CreateScene function that creates and return the scene
export async function createScene(engine: BABYLON.Engine) {
  // Create a basic BJS Scene object
  const scene = await BABYLON.SceneLoader.LoadAsync(
    `${getAssetsPrefix('https://fastly.jsdelivr.net/gh/advjs/assets')}/scenes/low_poly_medieval_island/`,
    'scene.gltf',
    engine,
  )

  scene.clearColor = new BABYLON.Color4(0, 0, 0, 0)

  const camera = new BABYLON.ArcRotateCamera('camera', Math.PI / 4, Math.PI / 2.5, 15, BABYLON.Vector3.Zero(), scene)
  camera.attachControl(null, true)

  camera.lowerRadiusLimit = 1
  camera.upperRadiusLimit = 25

  scene.activeCameras?.push(camera)

  const light = new BABYLON.HemisphericLight('light', new BABYLON.Vector3(0, 1, 0), scene)

  // const box = BABYLON.MeshBuilder.CreateBox('box', {})

  // Create a default skybox with an environment.
  const hdrTexture = BABYLON.CubeTexture.CreateFromPrefilteredData(
    `${getAssetsPrefix()}/textures/environment.dds`, scene,
  )

  const currentSkybox = scene.createDefaultSkybox(hdrTexture, true)

  // Return the created scene
  return {
    light,
    currentSkybox,
    scene,
  }
}
