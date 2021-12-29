import * as BABYLON from 'babylonjs'
import 'babylon-vrm-loader'

export function loadVRM(callback) {
  BABYLON.SceneLoader.Append(
    'https://raw.githubusercontent.com/vrm-c/UniVRM/master/Tests/Models/Alicia_vrm-0.51/',
    'AliciaSolid_vrm-0.51.vrm',
    scene,
    callback,
  )
}

export function onVRMLoaded() {
  const manager = scene.metadata.vrmManagers[0]
  scene.registerBeforeRender(() => {
    // Update SpringBone
    manager.update(scene.getEngine().getDeltaTime())
  })

  addUI(manager)
  makePose(manager)
}
