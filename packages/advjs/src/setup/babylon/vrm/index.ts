import * as BABYLON from '@babylonjs/core'
import type { VRMManager } from 'babylon-vrm-loader'
import type { RawPoseData } from '../types'
import type { HumanBonesType } from './poses'
import { defaultPoseQuaternion } from './poses'
import { v2RawPoseData } from './poseData'

export function getVrmManager(scene: BABYLON.Scene) {
  const vrmManager = scene.metadata.vrmManagers[0] as VRMManager
  return vrmManager
}

// https://doc.babylonjs.com/divingDeeper/scene/multiScenes
export function createVRMScene(engine: BABYLON.Engine, onVRMLoaded?: () => void) {
  const scene = new BABYLON.Scene(engine)
  scene.clearColor = new BABYLON.Color4(0, 0, 0, 0)
  scene.autoClear = false

  // const camera = new BABYLON.ArcRotateCamera('camera', -1.6, 1.5, 2, new BABYLON.Vector3(0.4, 3.2, 0.75), scene)
  const camera = new BABYLON.ArcRotateCamera('camera', -Math.PI / 2, Math.PI / 2, 2, new BABYLON.Vector3(0, 1, 0), scene)
  // todo: add dev
  camera.attachControl(engine.getRenderingCanvas, true)
  camera.minZ = 0.1
  camera.lowerRadiusLimit = 1
  camera.upperRadiusLimit = 10

  // @ts-expect-error do not need used
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const light = new BABYLON.HemisphericLight('light', new BABYLON.Vector3(0, 1, 0), scene)

  // BABYLON.SceneLoader.Append('/assets/scenes/low_poly_winter_scene/', 'scene.gltf', scene)

  createVRM(scene, onVRMLoaded)

  // Return the created scene
  return scene
}

export function createVRM(scene: BABYLON.Scene, onLoaded?: () => void) {
  function loadVRM(callback: () => void) {
    BABYLON.SceneLoader.Append(
      '/assets/vrms/',
      // 'alicia-solid.vrm',
      'xiao-yun.vrm',
      scene,
      callback,
    )
  }

  function onVRMLoaded() {
    const vrmManager = getVrmManager(scene)
    // scene.registerBeforeRender(() => {
    //   // Update SpringBone
    //   vrmManager.update(scene.getEngine().getDeltaTime())
    // })

    if (onLoaded) onLoaded()

    // Model Transformation
    // vrmManager.rootMesh.translate(new BABYLON.Vector3(0, 1, 0), 2)
    makePose(vrmManager)
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

  loadVRM(onVRMLoaded)
}
