/**
 * @packageDocumentation
 * [Babylon.js](https://www.babylonjs.com/) 插件
 * @module plugins/plugin-babylon
 */
import type * as BABYLON from '@babylonjs/core'

export * from './camera'

export * from './light'
export * from './scene'
export * from './setup'
export * from './stores'

export * from './types'

export * from './vrm'

// eslint-disable-next-line unused-imports/no-unused-vars
declare interface Window {
  // extend the window
  babylon: {
    scene: BABYLON.Scene
    gizmoManager: BABYLON.GizmoManager
  }
}
