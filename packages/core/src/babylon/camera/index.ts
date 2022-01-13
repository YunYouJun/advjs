import * as BABYLON from '@babylonjs/core'

export const createArcRotateCamera = (scene: BABYLON.Scene) => {
  // const camera = new BABYLON.ArcRotateCamera('camera', -1.6, 1.5, 2, new BABYLON.Vector3(0.4, 3.2, 0.75), scene)
  const camera = new BABYLON.ArcRotateCamera('camera', -Math.PI / 2, Math.PI / 2, 2, new BABYLON.Vector3(0, 1, 0), scene)
  camera.attachControl(null, true)

  camera.viewport = new BABYLON.Viewport(0, 0, 1, 1)
  scene.activeCameras?.push(camera)

  camera.wheelDeltaPercentage = 0.01
  // todo: add dev
  camera.minZ = 0.1
  camera.lowerRadiusLimit = 0.5
  camera.upperRadiusLimit = 10

  return camera
}
