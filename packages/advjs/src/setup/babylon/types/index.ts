import type * as BABYLON from '@babylonjs/core'
import type { HumanBonesType } from '../vrm/poses'
import type { MorphingPresetType } from '../vrm/ui'

export type RawPoseData = Record<HumanBonesType, {
  x: number
  y: number
  z: number
}>

export type PoseQuaternion = Record<HumanBonesType, BABYLON.Quaternion>

export type MorphingPresetData = {
  [key in MorphingPresetType]: number
}
