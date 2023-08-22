import type * as BABYLON from '@babylonjs/core'

declare interface Window {
  // extend the window
  scene: BABYLON.Scene
  engine: BABYLON.Engine
  gizmoManager: BABYLON.GizmoManager
}

// with unplugin-vue-markdown, markdowns can be treat as Vue components
declare module '*.md' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}
