import * as BABYLON from '@babylonjs/core'
import 'babylon-vrm-loader'
import type { HumanBoneName, VRMManager } from 'babylon-vrm-loader'
// import * as GUI from '@babylonjs/gui'

// https://doc.babylonjs.com/divingDeeper/scene/multiScenes
export function createVRMScene(engine: BABYLON.Engine) {
  const scene = new BABYLON.Scene(engine)
  scene.clearColor = new BABYLON.Color4(0, 0, 0, 0)
  scene.autoClear = false

  const camera = new BABYLON.ArcRotateCamera('camera', -1.6, 1.5, 2, new BABYLON.Vector3(0.4, 3.2, 0.75), scene)
  // todo: add dev
  camera.attachControl(engine.getRenderingCanvas, true)
  camera.minZ = 0.1

  // @ts-ignore
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const light = new BABYLON.HemisphericLight('light', new BABYLON.Vector3(0, 1, 0), scene)

  // BABYLON.SceneLoader.Append('/assets/scenes/low_poly_winter_scene/', 'scene.gltf', scene)

  createVRM(scene)

  // Return the created scene
  return scene
}

export function createVRM(scene: BABYLON.Scene) {
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
    const vrmManager = scene.metadata.vrmManagers[0] as VRMManager
    // scene.registerBeforeRender(() => {
    //   // Update SpringBone
    //   vrmManager.update(scene.getEngine().getDeltaTime())
    // })

    // Model Transformation
    vrmManager.rootMesh.translate(new BABYLON.Vector3(0, 1, 0), 2)

    // addUI(vrmManager)
    makePose(vrmManager)
  }

  // function addUI(manager: VRMManager) {
  //   const advancedTexture = GUI.AdvancedDynamicTexture.CreateFullscreenUI('UI')
  //   advancedTexture.layer!.layerMask = 2

  //   const panel3 = new GUI.StackPanel()
  //   panel3.width = '220px'
  //   panel3.fontSize = '14px'
  //   panel3.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT
  //   panel3.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_CENTER
  //   advancedTexture.addControl(panel3)

  //   function addSlider(text: string, callback: (num: number) => void, defaultValue = 0) {
  //     const header = new GUI.TextBlock()
  //     header.text = text
  //     header.height = '40px'
  //     header.color = 'white'
  //     header.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT
  //     panel3.addControl(header)

  //     const slider = new GUI.Slider()
  //     slider.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT
  //     slider.minimum = 0
  //     slider.maximum = 1
  //     slider.color = 'green'
  //     slider.value = defaultValue
  //     slider.height = '20px'
  //     slider.width = '200px'
  //     slider.onValueChangedObservable.add(callback)
  //     callback(defaultValue)
  //     panel3.addControl(slider)
  //   }

  //   addSlider('Joy:', (num) => { manager.morphingPreset('joy', num) }, 1)
  //   addSlider('Angry:', (num) => { manager.morphingPreset('angry', num) })
  //   addSlider('Sorrow:', (num) => { manager.morphingPreset('sorrow', num) })
  //   addSlider('Fun:', (num) => { manager.morphingPreset('fun', num) })
  //   addSlider('Blink:', (num) => { manager.morphingPreset('blink', num) })
  //   addSlider('A:', (num) => { manager.morphingPreset('a', num) }, 1)
  //   addSlider('I:', (num) => { manager.morphingPreset('i', num) })
  //   addSlider('U:', (num) => { manager.morphingPreset('u', num) })
  //   addSlider('E:', (num) => { manager.morphingPreset('e', num) })
  //   addSlider('O:', (num) => { manager.morphingPreset('o', num) })
  // }

  function makePose(manager: VRMManager) {
    const poses: {
      [key: HumanBoneName]: BABYLON.Quaternion
    } = {
      hips: BABYLON.Quaternion.FromEulerAngles(0, 0, 0),
      spine: BABYLON.Quaternion.FromEulerAngles(-Math.PI / 20, Math.PI / 20, 0),
      chest: BABYLON.Quaternion.FromEulerAngles(0, 0, 0),
      upperChest: BABYLON.Quaternion.FromEulerAngles(0, 0, 0),
      neck: BABYLON.Quaternion.FromEulerAngles(0, 0, 0),
      head: BABYLON.Quaternion.FromEulerAngles(0, 0, -Math.PI / 30),
      leftEye: BABYLON.Quaternion.FromEulerAngles(0, 0, 0),
      leftShoulder: BABYLON.Quaternion.FromEulerAngles(0, 0, Math.PI / 4),
      leftUpperArm: BABYLON.Quaternion.FromEulerAngles(0, 0, 0),
      leftLowerArm: BABYLON.Quaternion.FromEulerAngles(0, 0, Math.PI / 4),
      leftHand: BABYLON.Quaternion.FromEulerAngles(0, 0, 0),
      leftThumbProximal: BABYLON.Quaternion.FromEulerAngles(0, 0, 0),
      leftThumbIntermediate: BABYLON.Quaternion.FromEulerAngles(0, 0, 0),
      leftThumbDistal: BABYLON.Quaternion.FromEulerAngles(0, 0, 0),
      leftIndexProximal: BABYLON.Quaternion.FromEulerAngles(0, 0, 0),
      leftIndexIntermediate: BABYLON.Quaternion.FromEulerAngles(0, 0, 0),
      leftIndexDistal: BABYLON.Quaternion.FromEulerAngles(0, 0, 0),
      leftMiddleProximal: BABYLON.Quaternion.FromEulerAngles(0, 0, 0),
      leftMiddleIntermediate: BABYLON.Quaternion.FromEulerAngles(0, 0, 0),
      leftMiddleDistal: BABYLON.Quaternion.FromEulerAngles(0, 0, 0),
      leftRingProximal: BABYLON.Quaternion.FromEulerAngles(0, 0, 0),
      leftRingIntermediate: BABYLON.Quaternion.FromEulerAngles(0, 0, 0),
      leftRingDistal: BABYLON.Quaternion.FromEulerAngles(0, 0, 0),
      leftLittleProximal: BABYLON.Quaternion.FromEulerAngles(0, 0, 0),
      leftLittleIntermediate: BABYLON.Quaternion.FromEulerAngles(0, 0, 0),
      leftLittleDistal: BABYLON.Quaternion.FromEulerAngles(0, 0, 0),
      leftUpperLeg: BABYLON.Quaternion.FromEulerAngles(0, 0, 0),
      leftLowerLeg: BABYLON.Quaternion.FromEulerAngles(0, 0, 0),
      leftFoot: BABYLON.Quaternion.FromEulerAngles(0, 0, 0),
      leftToe: BABYLON.Quaternion.FromEulerAngles(0, 0, 0),
      rightEye: BABYLON.Quaternion.FromEulerAngles(0, 0, 0),
      rightShoulder: BABYLON.Quaternion.FromEulerAngles(0, Math.PI / 6, 0),
      rightUpperArm: BABYLON.Quaternion.FromEulerAngles(0, Math.PI / 4, 0),
      rightLowerArm: BABYLON.Quaternion.FromEulerAngles(0, Math.PI / 8, 0),
      rightHand: BABYLON.Quaternion.FromEulerAngles(0, 0, Math.PI / 2),
      rightThumbProximal: BABYLON.Quaternion.FromEulerAngles(-Math.PI / 8, -Math.PI / 4, 0),
      rightThumbIntermediate: BABYLON.Quaternion.FromEulerAngles(-Math.PI / 4, 0, 0),
      rightThumbDistal: BABYLON.Quaternion.FromEulerAngles(0, 0, 0),
      rightIndexProximal: BABYLON.Quaternion.FromEulerAngles(0, Math.PI / 12, 0),
      rightIndexIntermediate: BABYLON.Quaternion.FromEulerAngles(0, 0, 0),
      rightIndexDistal: BABYLON.Quaternion.FromEulerAngles(0, 0, 0),
      rightMiddleProximal: BABYLON.Quaternion.FromEulerAngles(0, -Math.PI / 12, 0),
      rightMiddleIntermediate: BABYLON.Quaternion.FromEulerAngles(0, 0, 0),
      rightMiddleDistal: BABYLON.Quaternion.FromEulerAngles(0, 0, 0),
      rightRingProximal: BABYLON.Quaternion.FromEulerAngles(0, 0, -Math.PI / 2),
      rightRingIntermediate: BABYLON.Quaternion.FromEulerAngles(0, 0, -Math.PI / 2),
      rightRingDistal: BABYLON.Quaternion.FromEulerAngles(0, 0, 0),
      rightLittleProximal: BABYLON.Quaternion.FromEulerAngles(0, 0, -Math.PI / 2),
      rightLittleIntermediate: BABYLON.Quaternion.FromEulerAngles(0, 0, -Math.PI / 2),
      rightLittleDistal: BABYLON.Quaternion.FromEulerAngles(0, 0, 0),
      rightUpperLeg: BABYLON.Quaternion.FromEulerAngles(0, 0, 0),
      rightLowerLeg: BABYLON.Quaternion.FromEulerAngles(0, 0, 0),
      rightFoot: BABYLON.Quaternion.FromEulerAngles(0, 0, 0),
      rightToe: BABYLON.Quaternion.FromEulerAngles(0, 0, 0),
    }

    Object.keys(poses).forEach((boneName: HumanBoneName) => {
      if (!manager.humanoidBone[boneName])
        return

      manager.humanoidBone[boneName].rotationQuaternion = poses[boneName]
    })
  }

  loadVRM(onVRMLoaded)
}
