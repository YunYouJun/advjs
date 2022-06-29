import * as BABYLON from '@babylonjs/core'

export type RawVector3 = [number, number, number]
export type RawVector4 = [number, number, number, number]

export interface VRMPoseTransform {
  /**
     * Position of the transform.
     */
  position?: RawVector3
  /**
     * Rotation of the transform.
     * Note that it's a quaternion.
     */
  rotation?: RawVector4
}

export interface VRMPose {
  [boneName: string]: VRMPoseTransform | undefined
}

//
export const vRawPoseData: VRMPose = {
  spine: { rotation: BABYLON.Quaternion.FromEulerAngles(-Math.PI / 20, Math.PI / 20, 0).asArray() as RawVector4 },
  head: { rotation: BABYLON.Quaternion.FromEulerAngles(0, 0, -Math.PI / 30).asArray() as RawVector4 },
  leftShoulder: { rotation: BABYLON.Quaternion.FromEulerAngles(0, 0, Math.PI / 4).asArray() as RawVector4 },
  leftLowerArm: { rotation: BABYLON.Quaternion.FromEulerAngles(0, 0, Math.PI / 4).asArray() as RawVector4 },
  rightShoulder: { rotation: BABYLON.Quaternion.FromEulerAngles(0, Math.PI / 6, 0).asArray() as RawVector4 },
  rightUpperArm: { rotation: BABYLON.Quaternion.FromEulerAngles(0, Math.PI / 4, 0).asArray() as RawVector4 },
  rightLowerArm: { rotation: BABYLON.Quaternion.FromEulerAngles(0, Math.PI / 8, 0).asArray() as RawVector4 },
  rightHand: { rotation: BABYLON.Quaternion.FromEulerAngles(0, 0, Math.PI / 2).asArray() as RawVector4 },
  rightThumbProximal: { rotation: BABYLON.Quaternion.FromEulerAngles(-Math.PI / 8, -Math.PI / 4, 0).asArray() as RawVector4 },
  rightThumbIntermediate: { rotation: BABYLON.Quaternion.FromEulerAngles(-Math.PI / 4, 0, 0).asArray() as RawVector4 },
  rightIndexProximal: { rotation: BABYLON.Quaternion.FromEulerAngles(0, Math.PI / 12, 0).asArray() as RawVector4 },
  rightMiddleProximal: { rotation: BABYLON.Quaternion.FromEulerAngles(0, -Math.PI / 12, 0).asArray() as RawVector4 },
  rightRingProximal: { rotation: BABYLON.Quaternion.FromEulerAngles(0, 0, -Math.PI / 2).asArray() as RawVector4 },
  rightRingIntermediate: { rotation: BABYLON.Quaternion.FromEulerAngles(0, 0, -Math.PI / 2).asArray() as RawVector4 },
  rightLittleProximal: { rotation: BABYLON.Quaternion.FromEulerAngles(0, 0, -Math.PI / 2).asArray() as RawVector4 },
  rightLittleIntermediate: { rotation: BABYLON.Quaternion.FromEulerAngles(0, 0, -Math.PI / 2).asArray() as RawVector4 },
}
