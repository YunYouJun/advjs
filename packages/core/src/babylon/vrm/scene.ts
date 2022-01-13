import { isDev } from '@advjs/shared/utils'
import * as BABYLON from '@babylonjs/core'
import type { VRMManager } from 'babylon-vrm-loader'
import type { RawPoseData } from '../types'
import type { HumanBonesType } from './pose'
import { defaultPoseQuaternion, v2RawPoseData } from './pose'

export function getVrmManager(scene: BABYLON.Scene) {
  const vrmManager = scene.metadata.vrmManagers[0] as VRMManager
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

export function createVRM(scene: BABYLON.Scene, onLoaded?: () => void) {
  // const cdnPrefix = 'https://upyun.yunyoujun.cn'
  const cdnPrefix = 'https://v.yyj.moe'
  function loadVRM(callback: () => void) {
    BABYLON.SceneLoader.Append(
      `${isDev ? '' : cdnPrefix}/models/vrm/`,
      'alicia-solid.vrm',
      // 'xiao-yun.vrm', // 模型载入有点问题
      scene,
      callback,
    )
  }

  function makePose(manager: VRMManager) {
    const vPoseData: Partial<RawPoseData> = {}
    const rawPoseData = v2RawPoseData
    // eslint-disable-next-line no-restricted-syntax
    for (const key in rawPoseData) {
      const bone = rawPoseData[key as HumanBonesType]
      if (bone)
        vPoseData[key as HumanBonesType] = BABYLON.Quaternion.FromEulerAngles(bone.x, bone.y, bone.z)
    }

    const poseData = Object.assign(defaultPoseQuaternion, vPoseData)

    Object.keys(poseData).forEach((name) => {
      const boneName = name as HumanBonesType
      if (manager.humanoidBone[boneName])
        manager.humanoidBone[boneName]!.rotationQuaternion = poseData[boneName]
    })
  }

  loadVRM(() => {
    const vrmManager = getVrmManager(scene)
    // scene.registerBeforeRender(() => {
    //   // Update SpringBone
    //   vrmManager.update(scene.getEngine().getDeltaTime())
    // })

    if (onLoaded) onLoaded()

    // Model Transformation
    // vrmManager.rootMesh.translate(new BABYLON.Vector3(0, 1, 0), 2)
    makePose(vrmManager)
  })
}
