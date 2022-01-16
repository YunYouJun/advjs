import * as BABYLON from '@babylonjs/core'
import type { VRMManager } from 'babylon-vrm-loader'
import type { HumanBonesType } from './pose'
import { HumanBones, vRawPoseData } from './pose'

export function getVrmManager(scene?: BABYLON.Scene) {
  if (!scene?.metadata) return
  const vrmManager = scene?.metadata.vrmManagers[scene?.metadata.vrmManagers.length - 1] as VRMManager
  return vrmManager
}

// https://doc.babylonjs.com/divingDeeper/scene/multiScenes
export function createVRMScene(engine: BABYLON.Engine) {
  const scene = new BABYLON.Scene(engine)
  scene.clearColor = new BABYLON.Color4(0, 0, 0, 0)
  scene.autoClear = false

  // BABYLON.SceneLoader.Append('/assets/scenes/low_poly_winter_scene/', 'scene.gltf', scene)

  // Lights
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  // const lightHemi = new BABYLON.HemisphericLight('light', new BABYLON.Vector3(0, 2, 0), scene)
  // lightHemi.intensity = 0.5

  // Tone mapping
  // https://zhuanlan.zhihu.com/p/21983679
  scene.imageProcessingConfiguration.toneMappingEnabled = true
  scene.imageProcessingConfiguration.toneMappingType = BABYLON.ImageProcessingConfiguration.TONEMAPPING_ACES
  scene.imageProcessingConfiguration.exposure = 3

  // Return the created scene
  return scene
}

/**
 * 摆姿势
 * @param manager
 */
function makePose(manager: VRMManager) {
  const poseData = vRawPoseData
  HumanBones.forEach((name) => {
    const boneName = name as HumanBonesType
    if (manager.humanoidBone[boneName]) {
      manager.humanoidBone[boneName]!.rotationQuaternion = (
        poseData[boneName] ? BABYLON.Quaternion.FromArray(poseData[boneName]!.rotation!) : BABYLON.Quaternion.FromEulerAngles(0, 0, 0)
      )
    }
  })
}

export function createVRM(scene: BABYLON.Scene, rootUrl: string, vrmFilename: string | File, onLoaded?: () => void) {
  BABYLON.SceneLoader.Append(
    rootUrl,
    vrmFilename,
    scene,
    () => {
      const vrmManager = getVrmManager(scene)
      if (!vrmManager) return

      // scene.registerBeforeRender(() => {
      //   // Update SpringBone
      //   vrmManager.update(scene.getEngine().getDeltaTime())
      // })

      if (onLoaded) onLoaded()

      // Model Transformation
      // vrmManager.rootMesh.translate(new BABYLON.Vector3(0, 1, 0), 2)
      makePose(vrmManager)
    },
  )
}
