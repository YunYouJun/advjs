import * as BABYLON from '@babylonjs/core'
import type { VRMManager } from 'babylon-vrm-loader'
import { GridMaterial } from '@babylonjs/materials/Grid'
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
  camera.attachControl(engine.getRenderingCanvas, true)

  camera.viewport = new BABYLON.Viewport(0, 0, 1, 1)
  scene.activeCameras?.push(camera)

  camera.wheelDeltaPercentage = 0.01
  // todo: add dev
  camera.minZ = 0.1
  camera.lowerRadiusLimit = 1
  camera.upperRadiusLimit = 10

  // BABYLON.SceneLoader.Append('/assets/scenes/low_poly_winter_scene/', 'scene.gltf', scene)

  // Material
  const groundMaterial = new GridMaterial('groundMaterial', scene)
  groundMaterial.majorUnitFrequency = 5
  groundMaterial.minorUnitVisibility = 0.45
  groundMaterial.gridRatio = 0.5
  groundMaterial.backFaceCulling = false
  groundMaterial.mainColor = new BABYLON.Color3(1, 1, 1)
  groundMaterial.lineColor = new BABYLON.Color3(1.0, 1.0, 1.0)
  groundMaterial.opacity = 0.98

  // Ground
  const ground = BABYLON.MeshBuilder.CreatePlane('ground', {
    size: 10,
  }, scene)
  ground.position = new BABYLON.Vector3(0, 0, 0)
  ground.rotation = new BABYLON.Vector3(Math.PI / 2, 0, 0)
  ground.material = groundMaterial

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  // const light = new BABYLON.HemisphericLight('light', new BABYLON.Vector3(0, 1, 0), scene)

  // Lights
  const pointLight = new BABYLON.PointLight('pointLight', new BABYLON.Vector3(0, 2, 0), scene)
  pointLight.intensity = 1
  // pointLight.includedOnlyMeshes.push(ground)

  // Tone mapping
  // https://zhuanlan.zhihu.com/p/21983679
  scene.imageProcessingConfiguration.toneMappingEnabled = true
  scene.imageProcessingConfiguration.toneMappingType = BABYLON.ImageProcessingConfiguration.TONEMAPPING_ACES
  scene.imageProcessingConfiguration.exposure = 3

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

  // for vrm rotation
  // Create utility layer the gizmo will be rendered on
  const utilLayer = new BABYLON.UtilityLayerRenderer(scene)
  const gizmo = new BABYLON.RotationGizmo(utilLayer)

  // pick mesh by light cast
  // https://doc.babylonjs.com/divingDeeper/mesh/interactions/picking_collisions

  function onVRMLoaded() {
    const vrmManager = getVrmManager(scene)
    // scene.registerBeforeRender(() => {
    //   // Update SpringBone
    //   vrmManager.update(scene.getEngine().getDeltaTime())
    // })

    // Create the gizmo and attach to the box
    gizmo.attachedMesh = vrmManager.rootMesh
    // console.log(vrmManager.rootMesh)
    // console.log(vrmManager.humanoidBone.leftFoot.parent)

    // Keep the gizmo fixed to world rotation
    gizmo.updateGizmoRotationToMatchAttachedMesh = false
    gizmo.updateGizmoPositionToMatchAttachedMesh = true

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

      // gizmo.attachedMesh = manager.humanoidBone[boneName].parent
    })
  }

  loadVRM(onVRMLoaded)
}
