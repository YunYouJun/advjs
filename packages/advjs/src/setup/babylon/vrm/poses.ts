import * as BABYLON from '@babylonjs/core'
// import type { HumanBoneName } from 'babylon-vrm-loader'
import type { PoseQuaternion } from '../types'

export const ZeroQuaternion = BABYLON.Quaternion.FromEulerAngles(0, 0, 0)

// extra is jaw?
// https://docs.unity.cn/550/Documentation/ScriptReference/HumanBodyBones.html
// 人体骨骼
export const HumanBones = [
  'hips',
  'leftUpperLeg',
  'rightUpperLeg',
  'leftLowerLeg',
  'rightLowerLeg',
  'leftFoot',
  'rightFoot',
  'spine',
  'chest',
  'neck',
  'head',
  'leftShoulder',
  'rightShoulder',
  'leftUpperArm',
  'rightUpperArm',
  'leftLowerArm',
  'rightLowerArm',
  'leftHand',
  'rightHand',
  'leftToes',
  'rightToes',
  'leftEye',
  'rightEye',
  'jaw',
  'leftThumbProximal',
  'leftThumbIntermediate',
  'leftThumbDistal',
  'leftIndexProximal',
  'leftIndexIntermediate',
  'leftIndexDistal',
  'leftMiddleProximal',
  'leftMiddleIntermediate',
  'leftMiddleDistal',
  'leftRingProximal',
  'leftRingIntermediate',
  'leftRingDistal',
  'leftLittleProximal',
  'leftLittleIntermediate',
  'leftLittleDistal',
  'rightThumbProximal',
  'rightThumbIntermediate',
  'rightThumbDistal',
  'rightIndexProximal',
  'rightIndexIntermediate',
  'rightIndexDistal',
  'rightMiddleProximal',
  'rightMiddleIntermediate',
  'rightMiddleDistal',
  'rightRingProximal',
  'rightRingIntermediate',
  'rightRingDistal',
  'rightLittleProximal',
  'rightLittleIntermediate',
  'rightLittleDistal',
  'upperChest',
] as const

export type HumanBonesType = typeof HumanBones[number]

const defaultPoseQuaternion: PoseQuaternion = {}
// set every bone to zero quaternion
HumanBones.forEach((bone) => {
  defaultPoseQuaternion[bone] = ZeroQuaternion
})

export { defaultPoseQuaternion }
