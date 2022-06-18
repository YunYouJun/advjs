import type * as BABYLON from '@babylonjs/core'

declare interface Window {
  // extend the window
  babylon: {
    scene: BABYLON.Scene
    gizmoManager: BABYLON.GizmoManager
  }
}

// with vite-plugin-md, markdowns can be treat as Vue components
declare module '*.md' {
  import type { ComponentOptions } from 'vue'
  const component: ComponentOptions
  export default component
}

declare module '/@advjs/configs' {
  import { AdvConfig } from '@advjs/types'
  export default AdvConfig
}
