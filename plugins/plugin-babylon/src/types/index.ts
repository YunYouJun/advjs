import type * as BABYLON from '@babylonjs/core'
import type { HumanBonesType } from '../vrm/pose'
import type { MorphingPresetType } from '../vrm/ui'

export type PoseQuaternion = Record<HumanBonesType, BABYLON.Quaternion>

export type PoseEulerType = Record<HumanBonesType, {
  // degree
  x: number
  y: number
  z: number
}>

export type MorphingPresetData = {
  [key in MorphingPresetType]: number
}
