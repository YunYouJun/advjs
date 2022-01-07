import type * as BABYLON from '@babylonjs/core'
import type { HumanBoneName } from 'babylon-vrm-loader'
import type { MorphingPresetType } from '../vrm/ui'

export interface RawPoseData {
  [key: HumanBoneName]: {
    x: number
    y: number
    z: number
  }
}

export interface PoseQuaternion {
  [key: HumanBoneName]: BABYLON.Quaternion
}

export type MorphingPresetData = {
  [key in MorphingPresetType]: number
}
